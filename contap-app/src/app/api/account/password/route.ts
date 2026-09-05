import { db } from '@/lib/db';
import { handler, ok, readJson, rateLimit, clientKey } from '@/lib/api';
import { changePasswordSchema } from '@/lib/validate';
import { requireUser, verifyPassword, hashPassword, HttpError } from '@/lib/auth';

export const runtime = 'nodejs';

export const POST = handler(async (req) => {
  const user = await requireUser();
  await rateLimit(`password:${user.id}`, 8, 900);

  const input = await readJson(req, changePasswordSchema);

  const row = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { passwordHash: true } });
  const okNow = await verifyPassword(input.currentPassword, row.passwordHash);
  if (!okNow) throw new HttpError(401, 'That is not your current password.', 'bad_password');

  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(input.password) },
  });

  return ok({ changed: true });
});
