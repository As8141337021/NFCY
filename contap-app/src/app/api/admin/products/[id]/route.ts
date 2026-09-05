import { db } from '@/lib/db';
import { handler, ok, readJson } from '@/lib/api';
import { adminProductSchema } from '@/lib/validate';
import { requireStaff, HttpError } from '@/lib/auth';
import { audit } from '@/lib/audit';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

export const PUT = handler(async (req, ctx: Ctx) => {
  const staff = await requireStaff('products.manage');
  const { id } = await ctx.params;
  const input = await readJson(req, adminProductSchema);

  const before = await db.product.findUnique({ where: { id } });
  if (!before) throw new HttpError(404, 'No such product.', 'not_found');

  const clash = await db.product.findFirst({
    where: { id: { not: id }, OR: [{ slug: input.slug }, { sku: input.sku }] },
    select: { slug: true, sku: true },
  });
  if (clash) {
    throw new HttpError(
      409,
      clash.slug === input.slug ? 'Another product already uses that link name.' : 'Another product already uses that SKU.',
      'duplicate',
    );
  }
  if (input.mrpMinor != null && input.mrpMinor > 0 && input.mrpMinor < input.priceMinor) {
    throw new HttpError(422, 'The struck through price cannot be lower than the price you charge.', 'bad_mrp');
  }

  const updated = await db.product.update({
    where: { id },
    data: {
      name: input.name,
      slug: input.slug,
      sku: input.sku,
      kind: input.kind,
      tagline: input.tagline || null,
      description: input.description || null,
      status: input.status,
      priceMinor: input.priceMinor,
      mrpMinor: input.mrpMinor ?? null,
      taxPercent: input.taxPercent,
      stock: input.stock,
      trackStock: input.trackStock,
      badge: input.badge || null,
      position: input.position,
      destinationType: input.destinationType,
      features: input.features as never,
    },
  });

  await audit({
    userId: staff.id,
    action: 'product.updated',
    entityType: 'Product',
    entityId: id,
    before: { priceMinor: before.priceMinor, status: before.status, stock: before.stock },
    after: { priceMinor: updated.priceMinor, status: updated.status, stock: updated.stock },
  });

  return ok({ id: updated.id, priceMinor: updated.priceMinor, status: updated.status });
});

export const DELETE = handler(async (_req, ctx: Ctx) => {
  const staff = await requireStaff('products.manage');
  const { id } = await ctx.params;

  const sold = await db.orderItem.count({ where: { productId: id } });
  if (sold > 0) {
    // deleting would orphan order history, so it is archived instead
    await db.product.update({ where: { id }, data: { status: 'ARCHIVED' } });
    await audit({ userId: staff.id, action: 'product.archived', entityType: 'Product', entityId: id });
    return ok({ archived: true, reason: 'This product has been sold before, so it was archived instead of deleted.' });
  }

  await db.product.delete({ where: { id } });
  await audit({ userId: staff.id, action: 'product.deleted', entityType: 'Product', entityId: id });
  return ok({ deleted: true });
});
