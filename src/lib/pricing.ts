import 'server-only';
import type { Coupon, Product } from '@prisma/client';
import { db } from './db';
import { HttpError } from './auth';
import { splitInclusiveTax } from './money';

export type CartLine = {
  productId: string;
  quantity: number;
  customization?: unknown;
};

export type PricedLine = {
  productId: string;
  productName: string;
  productSku: string;
  unitMinor: number;
  quantity: number;
  totalMinor: number;
  taxPercent: number;
  customization?: unknown;
};

export type PricedCart = {
  lines: PricedLine[];
  subtotalMinor: number;
  discountMinor: number;
  shippingMinor: number;
  taxMinor: number;
  totalMinor: number;
  coupon: { id: string; code: string } | null;
  couponMessage?: string;
};

/**
 * The only place a cart total is ever calculated.
 * Prices come from the database every time. Nothing about money is read from
 * the request body, so a tampered client cannot change what is charged.
 */
export async function priceCart(input: {
  items: CartLine[];
  couponCode?: string | null;
  userId?: string | null;
}): Promise<PricedCart> {
  if (!input.items.length) throw new HttpError(400, 'Your cart is empty.', 'empty_cart');

  const ids = [...new Set(input.items.map((i) => i.productId))];
  const products = await db.product.findMany({ where: { id: { in: ids } } });
  const byId = new Map(products.map((p) => [p.id, p]));

  const lines: PricedLine[] = [];
  for (const item of input.items) {
    const p = byId.get(item.productId);
    if (!p) throw new HttpError(404, 'One of those products is no longer available.', 'product_missing');
    if (p.status !== 'ACTIVE') {
      throw new HttpError(409, `${p.name} is not available right now.`, 'product_unavailable');
    }
    if (p.trackStock && p.stock < item.quantity) {
      throw new HttpError(409, `Only ${p.stock} of ${p.name} left in stock.`, 'out_of_stock');
    }
    lines.push({
      productId: p.id,
      productName: p.name,
      productSku: p.sku,
      unitMinor: p.priceMinor,
      quantity: item.quantity,
      totalMinor: p.priceMinor * item.quantity,
      taxPercent: p.taxPercent,
      customization: item.customization ?? null,
    });
  }

  const subtotalMinor = lines.reduce((n, l) => n + l.totalMinor, 0);

  let discountMinor = 0;
  let coupon: { id: string; code: string } | null = null;
  let couponMessage: string | undefined;

  if (input.couponCode) {
    const result = await applyCoupon(input.couponCode, lines, subtotalMinor, input.userId ?? null);
    if (result.ok) {
      discountMinor = result.discountMinor;
      coupon = { id: result.coupon.id, code: result.coupon.code };
    } else {
      couponMessage = result.reason;
    }
  }

  const shippingMinor = await shippingFor(subtotalMinor - discountMinor);
  const totalMinor = Math.max(0, subtotalMinor - discountMinor + shippingMinor);

  // Displayed prices already include GST, so the tax is split back out of the total.
  const weightedRate = lines.length
    ? lines.reduce((n, l) => n + l.taxPercent * l.totalMinor, 0) / Math.max(1, subtotalMinor)
    : 18;
  const { taxMinor } = splitInclusiveTax(totalMinor, Math.round(weightedRate));

  return { lines, subtotalMinor, discountMinor, shippingMinor, taxMinor, totalMinor, coupon, couponMessage };
}

async function shippingFor(payableMinor: number): Promise<number> {
  const flat = await db.setting.findUnique({ where: { key: 'shipping.flatRateMinor' } });
  const freeAbove = await db.setting.findUnique({ where: { key: 'shipping.freeAboveMinor' } });
  const flatMinor = Number(flat?.value ?? 0);
  const threshold = Number(freeAbove?.value ?? 0);
  if (flatMinor <= 0) return 0;
  if (threshold > 0 && payableMinor >= threshold) return 0;
  return flatMinor;
}

type CouponResult =
  | { ok: true; coupon: Coupon; discountMinor: number }
  | { ok: false; reason: string };

export async function applyCoupon(
  code: string,
  lines: PricedLine[],
  subtotalMinor: number,
  userId: string | null,
): Promise<CouponResult> {
  const coupon = await db.coupon.findUnique({
    where: { code: code.trim().toUpperCase() },
    include: { products: { select: { id: true } } },
  });

  if (!coupon || !coupon.active) return { ok: false, reason: 'That coupon code is not valid.' };

  const now = new Date();
  if (coupon.startsAt && coupon.startsAt > now) return { ok: false, reason: 'That coupon is not active yet.' };
  if (coupon.expiresAt && coupon.expiresAt < now) return { ok: false, reason: 'That coupon has expired.' };
  if (coupon.usageLimit !== null && coupon.usageCount >= coupon.usageLimit) {
    return { ok: false, reason: 'That coupon has been fully used.' };
  }

  const quantity = lines.reduce((n, l) => n + l.quantity, 0);
  if (quantity < coupon.minQuantity) {
    return { ok: false, reason: `That coupon needs at least ${coupon.minQuantity} cards.` };
  }

  // A product specific coupon only discounts the lines it names.
  const scopedIds = coupon.products.map((p) => p.id);
  const eligible = scopedIds.length ? lines.filter((l) => scopedIds.includes(l.productId)) : lines;
  const eligibleMinor = eligible.reduce((n, l) => n + l.totalMinor, 0);

  if (eligibleMinor === 0) return { ok: false, reason: 'That coupon does not apply to these products.' };
  if (subtotalMinor < coupon.minOrderMinor) {
    return { ok: false, reason: `That coupon needs an order of at least ₹${Math.round(coupon.minOrderMinor / 100)}.` };
  }

  if (userId) {
    if (coupon.firstOrderOnly) {
      const previous = await db.order.count({
        where: { userId, status: { notIn: ['PAYMENT_PENDING', 'CANCELLED'] } },
      });
      if (previous > 0) return { ok: false, reason: 'That coupon is for a first order only.' };
    }
    if (coupon.perUserLimit !== null) {
      const used = await db.order.count({
        where: { userId, couponId: coupon.id, status: { notIn: ['PAYMENT_PENDING', 'CANCELLED'] } },
      });
      if (used >= coupon.perUserLimit) return { ok: false, reason: 'You have already used that coupon.' };
    }
  }

  let discountMinor =
    coupon.type === 'PERCENT' ? Math.floor((eligibleMinor * coupon.value) / 100) : Math.min(coupon.value, eligibleMinor);

  if (coupon.maxDiscountMinor !== null) discountMinor = Math.min(discountMinor, coupon.maxDiscountMinor);
  discountMinor = Math.min(discountMinor, subtotalMinor);

  if (discountMinor <= 0) return { ok: false, reason: 'That coupon gives no discount on this order.' };

  return { ok: true, coupon: coupon as Coupon, discountMinor };
}

/** Next order number, allocated inside the same transaction that creates the order. */
export async function nextOrderNumber(tx: { order: { count: (a?: unknown) => Promise<number> } }): Promise<string> {
  const year = new Date().getFullYear();
  const count = await tx.order.count({
    where: { createdAt: { gte: new Date(`${year}-01-01T00:00:00.000Z`) } },
  } as never);
  return `CT-${year}-${String(count + 1).padStart(6, '0')}`;
}

export function productNeedsProfile(p: Pick<Product, 'destinationType' | 'kind'>): boolean {
  return p.kind !== 'RENEWAL' && p.destinationType === 'PROFILE';
}
