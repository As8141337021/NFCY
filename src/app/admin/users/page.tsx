import Link from 'next/link';
import type { Metadata } from 'next';
import type { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { requireStaffOrRedirect } from '@/lib/guards';
import { can } from '@/lib/auth';
import { rupees } from '@/lib/money';
import UserRow from './UserRow';

export const metadata: Metadata = { title: 'Customers' };
export const dynamic = 'force-dynamic';

export default async function AdminUsers({ searchParams }: { searchParams: Promise<{ q?: string; role?: string }> }) {
  const staff = await requireStaffOrRedirect('users.view');
  const { q = '', role = 'all' } = await searchParams;

  const where: Prisma.UserWhereInput = {
    ...(role !== 'all' ? { role: role as 'CUSTOMER' } : {}),
    ...(q.trim()
      ? {
          OR: [
            { email: { contains: q.trim(), mode: 'insensitive' } },
            { name: { contains: q.trim(), mode: 'insensitive' } },
            { phone: { contains: q.trim() } },
          ],
        }
      : {}),
  };

  const users = await db.user.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: {
      profiles: { select: { username: true, status: true } },
      _count: { select: { orders: true, cards: true } },
      orders: { where: { paidAt: { not: null } }, select: { totalMinor: true } },
    },
  });

  return (
    <>
      <div className="page-head">
        <h1>Customers</h1>
        <p>Everyone with an account, what they have spent, and what they hold.</p>
      </div>

      <form className="row" style={{ marginBottom: 16 }} action="/admin/users" method="get">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search by name, email or phone"
          aria-label="Search customers"
          style={{
            flex: 1, minWidth: 220, padding: '11px 14px', borderRadius: 10,
            background: 'rgba(6,8,12,.7)', border: '1px solid var(--line-strong)', color: 'var(--text-primary)',
          }}
        />
        <select
          name="role"
          defaultValue={role}
          aria-label="Filter by role"
          style={{ padding: '11px 14px', borderRadius: 10, background: 'rgba(6,8,12,.7)', border: '1px solid var(--line-strong)', color: 'var(--text-primary)' }}
        >
          <option value="all">Every role</option>
          <option value="CUSTOMER">Customers</option>
          <option value="SUPPORT">Support</option>
          <option value="OPERATIONS">Operations</option>
          <option value="ADMIN">Admin</option>
          <option value="SUPER_ADMIN">Super admin</option>
        </select>
        <button type="submit" className="btn btn-quiet btn-sm">Search</button>
      </form>

      {users.length === 0 ? (
        <div className="empty"><h3>Nobody here</h3><p>Nothing matched that search.</p></div>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Person</th>
                <th>Joined</th>
                <th>Profile</th>
                <th>Orders</th>
                <th>Spent</th>
                <th>Cards</th>
                <th>Role</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    {u.name}
                    <br />
                    <span className="muted tiny">{u.email}</span>
                    {u.phone ? <><br /><span className="muted tiny">{u.phone}</span></> : null}
                  </td>
                  <td className="muted tiny">{u.createdAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}</td>
                  <td className="tiny">
                    {u.profiles.length === 0 ? (
                      <span className="muted">none</span>
                    ) : (
                      u.profiles.map((p) => (
                        <span key={p.username}>
                          <Link href={`/${p.username}`} target="_blank">/{p.username}</Link>
                          <br />
                          <span className="muted">{p.status.toLowerCase()}</span>
                        </span>
                      ))
                    )}
                  </td>
                  <td className="num">{u._count.orders}</td>
                  <td className="num">{rupees(u.orders.reduce((n, o) => n + o.totalMinor, 0))}</td>
                  <td className="num">{u._count.cards}</td>
                  <UserRow
                    id={u.id}
                    role={u.role}
                    status={u.status}
                    canManage={can(staff.role, 'users.manage')}
                    isSelf={u.id === staff.id}
                  />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
