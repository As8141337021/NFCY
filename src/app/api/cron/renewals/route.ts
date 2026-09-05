import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { notify } from '@/lib/notify';
import { rupees } from '@/lib/money';
import { sweepRateLimits } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const REMINDER_DAYS = [30, 15, 7, 1];

/**
 * The daily housekeeping run.
 *
 * Sends the four renewal reminders, pauses profiles whose year has run out, and
 * clears expired rate limit rows. Guarded by a shared secret so it cannot be
 * triggered by anyone who happens to find the URL.
 *
 * On Vercel, add to vercel.json:
 *   { "crons": [{ "path": "/api/cron/renewals", "schedule": "0 4 * * *" }] }
 */
export async function GET(req: Request) {
  const secret = env.cronSecret;
  const provided =
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ??
    new URL(req.url).searchParams.get('key') ??
    '';

  if (!secret) {
    return NextResponse.json(
      { ok: false, error: 'CRON_SECRET is not set, so this endpoint is switched off.' },
      { status: 503 },
    );
  }
  if (provided !== secret) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const now = new Date();
  let remindersSent = 0;
  let paused = 0;

  // ---- reminders ----
  for (const days of REMINDER_DAYS) {
    const from = new Date(now);
    from.setDate(from.getDate() + days);
    from.setHours(0, 0, 0, 0);
    const to = new Date(from);
    to.setHours(23, 59, 59, 999);

    const due = await db.subscription.findMany({
      where: {
        status: { in: ['ACTIVE', 'EXPIRING'] },
        expiresAt: { gte: from, lte: to },
        NOT: { remindersSent: { has: days } },
      },
      include: { user: { select: { id: true, name: true, email: true } } },
      take: 500,
    });

    for (const sub of due) {
      await notify({
        template: 'renewal_reminder',
        to: sub.user.email,
        userId: sub.user.id,
        vars: {
          name: sub.user.name.split(' ')[0],
          daysLeft: days,
          expiresOn: sub.expiresAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }),
          price: rupees(sub.priceMinor),
        },
        // the same reminder can never go out twice, however often this runs
        dedupeKey: `reminder:${sub.id}:${days}`,
      });

      await db.subscription.update({
        where: { id: sub.id },
        data: {
          remindersSent: { push: days },
          status: days <= 30 ? 'EXPIRING' : sub.status,
        },
      });
      remindersSent++;
    }
  }

  // ---- lapsed: pause the profile, never the card ----
  const lapsed = await db.subscription.findMany({
    where: { status: { in: ['ACTIVE', 'EXPIRING'] }, expiresAt: { lt: now } },
    select: { id: true, userId: true },
    take: 500,
  });

  for (const sub of lapsed) {
    await db.$transaction([
      db.subscription.update({ where: { id: sub.id }, data: { status: 'EXPIRED' } }),
      db.profile.updateMany({
        where: { userId: sub.userId, status: 'PUBLISHED' },
        data: { status: 'RENEWAL_REQUIRED' },
      }),
    ]);
    paused++;
  }

  await sweepRateLimits();

  return NextResponse.json({ ok: true, remindersSent, profilesPaused: paused, ranAt: now.toISOString() });
}
