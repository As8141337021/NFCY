import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { requireStaffOrRedirect } from '@/lib/guards';

export const metadata: Metadata = { title: 'Messages' };
export const dynamic = 'force-dynamic';

export default async function AdminNotifications({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireStaffOrRedirect('orders.view');
  const { status = 'all' } = await searchParams;

  const [rows, counts] = await Promise.all([
    db.notification.findMany({
      where: status !== 'all' ? { status } : {},
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
    db.notification.groupBy({ by: ['status'], _count: { _all: true } }),
  ]);

  const countBy = Object.fromEntries(counts.map((c) => [c.status, c._count._all]));

  return (
    <>
      <div className="page-head">
        <h1>Messages</h1>
        <p>
          Every email the platform has generated. Each one is written down before it is sent, so nothing is ever
          silently lost.
        </p>
      </div>

      {!env.mail.configured ? (
        <p className="form-error" style={{ marginBottom: 20 }}>
          No mail server is configured, so messages are queued here rather than delivered. Set the SMTP values in the
          environment and they start going out. Nothing below has been sent.
        </p>
      ) : null}

      <div className="stats" style={{ marginBottom: 20 }}>
        <div className="stat">
          <p className="stat-k">Queued</p>
          <p className="stat-v num">{countBy.queued ?? 0}</p>
        </div>
        <div className="stat accent">
          <p className="stat-k">Sent</p>
          <p className="stat-v num">{countBy.sent ?? 0}</p>
        </div>
        <div className="stat">
          <p className="stat-k">Failed</p>
          <p className="stat-v num" style={{ color: countBy.failed ? '#F09189' : undefined }}>
            {countBy.failed ?? 0}
          </p>
        </div>
      </div>

      <div className="row" style={{ marginBottom: 18 }}>
        {['all', 'queued', 'sent', 'failed'].map((s) => (
          <a
            key={s}
            href={`/admin/notifications?status=${s}`}
            className={`btn btn-sm ${status === s ? 'btn-accent' : 'btn-quiet'}`}
          >
            {s === 'all' ? 'All' : s}
          </a>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="empty">
          <h3>Nothing here</h3>
          <p>No messages in this list.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>When</th>
                <th>To</th>
                <th>Subject</th>
                <th>Template</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((n) => (
                <tr key={n.id}>
                  <td className="muted tiny">
                    {n.createdAt.toLocaleString('en-IN', {
                      day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
                    })}
                  </td>
                  <td className="tiny">{n.toAddress}</td>
                  <td className="tiny">
                    {n.subject}
                    {n.error ? (
                      <>
                        <br />
                        <span className="err tiny">{n.error.slice(0, 90)}</span>
                      </>
                    ) : null}
                  </td>
                  <td className="muted tiny">{n.template}</td>
                  <td>
                    <span className={`pill ${n.status === 'sent' ? 'live' : n.status === 'failed' ? 'bad' : 'warn'}`}>
                      {n.status}
                    </span>
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
