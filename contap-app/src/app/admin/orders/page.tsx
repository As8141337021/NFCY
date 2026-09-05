import Link from 'next/link';
import type { Metadata } from 'next';
import type { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { requireStaffOrRedirect } from '@/lib/guards';
import { rupees } from '@/lib/money';
import { ORDER_LABEL } from '@/lib/orders';

export const metadata: Metadata = { title: 'Orders' };
export const dynamic = 'force-dynamic';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'unpaid', label: 'Unpaid' },
  { id: 'needs-card', label: 'Needs a card' },
  { id: 'to-make', label: 'To make' },
  { id: 'to-ship', label: 'To ship' },
  { id: 'shipped', label: 'Shipped' },
  { id: 'done', label: 'Done' },
];

function whereFor(filter: string, q: string): Prisma.OrderWhereInput {
  const search: Prisma.OrderWhereInput = q
    ? {
        OR: [
          { orderNumber: { contains: q, mode: 'insensitive' } },
          { customerName: { contains: q, mode: 'insensitive' } },
          { customerEmail: { contains: q, mode: 'insensitive' } },
          { customerPhone: { contains: q } },
        ],
      }
    : {};

  const byFilter: Record<string, Prisma.OrderWhereInput> = {
    all: {},
    unpaid: { paidAt: null, status: { not: 'CANCELLED' } },
    'needs-card': {
      paidAt: { not: null },
      status: { notIn: ['CANCELLED'] },
      items: { some: { cards: { none: {} }, product: { kind: { not: 'RENEWAL' } } } },
    },
    'to-make': { paidAt: { not: null }, status: { in: ['PAYMENT_RECEIVED', 'PROFILE_COMPLETED', 'DESIGN_PROCESSING'] } },
    'to-ship': { paidAt: { not: null }, status: 'MANUFACTURING' },
    shipped: { status: 'DISPATCHED' },
    done: { status: { in: ['DELIVERED', 'ACTIVATED'] } },
  };

  return { AND: [byFilter[filter] ?? {}, search] };
}

export default async function AdminOrders({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; q?: string }>;
}) {
  await requireStaffOrRedirect('orders.view');
  const { filter = 'all', q = '' } = await searchParams;

  const orders = await db.order.findMany({
    where: whereFor(filter, q.trim()),
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: {
      items: { include: { cards: { select: { serial: true } } } },
      shipment: { select: { awb: true, courier: true } },
    },
  });

  return (
    <>
      <div className="page-head">
        <h1>Orders</h1>
        <p>Filter by what needs doing next. Search by order number, name, email or phone.</p>
      </div>

      <form className="row" style={{ marginBottom: 18 }} action="/admin/orders" method="get">
        <input type="hidden" name="filter" value={filter} />
        <input
          name="q"
          defaultValue={q}
          placeholder="Search orders"
          aria-label="Search orders"
          style={{
            flex: 1, minWidth: 200, padding: '11px 14px', borderRadius: 10,
            background: 'rgba(6,8,12,.7)', border: '1px solid var(--line-strong)', color: 'var(--text-primary)',
          }}
        />
        <button type="submit" className="btn btn-quiet btn-sm">Search</button>
      </form>

      <div className="row" style={{ marginBottom: 20 }}>
        {FILTERS.map((f) => (
          <Link
            key={f.id}
            href={`/admin/orders?filter=${f.id}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
            className={`btn btn-sm ${filter === f.id ? 'btn-accent' : 'btn-quiet'}`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {orders.length === 0 ? (
        <div className="empty">
          <h3>Nothing here</h3>
          <p>{q ? 'No order matched that search.' : 'No orders in this list right now.'}</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Order</th>
                <th>Placed</th>
                <th>Customer</th>
                <th>Items</th>
                <th>Cards</th>
                <th>Total</th>
                <th>Paid</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => {
                const physical = o.items.filter((i) => i.productName.toLowerCase().indexOf('renewal') === -1);
                const assigned = physical.filter((i) => i.cards.length >= i.quantity).length;
                return (
                  <tr key={o.id}>
                    <td><Link href={`/admin/orders/${o.id}`} className="num">{o.orderNumber}</Link></td>
                    <td className="muted tiny">
                      {o.createdAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </td>
                    <td>
                      {o.customerName}
                      <br />
                      <span className="muted tiny">{o.customerPhone}</span>
                    </td>
                    <td className="tiny">{o.items.map((i) => `${i.quantity}x ${i.productName}`).join(', ')}</td>
                    <td>
                      {physical.length === 0 ? (
                        <span className="muted tiny">n/a</span>
                      ) : (
                        <span className={`pill ${assigned === physical.length ? 'live' : 'warn'}`}>
                          {assigned}/{physical.length}
                        </span>
                      )}
                    </td>
                    <td className="num">{rupees(o.totalMinor)}</td>
                    <td>
                      <span className={`pill ${o.paidAt ? 'live' : 'bad'}`}>{o.paidAt ? 'Paid' : 'No'}</span>
                    </td>
                    <td className="tiny">{ORDER_LABEL[o.status] ?? o.status}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
