import { db } from '@/lib/db';
import { handler, ok, readJson } from '@/lib/api';
import { couponSchema } from '@/lib/validate';
import { requireStaff, HttpError } from '@/lib/auth';
import { audit } from '@/lib/audit';

export const runtime = 'nodejs';

export const POST = handler(async (req) => {
  const staff = await requireStaff('coupons.manage');
  const input = await readJson(req, couponSchema);

  const existing = await db.coupon.findUnique({ where: { code: input.code } });
  if (existing) throw new HttpError(409, 'That code already exists.', 'duplicate');

  if (input.type === 'PERCENT' && input.value > 100) {
    throw new HttpError(422, 'A percentage discount cannot be more than 100.', 'bad_percent');
  }

  const created = await db.coupon.create({
    data: {
      code: input.code,
      type: input.type,
      value: input.value,
      minOrderMinor: input.minOrderMinor,
      maxDiscountMinor: input.maxDiscountMinor ?? null,
      firstOrderOnly: input.firstOrderOnly,
      minQuantity: input.minQuantity,
      usageLimit: input.usageLimit ?? null,
      perUserLimit: input.perUserLimit ?? null,
      startsAt: input.startsAt ? new Date(input.startsAt) : null,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      active: input.active,
      ...(input.productIds.length ? { products: { connect: input.productIds.map((id) => ({ id })) } } : {}),
    },
  });

  await audit({ userId: staff.id, action: 'coupon.created', entityType: 'Coupon', entityId: created.id, after: { code: created.code } });
  return ok({ id: created.id, code: created.code });
});
