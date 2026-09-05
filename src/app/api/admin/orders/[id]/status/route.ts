import { db } from '@/lib/db';
import { handler, ok, readJson } from '@/lib/api';
import { adminOrderStatusSchema } from '@/lib/validate';
import { requireStaff, HttpError } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { notify } from '@/lib/notify';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

export const POST = handler(async (req, ctx: Ctx) => {
  const staff = await requireStaff('orders.update');
  const { id } = await ctx.params;
  const input = await readJson(req, adminOrderStatusSchema);

  const order = await db.order.findUnique({
    where: { id },
    include: { shipment: true, user: { select: { id: true, email: true, name: true } } },
  });
  if (!order) throw new HttpError(404, 'No such order.', 'not_found');

  // An unpaid order cannot be pushed down the line: that is how stock walks out
  // of the door for free.
  const paidStates = ['PAYMENT_RECEIVED', 'PROFILE_PENDING', 'PROFILE_COMPLETED', 'DESIGN_PROCESSING', 'MANUFACTURING', 'DISPATCHED', 'DELIVERED', 'ACTIVATED'];
  if (!order.paidAt && paidStates.includes(input.status)) {
    throw new HttpError(
      409,
      'This order has not been paid for. Take payment first, or cancel it.',
      'not_paid',
    );
  }
  if (input.status === 'DISPATCHED' && !order.shipment?.awb) {
    throw new HttpError(409, 'Add the courier and tracking number before marking it dispatched.', 'no_shipment');
  }

  const updated = await db.order.update({ where: { id }, data: { status: input.status } });
  await db.orderStatusEvent.create({
    data: { orderId: id, status: input.status, note: input.note ?? null, actorId: staff.id },
  });

  await audit({
    userId: staff.id,
    action: 'order.status_changed',
    entityType: 'Order',
    entityId: id,
    before: { status: order.status },
    after: { status: input.status },
  });

  if (input.status === 'DELIVERED' && order.user) {
    await notify({
      template: 'card_delivered',
      to: order.customerEmail,
      userId: order.user.id,
      vars: { name: order.customerName.split(' ')[0], orderNumber: order.orderNumber },
      dedupeKey: `delivered:${order.id}`,
    });
  }

  return ok({ status: updated.status });
});
