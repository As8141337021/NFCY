import { db } from '@/lib/db';
import { handler, ok, readJson, rateLimit, clientKey } from '@/lib/api';
import { loginSchema } from '@/lib/validate';
import { verifyPassword, createSession, setSessionCookie, HttpError, isStaff } from '@/lib/auth';

export const runtime = 'nodejs';

export const POST = handler(async (req) => {
  const input = await readJson(req, loginSchema);

  // two limits: one on the address being attacked, one on the attacker
  await rateLimit(clientKey(req, 'login-ip'), 20, 900);
  await rateLimit(`login-acct:${input.email}`, 8, 900);

  const user = await db.user.findUnique({ where: { email: input.email } });
  const passwordOk = await verifyPassword(input.password, user?.passwordHash ?? null);

  // one message for both cases, so this cannot be used to discover who has an account
  if (!user || !passwordOk) {
    throw new HttpError(401, 'That email and password do not match.', 'bad_credentials');
  }
  if (user.status === 'SUSPENDED') {
    throw new HttpError(403, 'That account is suspended. Contact support.', 'suspended');
  }
  if (user.status === 'DELETED') {
    throw new HttpError(401, 'That email and password do not match.', 'bad_credentials');
  }

  const token = await createSession(user.id);
  await setSessionCookie(token);

  return ok({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    redirect: isStaff(user.role) ? '/admin' : '/dashboard',
  });
});
