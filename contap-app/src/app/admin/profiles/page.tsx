import Link from 'next/link';
import type { Metadata } from 'next';
import type { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { requireStaffOrRedirect } from '@/lib/guards';

export const metadata: Metadata = { title: 'Profiles' };
export const dynamic = 'force-dynamic';

export default async function AdminProfiles({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  await requireStaffOrRedirect('profiles.view');
  const { q = '', status = 'all' } = await searchParams;

  const where: Prisma.ProfileWhereInput = {
    ...(status !== 'all' ? { status: status as 'PUBLISHED' } : {}),
    ...(q.trim()
      ? {
          OR: [
            { username: { contains: q.trim(), mode: 'insensitive' } },
            { fullName: { contains: q.trim(), mode: 'insensitive' } },
            { company: { contains: q.trim(), mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const profiles = await db.profile.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: {
      user: { select: { email: true } },
      _count: { select: { cards: true, leads: true, events: true } },
    },
  });

  const inputStyle = {
    padding: '11px 14px',
    borderRadius: 10,
    background: 'rgba(6,8,12,.7)',
    border: '1px solid var(--line-strong)',
    color: 'var(--text-primary)',
  } as const;

  return (
    <>
      <div className="page-head">
        <h1>Profiles</h1>
        <p>Every profile on the platform, live or not.</p>
      </div>

      <form className="row" style={{ marginBottom: 16 }} action="/admin/profiles" method="get">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search by link, name or company"
          aria-label="Search profiles"
          style={{ ...inputStyle, flex: 1, minWidth: 220 }}
        />
        <select name="status" defaultValue={status} aria-label="Filter by status" style={inputStyle}>
          <option value="all">Every status</option>
          <option value="PUBLISHED">Live</option>
          <option value="DRAFT">Draft</option>
          <option value="SUSPENDED">Suspended</option>
          <option value="RENEWAL_REQUIRED">Renewal required</option>
        </select>
        <button type="submit" className="btn btn-quiet btn-sm">
          Search
        </button>
      </form>

      {profiles.length === 0 ? (
        <div className="empty">
          <h3>Nothing here</h3>
          <p>No profile matched that.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Link</th>
                <th>Who</th>
                <th>Status</th>
                <th>Cards</th>
                <th>Enquiries</th>
                <th>Events</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link href={`/${p.username}`} target="_blank" className="num">
                      /{p.username}
                    </Link>
                  </td>
                  <td className="tiny">
                    {p.fullName}
                    <br />
                    <span className="muted">{p.user.email}</span>
                  </td>
                  <td>
                    <span
                      className={`pill ${p.status === 'PUBLISHED' ? 'live' : p.status === 'DRAFT' ? 'warn' : 'bad'}`}
                    >
                      {p.status.toLowerCase().replace('_', ' ')}
                    </span>
                  </td>
                  <td className="num">{p._count.cards}</td>
                  <td className="num">{p._count.leads}</td>
                  <td className="num">{p._count.events}</td>
                  <td className="muted tiny">
                    {p.createdAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}
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
