'use client';

import { useState } from 'react';
import { api } from '@/lib/client';
import { useToast } from '@/components/Toast';
import { TextField, SelectField } from '@/components/forms';
import CopyLink from '@/components/CopyLink';
import { IconWhatsApp, IconExternal } from '@/components/icons';

type Business = { id: string; name: string; googleReviewUrl: string | null };
type Row = {
  id: string;
  customerName: string;
  phone: string | null;
  channel: string;
  sentAt: string;
  openedAt: string | null;
  openCount: number;
  businessName: string | null;
};

/**
 * Asking a real customer to leave a real review.
 *
 * Nothing here writes a review. It sends a customer who has actually bought
 * something to the business's own Google page, and counts who opened the link.
 * Whether they wrote anything is between them and Google, and the numbers on
 * this page say exactly that rather than implying more.
 */
export default function ReviewsClient({
  profileId,
  businesses,
  initialRows,
  appUrl,
  ownerName,
}: {
  profileId: string;
  businesses: Business[];
  initialRows: Row[];
  appUrl: string;
  ownerName: string;
}) {
  const { toast } = useToast();
  const [rows, setRows] = useState(initialRows);
  const [businessId, setBusinessId] = useState(businesses[0]?.id ?? '');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [made, setMade] = useState<{ link: string; customerName: string } | null>(null);

  const business = businesses.find((b) => b.id === businessId) ?? null;
  const ready = Boolean(business?.googleReviewUrl);

  const sent = rows.length;
  const opened = rows.filter((r) => r.openCount > 0).length;

  const message = (link: string, customer: string) =>
    `Hello ${customer}, thank you for choosing ${business?.name ?? ownerName}. `
    + `If you have a moment, a short review would mean a lot to us: ${link}`;

  async function create(channel: 'whatsapp' | 'copied') {
    setBusy(true);
    setError('');

    const res = await api<{ id: string; link: string; customerName: string }>('/api/review-requests', {
      json: { profileId, businessId, customerName: name, phone: phone || null, channel },
    });
    setBusy(false);

    if (!res.ok) {
      setError(res.error.message);
      return;
    }

    setMade({ link: res.data.link, customerName: res.data.customerName });
    setRows((r) => [
      {
        id: res.data.id,
        customerName: res.data.customerName,
        phone: phone || null,
        channel,
        sentAt: new Date().toISOString(),
        openedAt: null,
        openCount: 0,
        businessName: business?.name ?? null,
      },
      ...r,
    ]);

    if (channel === 'whatsapp' && phone) {
      const text = encodeURIComponent(message(res.data.link, res.data.customerName));
      window.open(`https://wa.me/91${phone}?text=${text}`, '_blank', 'noopener');
    }

    setName('');
    setPhone('');
    toast('Link ready');
  }

  if (businesses.length === 0) {
    return (
      <div className="card">
        <p className="muted">
          Add a business on your profile first, with its Google review link. That link is where customers are sent.
        </p>
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="stats">
        <div className="stat accent">
          <p className="stat-k">Asked</p>
          <p className="stat-v num">{sent}</p>
          <p className="stat-sub">customers you have sent the link to</p>
        </div>
        <div className="stat">
          <p className="stat-k">Opened the link</p>
          <p className="stat-v num">{opened}</p>
          <p className="stat-sub">{sent > 0 ? `${Math.round((opened / sent) * 100)}% of those asked` : 'nobody yet'}</p>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Ask a customer</h2>
        </div>

        {error ? <p className="form-error" role="alert">{error}</p> : null}

        <div className="form">
          {businesses.length > 1 ? (
            <SelectField label="Which business" value={businessId} onChange={(e) => setBusinessId(e.target.value)}>
              {businesses.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                  {b.googleReviewUrl ? '' : ' — no review link yet'}
                </option>
              ))}
            </SelectField>
          ) : null}

          {!ready ? (
            <p className="form-error">
              {business?.name} has no Google review link yet. Add it on the Business tab of your profile and this
              starts working.
            </p>
          ) : null}

          <div className="form-grid-2">
            <TextField
              label="Customer name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Meera"
              required
            />
            <TextField
              label="WhatsApp number"
              type="tel"
              prefix="+91"
              inputMode="numeric"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
              placeholder="98765 43210"
              hint="Optional. Leave it out and you will get a link to send however you like."
            />
          </div>

          <div className="row">
            <button
              type="button"
              className="btn btn-accent"
              onClick={() => void create('whatsapp')}
              disabled={busy || !ready || name.trim().length < 2 || phone.length !== 10}
            >
              {busy ? <span className="spinner" aria-hidden="true" /> : <IconWhatsApp />}
              Open WhatsApp
            </button>
            <button
              type="button"
              className="btn btn-quiet"
              onClick={() => void create('copied')}
              disabled={busy || !ready || name.trim().length < 2}
            >
              Just give me the link
            </button>
          </div>

          {made ? (
            <div className="card card-tight" style={{ marginTop: 4 }}>
              <p className="muted small" style={{ marginBottom: 10 }}>
                Link for {made.customerName}. It counts as opened when they tap it, then takes them straight to your
                Google review page.
              </p>
              <CopyLink url={made.link} />
            </div>
          ) : null}
        </div>

        <p className="muted tiny" style={{ marginTop: 18 }}>
          Only ask people who have actually bought from you, and never offer anything in return for a review. Both are
          against Google&apos;s rules and can get a listing removed. This page cannot tell you whether a review was
          written — only Google knows that — so it reports what it honestly can: who you asked, and who opened the link.
        </p>
      </div>

      {rows.length > 0 ? (
        <div className="card">
          <div className="card-head">
            <h2>Who you have asked</h2>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Business</th>
                  <th>Sent</th>
                  <th>Opened</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      {r.customerName}
                      {r.phone ? <><br /><span className="muted tiny num">+91 {r.phone}</span></> : null}
                    </td>
                    <td className="tiny">{r.businessName ?? '—'}</td>
                    <td className="muted tiny">{new Date(r.sentAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</td>
                    <td>
                      {r.openCount > 0 ? (
                        <span className="pill live">
                          <IconExternal /> {r.openCount}
                        </span>
                      ) : (
                        <span className="muted tiny">not yet</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
