import Link from 'next/link';
import type { Metadata } from 'next';
import type { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { requireStaffOrRedirect } from '@/lib/guards';
import { can } from '@/lib/auth';

export const metadata: Metadata = { title: 'NFC cards' };
export const dynamic = 'force-dynamic';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'ASSIGNED', label: 'To produce' },
  { id: 'ACTIVE', label: 'Active' },
  { id: 'LOST', label: 'Switched off' },
];

export default async function AdminCards({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const staff = await requireStaffOrRedirect('cards.view');
  const { status = 'all', q = '' } = await searchParams;

  const where: Prisma.NfcCardWhereInput = {
    ...(status !== 'all' ? { status: status as 'ACTIVE' } : {}),
    ...(q.trim()
      ? {
          OR: [
            { serial: { contains: q.trim(), mode: 'insensitive' } },
            { code: { contains: q.trim(), mode: 'insensitive' } },
            { batch: { contains: q.trim(), mode: 'insensitive' } },
            { user: { email: { contains: q.trim(), mode: 'insensitive' } } },
          ],
        }
      : {}),
  };

  const [cards, counts, products] = await Promise.all([
    db.nfcCard.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 300,
      include: {
        product: { select: { name: true } },
        user: { select: { email: true } },
        profile: { select: { username: true } },
      },
    }),
    db.nfcCard.groupBy({ by: ['status'], _count: { _all: true } }),
    db.product.findMany({
      where: { kind: { not: 'RENEWAL' }, status: { not: 'ARCHIVED' } },
      orderBy: { position: 'asc' },
      select: { id: true, name: true, sku: true },
    }),
  ]);

  const countBy = Object.fromEntries(counts.map((c) => [c.status, c._count._all]));

  return (
    <>
      <div className="page-head">
        <h1>NFC cards</h1>
        <p>
          Every physical card, what it points at, and who has it. The chip only ever stores{' '}
          <span className="num">{env.appUrl.replace(/^https?:\/\//, '')}/c/CODE</span>, so a destination can change
          without the card ever being touched.
        </p>
        <p style={{ marginTop: 14 }}>
          <Link href="/admin/cards/print" className="btn btn-quiet btn-sm">
            Print sheet for the card printer
          </Link>
        </p>
      </div>

      <div className="stats" style={{ marginBottom: 22 }}>
        <div className="stat accent">
          {/* nothing is printed before it is ordered, so this is the print queue */}
          <p className="stat-k">To produce</p>
          <p className="stat-v num">{countBy.ASSIGNED ?? 0}</p>
        </div>
        <div className="stat">
          <p className="stat-k">Active</p>
          <p className="stat-v num">{countBy.ACTIVE ?? 0}</p>
        </div>
        <div className="stat">
          <p className="stat-k">Never ordered</p>
          <p className="stat-v num">{countBy.UNASSIGNED ?? 0}</p>
        </div>
        <div className="stat">
          <p className="stat-k">Switched off</p>
          <p className="stat-v num">{(countBy.LOST ?? 0) + (countBy.SUSPENDED ?? 0) + (countBy.REPLACED ?? 0)}</p>
        </div>
      </div>

      {can(staff.role, 'cards.manage') && products.length > 0 ? (
        <div style={{ marginBottom: 24 }}>
        </div>
      ) : null}

      <form className="row" style={{ marginBottom: 16 }} action="/admin/cards" method="get">
        <input type="hidden" name="status" value={status} />
        <input
          name="q"
          defaultValue={q}
          placeholder="Search by serial, code, batch or customer email"
          aria-label="Search cards"
          style={{
            flex: 1, minWidth: 220, padding: '11px 14px', borderRadius: 10,
            background: 'rgba(6,8,12,.7)', border: '1px solid var(--line-strong)', color: 'var(--text-primary)',
          }}
        />
        <button type="submit" className="btn btn-quiet btn-sm">Search</button>
      </form>

      <div className="row" style={{ marginBottom: 18 }}>
        {FILTERS.map((f) => (
          <Link
            key={f.id}
            href={`/admin/cards?status=${f.id}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
            className={`btn btn-sm ${status === f.id ? 'btn-accent' : 'btn-quiet'}`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {cards.length === 0 ? (
        <div className="empty">
          <h3>No cards here</h3>
          <p>{q ? 'Nothing matched that search.' : 'Generate a batch above to put cards into stock.'}</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>QR</th>
                <th>Serial</th>
                <th>Product</th>
                <th>Status</th>
                <th>Points at</th>
                <th>Customer</th>
                <th>Taps</th>
                <th>Batch</th>
              </tr>
            </thead>
            <tbody>
              {cards.map((c) => (
                <tr key={c.id}>
                  <td>
                    {/* the code actually printed on this card, so it is obvious
                        at a glance which one belongs to whom */}
                    <a href={`/api/admin/cards/${c.id}/qr?format=png&size=512`} target="_blank" rel="noopener" title={`QR for ${c.serial}`}>
                      <img
                        src={`/api/admin/cards/${c.id}/qr?format=png&size=160`}
                        alt={`QR code for card ${c.serial}`}
                        width={56}
                        height={56}
                        style={{ display: 'block', borderRadius: 6, background: '#fff', padding: 3 }}
                      />
                    </a>
                  </td>
                  <td className="num">
                    {c.serial}
                    <br />
                    <span className="muted tiny">/c/{c.code}</span>
                    <br />
                    <a className="muted tiny" href={`/api/admin/cards/${c.id}/qr?download=1`} style={{ textDecoration: 'underline' }}>
                      download SVG
                    </a>
                  </td>
                  <td className="tiny">{c.product?.name ?? '—'}</td>
                  <td>
                    <span className={`pill ${c.status === 'ACTIVE' ? 'live' : c.status === 'ASSIGNED' ? 'warn' : c.status === 'UNASSIGNED' ? '' : 'bad'}`}>
                      {c.status.toLowerCase()}
                    </span>
                  </td>
                  <td className="tiny">
                    {c.destinationType === 'PROFILE'
                      ? c.profile?.username
                        ? <Link href={`/${c.profile.username}`} target="_blank">/{c.profile.username}</Link>
                        : <span className="muted">no profile</span>
                      : c.destinationUrl
                        ? <span className="muted">{c.destinationUrl.slice(0, 40)}</span>
                        : <span className="muted">{c.destinationType.toLowerCase()}, not set</span>}
                  </td>
                  <td className="tiny">{c.user?.email ?? <span className="muted">unassigned</span>}</td>
                  <td className="num">{c.tapCount}</td>
                  <td className="muted tiny">{c.batch ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
