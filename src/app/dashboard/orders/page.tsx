import Link from 'next/link';
import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { requireUserOrRedirect } from '@/lib/guards';
import { rupees } from '@/lib/money';
import { ORDER_LABEL } from '@/lib/orders';

export const metadata: Metadata = { title: 'Orders' };
export const dynamic = 'force-dynamic';

const pillFor = (status: string) =>
  status === 'ACTIVATED' || status === 'DELIVERED' ? 'live'
  : status === 'CANCELLED' ? 'bad'
  : status === 'PAYMENT_PENDING' ? ''
  : 'warn';

export default async function OrdersPage() {
  const user = await requireUserOrRedirect('/dashboard/orders');

  const orders = await db.order.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    include: { items: { select: { productName: true, quantity: true } }, shipment: true },
  });

  return (
    <>
      <div className="page-head">
        <h1>Orders</h1>
        <p>Every order, its payment, and where it has got to.</p>
      </div>

      {orders.length === 0 ? (
        <div className="empty">
          <h3>No orders yet</h3>
          <p>When you buy a card it shows up here, with tracking and your invoice.</p>
          <Link href="/cards" className="btn btn-accent">
            See the cards
          </Link>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Order</th>
                <th>Placed</th>
                <th>What</th>
                <th>Total</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td>
                    <Link href={`/dashboard/orders/${o.id}`} className="num">
                      {o.orderNumber}
                    </Link>
                  </td>
                  <td className="muted">
                    {o.createdAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td>{o.items.map((i) => `${i.quantity} x ${i.productName}`).join(', ')}</td>
                  <td className="num">{rupees(o.totalMinor)}</td>
                  <td>
                    <span className={`pill ${pillFor(o.status)}`}>{ORDER_LABEL[o.status] ?? o.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
