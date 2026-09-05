import { db } from '@/lib/db';
import { handler, ok } from '@/lib/api';
import { requireStaff, HttpError } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { notify } from '@/lib/notify';
import { profileUrl } from '@/lib/qr';

export const runtime = 'nodejs';

/**
 * Activates this order's cards against the customer's profile, and publishes
 * the profile so the cards are not dead links.
 *
 * The customer can do this themselves from their dashboard, and normally will.
 * This is for when they cannot: a card handed over the counter, somebody who
 * does not want to sign in, or a support call. Same outcome, written to the
 * audit log with the staff member's name on it.
 */
export const POST = handler(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const staff = await requireStaff('orders.update');
  const { id } = await ctx.params;

  const order = await db.order.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, email: true, name: true } },
      items: { include: { cards: true } },
    },
  });
  if (!order) throw new HttpError(404, 'No such order.', 'not_found');
  if (!order.paidAt) {
    throw new HttpError(409, 'Take the payment first. An unpaid order has no cards to activate.', 'not_paid');
  }
  if (!order.user) {
    throw new HttpError(
      409,
      'This order was placed without an account, so there is no profile to point the card at. The customer needs to sign up with the same email first.',
      'no_account',
    );
  }

  const profile = await db.profile.findFirst({
    where: { userId: order.user.id },
    orderBy: { createdAt: 'asc' },
    select: { id: true, username: true, status: true },
  });
  if (!profile) {
    throw new HttpError(
      409,
      `${order.customerName} has not built a profile yet. The card has nothing to open until they do.`,
      'no_profile',
    );
  }

  const cards = order.items.flatMap((i) => i.cards).filter((c) => c.status === 'ASSIGNED' || c.status === 'UNASSIGNED');
  if (cards.length === 0) {
    throw new HttpError(409, 'Every card on this order is already active.', 'already_active');
  }

  for (const card of cards) {
    await db.nfcCard.update({
      where: { id: card.id },
      data: {
        userId: order.user.id,
        profileId: profile.id,
        status: 'ACTIVE',
        activatedAt: card.activatedAt ?? new Date(),
        assignedAt: card.assignedAt ?? new Date(),
      },
    });
  }

  // a card pointing at a draft is a dead link, so activating publishes it
  if (profile.status === 'DRAFT') {
    await db.profile.update({
      where: { id: profile.id },
      data: { status: 'PUBLISHED', publishedAt: new Date() },
    });
  }

  // the first activated card starts the subscription year
  const existing = await db.subscription.findFirst({ where: { userId: order.user.id } });
  if (!existing) {
    const renewal = await db.product.findFirst({ where: { kind: 'RENEWAL' }, select: { priceMinor: true } });
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    await db.subscription.create({
      data: { userId: order.user.id, priceMinor: renewal?.priceMinor ?? 29900, expiresAt, status: 'ACTIVE' },
    });
  }

  if (order.status !== 'ACTIVATED') {
    await db.order.update({ where: { id }, data: { status: 'ACTIVATED' } });
  }
  await db.orderStatusEvent.create({
    data: {
      orderId: id,
      status: 'ACTIVATED',
      note: `${cards.length} card${cards.length === 1 ? '' : 's'} activated on /${profile.username} by ${staff.name}.`,
      actorId: staff.id,
    },
  });

  await audit({
    userId: staff.id,
    action: 'card.activated_by_staff',
    entityType: 'Order',
    entityId: id,
    after: { profileId: profile.id, serials: cards.map((c) => c.serial) },
  });

  await notify({
    template: 'card_activated',
    to: order.user.email,
    userId: order.user.id,
    vars: {
      name: order.user.name.split(' ')[0],
      serial: cards[0].serial,
      url: profileUrl(profile.username),
    },
    dedupeKey: `activated:${cards[0].id}`,
  });

  return ok({
    activated: cards.length,
    username: profile.username,
    published: true,
  });
});
