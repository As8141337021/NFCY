import Link from 'next/link';
import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { requireStaffOrRedirect } from '@/lib/guards';
import { can } from '@/lib/auth';
import { rupees } from '@/lib/money';
import { assetUrl } from '@/lib/storage';
import { IconPlus } from '@/components/icons';

export const metadata: Metadata = { title: 'Products' };
export const dynamic = 'force-dynamic';

const STATUS_PILL: Record<string, string> = {
  ACTIVE: 'live', DRAFT: 'warn', OUT_OF_STOCK: 'bad', HIDDEN: '', ARCHIVED: '',
};

export default async function AdminProducts() {
  const staff = await requireStaffOrRedirect('products.view');

  const products = await db.product.findMany({
    orderBy: [{ status: 'asc' }, { position: 'asc' }],
    include: {
      images: { where: { isPrimary: true }, include: { media: true }, take: 1 },
      _count: { select: { orderItems: true } },
    },
  });

  return (
    <>
      <div className="page-head">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div>
            <h1>Products</h1>
            <p>Prices live here, not in the code. Change one and the shop, the cart and the invoice all follow.</p>
          </div>
          {can(staff.role, 'products.manage') ? (
            <Link href="/admin/products/new" className="btn btn-accent btn-sm"><IconPlus /> New product</Link>
          ) : null}
        </div>
      </div>

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Product</th>
              <th>Price</th>
              <th>Status</th>
              <th>Stock</th>
              <th>Sold</th>
              <th>Picture</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id}>
                <td>
                  <Link href={`/admin/products/${p.id}`}>{p.name}</Link>
                  <br />
                  <span className="muted tiny">{p.sku} · {p.kind.toLowerCase()}</span>
                </td>
                <td className="num">
                  {rupees(p.priceMinor)}
                  {p.mrpMinor && p.mrpMinor > p.priceMinor ? (
                    <><br /><span className="muted tiny" style={{ textDecoration: 'line-through' }}>{rupees(p.mrpMinor)}</span></>
                  ) : null}
                </td>
                <td><span className={`pill ${STATUS_PILL[p.status] ?? ''}`}>{p.status.toLowerCase().replace('_', ' ')}</span></td>
                <td className="num">{p.trackStock ? p.stock : <span className="muted tiny">not tracked</span>}</td>
                <td className="num">{p._count.orderItems}</td>
                <td>
                  {p.images[0] ? (
                    <img
                      src={assetUrl(p.images[0].media.id, p.images[0].media.externalUrl)}
                      alt=""
                      style={{ width: 54, height: 34, objectFit: 'cover', borderRadius: 6 }}
                    />
                  ) : (
                    <span className="muted tiny">drawn art</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
