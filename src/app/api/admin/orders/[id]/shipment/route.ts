import { db } from '@/lib/db';
import { handler, ok, readJson } from '@/lib/api';
import { shipmentSchema } from '@/lib/validate';
import { requireStaff, HttpError } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { notify } from '@/lib/notify';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

export const PUT = handler(async (req, ctx: Ctx) => {
  const staff = await requireStaff('orders.ship');
  const { id } = await ctx.params;
  const input = await readJson(req, shipmentSchema);

  const order = await db.order.findUnique({
    where: { id },
    include: { shipment: true, user: { select: { id: true } } },
  });
  if (!order) throw new HttpError(404, 'No such order.', 'not_found');
  if (!order.paidAt) throw new HttpError(409, 'This order has not been paid for yet.', 'not_paid');

  const dispatchedAt = input.status === 'PENDING' ? null : (order.shipment?.dispatchedAt ?? new Date());
  const data = {
    courier: input.courier,
    awb: input.awb,
    trackingUrl: input.trackingUrl || null,
    status: input.status,
    estimatedDelivery: input.estimatedDelivery ? new Date(input.estimatedDelivery) : null,
    dispatchedAt,
    deliveredAt: input.status === 'DELIVERED' ? (order.shipment?.deliveredAt ?? new Date()) : null,
  };

  const shipment = order.shipment
    ? await db.shipment.update({ where: { orderId: id }, data })
    : await db.shipment.create({ data: { ...data, orderId: id } });

  // moving the order along with the parcel, so staff never have to do it twice
  if (input.status === 'DISPATCHED' && order.status !== 'DISPATCHED' && order.status !== 'DELIVERED' && order.status !== 'ACTIVATED') {
    await db.order.update({ where: { id }, data: { status: 'DISPATCHED' } });
    await db.orderStatusEvent.create({
      data: { orderId: id, status: 'DISPATCHED', note: `${input.courier} ${input.awb}`, actorId: staff.id },
    });
    await notify({
      template: 'card_dispatched',
      to: order.customerEmail,
      userId: order.user?.id ?? null,
      vars: {
        name: order.customerName.split(' ')[0],
        orderNumber: order.orderNumber,
        courier: input.courier,
        awb: input.awb,
        trackingUrl: input.trackingUrl ?? '',
      },
      dedupeKey: `dispatched:${order.id}:${input.awb}`,
    });
  }

  if (input.status === 'DELIVERED' && order.status !== 'DELIVERED' && order.status !== 'ACTIVATED') {
    await db.order.update({ where: { id }, data: { status: 'DELIVERED' } });
    await db.orderStatusEvent.create({
      data: { orderId: id, status: 'DELIVERED', note: 'Marked delivered.', actorId: staff.id },
    });
  }

  await audit({
    userId: staff.id,
    action: 'order.shipment_updated',
    entityType: 'Order',
    entityId: id,
    after: { courier: input.courier, awb: input.awb, status: input.status },
  });

  return ok({ shipment });
});
