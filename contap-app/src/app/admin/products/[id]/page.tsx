import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { requireStaffOrRedirect } from '@/lib/guards';
import { assetUrl } from '@/lib/storage';
import ProductEditor, { type ProductForm } from './ProductEditor';

export const metadata: Metadata = { title: 'Product' };
export const dynamic = 'force-dynamic';

const BLANK: ProductForm = {
  id: 'new',
  name: '', slug: '', sku: '', kind: 'CARD',
  tagline: '', description: '', status: 'DRAFT',
  priceRupees: '599', mrpRupees: '', taxPercent: '18',
  stock: '0', trackStock: false, badge: '', position: '10',
  destinationType: 'PROFILE', features: [],
};

export default async function AdminProductPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaffOrRedirect('products.manage');
  const { id } = await params;

  if (id === 'new') {
    return (
      <>
        <div className="page-head">
          <Link href="/admin/products" className="muted small" style={{ textDecoration: 'none' }}>← All products</Link>
          <h1 style={{ marginTop: 10 }}>New product</h1>
          <p>Fill in the details and save. Pictures come after the first save.</p>
        </div>
        <ProductEditor initial={BLANK} initialImages={[]} isNew />
      </>
    );
  }

  const product = await db.product.findUnique({
    where: { id },
    include: { images: { orderBy: { position: 'asc' }, include: { media: true } }, _count: { select: { orderItems: true, cards: true } } },
  });
  if (!product) notFound();

  return (
    <>
      <div className="page-head">
        <Link href="/admin/products" className="muted small" style={{ textDecoration: 'none' }}>← All products</Link>
        <h1 style={{ marginTop: 10 }}>{product.name}</h1>
        <p>
          Sold {product._count.orderItems} time{product._count.orderItems === 1 ? '' : 's'} ·{' '}
          {product._count.cards} card{product._count.cards === 1 ? '' : 's'} made for it
        </p>
      </div>

      <ProductEditor
        isNew={false}
        initial={{
          id: product.id,
          name: product.name,
          slug: product.slug,
          sku: product.sku,
          kind: product.kind,
          tagline: product.tagline ?? '',
          description: product.description ?? '',
          status: product.status,
          priceRupees: String(product.priceMinor / 100),
          mrpRupees: product.mrpMinor ? String(product.mrpMinor / 100) : '',
          taxPercent: String(product.taxPercent),
          stock: String(product.stock),
          trackStock: product.trackStock,
          badge: product.badge ?? '',
          position: String(product.position),
          destinationType: product.destinationType,
          features: (product.features as string[] | null) ?? [],
        }}
        initialImages={product.images.map((i) => ({
          id: i.id,
          url: assetUrl(i.media.id, i.media.externalUrl),
          alt: i.alt,
          isPrimary: i.isPrimary,
          position: i.position,
        }))}
      />
    </>
  );
}
