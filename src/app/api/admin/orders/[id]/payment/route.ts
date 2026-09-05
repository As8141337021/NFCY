import { db } from '@/lib/db';
import { handler, ok, readJson } from '@/lib/api';
import { offlinePaymentSchema } from '@/lib/validate';
import { requireStaff, HttpError } from '@/lib/auth';
import { markOrderPaid, afterPayment } from '@/lib/orders';
import { audit } from '@/lib/audit';

export const runtime = 'nodejs';

const METHOD_LABEL: Record<string, string> = {
  cash: 'cash',
  upi: 'UPI',
  bank_transfer: 'a bank transfer',
  card_machine: 'a card machine',
  cheque: 'a cheque',
  other: 'another method',
};

/**
 * Records a payment that was taken outside the gateway.
 *
 * Most sales in a shop are not made through Razorpay: somebody pays cash, or
 * sends UPI, or transfers to the bank. Without this the order could never move
 * and the cards would never be made, because the only route to "paid" was the
 * gateway webhook.
 *
 * This is not the frontend claiming a payment happened. It is a named member
 * of staff, with the orders.update permission, recording money they saw
 * arrive, and it is written to the audit log with their name against it.
 * It then runs exactly the same code the webhook runs, so the cards, the
 * invoice and the subscription all come out identical.
 */
export const POST = handler(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const staff = await requireStaff('orders.update');
  const { id } = await ctx.params;
  const input = await readJson(req, offlinePaymentSchema);

  const order = await db.order.findUnique({
    where: { id },
    select: { id: true, orderNumber: true, totalMinor: true, paidAt: true, status: true },
  });
  if (!order) throw new HttpError(404, 'No such order.', 'not_found');
  if (order.status === 'CANCELLED') {
    throw new HttpError(409, 'That order was cancelled. Reinstate it before taking payment.', 'cancelled');
  }
  if (order.paidAt) {
    throw new HttpError(409, 'That order is already paid for.', 'already_paid');
  }

  const { changed } = await markOrderPaid({
    orderId: order.id,
    gatewayPaymentId: `offline:${input.method}:${input.reference || 'no reference'}`,
    method: input.method,
    amountMinor: order.totalMinor,
  });

  if (!changed) throw new HttpError(409, 'That order is already paid for.', 'already_paid');

  // the same work the gateway path does: mint the cards, send the receipt
  await afterPayment(order.id);

  await db.orderStatusEvent.create({
    data: {
      orderId: order.id,
      status: 'PAYMENT_RECEIVED',
      note: `Payment taken by ${METHOD_LABEL[input.method]}${input.reference ? `, reference ${input.reference}` : ''}, recorded by ${staff.name}.${input.note ? ` ${input.note}` : ''}`,
      actorId: staff.id,
    },
  });

  await audit({
    userId: staff.id,
    action: 'order.payment_recorded_offline',
    entityType: 'Order',
    entityId: order.id,
    after: { method: input.method, reference: input.reference ?? null, amountMinor: order.totalMinor },
  });

  const fresh = await db.order.findUnique({ where: { id }, select: { status: true, paidAt: true } });
  return ok({ status: fresh?.status, paidAt: fresh?.paidAt });
});
