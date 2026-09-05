import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { handler } from '@/lib/api';
import { sha256 } from '@/lib/ids';

export const runtime = 'nodejs';

/** Opened from the email link, so it redirects rather than returning JSON. */
export const GET = handler(async (req) => {
  const token = new URL(req.url).searchParams.get('token') ?? '';
  const fail = (why: string) => NextResponse.redirect(`${env.appUrl}/verify?state=${why}`);

  if (!token) return fail('missing');

  const row = await db.verificationToken.findUnique({ where: { tokenHash: sha256(token) } });
  if (!row || row.purpose !== 'EMAIL_VERIFY' || row.expiresAt < new Date()) return fail('expired');
  if (row.usedAt) return NextResponse.redirect(`${env.appUrl}/verify?state=already`);

  await db.$transaction([
    db.user.update({ where: { id: row.userId }, data: { emailVerified: new Date() } }),
    db.verificationToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
  ]);

  return NextResponse.redirect(`${env.appUrl}/verify?state=done`);
});
