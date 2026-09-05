import { db } from '@/lib/db';
import { handler, ok, readJson, rateLimit, clientKey } from '@/lib/api';
import { checkoutSchema } from '@/lib/validate';
import { currentUser, HttpError } from '@/lib/auth';
import { priceCart } from '@/lib/pricing';
import { allocateOrderNumber } from '@/lib/orders';
import { env } from '@/lib/env';
import { createGatewayOrder } from '@/lib/razorpay';
import { notify } from '@/lib/notify';
import { rupees } from '@/lib/money';

export const runtime = 'nodejs';

/**
 * Creates an order and its gateway order in one shot.
 *
 * Everything about money is computed here from the database. The request body
 * carries what the customer wants, never what it costs.
 *
 * The idempotency key makes a double click, a flaky network or a retried
 * request return the SAME order instead of creating a second one.
 */
export const POST = handler(async (req) => {
  await rateLimit(clientKey(req, 'checkout'), 20, 900);

  const user = await currentUser();
  const input = await readJson(req, checkoutSchema);

  // the same key always returns the same order, so a retry is free
  const existing = await db.order.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
    include: { payments: { orderBy: { createdAt: 'desc' }, take: 1 } },
  });

  if (existing) {
    if (existing.userId && (!user || existing.userId !== user.id)) {
      throw new HttpError(403, 'That order belongs to another account.', 'forbidden');
    }
    return ok({
      orderId: existing.id,
      orderNumber: existing.orderNumber,
      amountMinor: existing.totalMinor,
      gatewayOrderId: existing.payments[0]?.gatewayOrderId ?? null,
      keyId: env.razorpay.keyId,
      reused: true,
    });
  }

  const priced = await priceCart({
    items: input.items,
    couponCode: input.couponCode ?? null,
    userId: user?.id ?? null,
  });

  if (input.couponCode && !priced.coupon) {
    throw new HttpError(422, priced.couponMessage ?? 'That coupon could not be applied.', 'coupon');
  }
  if (priced.totalMinor <= 0) {
    throw new HttpError(422, 'That order comes to nothing. Please check your cart.', 'zero_total');
  }

  const order = await db.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        orderNumber: await allocateOrderNumber(tx),
        userId: user?.id ?? null,
        organizationId: user?.organizationId ?? null,
        status: 'PAYMENT_PENDING',
        customerName: input.customerName,
        customerEmail: input.customerEmail,
        customerPhone: input.customerPhone,
        companyName: input.companyName || null,
        gstNumber: input.gstNumber || null,
        billingAddress: input.billingAddress as never,
        shippingAddress: input.shippingAddress as never,
        subtotalMinor: priced.subtotalMinor,
        discountMinor: priced.discountMinor,
        shippingMinor: priced.shippingMinor,
        taxMinor: priced.taxMinor,
        totalMinor: priced.totalMinor,
        couponId: priced.coupon?.id ?? null,
        couponCode: priced.coupon?.code ?? null,
        notes: input.notes || null,
        idempotencyKey: input.idempotencyKey,
        items: {
          create: priced.lines.map((l) => ({
            productId: l.productId,
            productName: l.productName,
            productSku: l.productSku,
            unitMinor: l.unitMinor,
            quantity: l.quantity,
            totalMinor: l.totalMinor,
            customization: (l.customization ?? undefined) as never,
          })),
        },
        statusEvents: { create: { status: 'PAYMENT_PENDING', note: 'Order created.' } },
      },
      include: { items: true },
    });
    return created;
  });

  // no gateway keys yet: the order stands, and the customer is told plainly
  if (!env.razorpay.configured) {
    return ok({
      orderId: order.id,
      orderNumber: order.orderNumber,
      amountMinor: order.totalMinor,
      gatewayOrderId: null,
      keyId: null,
      paymentsDisabled: true,
      reused: false,
    });
  }

  const gateway = await createGatewayOrder({
    amountMinor: order.totalMinor,
    receipt: order.orderNumber,
    notes: { orderId: order.id, orderNumber: order.orderNumber },
  });

  await db.payment.create({
    data: {
      orderId: order.id,
      gateway: 'razorpay',
      gatewayOrderId: gateway.id,
      amountMinor: order.totalMinor,
      status: 'PENDING',
    },
  });

  await notify({
    template: 'order_confirmed',
    to: order.customerEmail,
    userId: order.userId,
    vars: {
      name: order.customerName.split(' ')[0],
      orderNumber: order.orderNumber,
      orderId: order.id,
      total: rupees(order.totalMinor),
    },
    dedupeKey: `order_confirmed:${order.id}`,
  });

  return ok({
    orderId: order.id,
    orderNumber: order.orderNumber,
    amountMinor: order.totalMinor,
    gatewayOrderId: gateway.id,
    keyId: env.razorpay.keyId,
    reused: false,
  });
});

/** The signed in customer's own orders. */
export const GET = handler(async () => {
  const user = await currentUser();
  if (!user) throw new HttpError(401, 'Please sign in to see your orders.', 'unauthenticated');

  const orders = await db.order.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    include: { items: true, shipment: true, invoice: true },
    take: 100,
  });

  return ok({ orders });
});
