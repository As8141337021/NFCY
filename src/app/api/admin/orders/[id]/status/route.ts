import { db } from '@/lib/db';
import { handler, ok, readJson } from '@/lib/api';
import { adminOrderStatusSchema } from '@/lib/validate';
import { requireStaff, HttpError } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { notify } from '@/lib/notify';
import { mintCardsForOrderUnpaid } from '@/lib/orders';

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

  // Moving an unpaid order forward is how stock walks out of the door for
  // free, so it is never the default. But cash on delivery is ordinary here:
  // the card is made and posted, and the money is collected at the door. So it
  // is allowed when a member of staff asks for it deliberately, and the fact
  // that they did is written down.
  const paidStates = ['PAYMENT_RECEIVED', 'PROFILE_PENDING', 'PROFILE_COMPLETED', 'DESIGN_PROCESSING', 'MANUFACTURING', 'DISPATCHED', 'DELIVERED', 'ACTIVATED'];
  const movingUnpaid = !order.paidAt && paidStates.includes(input.status);

  if (movingUnpaid && !input.allowUnpaid) {
    throw new HttpError(
      409,
      'This order has not been paid for. Record the payment, or tick the box to move it anyway.',
      'not_paid',
    );
  }
  // A card cannot be posted before it exists. On a cash on delivery order
  // nothing was minted at payment, so mint it here.
  if (movingUnpaid && ['DESIGN_PROCESSING', 'MANUFACTURING', 'DISPATCHED', 'DELIVERED', 'ACTIVATED'].includes(input.status)) {
    const made = await mintCardsForOrderUnpaid(id);
    if (made > 0) {
      await db.orderStatusEvent.create({
        data: {
          orderId: id,
          status: input.status,
          note: `${made} card${made === 1 ? '' : 's'} created for an unpaid order, so production can start.`,
          actorId: staff.id,
        },
      });
    }
  }

  if (input.status === 'DISPATCHED' && !order.shipment?.awb) {
    throw new HttpError(409, 'Add the courier and tracking number before marking it dispatched.', 'no_shipment');
  }

  const updated = await db.order.update({ where: { id }, data: { status: input.status } });
  await db.orderStatusEvent.create({
    data: {
      orderId: id,
      status: input.status,
      note: movingUnpaid
        ? `Moved while still unpaid by ${staff.name}. Money is still owed on this order.${input.note ? ` ${input.note}` : ''}`
        : input.note ?? null,
      actorId: staff.id,
    },
  });

  await audit({
    userId: staff.id,
    action: movingUnpaid ? 'order.status_changed_while_unpaid' : 'order.status_changed',
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
