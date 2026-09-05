import { db } from '@/lib/db';
import { handler, ok, readJson } from '@/lib/api';
import { z } from 'zod';
import { requireStaff, HttpError } from '@/lib/auth';
import { assetUrl, deleteAssetIfOrphan } from '@/lib/storage';
import { audit } from '@/lib/audit';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

const addSchema = z.object({
  mediaId: z.string().uuid(),
  alt: z.string().trim().max(160).optional().nullable(),
});

const orderSchema = z.object({
  ids: z.array(z.string().uuid()).max(30),
  primaryId: z.string().uuid().optional().nullable(),
});

async function listFor(productId: string) {
  const rows = await db.productImage.findMany({
    where: { productId },
    orderBy: { position: 'asc' },
    include: { media: true },
  });
  return rows.map((r) => ({
    id: r.id,
    url: assetUrl(r.media.id, r.media.externalUrl),
    alt: r.alt,
    isPrimary: r.isPrimary,
    position: r.position,
  }));
}

export const GET = handler(async (_req, ctx: Ctx) => {
  await requireStaff('products.view');
  const { id } = await ctx.params;
  return ok({ images: await listFor(id) });
});

/** Attaches an already uploaded image to a product. */
export const POST = handler(async (req, ctx: Ctx) => {
  const staff = await requireStaff('products.manage');
  const { id } = await ctx.params;
  const input = await readJson(req, addSchema);

  const [product, media] = await Promise.all([
    db.product.findUnique({ where: { id }, select: { id: true, name: true } }),
    db.mediaAsset.findUnique({ where: { id: input.mediaId }, select: { id: true } }),
  ]);
  if (!product) throw new HttpError(404, 'No such product.', 'not_found');
  if (!media) throw new HttpError(404, 'That image is not in storage.', 'no_media');

  const count = await db.productImage.count({ where: { productId: id } });
  if (count >= 12) throw new HttpError(409, 'A product can carry up to twelve pictures.', 'limit');

  await db.productImage.create({
    data: {
      productId: id,
      mediaId: input.mediaId,
      alt: input.alt || product.name,
      position: count,
      isPrimary: count === 0, // the first one uploaded is the one shown on the shelf
    },
  });

  await audit({ userId: staff.id, action: 'product.image_added', entityType: 'Product', entityId: id });
  return ok({ images: await listFor(id) });
});

/** Reordering, and choosing which one is the main picture. */
export const PATCH = handler(async (req, ctx: Ctx) => {
  await requireStaff('products.manage');
  const { id } = await ctx.params;
  const input = await readJson(req, orderSchema);

  const owned = await db.productImage.findMany({ where: { productId: id }, select: { id: true } });
  const ownedIds = new Set(owned.map((o) => o.id));
  const ordered = input.ids.filter((x) => ownedIds.has(x));

  await db.$transaction([
    ...ordered.map((imageId, position) => db.productImage.update({ where: { id: imageId }, data: { position } })),
    ...(input.primaryId && ownedIds.has(input.primaryId)
      ? [
          db.productImage.updateMany({ where: { productId: id }, data: { isPrimary: false } }),
          db.productImage.update({ where: { id: input.primaryId }, data: { isPrimary: true } }),
        ]
      : []),
  ]);

  return ok({ images: await listFor(id) });
});

export const DELETE = handler(async (req, ctx: Ctx) => {
  const staff = await requireStaff('products.manage');
  const { id } = await ctx.params;
  const imageId = new URL(req.url).searchParams.get('imageId');
  if (!imageId) throw new HttpError(400, 'Which picture?', 'no_image');

  const image = await db.productImage.findUnique({ where: { id: imageId } });
  if (!image || image.productId !== id) throw new HttpError(404, 'That picture is not on this product.', 'not_found');

  await db.productImage.delete({ where: { id: imageId } });
  await deleteAssetIfOrphan(image.mediaId);

  // the shelf must never be left without a main picture
  if (image.isPrimary) {
    const next = await db.productImage.findFirst({ where: { productId: id }, orderBy: { position: 'asc' } });
    if (next) await db.productImage.update({ where: { id: next.id }, data: { isPrimary: true } });
  }

  await audit({ userId: staff.id, action: 'product.image_removed', entityType: 'Product', entityId: id });
  return ok({ images: await listFor(id) });
});
