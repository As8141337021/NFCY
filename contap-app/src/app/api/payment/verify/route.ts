import { db } from '@/lib/db';
import { handler, ok, readJson, rateLimit, clientKey } from '@/lib/api';
import { verifyPaymentSchema } from '@/lib/validate';
import { HttpError } from '@/lib/auth';
import { verifyCheckoutSignature, fetchPayment } from '@/lib/razorpay';
import { markOrderPaid, afterPayment } from '@/lib/orders';

export const runtime = 'nodejs';

/**
 * The browser's return trip after checkout.
 *
 * This is a convenience so the customer sees their confirmation immediately.
 * It is NOT the source of truth. Two things have to agree before an order is
 * marked paid: the signature, which proves the message came from Razorpay, and
 * a fresh call to Razorpay asking what actually happened to that payment. The
 * webhook does the same work independently, and whichever arrives first wins
 * without the other doing any harm.
 */
export const POST = handler(async (req) => {
  await rateLimit(clientKey(req, 'verify'), 40, 900);
  const input = await readJson(req, verifyPaymentSchema);

  const signatureOk = verifyCheckoutSignature(
    input.razorpay_order_id,
    input.razorpay_payment_id,
    input.razorpay_signature,
  );
  if (!signatureOk) {
    throw new HttpError(400, 'We could not verify that payment. Nothing has been charged twice.', 'bad_signature');
  }

  const payment = await db.payment.findUnique({
    where: { gatewayOrderId: input.razorpay_order_id },
    include: { order: { include: { items: { include: { product: true } } } } },
  });
  if (!payment) throw new HttpError(404, 'We do not have a record of that payment.', 'not_found');

  // ask the gateway what really happened, rather than believing the browser
  const gatewayPayment = await fetchPayment(input.razorpay_payment_id);

  if (gatewayPayment.order_id !== input.razorpay_order_id) {
    throw new HttpError(400, 'That payment belongs to a different order.', 'mismatch');
  }
  if (gatewayPayment.amount !== payment.amountMinor) {
    // the amount is checked because it is the one thing worth tampering with
    console.error('[payment] amount mismatch', { expected: payment.amountMinor, got: gatewayPayment.amount });
    throw new HttpError(400, 'That payment amount does not match the order.', 'amount_mismatch');
  }

  if (gatewayPayment.status !== 'captured' && gatewayPayment.status !== 'authorized') {
    return ok({ paid: false, status: gatewayPayment.status, orderId: payment.orderId });
  }

  const { changed } = await markOrderPaid({
    orderId: payment.orderId,
    gatewayPaymentId: gatewayPayment.id,
    method: gatewayPayment.method ?? null,
    amountMinor: gatewayPayment.amount,
  });

  if (changed) await afterPayment(payment.orderId);

  const order = await db.order.findUniqueOrThrow({
    where: { id: payment.orderId },
    select: { id: true, orderNumber: true, status: true, totalMinor: true },
  });

  return ok({ paid: true, orderId: order.id, orderNumber: order.orderNumber, status: order.status });
});
