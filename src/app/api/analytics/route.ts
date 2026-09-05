import { db } from '@/lib/db';
import { handler, ok } from '@/lib/api';
import { requireUser, isStaff } from '@/lib/auth';
import { dailySeries, totals, breakdown, type Range } from '@/lib/analytics';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RANGES: Range[] = [7, 30, 90, 365];

/** The signed in owner's own numbers. Staff can pass a profileId they do not own. */
export const GET = handler(async (req) => {
  const user = await requireUser();
  const url = new URL(req.url);

  const requested = Number(url.searchParams.get('days') ?? 30);
  const days = (RANGES.includes(requested as Range) ? requested : 30) as Range;
  const profileId = url.searchParams.get('profileId');

  let profileIds: string[];

  if (profileId) {
    const p = await db.profile.findUnique({ where: { id: profileId }, select: { id: true, userId: true } });
    // an id they do not own simply resolves to nothing, rather than confirming it exists
    profileIds = p && (p.userId === user.id || isStaff(user.role)) ? [p.id] : [];
  } else {
    profileIds = (await db.profile.findMany({ where: { userId: user.id }, select: { id: true } })).map((p) => p.id);
  }

  const [t, series, devices, browsers, sources, topLinks] = await Promise.all([
    totals(profileIds, days),
    dailySeries(profileIds, days),
    breakdown(profileIds, days, 'deviceType'),
    breakdown(profileIds, days, 'browser'),
    breakdown(profileIds, days, 'source'),
    profileIds.length
      ? db.analyticsEvent.groupBy({
          by: ['type'],
          where: { profileId: { in: profileIds }, createdAt: { gte: new Date(Date.now() - days * 864e5) } },
          _count: { _all: true },
          orderBy: { _count: { type: 'desc' } },
          take: 12,
        })
      : Promise.resolve([]),
  ]);

  return ok({
    days,
    totals: t,
    series,
    devices,
    browsers,
    sources,
    byType: topLinks.map((r) => ({ type: r.type, count: r._count._all })),
  });
});
