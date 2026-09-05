'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, rupees } from '@/lib/client';
import { useToast } from '@/components/Toast';
import { TextField, SelectField, Check } from '@/components/forms';
import { IconPlus, IconTrash } from '@/components/icons';

export type CouponRow = {
  id: string; code: string; type: string; value: number;
  minOrderMinor: number; maxDiscountMinor: number | null;
  firstOrderOnly: boolean; minQuantity: number;
  usageLimit: number | null; usageCount: number; perUserLimit: number | null;
  startsAt: string | null; expiresAt: string | null; active: boolean;
  productNames: string[];
};

export default function CouponManager({
  coupons,
  products,
}: {
  coupons: CouponRow[];
  products: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [f, setF] = useState({
    code: '', type: 'PERCENT', value: '10',
    minOrderRupees: '0', maxDiscountRupees: '',
    firstOrderOnly: false, minQuantity: '1',
    usageLimit: '', perUserLimit: '1', expiresAt: '',
    productIds: [] as string[],
  });

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF((p) => ({ ...p, [k]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value }));

  async function create() {
    setBusy(true);
    setError('');
    setFields({});

    const res = await api('/api/admin/coupons', {
      json: {
        code: f.code.trim().toUpperCase(),
        type: f.type,
        value: f.type === 'PERCENT' ? Number(f.value) : Math.round(Number(f.value) * 100),
        minOrderMinor: Math.round(Number(f.minOrderRupees || 0) * 100),
        maxDiscountMinor: f.maxDiscountRupees.trim() ? Math.round(Number(f.maxDiscountRupees) * 100) : null,
        firstOrderOnly: f.firstOrderOnly,
        minQuantity: Number(f.minQuantity) || 1,
        usageLimit: f.usageLimit.trim() ? Number(f.usageLimit) : null,
        perUserLimit: f.perUserLimit.trim() ? Number(f.perUserLimit) : null,
        expiresAt: f.expiresAt ? new Date(f.expiresAt).toISOString() : null,
        active: true,
        productIds: f.productIds,
      },
    });
    setBusy(false);

    if (!res.ok) {
      setError(res.error.message);
      setFields(res.error.fields ?? {});
      return;
    }
    toast('Coupon created');
    setOpen(false);
    setF((p) => ({ ...p, code: '' }));
    router.refresh();
  }

  async function toggle(id: string, active: boolean) {
    const res = await api(`/api/admin/coupons/${id}`, { method: 'PATCH', json: { active } });
    if (!res.ok) {
      toast(res.error.message, 'err');
      return;
    }
    router.refresh();
  }

  async function remove(id: string, code: string) {
    if (!window.confirm(`Delete coupon ${code}?`)) return;
    const res = await api<{ deleted?: boolean; deactivated?: boolean; reason?: string }>(
      `/api/admin/coupons/${id}`,
      { method: 'DELETE' },
    );
    if (!res.ok) {
      toast(res.error.message, 'err');
      return;
    }
    toast(res.data.reason ?? 'Coupon deleted');
    router.refresh();
  }

  return (
    <>
      <div className="row" style={{ marginBottom: 20 }}>
        <button type="button" className="btn btn-accent btn-sm" onClick={() => setOpen((o) => !o)}>
          <IconPlus /> {open ? 'Cancel' : 'New coupon'}
        </button>
      </div>

      {open && (
        <div className="card" style={{ marginBottom: 22 }}>
          <div className="card-head">
            <h2>New coupon</h2>
          </div>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          <div className="form">
            <div className="form-grid-2">
              <TextField
                label="Code"
                value={f.code}
                onChange={(e) => setF((p) => ({ ...p, code: e.target.value.toUpperCase() }))}
                placeholder="WELCOME10"
                error={fields.code}
              />
              <SelectField label="Type" value={f.type} onChange={set('type')}>
                <option value="PERCENT">Percentage off</option>
                <option value="FIXED">Fixed amount off</option>
              </SelectField>
            </div>
            <div className="form-grid-2">
              <TextField
                label={f.type === 'PERCENT' ? 'Percent off' : 'Rupees off'}
                type="number"
                min={1}
                value={f.value}
                onChange={set('value')}
                error={fields.value}
              />
              <TextField
                label="Cap the discount at, rupees"
                type="number"
                min={0}
                value={f.maxDiscountRupees}
                onChange={set('maxDiscountRupees')}
                hint="Optional. Useful with a percentage."
              />
            </div>
            <div className="form-grid-2">
              <TextField label="Minimum order, rupees" type="number" min={0} value={f.minOrderRupees} onChange={set('minOrderRupees')} />
              <TextField label="Minimum cards" type="number" min={1} value={f.minQuantity} onChange={set('minQuantity')} hint="For bulk only coupons." />
            </div>
            <div className="form-grid-2">
              <TextField label="Total uses allowed" type="number" min={1} value={f.usageLimit} onChange={set('usageLimit')} hint="Empty means unlimited." />
              <TextField label="Uses per customer" type="number" min={1} value={f.perUserLimit} onChange={set('perUserLimit')} />
            </div>
            <TextField label="Expires on" type="date" value={f.expiresAt} onChange={set('expiresAt')} hint="Empty means it never expires." />
            <Check label="First order only" checked={f.firstOrderOnly} onChange={set('firstOrderOnly')} />

            <div className="field">
              <label>Limit to these products</label>
              <div className="row" style={{ gap: 8 }}>
                {products.map((p) => {
                  const on = f.productIds.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      className={`btn btn-sm ${on ? 'btn-accent' : 'btn-quiet'}`}
                      onClick={() =>
                        setF((prev) => ({
                          ...prev,
                          productIds: on ? prev.productIds.filter((x) => x !== p.id) : [...prev.productIds, p.id],
                        }))
                      }
                    >
                      {p.name}
                    </button>
                  );
                })}
              </div>
              <p className="hint">Pick none and it applies to everything.</p>
            </div>

            <button type="button" className="btn btn-accent" onClick={() => void create()} disabled={busy || !f.code.trim()}>
              {busy ? <span className="spinner" aria-hidden="true" /> : null}
              {busy ? 'Creating' : 'Create coupon'}
            </button>
          </div>
        </div>
      )}

      {coupons.length === 0 ? (
        <div className="empty">
          <h3>No coupons yet</h3>
          <p>Create one above. Discounts are always applied on our server, never in the browser.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Code</th>
                <th>Discount</th>
                <th>Conditions</th>
                <th>Used</th>
                <th>Expires</th>
                <th>Live</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {coupons.map((c) => (
                <tr key={c.id}>
                  <td className="num">{c.code}</td>
                  <td>{c.type === 'PERCENT' ? `${c.value}%` : rupees(c.value)}
                    {c.maxDiscountMinor ? <><br /><span className="muted tiny">max {rupees(c.maxDiscountMinor)}</span></> : null}
                  </td>
                  <td className="tiny muted">
                    {[
                      c.minOrderMinor ? `over ${rupees(c.minOrderMinor)}` : null,
                      c.minQuantity > 1 ? `${c.minQuantity}+ cards` : null,
                      c.firstOrderOnly ? 'first order only' : null,
                      c.productNames.length ? c.productNames.join(', ') : null,
                    ].filter(Boolean).join(' · ') || 'none'}
                  </td>
                  <td className="num">{c.usageCount}{c.usageLimit ? ` / ${c.usageLimit}` : ''}</td>
                  <td className="muted tiny">
                    {c.expiresAt ? new Date(c.expiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' }) : 'never'}
                  </td>
                  <td>
                    <button
                      type="button"
                      className={`btn btn-sm ${c.active ? 'btn-quiet' : 'btn-accent'}`}
                      onClick={() => void toggle(c.id, !c.active)}
                    >
                      {c.active ? 'On' : 'Off'}
                    </button>
                  </td>
                  <td>
                    <button type="button" className="btn btn-danger btn-sm" onClick={() => void remove(c.id, c.code)} aria-label={`Delete ${c.code}`}>
                      <IconTrash />
                    </button>
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
