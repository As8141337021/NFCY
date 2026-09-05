import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { track, looksLikeBot } from '@/lib/analytics';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * A customer opening the review link they were sent.
 *
 * This counts the open and forwards to the business's own Google review page.
 * It is the only thing the platform does here: it cannot know whether a review
 * was written, and it deliberately does not pretend to.
 */
export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;

  const request = await db.reviewRequest.findUnique({
    where: { token },
    include: { business: { select: { googleReviewUrl: true, name: true } } },
  });

  if (!request?.business?.googleReviewUrl) {
    return NextResponse.redirect(`${env.appUrl}/tap?state=unknown`, 302);
  }

  if (!looksLikeBot(req.headers.get('user-agent') ?? '')) {
    await db.reviewRequest
      .update({
        where: { id: request.id },
        data: { openCount: { increment: 1 }, openedAt: request.openedAt ?? new Date() },
      })
      .catch(() => {});
    await track(req, { profileId: request.profileId, type: 'REVIEW_REDIRECT', label: request.business.name });
  }

  return NextResponse.redirect(request.business.googleReviewUrl, 302);
}
