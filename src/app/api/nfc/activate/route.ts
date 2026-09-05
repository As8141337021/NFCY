import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { handler, ok, readJson, rateLimit, clientKey } from '@/lib/api';
import { activateCardSchema } from '@/lib/validate';
import { requireUser, HttpError } from '@/lib/auth';
import { profileUrl } from '@/lib/qr';
import { notify } from '@/lib/notify';
import { audit } from '@/lib/audit';

export const runtime = 'nodejs';

/**
 * The customer connects the card in their hand to their profile.
 *
 * They give the serial printed on the card and the activation code that came
 * with it. The code is stored hashed, so a database leak does not hand anyone
 * a way to hijack cards, and it is checked with a slow hash so guessing costs
 * real time. Rate limits sit on top of both.
 */
export const POST = handler(async (req) => {
  const user = await requireUser();
  await rateLimit(clientKey(req, 'activate-ip'), 20, 900);
  await rateLimit(`activate-user:${user.id}`, 15, 900);

  const input = await readJson(req, activateCardSchema);

  const profile = await db.profile.findUnique({
    where: { id: input.profileId },
    select: { id: true, userId: true, username: true, status: true },
  });
  if (!profile || profile.userId !== user.id) {
    throw new HttpError(404, 'That profile is not yours.', 'not_found');
  }

  const card = await db.nfcCard.findUnique({
    where: { serial: input.serial },
    include: { product: { select: { name: true, destinationType: true } } },
  });

  // one message whether the serial is wrong or the code is wrong, so this
  // cannot be used to work out which serials exist
  const wrong = () =>
    new HttpError(400, 'That card number and activation code do not match. Check both and try again.', 'bad_activation');

  if (!card) {
    // still spend the time a real check would, so a miss cannot be timed
    await bcrypt.compare(input.activationCode ?? '', '$2a$12$0000000000000000000000000000000000000000000000000000');
    throw wrong();
  }

  // A card minted for this order already belongs to this account, so signing
  // in is the proof. Nothing was ever printed for them to type.
  const isOwnCard = card.userId !== null && card.userId === user.id;

  if (!isOwnCard) {
    if (!input.activationCode) throw wrong();
    const codeOk = await bcrypt.compare(input.activationCode.toUpperCase(), card.activationHash);
    if (!codeOk) throw wrong();
  } else if (input.activationCode) {
    // they typed one anyway; it still has to be right
    const codeOk = await bcrypt.compare(input.activationCode.toUpperCase(), card.activationHash);
    if (!codeOk) throw wrong();
  }

  if (card.status === 'LOST' || card.status === 'REPLACED') {
    throw new HttpError(409, 'That card has been switched off and cannot be activated.', 'card_disabled');
  }
  if (card.status === 'ACTIVE' && card.userId && card.userId !== user.id) {
    throw new HttpError(409, 'That card is already active on another account.', 'already_active');
  }

  const activated = await db.nfcCard.update({
    where: { id: card.id },
    data: {
      userId: user.id,
      profileId: profile.id,
      destinationType: card.product?.destinationType ?? 'PROFILE',
      status: 'ACTIVE',
      activatedAt: card.activatedAt ?? new Date(),
      assignedAt: card.assignedAt ?? new Date(),
    },
  });

  // a card arriving means the order is done
  if (card.orderItemId) {
    const item = await db.orderItem.findUnique({ where: { id: card.orderItemId }, select: { orderId: true } });
    if (item) {
      const order = await db.order.findUnique({ where: { id: item.orderId }, select: { status: true } });
      if (order && order.status !== 'ACTIVATED' && order.status !== 'CANCELLED') {
        await db.order.update({ where: { id: item.orderId }, data: { status: 'ACTIVATED' } });
        await db.orderStatusEvent.create({
          data: { orderId: item.orderId, status: 'ACTIVATED', note: `Card ${activated.serial} activated by the customer.` },
        });
      }
    }
  }

  // the first activated card starts the subscription year
  const existingSub = await db.subscription.findFirst({ where: { userId: user.id } });
  if (!existingSub) {
    const renewalProduct = await db.product.findFirst({ where: { kind: 'RENEWAL' }, select: { priceMinor: true } });
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    await db.subscription.create({
      data: {
        userId: user.id,
        priceMinor: renewalProduct?.priceMinor ?? 29900,
        expiresAt,
        status: 'ACTIVE',
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

  await audit({
    userId: user.id,
    action: 'card.activated',
    entityType: 'NfcCard',
    entityId: activated.id,
    after: { profileId: profile.id, serial: activated.serial },
  });

  await notify({
    template: 'card_activated',
    to: user.email,
    userId: user.id,
    vars: { name: user.name.split(' ')[0], serial: activated.serial, url: profileUrl(profile.username) },
    dedupeKey: `activated:${activated.id}`,
  });

  return ok({
    activated: true,
    serial: activated.serial,
    tapUrl: `/t/${activated.code}`,
    profileUrl: profileUrl(profile.username),
  });
});
