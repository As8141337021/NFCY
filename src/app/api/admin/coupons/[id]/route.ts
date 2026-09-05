import { db } from '@/lib/db';
import { handler, ok, readJson } from '@/lib/api';
import { z } from 'zod';
import { requireStaff, HttpError } from '@/lib/auth';
import { audit } from '@/lib/audit';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handler(async (req, ctx: Ctx) => {
  const staff = await requireStaff('coupons.manage');
  const { id } = await ctx.params;
  const input = await readJson(req, z.object({ active: z.boolean() }));

  const coupon = await db.coupon.findUnique({ where: { id } });
  if (!coupon) throw new HttpError(404, 'No such coupon.', 'not_found');

  const updated = await db.coupon.update({ where: { id }, data: { active: input.active } });
  await audit({ userId: staff.id, action: 'coupon.toggled', entityType: 'Coupon', entityId: id, after: { active: updated.active } });
  return ok({ id: updated.id, active: updated.active });
});

export const DELETE = handler(async (_req, ctx: Ctx) => {
  const staff = await requireStaff('coupons.manage');
  const { id } = await ctx.params;

  const used = await db.order.count({ where: { couponId: id } });
  if (used > 0) {
    await db.coupon.update({ where: { id }, data: { active: false } });
    return ok({ deactivated: true, reason: 'This coupon has been used on real orders, so it was switched off rather than deleted.' });
  }

  await db.coupon.delete({ where: { id } });
  await audit({ userId: staff.id, action: 'coupon.deleted', entityType: 'Coupon', entityId: id });
  return ok({ deleted: true });
});
