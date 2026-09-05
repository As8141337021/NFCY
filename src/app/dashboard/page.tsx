import Link from 'next/link';
import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { requireUserOrRedirect } from '@/lib/guards';
import { editorInclude, completion, type FullProfile } from '@/lib/profile';
import { totals } from '@/lib/analytics';
import { profileUrl } from '@/lib/qr';
import { rupees } from '@/lib/money';
import { IconExternal, IconCheck } from '@/components/icons';
import CopyLink from '@/components/CopyLink';

export const metadata: Metadata = { title: 'Overview' };
export const dynamic = 'force-dynamic';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

const ORDER_LABEL: Record<string, string> = {
  PAYMENT_PENDING: 'Waiting for payment',
  PAYMENT_RECEIVED: 'Payment received',
  PROFILE_PENDING: 'Waiting on your profile',
  PROFILE_COMPLETED: 'Profile ready',
  DESIGN_PROCESSING: 'In design',
  MANUFACTURING: 'Being made',
  DISPATCHED: 'On its way',
  DELIVERED: 'Delivered',
  ACTIVATED: 'Active',
  CANCELLED: 'Cancelled',
};

export default async function Overview() {
  const user = await requireUserOrRedirect('/dashboard');

  const profiles = (await db.profile.findMany({
    where: { userId: user.id },
    include: editorInclude,
    orderBy: { createdAt: 'asc' },
  })) as FullProfile[];

  const primary = profiles[0] ?? null;
  const profileIds = profiles.map((p) => p.id);

  const [stats, cards, orders, subscription, newLeads] = await Promise.all([
    totals(profileIds, 30),
    db.nfcCard.findMany({
      where: { userId: user.id },
      include: { product: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 4,
    }),
    db.order.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 3,
      include: { items: { select: { productName: true, quantity: true } } },
    }),
    db.subscription.findFirst({
      where: { userId: user.id, status: { in: ['ACTIVE', 'EXPIRING'] } },
      orderBy: { expiresAt: 'desc' },
    }),
    profileIds.length
      ? db.lead.count({ where: { profileId: { in: profileIds }, status: 'NEW' } })
      : Promise.resolve(0),
  ]);

  const firstName = user.name.split(' ')[0];

  if (!primary) {
    return (
      <>
        <div className="page-head">
          <h1>{greeting()}, {firstName}</h1>
          <p>One thing left before anything else works: your profile.</p>
        </div>

        <div className="card">
          <h2 style={{ fontSize: '1.2rem' }}>Build your digital profile</h2>
          <p className="muted" style={{ marginTop: 10, maxWidth: '56ch' }}>
            This is what opens when somebody taps your card. Your name, your business, your links,
            your products, how to reach you. It takes about ten minutes, and you can change every
            word of it later.
          </p>
          <div className="row" style={{ marginTop: 22 }}>
            <Link href="/dashboard/profile/new" className="btn btn-accent">
              Create my profile
            </Link>
            <Link href="/cards" className="btn btn-ghost">
              Look at the cards
            </Link>
          </div>
        </div>
      </>
    );
  }

  const comp = completion(primary);
  const missing = comp.steps.filter((s) => !s.done).slice(0, 5);
  const url = profileUrl(primary.username);
  const daysLeft = subscription
    ? Math.ceil((subscription.expiresAt.getTime() - Date.now()) / 86_400_000)
    : null;

  return (
    <>
      <div className="page-head">
        <h1>{greeting()}, {firstName}</h1>
        <p>
          {primary.status === 'PUBLISHED'
            ? 'Your profile is live. Here is what happened in the last 30 days.'
            : 'Your profile is still a draft. Publish it and the numbers below start moving.'}
        </p>
      </div>

      <div className="stack">
        {/* profile completion */}
        <div className="card">
          <div className="card-head">
            <div>
              <h2>Your profile is {comp.percent}% complete</h2>
              <p className="muted small" style={{ marginTop: 6 }}>
                {comp.percent === 100
                  ? 'Nothing left to fill in.'
                  : 'The fuller it is, the more people do something after they tap.'}
              </p>
            </div>
            <Link href="/dashboard/profile" className="btn btn-accent btn-sm">
              {comp.percent === 100 ? 'Edit my profile' : 'Complete my profile'}
            </Link>
          </div>

          <div className="progress" role="progressbar" aria-valuenow={comp.percent} aria-valuemin={0} aria-valuemax={100}>
            <i style={{ width: `${comp.percent}%` }} />
          </div>

          {missing.length > 0 && (
            <ul className="todo">
              {missing.map((s) => (
                <li key={s.key}>
                  <span className="box" aria-hidden="true" />
                  <Link href={s.href} style={{ color: 'inherit', textDecoration: 'none' }}>
                    {s.label}
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <div className="divider" />
          <div className="row">
            <span className={`pill ${primary.status === 'PUBLISHED' ? 'live' : 'warn'}`}>
              {primary.status === 'PUBLISHED' ? 'Live' : primary.status === 'DRAFT' ? 'Draft' : primary.status.replace('_', ' ')}
            </span>
            <CopyLink url={url} />
            {primary.status === 'PUBLISHED' ? (
              <a href={`/${primary.username}`} target="_blank" rel="noopener" className="btn btn-quiet btn-sm">
                <IconExternal /> View it
              </a>
            ) : null}
          </div>
        </div>

        {/* the numbers */}
        <div className="stats">
          <div className="stat accent">
            <p className="stat-k">Profile views</p>
            <p className="stat-v num">{stats.views}</p>
            <p className="stat-sub">{stats.uniqueVisitors} different people</p>
          </div>
          <div className="stat">
            <p className="stat-k">Card taps</p>
            <p className="stat-v num">{stats.taps}</p>
            <p className="stat-sub">last 30 days</p>
          </div>
          <div className="stat">
            <p className="stat-k">QR scans</p>
            <p className="stat-v num">{stats.scans}</p>
            <p className="stat-sub">last 30 days</p>
          </div>
          <div className="stat">
            <p className="stat-k">Button clicks</p>
            <p className="stat-v num">{stats.clicks}</p>
            <p className="stat-sub">calls, WhatsApp, links</p>
          </div>
          <div className="stat">
            <p className="stat-k">Enquiries</p>
            <p className="stat-v num">{stats.leads}</p>
            <p className="stat-sub">{newLeads} still unread</p>
          </div>
        </div>

        <div className="stats" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))' }}>
          {/* cards */}
          <div className="card">
            <div className="card-head">
              <h2>My cards</h2>
              <Link href="/dashboard/cards" className="small" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
                All cards
              </Link>
            </div>
            {cards.length === 0 ? (
              <p className="muted small">
                No card yet. Your profile already works as a link, and a card makes it something you can hand over.{' '}
                <Link href="/cards" style={{ color: 'var(--accent)' }}>See the cards</Link>.
              </p>
            ) : (
              <div className="stack-sm">
                {cards.map((c) => (
                  <div key={c.id} className="item-row">
                    <span className="grow">
                      <b>{c.product?.name ?? 'NFCY card'}</b>
                      <span className="mono-label">{c.serial}</span>
                    </span>
                    <span className={`pill ${c.status === 'ACTIVE' ? 'live' : c.status === 'ASSIGNED' ? 'warn' : ''}`}>
                      {c.status === 'ACTIVE' ? 'Active' : c.status === 'ASSIGNED' ? 'Activate it' : c.status.toLowerCase()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* renewal */}
          <div className="card">
            <div className="card-head">
              <h2>Renewal</h2>
              <Link href="/dashboard/renewal" className="small" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
                Details
              </Link>
            </div>
            {subscription ? (
              <>
                <p className="stat-v num" style={{ color: daysLeft !== null && daysLeft <= 30 ? 'var(--gold)' : undefined }}>
                  {daysLeft !== null && daysLeft > 0 ? `${daysLeft} days` : 'Due now'}
                </p>
                <p className="muted small" style={{ marginTop: 8 }}>
                  {subscription.planName} renews on{' '}
                  {subscription.expiresAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}{' '}
                  for {rupees(subscription.priceMinor)}.
                </p>
                {daysLeft !== null && daysLeft <= 30 ? (
                  <Link href="/dashboard/renewal" className="btn btn-accent btn-sm" style={{ marginTop: 16 }}>
                    Renew now
                  </Link>
                ) : null}
              </>
            ) : (
              <p className="muted small">
                Nothing to renew yet. Your first year starts when your card is activated, and you will see the exact
                date here.
              </p>
            )}
          </div>
        </div>

        {/* orders */}
        {orders.length > 0 && (
          <div className="card">
            <div className="card-head">
              <h2>Recent orders</h2>
              <Link href="/dashboard/orders" className="small" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
                All orders
              </Link>
            </div>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>What</th>
                    <th>Total</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id}>
                      <td>
                        <Link href={`/dashboard/orders/${o.id}`} className="num">{o.orderNumber}</Link>
                      </td>
                      <td>{o.items.map((i) => `${i.quantity} x ${i.productName}`).join(', ')}</td>
                      <td className="num">{rupees(o.totalMinor)}</td>
                      <td>
                        <span className={`pill ${o.status === 'ACTIVATED' || o.status === 'DELIVERED' ? 'live' : o.status === 'CANCELLED' ? 'bad' : 'warn'}`}>
                          {ORDER_LABEL[o.status] ?? o.status}
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
