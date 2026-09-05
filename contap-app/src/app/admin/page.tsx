import Link from 'next/link';
import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { requireStaffOrRedirect } from '@/lib/guards';
import { rupees } from '@/lib/money';
import { ORDER_LABEL } from '@/lib/orders';
import { revenueStats, platformStats, productSales, revenueSeries, renewalRate } from '@/lib/adminStats';

export const metadata: Metadata = { title: 'Admin' };
export const dynamic = 'force-dynamic';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * A revenue bucket key is already a plain YYYY-MM-DD.
 * Formatting it by hand rather than going through Date and toLocaleDateString
 * keeps the server and the browser in agreement whatever timezone either one
 * happens to be in, and never shifts a bar onto the wrong day.
 */
function shortDate(key: string): string {
  const [, m, d] = key.split('-');
  return `${Number(d)} ${MONTHS[Number(m) - 1] ?? ''}`;
}

export default async function AdminOverview() {
  await requireStaffOrRedirect('orders.view');

  const [money, platform, sales, series, renewals, recent, needsCard] = await Promise.all([
    revenueStats(),
    platformStats(),
    productSales(),
    revenueSeries(30),
    renewalRate(),
    db.order.findMany({
      orderBy: { createdAt: 'desc' },
      take: 8,
      include: { items: { select: { productName: true, quantity: true } } },
    }),
    db.orderItem.count({
      where: { cards: { none: {} }, order: { paidAt: { not: null }, status: { notIn: ['CANCELLED'] } }, product: { kind: { not: 'RENEWAL' } } },
    }),
  ]);

  const maxRevenue = Math.max(1, ...series.map((s) => s.revenueMinor));

  return (
    <>
      <div className="page-head">
        <h1>Overview</h1>
        <p>Every number here is read from real orders and real events. Nothing is estimated.</p>
      </div>

      <div className="stack">
        <div className="stats">
          <div className="stat accent">
            <p className="stat-k">Revenue today</p>
            <p className="stat-v num">{rupees(money.todayMinor)}</p>
          </div>
          <div className="stat">
            <p className="stat-k">This month</p>
            <p className="stat-v num">{rupees(money.monthMinor)}</p>
            <p className="stat-sub">{money.ordersThisMonth} orders</p>
          </div>
          <div className="stat">
            <p className="stat-k">This year</p>
            <p className="stat-v num">{rupees(money.yearMinor)}</p>
          </div>
          <div className="stat">
            <p className="stat-k">Average order</p>
            <p className="stat-v num">{rupees(money.averageOrderMinor)}</p>
            <p className="stat-sub">{money.paidOrders} paid orders</p>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h2>Revenue, last 30 days</h2>
            <span className="muted small">{rupees(money.monthMinor)} this month</span>
          </div>
          {money.allTimeMinor === 0 ? (
            <p className="muted small">No paid orders yet. The chart fills in from the first real payment.</p>
          ) : (
            <>
              {/* Plain elements rather than an SVG on purpose. React treats a
                  <title> as document metadata and hoists it out of the tree,
                  which emptied every bar's tooltip on the server and then
                  refilled it in the browser: a hydration mismatch on a chart
                  nobody could hover anyway. A title attribute just works. */}
              <div className="bars" role="img" aria-label={`Revenue for each of the last ${series.length} days`}>
                {series.map((s) => (
                  <div key={s.date} className="bars-col" title={`${shortDate(s.date)}: ${rupees(s.revenueMinor)}`}>
                    <span
                      className={s.revenueMinor > 0 ? 'on' : ''}
                      style={{ height: `${Math.max(1, (s.revenueMinor / maxRevenue) * 100)}%` }}
                    />
                  </div>
                ))}
              </div>
              <div className="bars-axis" aria-hidden="true">
                {series.map((s, i) => (
                  <span key={s.date}>{i % 6 === 0 ? shortDate(s.date) : ''}</span>
                ))}
              </div>
            </>
          )}
        </div>

        {(platform.pendingOrders > 0 || needsCard > 0 || platform.expiringSoon > 0) && (
          <div className="card" style={{ borderColor: 'rgba(217,176,106,.35)' }}>
            <div className="card-head">
              <h2>Needs attention</h2>
            </div>
            <div className="stack-sm">
              {needsCard > 0 ? (
                <div className="row">
                  <span className="pill warn">{needsCard}</span>
                  <span className="small">
                    paid order line{needsCard === 1 ? '' : 's'} with no card assigned yet
                  </span>
                  <Link href="/admin/orders?filter=needs-card" className="btn btn-quiet btn-sm row-end">
                    Assign cards
                  </Link>
                </div>
              ) : null}
              {platform.pendingOrders > 0 ? (
                <div className="row">
                  <span className="pill warn">{platform.pendingOrders}</span>
                  <span className="small">paid orders still in progress</span>
                  <Link href="/admin/orders" className="btn btn-quiet btn-sm row-end">
                    Open orders
                  </Link>
                </div>
              ) : null}
              {platform.expiringSoon > 0 ? (
                <div className="row">
                  <span className="pill warn">{platform.expiringSoon}</span>
                  <span className="small">renewals due in the next 30 days</span>
                  <Link href="/admin/renewals" className="btn btn-quiet btn-sm row-end">
                    See renewals
                  </Link>
                </div>
              ) : null}
            </div>
          </div>
        )}

        <div className="stats">
          <div className="stat">
            <p className="stat-k">Customers</p>
            <p className="stat-v num">{platform.users}</p>
            <p className="stat-sub">{platform.newUsers} joined in 30 days</p>
          </div>
          <div className="stat">
            <p className="stat-k">Profiles live</p>
            <p className="stat-v num">{platform.published}</p>
            <p className="stat-sub">of {platform.profiles} created</p>
          </div>
          <div className="stat">
            <p className="stat-k">Cards active</p>
            <p className="stat-v num">{platform.cardsActive}</p>
            <p className="stat-sub">of {platform.cardsMade} made</p>
          </div>
          <div className="stat">
            <p className="stat-k">Subscriptions</p>
            <p className="stat-v num">{platform.activeSubscriptions}</p>
            <p className="stat-sub">{platform.expiringSoon} due within 30 days</p>
          </div>
          <div className="stat">
            <p className="stat-k">Renewal rate</p>
            <p className="stat-v num">{renewals.rate === null ? '—' : `${renewals.rate}%`}</p>
            <p className="stat-sub">
              {renewals.rate === null ? 'not enough history yet' : `${renewals.renewed} of ${renewals.eligible}`}
            </p>
          </div>
        </div>

        <div className="stats" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))' }}>
          <div className="card">
            <div className="card-head">
              <h2>Sales by product</h2>
            </div>
            {sales.length === 0 ? (
              <p className="muted small">Nothing sold yet.</p>
            ) : (
              <div className="table-wrap">
                <table className="data" style={{ minWidth: 0 }}>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th style={{ textAlign: 'right' }}>Units</th>
                      <th style={{ textAlign: 'right' }}>Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sales.map((s) => (
                      <tr key={s.name}>
                        <td>{s.name}</td>
                        <td className="num" style={{ textAlign: 'right' }}>{s.units}</td>
                        <td className="num" style={{ textAlign: 'right' }}>{rupees(s.revenueMinor)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-head">
              <h2>Latest orders</h2>
              <Link href="/admin/orders" className="small" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
                All orders
              </Link>
            </div>
            {recent.length === 0 ? (
              <p className="muted small">No orders yet.</p>
            ) : (
              <div className="table-wrap">
                <table className="data" style={{ minWidth: 0 }}>
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>Customer</th>
                      <th>Total</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map((o) => (
                      <tr key={o.id}>
                        <td><Link href={`/admin/orders/${o.id}`} className="num">{o.orderNumber}</Link></td>
                        <td>{o.customerName}</td>
                        <td className="num">{rupees(o.totalMinor)}</td>
                        <td>
                          <span className={`pill ${o.paidAt ? 'live' : ''}`}>{ORDER_LABEL[o.status] ?? o.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
