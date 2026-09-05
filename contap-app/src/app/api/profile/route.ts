import { db } from '@/lib/db';
import { handler, ok, readJson, rateLimit, clientKey } from '@/lib/api';
import { createProfileSchema } from '@/lib/validate';
import { requireUser, HttpError } from '@/lib/auth';
import { usernameTaken, suggestUsernames } from '@/lib/profile';
import { mayCreateProfile } from '@/lib/entitlement';

export const runtime = 'nodejs';

/** Creates a profile. A customer gets one; staff and organisations can hold more. */
export const POST = handler(async (req) => {
  const user = await requireUser();
  await rateLimit(clientKey(req, 'profile-create'), 12, 3600);

  // A profile is the thing a card opens. Without a card there is no way in and
  // no QR to print, so buying one comes first. The card is minted at payment,
  // so this unlocks the moment the money lands, not when the post arrives.
  if (!(await mayCreateProfile(user))) {
    throw new HttpError(
      403,
      'Your profile is created along with your card. Order a card and you can build it straight away, while it is still being printed.',
      'card_required',
    );
  }

  const input = await readJson(req, createProfileSchema);

  if (await usernameTaken(input.username)) {
    const suggestions = await suggestUsernames(input.username);
    throw new HttpError(
      409,
      `${input.username} is taken. ${suggestions.length ? `Try ${suggestions.join(', ')}.` : 'Try another one.'}`,
      'username_taken',
    );
  }

  const mine = await db.profile.count({ where: { userId: user.id } });
  if (mine >= 10) {
    throw new HttpError(409, 'You already have ten profiles. Contact us if you need more.', 'limit');
  }

  const profile = await db.profile.create({
    data: {
      username: input.username,
      userId: user.id,
      organizationId: user.organizationId,
      fullName: input.fullName,
      designation: input.designation ?? null,
      company: input.company ?? null,
      email: user.email,
      status: 'DRAFT',
    },
  });

  return ok({ id: profile.id, username: profile.username });
});

export const GET = handler(async () => {
  const user = await requireUser();
  const profiles = await db.profile.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'asc' },
    select: { id: true, username: true, fullName: true, status: true, createdAt: true },
  });
  return ok({ profiles });
});
