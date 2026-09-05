import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { handler, ok, readJson, rateLimit, clientKey } from '@/lib/api';
import { signupSchema } from '@/lib/validate';
import { hashPassword, createSession, setSessionCookie, HttpError } from '@/lib/auth';
import { randomToken, sha256 } from '@/lib/ids';
import { notify } from '@/lib/notify';

export const runtime = 'nodejs';

export const POST = handler(async (req) => {
  // 8 an hour was too tight: a whole office or college behind one NAT address
  // shares an IP, and a genuine rush would have locked them all out.
  await rateLimit(clientKey(req, 'signup'), 30, 3600);

  const input = await readJson(req, signupSchema);

  const existing = await db.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new HttpError(
      409,
      'An account already uses that email. Sign in instead, or reset your password.',
      'email_taken',
    );
  }
  if (input.phone) {
    const phoneTaken = await db.user.findUnique({ where: { phone: input.phone } });
    if (phoneTaken) {
      throw new HttpError(409, 'An account already uses that mobile number.', 'phone_taken');
    }
  }

  const user = await db.user.create({
    data: {
      email: input.email,
      name: input.name,
      phone: input.phone ?? null,
      passwordHash: await hashPassword(input.password),
      role: 'CUSTOMER',
    },
  });

  // email verification, sent but never blocking: an unverified user can still work
  const token = randomToken();
  await db.verificationToken.create({
    data: {
      tokenHash: sha256(token),
      purpose: 'EMAIL_VERIFY',
      userId: user.id,
      expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
    },
  });

  await notify({
    template: 'welcome',
    to: user.email,
    userId: user.id,
    vars: { name: user.name.split(' ')[0] },
    dedupeKey: `welcome:${user.id}`,
  });
  await notify({
    template: 'verify_email',
    to: user.email,
    userId: user.id,
    vars: { name: user.name.split(' ')[0], link: `${env.appUrl}/verify?token=${token}` },
  });

  const session = await createSession(user.id);
  await setSessionCookie(session);

  return ok({ id: user.id, name: user.name, email: user.email, role: user.role });
});
