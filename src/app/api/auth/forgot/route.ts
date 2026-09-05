import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { handler, ok, readJson, rateLimit, clientKey } from '@/lib/api';
import { forgotSchema } from '@/lib/validate';
import { randomToken, sha256 } from '@/lib/ids';
import { notify } from '@/lib/notify';

export const runtime = 'nodejs';

export const POST = handler(async (req) => {
  await rateLimit(clientKey(req, 'forgot'), 6, 900);
  const { email } = await readJson(req, forgotSchema);
  await rateLimit(`forgot-acct:${email}`, 4, 900);

  const user = await db.user.findUnique({ where: { email } });

  if (user && user.status === 'ACTIVE') {
    // Any earlier reset link stops working the moment a new one is asked for.
    await db.verificationToken.updateMany({
      where: { userId: user.id, purpose: 'PASSWORD_RESET', usedAt: null },
      data: { usedAt: new Date() },
    });

    const token = randomToken();
    await db.verificationToken.create({
      data: {
        tokenHash: sha256(token),
        purpose: 'PASSWORD_RESET',
        userId: user.id,
        expiresAt: new Date(Date.now() + 3600 * 1000),
      },
    });

    await notify({
      template: 'password_reset',
      to: user.email,
      userId: user.id,
      vars: { name: user.name.split(' ')[0], link: `${env.appUrl}/reset?token=${token}` },
    });
  }

  // Always the same answer, so this cannot be used to find out who has an account.
  return ok({ sent: true });
});
