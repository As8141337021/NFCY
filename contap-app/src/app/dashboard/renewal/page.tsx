import Link from 'next/link';
import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { requireUserOrRedirect } from '@/lib/guards';
import { rupees } from '@/lib/money';
import RenewButton from './RenewButton';

export const metadata: Metadata = { title: 'Renewal' };
export const dynamic = 'force-dynamic';

const fullDate = (d: Date) => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

export default async function RenewalPage() {
  const user = await requireUserOrRedirect('/dashboard/renewal');

  const [subscription, renewalProduct, dbUser, history] = await Promise.all([
    db.subscription.findFirst({ where: { userId: user.id }, orderBy: { expiresAt: 'desc' } }),
    db.product.findFirst({ where: { kind: 'RENEWAL' } }),
    db.user.findUniqueOrThrow({ where: { id: user.id }, select: { name: true, email: true, phone: true } }),
    db.order.findMany({
      where: { userId: user.id, items: { some: { product: { kind: 'RENEWAL' } } } },
      orderBy: { createdAt: 'desc' },
      take: 12,
      include: { payments: { where: { status: 'SUCCESSFUL' }, take: 1 } },
    }),
  ]);

  const price = renewalProduct?.priceMinor ?? 29900;
  const daysLeft = subscription
    ? Math.ceil((subscription.expiresAt.getTime() - Date.now()) / 86_400_000)
    : null;
  const expired = daysLeft !== null && daysLeft <= 0;
  const soon = daysLeft !== null && daysLeft > 0 && daysLeft <= 30;

  return (
    <>
      <div className="page-head">
        <h1>Renewal</h1>
        <p>What you pay, what it keeps running, and exactly when it is due. Nothing hidden.</p>
      </div>

      <div className="stack">
        {subscription ? (
          <div className="card" style={{ borderColor: expired ? 'rgba(224,100,90,.5)' : soon ? 'rgba(217,176,106,.5)' : undefined }}>
            <div className="card-head">
              <h2>{subscription.planName}</h2>
              <span className={`pill ${expired ? 'bad' : soon ? 'warn' : 'live'}`}>
                {expired ? 'Renewal due' : soon ? 'Due soon' : 'Active'}
              </span>
            </div>

            <div className="stats" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))' }}>
              <div className="stat">
                <p className="stat-k">Started</p>
                <p className="stat-v" style={{ fontSize: '1.05rem', paddingTop: 8 }}>{fullDate(subscription.activatedAt)}</p>
              </div>
              <div className="stat">
                <p className="stat-k">Renews on</p>
                <p className="stat-v" style={{ fontSize: '1.05rem', paddingTop: 8 }}>{fullDate(subscription.expiresAt)}</p>
              </div>
              <div className={`stat ${expired ? '' : 'accent'}`}>
                <p className="stat-k">Days left</p>
                <p className="stat-v num">{daysLeft !== null && daysLeft > 0 ? daysLeft : 0}</p>
              </div>
              <div className="stat">
                <p className="stat-k">Price</p>
                <p className="stat-v num">{rupees(price)}</p>
                <p className="stat-sub">per year</p>
              </div>
            </div>

            <div className="divider" />

            {expired ? (
              <p className="form-error" style={{ marginBottom: 16 }}>
                Your profile has paused. Your card is not bricked and your link has not changed. Renew and it comes
                straight back exactly as it was.
              </p>
            ) : soon ? (
              <p className="muted small" style={{ marginBottom: 16 }}>
                Renewing now adds a year to the date above, so paying early never costs you the days you already have.
              </p>
            ) : (
              <p className="muted small" style={{ marginBottom: 16 }}>
                Nothing to do right now. We will remind you 30, 15, 7 and 1 day before it is due, so your card never
                fails in front of someone.
              </p>
            )}

            <RenewButton
              priceMinor={price}
              customer={{ name: dbUser.name, email: dbUser.email, phone: dbUser.phone ?? '' }}
              label={expired ? `Renew now, ${rupees(price)}` : `Renew early, ${rupees(price)}`}
            />
          </div>
        ) : (
          <div className="card">
            <div className="card-head">
              <h2>Nothing to renew yet</h2>
            </div>
            <p className="muted small">
              Your first year begins the day you activate a card. You will see the exact date here from that moment,
              along with how many days are left.
            </p>
            <p style={{ marginTop: 18 }}>
              <Link href="/dashboard/cards" className="btn btn-ghost btn-sm">
                Activate a card
              </Link>
            </p>
          </div>
        )}

        <div className="card">
          <div className="card-head">
            <h2>What the {rupees(price)} pays for</h2>
          </div>
          <ul className="feats">
            <li>Your profile stays online at the same link</li>
            <li>The short link on your card keeps resolving</li>
            <li>Your QR code keeps working, on everything you have already printed</li>
            <li>Your analytics are kept and keep counting</li>
            <li>You can change anything on your profile as often as you like</li>
          </ul>
          <div className="divider" />
          <p className="muted small">
            The card itself is yours. You bought it once and we never take it back. If a renewal lapses, the profile
            pauses and comes back the moment you renew.
          </p>
        </div>

        {history.length > 0 && (
          <div className="card">
            <div className="card-head">
              <h2>Renewal history</h2>
            </div>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Date</th>
                    <th>Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((o) => (
                    <tr key={o.id}>
                      <td>
                        <Link href={`/dashboard/orders/${o.id}`} className="num">{o.orderNumber}</Link>
                      </td>
                      <td className="muted">{fullDate(o.createdAt)}</td>
                      <td className="num">{rupees(o.totalMinor)}</td>
                      <td>
                        <span className={`pill ${o.payments.length ? 'live' : 'warn'}`}>
                          {o.payments.length ? 'Paid' : 'Unpaid'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
