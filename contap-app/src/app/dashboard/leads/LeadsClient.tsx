'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/client';
import { useToast } from '@/components/Toast';
import { IconWhatsApp, IconPhone, IconMail, IconDownload, IconTrash } from '@/components/icons';

export type LeadRow = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  message: string | null;
  status: string;
  note: string | null;
  createdAt: string;
};

const STATUSES = [
  { id: 'NEW', label: 'New', cls: 'ok' },
  { id: 'CONTACTED', label: 'Contacted', cls: 'warn' },
  { id: 'CONVERTED', label: 'Converted', cls: 'live' },
  { id: 'CLOSED', label: 'Closed', cls: '' },
];

export default function LeadsClient({ leads }: { leads: LeadRow[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [filter, setFilter] = useState<string>('ALL');
  const [busyId, setBusyId] = useState<string | null>(null);

  const shown = filter === 'ALL' ? leads : leads.filter((l) => l.status === filter);

  async function setStatus(id: string, status: string) {
    setBusyId(id);
    const res = await api(`/api/leads/${id}`, { method: 'PATCH', json: { status } });
    setBusyId(null);
    if (!res.ok) {
      toast(res.error.message, 'err');
      return;
    }
    router.refresh();
  }

  async function remove(id: string, name: string) {
    if (!window.confirm(`Delete the enquiry from ${name}? This cannot be undone.`)) return;
    setBusyId(id);
    const res = await api(`/api/leads/${id}`, { method: 'DELETE' });
    setBusyId(null);
    if (!res.ok) {
      toast(res.error.message, 'err');
      return;
    }
    toast('Enquiry deleted');
    router.refresh();
  }

  const counts = STATUSES.map((s) => ({ ...s, n: leads.filter((l) => l.status === s.id).length }));

  return (
    <>
      <div className="row" style={{ marginBottom: 20 }}>
        <button type="button" className={`btn btn-sm ${filter === 'ALL' ? 'btn-accent' : 'btn-quiet'}`} onClick={() => setFilter('ALL')}>
          All {leads.length}
        </button>
        {counts.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`btn btn-sm ${filter === s.id ? 'btn-accent' : 'btn-quiet'}`}
            onClick={() => setFilter(s.id)}
          >
            {s.label} {s.n}
          </button>
        ))}
        <a href={`/api/leads/export${filter !== 'ALL' ? `?status=${filter}` : ''}`} className="btn btn-quiet btn-sm row-end">
          <IconDownload /> Export CSV
        </a>
      </div>

      {shown.length === 0 ? (
        <div className="empty">
          <h3>{filter === 'ALL' ? 'No enquiries yet' : 'Nothing in this list'}</h3>
          <p>
            {filter === 'ALL'
              ? 'When someone fills in the form on your profile, it lands here with their number so you can reply.'
              : 'Try another filter.'}
          </p>
        </div>
      ) : (
        <div className="stack">
          {shown.map((l) => {
            const pill = STATUSES.find((s) => s.id === l.status);
            return (
              <div className="card card-tight" key={l.id}>
                <div className="card-head" style={{ marginBottom: 12 }}>
                  <div>
                    <h3 style={{ fontSize: '1.02rem' }}>{l.name}</h3>
                    <p className="muted tiny" style={{ marginTop: 4 }}>
                      {new Date(l.createdAt).toLocaleString('en-IN', {
                        day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <span className={`pill ${pill?.cls ?? ''}`}>{pill?.label ?? l.status}</span>
                </div>

                {l.message ? (
                  <p className="small" style={{ whiteSpace: 'pre-wrap', marginBottom: 14 }}>{l.message}</p>
                ) : (
                  <p className="muted small" style={{ marginBottom: 14 }}>No message left.</p>
                )}

                <div className="row">
                  {l.phone ? (
                    <>
                      <a className="btn btn-accent btn-sm" href={`https://wa.me/91${l.phone}`} target="_blank" rel="noopener">
                        <IconWhatsApp /> WhatsApp
                      </a>
                      <a className="btn btn-quiet btn-sm" href={`tel:+91${l.phone}`}>
                        <IconPhone /> {l.phone}
                      </a>
                    </>
                  ) : null}
                  {l.email ? (
                    <a className="btn btn-quiet btn-sm" href={`mailto:${l.email}`}>
                      <IconMail /> {l.email}
                    </a>
                  ) : null}
                </div>

                <div className="divider" />

                <div className="row">
                  <span className="mono-label">Mark as</span>
                  {STATUSES.filter((s) => s.id !== l.status).map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className="btn btn-quiet btn-sm"
                      onClick={() => void setStatus(l.id, s.id)}
                      disabled={busyId === l.id}
                    >
                      {s.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="btn btn-danger btn-sm row-end"
                    onClick={() => void remove(l.id, l.name)}
                    disabled={busyId === l.id}
                    aria-label={`Delete the enquiry from ${l.name}`}
                  >
                    <IconTrash />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
