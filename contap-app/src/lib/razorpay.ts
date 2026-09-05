import 'server-only';
import crypto from 'node:crypto';
import { env } from './env';
import { HttpError } from './auth';

const API = 'https://api.razorpay.com/v1';

function authHeader(): string {
  const { keyId, keySecret } = env.razorpay;
  if (!keyId || !keySecret) {
    throw new HttpError(
      503,
      'Payments are not switched on yet. Add your Razorpay keys to the environment.',
      'razorpay_not_configured',
    );
  }
  return 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64');
}

export type RazorpayOrder = { id: string; amount: number; currency: string; status: string; receipt?: string };

/**
 * Creates the gateway order. `receipt` carries our own order number so a payment
 * can always be traced back, and Razorpay treats an identical receipt as the
 * same order, which is a second layer of idempotency under our own.
 */
export async function createGatewayOrder(input: {
  amountMinor: number;
  receipt: string;
  notes?: Record<string, string>;
}): Promise<RazorpayOrder> {
  const res = await fetch(`${API}/orders`, {
    method: 'POST',
    headers: { authorization: authHeader(), 'content-type': 'application/json' },
    body: JSON.stringify({
      amount: input.amountMinor,
      currency: 'INR',
      receipt: input.receipt.slice(0, 40),
      notes: input.notes ?? {},
      payment_capture: 1,
    }),
  });

  const body = (await res.json().catch(() => ({}))) as Record<string, unknown> & {
    error?: { description?: string };
  };

  if (!res.ok) {
    console.error('[razorpay] order create failed', res.status, body);
    throw new HttpError(502, body?.error?.description ?? 'The payment gateway rejected that order.', 'gateway');
  }
  return body as unknown as RazorpayOrder;
}

/**
 * The signature the browser hands back after checkout.
 * This is a useful first check, but it is NOT what marks an order paid: the
 * webhook and the fetched payment state do that, on the server.
 */
export function verifyCheckoutSignature(orderId: string, paymentId: string, signature: string): boolean {
  const { keySecret } = env.razorpay;
  if (!keySecret) return false;
  const expected = crypto.createHmac('sha256', keySecret).update(`${orderId}|${paymentId}`).digest('hex');
  return timingSafeHexEqual(expected, signature);
}

export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const secret = env.razorpay.webhookSecret;
  if (!secret) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return timingSafeHexEqual(expected, signature);
}

function timingSafeHexEqual(a: string, b: string): boolean {
  if (typeof b !== 'string' || a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
  } catch {
    return false;
  }
}

export type RazorpayPayment = {
  id: string;
  order_id: string;
  status: 'created' | 'authorized' | 'captured' | 'refunded' | 'failed';
  amount: number;
  amount_refunded: number;
  method?: string;
  error_description?: string;
};

/** The authority on whether money actually moved. Asked directly, never inferred. */
export async function fetchPayment(paymentId: string): Promise<RazorpayPayment> {
  const res = await fetch(`${API}/payments/${encodeURIComponent(paymentId)}`, {
    headers: { authorization: authHeader() },
    cache: 'no-store',
  });
  if (!res.ok) {
    console.error('[razorpay] payment fetch failed', res.status);
    throw new HttpError(502, 'We could not confirm that payment with the gateway.', 'gateway');
  }
  return (await res.json()) as RazorpayPayment;
}

export async function refundPayment(paymentId: string, amountMinor?: number) {
  const res = await fetch(`${API}/payments/${encodeURIComponent(paymentId)}/refund`, {
    method: 'POST',
    headers: { authorization: authHeader(), 'content-type': 'application/json' },
    body: JSON.stringify(amountMinor ? { amount: amountMinor } : {}),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error('[razorpay] refund failed', res.status, body);
    throw new HttpError(502, 'The refund could not be created.', 'gateway');
  }
  return res.json();
}
