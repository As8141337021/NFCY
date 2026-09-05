import 'server-only';
import crypto from 'node:crypto';
import type { EventType } from '@prisma/client';
import { db } from './db';
import { env } from './env';

/**
 * Analytics are deliberately coarse. No raw IP is ever written. A visitor is a
 * salted daily hash, so repeat views can be told apart without anyone being
 * identifiable, and the hash becomes meaningless the next day.
 */
function visitorHash(req: Request): string {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || '';
  const ua = req.headers.get('user-agent') ?? '';
  const day = new Date().toISOString().slice(0, 10);
  return crypto.createHash('sha256').update(`${env.authSecret}|${day}|${ip}|${ua}`).digest('hex').slice(0, 32);
}

function parseAgent(ua: string) {
  const s = ua.toLowerCase();
  const deviceType = /ipad|tablet/.test(s) ? 'tablet' : /mobi|android|iphone/.test(s) ? 'mobile' : 'desktop';

  let browser = 'Other';
  if (s.includes('edg/')) browser = 'Edge';
  else if (s.includes('opr/') || s.includes('opera')) browser = 'Opera';
  else if (s.includes('chrome') && !s.includes('chromium')) browser = 'Chrome';
  else if (s.includes('firefox')) browser = 'Firefox';
  else if (s.includes('safari')) browser = 'Safari';

  let os = 'Other';
  if (s.includes('android')) os = 'Android';
  else if (/iphone|ipad|ipod/.test(s)) os = 'iOS';
  else if (s.includes('windows')) os = 'Windows';
  else if (s.includes('mac os')) os = 'macOS';
  else if (s.includes('linux')) os = 'Linux';

  return { deviceType, browser, os };
}

/** Robots and previews must never be counted as a real profile view. */
export function looksLikeBot(ua: string): boolean {
  return /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegram|headless|lighthouse|monitor|curl|wget|python-requests/i.test(
    ua,
  );
}

type TrackInput = {
  profileId?: string | null;
  cardId?: string | null;
  type: EventType;
  label?: string | null;
  source?: string | null;
};

/**
 * Recording an event must never break the page a visitor is looking at, so this
 * swallows its own failures on purpose.
 */
export async function track(req: Request, input: TrackInput): Promise<void> {
  try {
    const ua = req.headers.get('user-agent') ?? '';
    if (looksLikeBot(ua)) return;

    const { deviceType, browser, os } = parseAgent(ua);
    const referrer = req.headers.get('referer');

    await db.analyticsEvent.create({
      data: {
        profileId: input.profileId ?? null,
        cardId: input.cardId ?? null,
        type: input.type,
        label: input.label?.slice(0, 80) ?? null,
        deviceType,
        browser,
        os,
        country: req.headers.get('x-vercel-ip-country') ?? null,
        referrer: referrer ? new URL(referrer).host.slice(0, 120) : null,
        source: input.source ?? null,
        visitorHash: visitorHash(req),
      },
    });
  } catch (e) {
    console.error('[analytics]', e);
  }
}

// ============================================================
// READING
// ============================================================

export type Range = 7 | 30 | 90 | 365;

export function since(days: Range): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - (days - 1));
  return d;
}

export type DayPoint = { date: string; views: number; taps: number; scans: number; clicks: number };

const CLICK_TYPES: EventType[] = [
  'CLICK_WHATSAPP', 'CLICK_CALL', 'CLICK_EMAIL', 'CLICK_WEBSITE', 'CLICK_SOCIAL',
  'CLICK_MAPS', 'CLICK_PRODUCT', 'CLICK_SERVICE', 'CLICK_UPI',
];

/** One row per day in the range, including the days with nothing on them. */
export async function dailySeries(profileIds: string[], days: Range): Promise<DayPoint[]> {
  const from = since(days);
  const rows = profileIds.length
    ? await db.analyticsEvent.findMany({
        where: { profileId: { in: profileIds }, createdAt: { gte: from } },
        select: { type: true, createdAt: true },
      })
    : [];

  const buckets = new Map<string, DayPoint>();
  for (let i = 0; i < days; i++) {
    const d = new Date(from);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    buckets.set(key, { date: key, views: 0, taps: 0, scans: 0, clicks: 0 });
  }

  for (const r of rows) {
    const key = r.createdAt.toISOString().slice(0, 10);
    const b = buckets.get(key);
    if (!b) continue;
    if (r.type === 'PROFILE_VIEW') b.views++;
    else if (r.type === 'NFC_TAP') b.taps++;
    else if (r.type === 'QR_SCAN') b.scans++;
    else if (CLICK_TYPES.includes(r.type)) b.clicks++;
  }

  return [...buckets.values()];
}

export async function totals(profileIds: string[], days: Range) {
  if (!profileIds.length) {
    return { views: 0, taps: 0, scans: 0, clicks: 0, leads: 0, uniqueVisitors: 0, byType: {} as Record<string, number> };
  }
  const from = since(days);
  const grouped = await db.analyticsEvent.groupBy({
    by: ['type'],
    where: { profileId: { in: profileIds }, createdAt: { gte: from } },
    _count: { _all: true },
  });

  const byType: Record<string, number> = {};
  for (const g of grouped) byType[g.type] = g._count._all;

  const uniques = await db.analyticsEvent.findMany({
    where: { profileId: { in: profileIds }, createdAt: { gte: from }, type: 'PROFILE_VIEW' },
    select: { visitorHash: true },
    distinct: ['visitorHash'],
  });

  const clicks = CLICK_TYPES.reduce((n, t) => n + (byType[t] ?? 0), 0);

  return {
    views: byType.PROFILE_VIEW ?? 0,
    taps: byType.NFC_TAP ?? 0,
    scans: byType.QR_SCAN ?? 0,
    clicks,
    leads: byType.LEAD_SUBMITTED ?? 0,
    uniqueVisitors: uniques.length,
    byType,
  };
}

export async function breakdown(profileIds: string[], days: Range, field: 'deviceType' | 'browser' | 'os' | 'referrer' | 'source') {
  if (!profileIds.length) return [] as Array<{ key: string; count: number }>;
  const rows = await db.analyticsEvent.groupBy({
    by: [field],
    where: { profileId: { in: profileIds }, createdAt: { gte: since(days) } },
    _count: { _all: true },
    orderBy: { _count: { [field]: 'desc' } },
    take: 8,
  });
  return rows.map((r) => ({ key: (r[field] as string | null) ?? 'Direct', count: r._count._all }));
}
