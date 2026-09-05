import 'server-only';
import { NextResponse } from 'next/server';
import { ZodError, type ZodTypeAny, type z } from 'zod';
import { HttpError } from './auth';
import { db } from './db';

// ============================================================
// RESPONSES
// ============================================================

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, init);
}

export function fail(status: number, message: string, code?: string, fields?: Record<string, string>) {
  return NextResponse.json({ ok: false, error: { message, code, fields } }, { status });
}

/**
 * Wraps a route handler so every failure becomes a clean JSON error instead of
 * a stack trace, and so an unexpected exception never leaks internals.
 */
export function handler<Args extends unknown[]>(
  fn: (req: Request, ...args: Args) => Promise<Response>,
) {
  return async (req: Request, ...args: Args): Promise<Response> => {
    try {
      return await fn(req, ...args);
    } catch (e) {
      if (e instanceof HttpError) return fail(e.status, e.message, e.code);
      if (e instanceof ZodError) {
        const fields: Record<string, string> = {};
        for (const issue of e.errors) {
          const key = issue.path.join('.') || '_';
          if (!fields[key]) fields[key] = issue.message;
        }
        return fail(422, 'Please check the highlighted fields.', 'validation', fields);
      }
      console.error('[api]', e);
      return fail(500, 'Something went wrong on our side. Please try again.', 'internal');
    }
  };
}

export async function readJson<S extends ZodTypeAny>(req: Request, schema: S): Promise<z.infer<S>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new HttpError(400, 'That request was not valid JSON.', 'bad_json');
  }
  return schema.parse(body);
}

// ============================================================
// RATE LIMITING
// ============================================================

/**
 * A fixed window counter kept in Postgres. It survives restarts and works on
 * serverless where in-memory counters do not, which is the whole point.
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<void> {
  const now = new Date();
  const bucket = Math.floor(now.getTime() / (windowSeconds * 1000));
  const id = `${key}:${bucket}`;
  const expiresAt = new Date((bucket + 1) * windowSeconds * 1000);

  const row = await db.rateLimit.upsert({
    where: { id },
    create: { id, count: 1, expiresAt },
    update: { count: { increment: 1 } },
  });

  if (row.count > limit) {
    const retryIn = Math.max(1, Math.ceil((expiresAt.getTime() - now.getTime()) / 1000));
    throw new HttpError(429, `Too many attempts. Try again in ${retryIn} seconds.`, 'rate_limited');
  }
}

/** Best effort client key. Behind Vercel the first forwarded address is the client. */
export function clientKey(req: Request, prefix: string): string {
  const fwd = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ip = fwd || req.headers.get('x-real-ip') || 'unknown';
  return `${prefix}:${ip}`;
}

export async function sweepRateLimits() {
  await db.rateLimit.deleteMany({ where: { expiresAt: { lt: new Date() } } });
}
