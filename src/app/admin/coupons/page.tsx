import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { requireStaffOrRedirect } from '@/lib/guards';
import CouponManager from './CouponManager';

export const metadata: Metadata = { title: 'Coupons' };
export const dynamic = 'force-dynamic';

export default async function AdminCoupons() {
  await requireStaffOrRedirect('coupons.manage');

  const [coupons, products] = await Promise.all([
    db.coupon.findMany({
      orderBy: { createdAt: 'desc' },
      include: { products: { select: { name: true } } },
    }),
    db.product.findMany({
      where: { status: { not: 'ARCHIVED' } },
      orderBy: { position: 'asc' },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <>
      <div className="page-head">
        <h1>Coupons</h1>
        <p>
          Every discount is checked and applied on our server at checkout, so a code cannot be faked from the browser.
        </p>
      </div>

      <CouponManager
        products={products}
        coupons={coupons.map((c) => ({
          id: c.id,
          code: c.code,
          type: c.type,
          value: c.value,
          minOrderMinor: c.minOrderMinor,
          maxDiscountMinor: c.maxDiscountMinor,
          firstOrderOnly: c.firstOrderOnly,
          minQuantity: c.minQuantity,
          usageLimit: c.usageLimit,
          usageCount: c.usageCount,
          perUserLimit: c.perUserLimit,
          startsAt: c.startsAt?.toISOString() ?? null,
          expiresAt: c.expiresAt?.toISOString() ?? null,
          active: c.active,
          productNames: c.products.map((p) => p.name),
        }))}
      />
    </>
  );
}
