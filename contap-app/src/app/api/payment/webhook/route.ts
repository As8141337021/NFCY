import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyWebhookSignature } from '@/lib/razorpay';
import { markOrderPaid, markPaymentFailed, afterPayment } from '@/lib/orders';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The authoritative payment channel.
 *
 * Three rules hold here, and they are the whole reason this endpoint exists:
 *   1. Nothing is trusted until the HMAC over the RAW body matches.
 *   2. Every event id is recorded, so a replayed or duplicated delivery
 *      changes nothing the second time.
 *   3. It always answers 200 once the signature is good. Razorpay retries on
 *      any other status, and retrying a message we already handled is noise.
 */
export async function POST(req: Request) {
  // the signature is over the exact bytes, so the body is read as text first
  const raw = await req.text();
  const signature = req.headers.get('x-razorpay-signature') ?? '';

  if (!verifyWebhookSignature(raw, signature)) {
    console.warn('[webhook] rejected: bad signature');
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  let body: {
    event?: string;
    payload?: {
      payment?: { entity?: { id?: string; order_id?: string; status?: string; method?: string; amount?: number; error_description?: string } };
      refund?: { entity?: { id?: string; payment_id?: string; amount?: number } };
    };
  };
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const eventType = body.event ?? 'unknown';
  // Razorpay sends its own delivery id; falling back to the payload keeps the
  // dedupe working even if that header is ever missing.
  const eventId =
    req.headers.get('x-razorpay-event-id') ??
    `${eventType}:${body.payload?.payment?.entity?.id ?? body.payload?.refund?.entity?.id ?? raw.length}`;

  // the replay guard: a unique index means the second delivery loses the race
  try {
    await db.webhookEvent.create({
      data: { gateway: 'razorpay', eventId, eventType, payload: body as never },
    });
  } catch {
    console.log('[webhook] already handled', eventId);
    return NextResponse.json({ ok: true, duplicate: true });
  }

  try {
    if (eventType === 'payment.captured' || eventType === 'payment.authorized') {
      const e = body.payload?.payment?.entity;
      if (e?.order_id && e.id) {
        const payment = await db.payment.findUnique({ where: { gatewayOrderId: e.order_id } });
        if (payment) {
          if (typeof e.amount === 'number' && e.amount !== payment.amountMinor) {
            console.error('[webhook] amount mismatch', { expected: payment.amountMinor, got: e.amount });
          } else {
            const { changed } = await markOrderPaid({
              orderId: payment.orderId,
              gatewayPaymentId: e.id,
              method: e.method ?? null,
              amountMinor: e.amount ?? payment.amountMinor,
            });
            await db.payment.update({
              where: { id: payment.id },
              data: { webhookEventIds: { push: eventId } },
            });
            if (changed) await afterPayment(payment.orderId);
          }
        }
      }
    } else if (eventType === 'payment.failed') {
      const e = body.payload?.payment?.entity;
      if (e?.order_id) {
        const payment = await db.payment.findUnique({ where: { gatewayOrderId: e.order_id } });
        if (payment) await markPaymentFailed(payment.orderId, e.error_description ?? 'The payment failed.');
      }
    } else if (eventType === 'refund.processed' || eventType === 'refund.created') {
      const r = body.payload?.refund?.entity;
      if (r?.payment_id && typeof r.amount === 'number') {
        const payment = await db.payment.findUnique({ where: { gatewayPaymentId: r.payment_id } });
        if (payment) {
          const refunded = payment.refundedMinor + r.amount;
          await db.payment.update({
            where: { id: payment.id },
            data: {
              refundedMinor: refunded,
              status: refunded >= payment.amountMinor ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
              webhookEventIds: { push: eventId },
            },
          });
        }
      }
    }
  } catch (e) {
    // The event is recorded, so a crash here must not make Razorpay retry
    // forever. It is logged loudly instead, for a human to look at.
    console.error('[webhook] handler failed', eventType, e);
  }

  return NextResponse.json({ ok: true });
}
