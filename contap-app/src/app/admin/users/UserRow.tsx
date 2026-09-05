'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/client';
import { useToast } from '@/components/Toast';

const ROLES = ['CUSTOMER', 'SALES', 'MANUFACTURING', 'SUPPORT', 'OPERATIONS', 'ADMIN', 'SUPER_ADMIN'];

export default function UserRow({
  id,
  role,
  status,
  canManage,
  isSelf,
}: {
  id: string;
  role: string;
  status: string;
  canManage: boolean;
  isSelf: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  async function change(patch: { role?: string; status?: string }) {
    setBusy(true);
    const res = await api(`/api/admin/users/${id}`, { method: 'PATCH', json: patch });
    setBusy(false);
    if (!res.ok) {
      toast(res.error.message, 'err');
      return;
    }
    toast('Account updated');
    router.refresh();
  }

  if (!canManage || isSelf) {
    return (
      <>
        <td className="tiny">{role.toLowerCase().replace('_', ' ')}</td>
        <td>
          <span className={`pill ${status === 'ACTIVE' ? 'live' : 'bad'}`}>{status.toLowerCase()}</span>
          {isSelf ? <span className="muted tiny"> you</span> : null}
        </td>
      </>
    );
  }

  return (
    <>
      <td>
        <select
          value={role}
          disabled={busy}
          onChange={(e) => void change({ role: e.target.value })}
          aria-label="Role"
          style={{
            padding: '6px 9px', borderRadius: 8, background: 'rgba(6,8,12,.7)',
            border: '1px solid var(--line-strong)', color: 'var(--text-primary)', fontSize: '.8rem',
          }}
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>{r.toLowerCase().replace('_', ' ')}</option>
          ))}
        </select>
      </td>
      <td>
        <button
          type="button"
          className={`btn btn-sm ${status === 'ACTIVE' ? 'btn-quiet' : 'btn-accent'}`}
          disabled={busy}
          onClick={() => void change({ status: status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE' })}
        >
          {status === 'ACTIVE' ? 'Suspend' : 'Reactivate'}
        </button>
      </td>
    </>
  );
}
