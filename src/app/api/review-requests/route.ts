import { db } from '@/lib/db';
import { handler, ok, readJson, rateLimit, clientKey } from '@/lib/api';
import { requireUser, HttpError } from '@/lib/auth';
import { reviewRequestSchema } from '@/lib/validate';
import { safeCode } from '@/lib/ids';
import { env } from '@/lib/env';
import { track } from '@/lib/analytics';

export const runtime = 'nodejs';

/**
 * Records that a customer was asked for a review, and hands back the link to
 * send them.
 *
 * The platform writes nothing and posts nothing. The link goes to the
 * business's own Google review page; whether the customer writes anything is
 * between them and Google, and this is deliberate — a review a business wrote
 * for itself is worthless to a reader and against Google's rules.
 */
export const POST = handler(async (req) => {
  const user = await requireUser();
  await rateLimit(clientKey(req, 'review-request'), 120, 3600);
  await rateLimit(`review-request-user:${user.id}`, 300, 86400);

  const input = await readJson(req, reviewRequestSchema);

  const profile = await db.profile.findFirst({
    where: { id: input.profileId, userId: user.id },
    select: { id: true },
  });
  if (!profile) throw new HttpError(404, 'That profile is not yours.', 'not_found');

  const business = await db.business.findFirst({
    where: { id: input.businessId, profileId: profile.id },
    select: { id: true, name: true, googleReviewUrl: true },
  });
  if (!business) throw new HttpError(404, 'That business is not on this profile.', 'not_found');
  if (!business.googleReviewUrl) {
    throw new HttpError(
      422,
      `Add the Google review link for ${business.name} first, on the Business tab. Without it there is nowhere to send anyone.`,
      'no_review_url',
    );
  }

  const row = await db.reviewRequest.create({
    data: {
      profileId: profile.id,
      businessId: business.id,
      customerName: input.customerName,
      phone: input.phone || null,
      token: safeCode(10),
      channel: input.channel,
    },
  });

  await track(req, { profileId: profile.id, type: 'REVIEW_REQUEST_SENT', label: business.name });

  return ok({
    id: row.id,
    link: `${env.appUrl}/r/${row.token}`,
    customerName: row.customerName,
  });
});
