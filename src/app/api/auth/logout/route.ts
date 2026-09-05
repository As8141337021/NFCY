import { cookies } from 'next/headers';
import { handler, ok } from '@/lib/api';
import { SESSION_COOKIE, clearSessionCookie, destroySession } from '@/lib/auth';

export const runtime = 'nodejs';

export const POST = handler(async () => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await destroySession(token);
  await clearSessionCookie();
  return ok({ signedOut: true });
});
