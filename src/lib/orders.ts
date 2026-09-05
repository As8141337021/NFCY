import 'server-only';
import type { Prisma, PrismaClient } from '@prisma/client';
import { db } from './db';
import { invoiceNumber, nfcCode, cardSerial, activationCode } from './ids';
import { notify } from './notify';
import { rupees, splitInclusiveTax } from './money';
import bcrypt from 'bcryptjs';

export const ORDER_FLOW = [
  'PAYMENT_RECEIVED',
  'PROFILE_PENDING',
  'PROFILE_COMPLETED',
  'DESIGN_PROCESSING',
  'MANUFACTURING',
  'DISPATCHED',
  'DELIVERED',
  'ACTIVATED',
] as const;

export const ORDER_LABEL: Record<string, string> = {
  PAYMENT_PENDING: 'Waiting for payment',
  PAYMENT_RECEIVED: 'Payment received',
  PROFILE_PENDING: 'Waiting on your profile',
  PROFILE_COMPLETED: 'Profile ready',
  DESIGN_PROCESSING: 'In design',
  MANUFACTURING: 'Being made',
  DISPATCHED: 'On its way',
  DELIVERED: 'Delivered',
  ACTIVATED: 'Active',
  CANCELLED: 'Cancelled',
};

export const ORDER_BLURB: Record<string, string> = {
  PAYMENT_PENDING: 'We have your details. The order starts the moment payment goes through.',
  PAYMENT_RECEIVED: 'Payment is in. Next we make sure your profile is ready.',
  PROFILE_PENDING: 'Your card needs a profile to point at. Build yours and this moves on by itself.',
  PROFILE_COMPLETED: 'Your profile is ready, so your card can be made.',
  DESIGN_PROCESSING: 'We are laying out your card.',
  MANUFACTURING: 'Your card is being printed and chipped.',
  DISPATCHED: 'It has left us. Tracking is below.',
  DELIVERED: 'It arrived. One step left: activate it.',
  ACTIVATED: 'Your card is live and pointed at your profile.',
  CANCELLED: 'This order was cancelled.',
};

/** Order numbers are allocated inside the transaction that creates the order. */
export async function allocateOrderNumber(tx: Prisma.TransactionClient): Promise<string> {
  const year = new Date().getFullYear();
  const from = new Date(Date.UTC(year, 0, 1));
  const count = await tx.order.count({ where: { createdAt: { gte: from } } });
  return `CT-${year}-${String(count + 1).padStart(6, '0')}`;
}

export async function allocateInvoiceNumber(tx: Prisma.TransactionClient): Promise<string> {
  const now = new Date();
  const fyStart = new Date(Date.UTC(now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1, 3, 1));
  const count = await tx.invoice.count({ where: { issuedAt: { gte: fyStart } } });
  return invoiceNumber(count + 1, now);
}

/**
 * Everything that must happen exactly once when money actually arrives.
 * Called from the webhook and from the browser's return trip, and safe to call
 * repeatedly: it checks the order's own state before doing anything.
 */
export async function markOrderPaid(input: {
  orderId: string;
  gatewayPaymentId: string;
  method?: string | null;
  amountMinor: number;
}): Promise<{ changed: boolean }> {
  return db.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: input.orderId },
      include: { payments: true, invoice: true, items: { include: { product: true } } },
    });
    if (!order) return { changed: false };

    // already paid: nothing to do, however many times this is called
    if (order.paidAt) return { changed: false };

    await tx.payment.updateMany({
      where: { orderId: order.id, status: { in: ['PENDING', 'FAILED'] } },
      data: {
        status: 'SUCCESSFUL',
        gatewayPaymentId: input.gatewayPaymentId,
        method: input.method ?? null,
        failureReason: null,
      },
    });

    // a card cannot be made until there is a profile for it to point at
    const needsProfile = order.items.some(
      (i) => i.product && i.product.kind !== 'RENEWAL' && i.product.destinationType === 'PROFILE',
    );
    const hasProfile = order.userId
      ? (await tx.profile.count({ where: { userId: order.userId } })) > 0
      : false;

    const nextStatus = needsProfile && !hasProfile ? 'PROFILE_PENDING' : 'PAYMENT_RECEIVED';

    await tx.order.update({
      where: { id: order.id },
      data: { status: nextStatus, paidAt: new Date() },
    });

    await tx.orderStatusEvent.create({
      data: { orderId: order.id, status: nextStatus, note: 'Payment confirmed by the gateway.' },
    });

    if (!order.invoice) {
      const { taxMinor } = splitInclusiveTax(order.totalMinor, 18);
      await tx.invoice.create({
        data: {
          invoiceNumber: await allocateInvoiceNumber(tx),
          orderId: order.id,
          totalMinor: order.totalMinor,
          taxMinor,
          gstNumber: order.gstNumber,
        },
      });
    }

    if (order.couponId) {
      await tx.coupon.update({ where: { id: order.couponId }, data: { usageCount: { increment: 1 } } });
    }

    // stock only moves once money has actually arrived
    for (const item of order.items) {
      if (item.product?.trackStock) {
        await tx.product.update({
          where: { id: item.product.id },
          data: { stock: { decrement: item.quantity } },
        });
      }
    }

    return { changed: true };
  });
}

export async function markPaymentFailed(orderId: string, reason: string) {
  const order = await db.order.findUnique({ where: { id: orderId }, select: { paidAt: true } });
  if (!order || order.paidAt) return; // a later success must never be undone by a stale failure
  await db.payment.updateMany({
    where: { orderId, status: 'PENDING' },
    data: { status: 'FAILED', failureReason: reason.slice(0, 300) },
  });
}

/**
 * A renewal buys another year. Called after a renewal order is paid.
 * Extending from the later of today and the current expiry means renewing early
 * never costs the customer the days they already paid for.
 */
export async function applyRenewal(userId: string, orderId: string, priceMinor: number) {
  const existing = await db.subscription.findFirst({
    where: { userId },
    orderBy: { expiresAt: 'desc' },
  });

  const base = existing && existing.expiresAt > new Date() ? existing.expiresAt : new Date();
  const expiresAt = new Date(base);
  expiresAt.setFullYear(expiresAt.getFullYear() + 1);

  if (existing) {
    await db.subscription.update({
      where: { id: existing.id },
      data: { expiresAt, status: 'ACTIVE', orderId, remindersSent: [] },
    });
  } else {
    await db.subscription.create({
      data: { userId, orderId, priceMinor, expiresAt, status: 'ACTIVE' },
    });
  }

  // a paused profile comes straight back
  await db.profile.updateMany({
    where: { userId, status: 'RENEWAL_REQUIRED' },
    data: { status: 'PUBLISHED' },
  });

  return expiresAt;
}

/**
 * Runs once, the first time an order becomes paid, whoever confirmed it.
 * Lives here rather than in a route file because Next only allows route
 * handlers to be exported from a route module.
 */
/**
 * Mint the physical cards for a paid order.
 *
 * One card per unit, so a line for three cards produces three. Each gets its
 * own short code, and the code is all the chip ever holds: the destination
 * lives in this database, so a customer can change their number, their profile
 * or even where the card points, and the card in someone's wallet follows. A
 * card is never reprogrammed and never reprinted.
 *
 * Runs at payment, not at manufacture, so the code, the URL and the QR all
 * exist before anything goes to the printer. Idempotent: a webhook that
 * arrives twice does not mint a second set.
 */
export async function mintCardsForOrder(orderId: string): Promise<number> {
  return mintCards(orderId, false);
}

/**
 * The same, for an order that has not been paid for.
 *
 * Only reached when a member of staff deliberately moves a cash on delivery
 * order into production. Kept as a separate, awkwardly named entry point so it
 * can never be called by accident from the ordinary payment path.
 */
export async function mintCardsForOrderUnpaid(orderId: string): Promise<number> {
  return mintCards(orderId, true);
}

async function mintCards(orderId: string, allowUnpaid: boolean): Promise<number> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { items: { include: { product: true, cards: { select: { id: true } } } } },
  });
  if (!order) return 0;
  if (!order.paidAt && !allowUnpaid) return 0;

  let made = 0;

  for (const item of order.items) {
    // a renewal is a subscription, not a thing that gets posted
    if (!item.product || item.product.kind === 'RENEWAL') continue;

    const wanted = item.quantity - item.cards.length;
    if (wanted <= 0) continue;

    for (let n = 0; n < wanted; n++) {
      // a collision on code or serial is astronomically unlikely; if one
      // happens, try again rather than losing the card
      for (let attempt = 0; attempt < 5; attempt++) {
        const plain = activationCode();
        try {
          await db.nfcCard.create({
            data: {
              code: nfcCode(),
              serial: cardSerial(),
              activationHash: await bcrypt.hash(plain, 12),
              productId: item.productId,
              userId: order.userId,
              orderItemId: item.id,
              destinationType: item.product.destinationType,
              status: 'ASSIGNED',
              assignedAt: new Date(),
              batch: `ORD-${order.orderNumber}`,
            },
          });
          made++;
          break;
        } catch {
          if (attempt === 4) throw new Error(`could not mint a card for order ${order.orderNumber}`);
        }
      }
    }
  }

  if (made > 0) {
    await db.orderStatusEvent.create({
      data: {
        orderId: order.id,
        status: order.status,
        note: `${made} card${made === 1 ? '' : 's'} created and ready for production.`,
      },
    });
  }

  return made;
}

export async function afterPayment(orderId: string) {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { items: { include: { product: true } } },
  });
  if (!order) return;

  // the cards exist the moment the money lands, so production has the code,
  // the URL and the QR without anyone having to assign anything by hand
  await mintCardsForOrder(orderId);

  const renewalItem = order.items.find((i) => i.product?.kind === 'RENEWAL');
  if (renewalItem && order.userId) {
    const expiresAt = await applyRenewal(order.userId, order.id, renewalItem.unitMinor);
    await notify({
      template: 'renewal_successful',
      to: order.customerEmail,
      userId: order.userId,
      vars: {
        name: order.customerName.split(' ')[0],
        expiresOn: expiresAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }),
      },
      dedupeKey: `renewed:${order.id}`,
    });
  }

  await notify({
    template: 'payment_received',
    to: order.customerEmail,
    userId: order.userId,
    vars: {
      name: order.customerName.split(' ')[0],
      orderNumber: order.orderNumber,
      orderId: order.id,
      total: rupees(order.totalMinor),
    },
    dedupeKey: `paid:${order.id}`,
  });
}
