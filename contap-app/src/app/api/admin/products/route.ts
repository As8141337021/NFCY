import { db } from '@/lib/db';
import { handler, ok, readJson } from '@/lib/api';
import { adminProductSchema } from '@/lib/validate';
import { requireStaff, HttpError } from '@/lib/auth';
import { audit } from '@/lib/audit';

export const runtime = 'nodejs';

export const POST = handler(async (req) => {
  const staff = await requireStaff('products.manage');
  const input = await readJson(req, adminProductSchema);

  const clash = await db.product.findFirst({
    where: { OR: [{ slug: input.slug }, { sku: input.sku }] },
    select: { slug: true },
  });
  if (clash) throw new HttpError(409, 'A product already uses that link name or SKU.', 'duplicate');

  const created = await db.product.create({
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

  await audit({ userId: staff.id, action: 'product.created', entityType: 'Product', entityId: created.id });
  return ok({ id: created.id });
});
