import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { requireUserOrRedirect } from '@/lib/guards';
import ReviewsClient from './ReviewsClient';

export const metadata: Metadata = { title: 'Ask for reviews' };
export const dynamic = 'force-dynamic';

export default async function ReviewsPage() {
  const user = await requireUserOrRedirect('/dashboard/reviews');

  const profile = await db.profile.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      fullName: true,
      businesses: {
        where: { active: true },
        orderBy: { position: 'asc' },
        select: { id: true, name: true, googleReviewUrl: true },
      },
    },
  });
  if (!profile) redirect('/dashboard/profile/new');

  const requests = await db.reviewRequest.findMany({
    where: { profileId: profile.id },
    orderBy: { sentAt: 'desc' },
    take: 100,
    include: { business: { select: { name: true } } },
  });

  return (
    <>
      <div className="page-head">
        <h1>Ask for reviews</h1>
        <p>
          Send a real customer straight to your Google review page, and see who opened the link. Nothing here writes a
          review for you.
        </p>
      </div>

      <ReviewsClient
        profileId={profile.id}
        ownerName={profile.fullName}
        appUrl={env.appUrl}
        businesses={profile.businesses}
        initialRows={requests.map((r) => ({
          id: r.id,
          customerName: r.customerName,
          phone: r.phone,
          channel: r.channel,
          sentAt: r.sentAt.toISOString(),
          openedAt: r.openedAt ? r.openedAt.toISOString() : null,
          openCount: r.openCount,
          businessName: r.business?.name ?? null,
        }))}
      />
    </>
  );
}
