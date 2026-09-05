import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { env } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * A readiness check that answers the questions worth asking before trusting a
 * deployment: is the database reachable, is it in an encoding that can actually
 * hold Indian text and the rupee sign, and which optional services are wired up.
 *
 * The encoding check is here because a WIN1252 database accepts every query
 * until the first rupee sign, then fails at the worst possible moment.
 */
export async function GET() {
  const started = Date.now();
  const checks: Record<string, { ok: boolean; detail: string }> = {};

  try {
    const rows = await db.$queryRaw<Array<{ server_encoding: string }>>`SHOW server_encoding`;
    const encoding = rows[0]?.server_encoding ?? 'unknown';
    checks.database = { ok: true, detail: `connected, ${encoding}` };
    checks.encoding = {
      ok: encoding.toUpperCase() === 'UTF8',
      detail:
        encoding.toUpperCase() === 'UTF8'
          ? 'UTF8, so the rupee sign and Indian language text are safe'
          : `${encoding}. The rupee sign cannot be stored. Recreate the database as UTF8.`,
    };
  } catch (e) {
    checks.database = { ok: false, detail: `unreachable: ${String(e).slice(0, 120)}` };
    checks.encoding = { ok: false, detail: 'not checked' };
  }

  try {
    const products = await db.product.count({ where: { status: 'ACTIVE' } });
    checks.catalogue = {
      ok: products > 0,
      detail: products > 0 ? `${products} products on sale` : 'no active products, run the seed',
    };
  } catch {
    checks.catalogue = { ok: false, detail: 'could not read the catalogue' };
  }

  checks.payments = {
    ok: env.razorpay.configured,
    detail: env.razorpay.configured
      ? 'Razorpay keys present'
      : 'no Razorpay keys, so orders can be placed but not paid for',
  };
  checks.webhook = {
    ok: Boolean(env.razorpay.webhookSecret),
    detail: env.razorpay.webhookSecret ? 'webhook secret present' : 'no webhook secret, payments cannot be confirmed',
  };
  checks.email = {
    ok: env.mail.configured,
    detail: env.mail.configured ? 'SMTP configured' : 'no SMTP, messages queue in the admin panel instead',
  };
  checks.storage = { ok: true, detail: `driver ${env.storage.driver}` };
  checks.cron = {
    ok: Boolean(env.cronSecret),
    detail: env.cronSecret ? 'cron secret present' : 'no CRON_SECRET, renewal reminders will not run',
  };

  // only the things that would actually break the product count as fatal
  const fatal = ['database', 'encoding', 'catalogue'];
  const healthy = fatal.every((k) => checks[k]?.ok);

  return NextResponse.json(
    { ok: healthy, checks, tookMs: Date.now() - started },
    { status: healthy ? 200 : 503, headers: { 'cache-control': 'no-store' } },
  );
}
