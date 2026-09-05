import { db } from '@/lib/db';
import { handler, ok, readJson } from '@/lib/api';
import { adminUserSchema } from '@/lib/validate';
import { requireStaff, HttpError, atLeast } from '@/lib/auth';
import { audit } from '@/lib/audit';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handler(async (req, ctx: Ctx) => {
  const staff = await requireStaff('users.manage');
  const { id } = await ctx.params;
  const input = await readJson(req, adminUserSchema);

  const target = await db.user.findUnique({ where: { id }, select: { id: true, role: true, status: true, email: true } });
  if (!target) throw new HttpError(404, 'No such user.', 'not_found');

  if (target.id === staff.id) {
    throw new HttpError(409, 'You cannot change your own role or status here.', 'self');
  }
  // nobody can hand out a role above their own, or edit someone senior to them
  if (atLeast(target.role, staff.role) && staff.role !== 'SUPER_ADMIN') {
    throw new HttpError(403, 'That account is at or above your own level.', 'rank');
  }
  if (input.role && atLeast(input.role, staff.role) && staff.role !== 'SUPER_ADMIN') {
    throw new HttpError(403, 'You cannot grant a role at or above your own.', 'rank');
  }

  const updated = await db.user.update({
    where: { id },
    data: { ...(input.role ? { role: input.role } : {}), ...(input.status ? { status: input.status } : {}) },
  });

  // suspending someone signs them out everywhere, immediately
  if (input.status && input.status !== 'ACTIVE') {
    await db.session.deleteMany({ where: { userId: id } });
  }

  await audit({
    userId: staff.id,
    action: 'user.updated',
    entityType: 'User',
    entityId: id,
    before: { role: target.role, status: target.status },
    after: { role: updated.role, status: updated.status },
  });

  return ok({ id: updated.id, role: updated.role, status: updated.status });
});
