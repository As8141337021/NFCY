import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { requireStaffOrRedirect } from '@/lib/guards';

export const metadata: Metadata = { title: 'Audit log' };
export const dynamic = 'force-dynamic';

export default async function AdminAudit() {
  await requireStaffOrRedirect('audit.view');

  const rows = await db.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 300,
    include: { user: { select: { name: true, email: true, role: true } } },
  });

  return (
    <>
      <div className="page-head">
        <h1>Audit log</h1>
        <p>Who changed what, and when. Written for every staff action that touches money, access or a customer.</p>
      </div>

      {rows.length === 0 ? (
        <div className="empty">
          <h3>Nothing logged yet</h3>
          <p>Staff actions appear here as they happen.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>When</th>
                <th>Who</th>
                <th>Action</th>
                <th>On</th>
                <th>Change</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="muted tiny">
                    {r.createdAt.toLocaleString('en-IN', {
                      day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
                    })}
                  </td>
                  <td className="tiny">
                    {r.user ? (
                      <>
                        {r.user.name}
                        <br />
                        <span className="muted">{r.user.role.toLowerCase()}</span>
                      </>
                    ) : (
                      <span className="muted">system</span>
                    )}
                  </td>
                  <td className="tiny num">{r.action}</td>
                  <td className="tiny">
                    {r.entityType}
                    <br />
                    <span className="muted">{r.entityId?.slice(0, 8) ?? ''}</span>
                  </td>
                  <td className="tiny muted" style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {r.after ? JSON.stringify(r.after).slice(0, 120) : ''}
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
