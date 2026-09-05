import Link from 'next/link';
import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { requireStaffOrRedirect } from '@/lib/guards';
import { rupees } from '@/lib/money';

export const metadata: Metadata = { title: 'Renewals' };
export const dynamic = 'force-dynamic';

const daysLeft = (d: Date) => Math.ceil((d.getTime() - Date.now()) / 86_400_000);

export default async function AdminRenewals() {
  await requireStaffOrRedirect('orders.view');

  const in30 = new Date(Date.now() + 30 * 864e5);

  const [expired, dueSoon, active, revenue] = await Promise.all([
    db.subscription.findMany({
      where: { expiresAt: { lt: new Date() } },
      orderBy: { expiresAt: 'asc' },
      take: 100,
      include: { user: { select: { name: true, email: true, phone: true, profiles: { select: { username: true, status: true } } } } },
    }),
    db.subscription.findMany({
      where: { expiresAt: { gte: new Date(), lte: in30 } },
      orderBy: { expiresAt: 'asc' },
      take: 100,
      include: { user: { select: { name: true, email: true, phone: true } } },
    }),
    db.subscription.count({ where: { status: 'ACTIVE', expiresAt: { gt: in30 } } }),
    db.order.aggregate({
      where: { paidAt: { not: null }, items: { some: { product: { kind: 'RENEWAL' } } } },
      _sum: { totalMinor: true },
      _count: { _all: true },
    }),
  ]);

  return (
    <>
      <div className="page-head">
        <h1>Renewals</h1>
        <p>Who is due, who has lapsed, and what renewals have brought in.</p>
      </div>

      <div className="stats" style={{ marginBottom: 24 }}>
        <div className="stat bad">
          <p className="stat-k">Lapsed</p>
          <p className="stat-v num" style={{ color: expired.length ? '#F09189' : undefined }}>{expired.length}</p>
          <p className="stat-sub">profiles paused</p>
        </div>
        <div className="stat gold">
          <p className="stat-k">Due within 30 days</p>
          <p className="stat-v num">{dueSoon.length}</p>
        </div>
        <div className="stat accent">
          <p className="stat-k">Comfortably active</p>
          <p className="stat-v num">{active}</p>
        </div>
        <div className="stat">
          <p className="stat-k">Renewal revenue</p>
          <p className="stat-v num">{rupees(revenue._sum.totalMinor ?? 0)}</p>
          <p className="stat-sub">{revenue._count._all} renewals paid</p>
        </div>
      </div>

      <div className="stack">
        <div className="card">
          <div className="card-head">
            <h2>Lapsed</h2>
            <span className="muted small">Profiles are paused, cards still resolve to a renew page</span>
          </div>
          {expired.length === 0 ? (
            <p className="muted small">Nobody has lapsed. Good.</p>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr><th>Customer</th><th>Expired</th><th>Overdue</th><th>Profile</th><th>Price</th></tr>
                </thead>
                <tbody>
                  {expired.map((s) => (
                    <tr key={s.id}>
                      <td>{s.user.name}<br /><span className="muted tiny">{s.user.email}</span></td>
                      <td className="muted tiny">{s.expiresAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}</td>
                      <td className="num">{Math.abs(daysLeft(s.expiresAt))} days</td>
                      <td className="tiny">
                        {s.user.profiles.map((p) => (
                          <span key={p.username}>
                            <Link href={`/${p.username}`} target="_blank">/{p.username}</Link>
                            <br /><span className="muted">{p.status.toLowerCase().replace('_', ' ')}</span>
                          </span>
                        ))}
                      </td>
                      <td className="num">{rupees(s.priceMinor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-head">
            <h2>Due in the next 30 days</h2>
            <span className="muted small">Reminders go out automatically at 30, 15, 7 and 1 day</span>
          </div>
          {dueSoon.length === 0 ? (
            <p className="muted small">Nothing due in the next month.</p>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr><th>Customer</th><th>Renews on</th><th>Days left</th><th>Reminders sent</th><th>Price</th></tr>
                </thead>
                <tbody>
                  {dueSoon.map((s) => (
                    <tr key={s.id}>
                      <td>{s.user.name}<br /><span className="muted tiny">{s.user.email}</span></td>
                      <td className="muted tiny">{s.expiresAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}</td>
                      <td className="num">{daysLeft(s.expiresAt)}</td>
                      <td className="tiny">{s.remindersSent.length ? s.remindersSent.join(', ') : <span className="muted">none yet</span>}</td>
                      <td className="num">{rupees(s.priceMinor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
