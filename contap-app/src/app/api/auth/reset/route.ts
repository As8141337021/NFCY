import { db } from '@/lib/db';
import { handler, ok, readJson, rateLimit, clientKey } from '@/lib/api';
import { resetSchema } from '@/lib/validate';
import { hashPassword, createSession, setSessionCookie, HttpError } from '@/lib/auth';
import { sha256 } from '@/lib/ids';

export const runtime = 'nodejs';

export const POST = handler(async (req) => {
  await rateLimit(clientKey(req, 'reset'), 10, 900);
  const input = await readJson(req, resetSchema);

  const row = await db.verificationToken.findUnique({
    where: { tokenHash: sha256(input.token) },
    include: { user: true },
  });

  if (!row || row.purpose !== 'PASSWORD_RESET' || row.usedAt || row.expiresAt < new Date()) {
    throw new HttpError(
      400,
      'That reset link has expired or has already been used. Ask for a new one.',
      'bad_token',
    );
  }

  await db.$transaction([
    db.user.update({
      where: { id: row.userId },
      data: { passwordHash: await hashPassword(input.password) },
    }),
    db.verificationToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
    // every other device is signed out, which is the point of resetting a password
    db.session.deleteMany({ where: { userId: row.userId } }),
  ]);

  const token = await createSession(row.userId);
  await setSessionCookie(token);

  return ok({ reset: true, name: row.user.name });
});
