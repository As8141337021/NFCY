import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { currentUser, isStaff } from '@/lib/auth';
import SiteNav from '@/components/SiteNav';
import CheckoutClient from './CheckoutClient';

export const metadata: Metadata = { title: 'Checkout', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function CheckoutPage() {
  const user = await currentUser();

  const [renewal, lastOrder] = await Promise.all([
    db.product.findFirst({ where: { kind: 'RENEWAL' }, select: { priceMinor: true } }),
    user
      ? db.order.findFirst({
          where: { userId: user.id },
          orderBy: { createdAt: 'desc' },
          select: { customerName: true, customerEmail: true, customerPhone: true },
        })
      : Promise.resolve(null),
  ]);

  const dbUser = user ? await db.user.findUnique({ where: { id: user.id }, select: { phone: true } }) : null;

  return (
    <>
      <div className="env" aria-hidden="true">
        <div className="env-glow" />
      </div>

      <SiteNav signedIn={Boolean(user)} staff={Boolean(user && isStaff(user.role))} />

      <main id="main" tabIndex={-1} className="wrap" style={{ paddingTop: 'clamp(100px,13vh,150px)', paddingBottom: 100 }}>
        <div className="page-head">
          <h1>Checkout</h1>
          <p>Everything is priced on our server, so what you see here is exactly what is charged.</p>
        </div>

        <CheckoutClient
          signedIn={Boolean(user)}
          prefill={{
            name: lastOrder?.customerName ?? user?.name ?? '',
            email: lastOrder?.customerEmail ?? user?.email ?? '',
            phone: lastOrder?.customerPhone ?? dbUser?.phone ?? '',
          }}
          renewalPriceMinor={renewal?.priceMinor ?? null}
        />
      </main>
    </>
  );
}
