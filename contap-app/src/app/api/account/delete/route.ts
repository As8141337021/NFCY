import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { handler, ok, rateLimit } from '@/lib/api';
import { requireUser, verifyPassword, HttpError, SESSION_COOKIE, clearSessionCookie } from '@/lib/auth';
import { audit } from '@/lib/audit';

export const runtime = 'nodejs';

/**
 * Deleting an account.
 *
 * Profiles, links, leads and analytics go with it. Orders and invoices do not:
 * they are financial records we are required to keep, so they are detached from
 * the person instead of destroyed.
 */
export const POST = handler(async (req) => {
  const user = await requireUser();
  await rateLimit(`delete:${user.id}`, 5, 3600);

  const body = (await req.json().catch(() => ({}))) as { password?: string; confirm?: string };

  const row = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { passwordHash: true } });
  if (!(await verifyPassword(body.password ?? '', row.passwordHash))) {
    throw new HttpError(401, 'Enter your password to confirm.', 'bad_password');
  }
  if (body.confirm !== 'DELETE') {
    throw new HttpError(422, 'Type DELETE in the box to confirm.', 'confirm');
  }

  const liveCards = await db.nfcCard.count({ where: { userId: user.id, status: 'ACTIVE' } });

  await db.$transaction([
    db.nfcCard.updateMany({
      where: { userId: user.id },
      data: { status: 'SUSPENDED', profileId: null, userId: null },
    }),
    db.profile.deleteMany({ where: { userId: user.id } }),
    db.session.deleteMany({ where: { userId: user.id } }),
    db.order.updateMany({ where: { userId: user.id }, data: { userId: null } }),
    db.user.update({
      where: { id: user.id },
      data: {
        status: 'DELETED',
        email: `deleted+${user.id}@nfcy.invalid`,
        phone: null,
        name: 'Deleted account',
        passwordHash: null,
        googleId: null,
      },
    }),
  ]);

  await audit({ userId: null, action: 'account.deleted', entityType: 'User', entityId: user.id, before: { liveCards } });

  const jar = await cookies();
  jar.get(SESSION_COOKIE);
  await clearSessionCookie();

  return ok({ deleted: true, cardsSwitchedOff: liveCards });
});
