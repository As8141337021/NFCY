import { db } from '@/lib/db';
import { handler, ok, rateLimit, clientKey } from '@/lib/api';
import { requireUser, HttpError } from '@/lib/auth';
import { allocateOrderNumber } from '@/lib/orders';
import { createGatewayOrder } from '@/lib/razorpay';
import { env } from '@/lib/env';
import { splitInclusiveTax } from '@/lib/money';

export const runtime = 'nodejs';

/**
 * Buying another year.
 *
 * Nothing is shipped, so this skips the address step entirely. The price comes
 * from the renewal product in the database, so changing it in the admin panel
 * changes it here with no deploy.
 */
export const POST = handler(async (req) => {
  const user = await requireUser();
  await rateLimit(`renewal:${user.id}`, 10, 900);

  const product = await db.product.findFirst({ where: { kind: 'RENEWAL', status: 'ACTIVE' } });
  if (!product) {
    throw new HttpError(503, 'Renewals are not available right now. Please message us.', 'no_renewal_product');
  }

  const body = (await req.json().catch(() => ({}))) as { idempotencyKey?: string };
  const key = typeof body.idempotencyKey === 'string' && body.idempotencyKey.length >= 8 ? body.idempotencyKey : null;

  if (key) {
    const existing = await db.order.findUnique({
      where: { idempotencyKey: key },
      include: { payments: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    if (existing && existing.userId === user.id) {
      return ok({
        orderId: existing.id,
        orderNumber: existing.orderNumber,
        amountMinor: existing.totalMinor,
        gatewayOrderId: existing.payments[0]?.gatewayOrderId ?? null,
        keyId: env.razorpay.keyId,
        reused: true,
      });
    }
  }

  const dbUser = await db.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { name: true, email: true, phone: true },
  });

  const totalMinor = product.priceMinor;
  const { taxMinor } = splitInclusiveTax(totalMinor, product.taxPercent);
  const noAddress = { line1: 'Not applicable', city: 'Not applicable', state: 'Not applicable', pincode: '000000', country: 'India' };

  const order = await db.$transaction(async (tx) =>
    tx.order.create({
      data: {
        orderNumber: await allocateOrderNumber(tx),
        userId: user.id,
        status: 'PAYMENT_PENDING',
        customerName: dbUser.name,
        customerEmail: dbUser.email,
        customerPhone: dbUser.phone ?? '0000000000',
        billingAddress: noAddress as never,
        shippingAddress: noAddress as never,
        subtotalMinor: totalMinor,
        taxMinor,
        totalMinor,
        idempotencyKey: key,
        notes: 'Profile renewal, one year.',
        items: {
          create: {
            productId: product.id,
            productName: product.name,
            productSku: product.sku,
            unitMinor: product.priceMinor,
            quantity: 1,
            totalMinor,
          },
        },
        statusEvents: { create: { status: 'PAYMENT_PENDING', note: 'Renewal started.' } },
      },
    }),
  );

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
    notes: { orderId: order.id, kind: 'renewal' },
  });

  await db.payment.create({
    data: {
      orderId: order.id,
      gatewayOrderId: gateway.id,
      amountMinor: order.totalMinor,
      status: 'PENDING',
    },
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
