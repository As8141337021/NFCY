import { db } from '@/lib/db';
import { handler, ok, readJson } from '@/lib/api';
import { cardDestinationSchema } from '@/lib/validate';
import { requireUser, HttpError } from '@/lib/auth';
import { audit } from '@/lib/audit';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

/**
 * Repointing a card the customer already owns.
 *
 * This is the whole promise of the product: the chip is never touched, only the
 * row it resolves to. A Google Review card can be aimed at a new listing and an
 * Instagram card at a different handle, from a phone, in seconds.
 */
export const PATCH = handler(async (req, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;

  const card = await db.nfcCard.findUnique({ where: { id } });
  if (!card || card.userId !== user.id) {
    throw new HttpError(404, 'That card is not on your account.', 'not_found');
  }
  if (card.status === 'LOST' || card.status === 'REPLACED') {
    throw new HttpError(409, 'That card is switched off. Ask us for a replacement.', 'card_disabled');
  }

  const input = await readJson(req, cardDestinationSchema);

  if (input.destinationType === 'PROFILE') {
    if (!input.profileId) throw new HttpError(422, 'Choose which profile this card should open.', 'validation');
    const profile = await db.profile.findUnique({ where: { id: input.profileId }, select: { userId: true } });
    if (!profile || profile.userId !== user.id) {
      throw new HttpError(404, 'That profile is not yours.', 'not_found');
    }
  } else if (!input.destinationUrl) {
    throw new HttpError(422, 'Add the link this card should open.', 'validation');
  }

  const updated = await db.nfcCard.update({
    where: { id },
    data: {
      destinationType: input.destinationType,
      destinationUrl: input.destinationType === 'PROFILE' ? null : (input.destinationUrl ?? null),
      profileId: input.destinationType === 'PROFILE' ? (input.profileId ?? null) : card.profileId,
    },
  });

  await audit({
    userId: user.id,
    action: 'card.repointed',
    entityType: 'NfcCard',
    entityId: id,
    before: { destinationType: card.destinationType, destinationUrl: card.destinationUrl },
    after: { destinationType: updated.destinationType, destinationUrl: updated.destinationUrl },
  });

  return ok({
    id: updated.id,
    destinationType: updated.destinationType,
    destinationUrl: updated.destinationUrl,
    profileId: updated.profileId,
  });
});

/** Switching off a lost card. It stops resolving immediately. */
export const DELETE = handler(async (_req, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;

  const card = await db.nfcCard.findUnique({ where: { id } });
  if (!card || card.userId !== user.id) {
    throw new HttpError(404, 'That card is not on your account.', 'not_found');
  }

  await db.nfcCard.update({ where: { id }, data: { status: 'LOST' } });
  await audit({ userId: user.id, action: 'card.reported_lost', entityType: 'NfcCard', entityId: id });

  return ok({ status: 'LOST' });
});
