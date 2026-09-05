import { db } from '@/lib/db';
import { handler, ok } from '@/lib/api';
import { assetUrl } from '@/lib/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** The public catalogue. Prices always come from the database, never from code. */
export const GET = handler(async () => {
  const products = await db.product.findMany({
    where: { status: { in: ['ACTIVE', 'OUT_OF_STOCK'] } },
    orderBy: { position: 'asc' },
    include: { images: { orderBy: { position: 'asc' }, include: { media: true } } },
  });

  return ok({
    products: products.map((p) => ({
      id: p.id,
      slug: p.slug,
      sku: p.sku,
      name: p.name,
      kind: p.kind,
      tagline: p.tagline,
      description: p.description,
      status: p.status,
      priceMinor: p.priceMinor,
      mrpMinor: p.mrpMinor,
      badge: p.badge,
      features: (p.features as string[] | null) ?? [],
      destinationType: p.destinationType,
      inStock: !p.trackStock || p.stock > 0,
      images: p.images.map((i) => ({
        url: assetUrl(i.media.id, i.media.externalUrl),
        alt: i.alt ?? p.name,
        isPrimary: i.isPrimary,
      })),
    })),
  });
});
