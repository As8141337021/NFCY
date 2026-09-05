'use client';

import { useState } from 'react';
import { api } from '@/lib/client';
import { useToast } from '@/components/Toast';
import ImagePicker from '@/components/ImagePicker';
import { TextField, TextArea, Check } from '@/components/forms';
import { IconPlus, IconTrash } from '@/components/icons';
import type { ProfileView, BusinessView, Hours } from '@/lib/profile';

type Completion = { percent: number; steps?: Array<{ key: string; label: string; done: boolean; href: string }> };

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
const DAY_LABEL: Record<string, string> = {
  mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun',
};

const defaultHours = (): Hours =>
  DAYS.map((d) => ({ day: d, open: '10:00', close: '19:00', closed: d === 'sun' }));

type Draft = {
  name: string; category: string; about: string;
  phone: string; whatsapp: string; email: string; website: string;
  address: string; mapsUrl: string; gstNumber: string;
  googleReviewUrl: string; instagramUrl: string;
  logoId: string | null; logoUrl: string | null;
  hours: Hours; showHours: boolean; isPrimary: boolean; active: boolean;
};

const blank = (isFirst: boolean): Draft => ({
  name: '', category: '', about: '',
  phone: '', whatsapp: '', email: '', website: '',
  address: '', mapsUrl: '', gstNumber: '',
  googleReviewUrl: '', instagramUrl: '',
  logoId: null, logoUrl: null,
  hours: defaultHours(), showHours: false, isPrimary: isFirst, active: true,
});

const fromRow = (b: BusinessView): Draft => ({
  name: b.name,
  category: b.category ?? '',
  about: b.about ?? '',
  phone: b.phone ?? '',
  whatsapp: b.whatsapp ?? '',
  email: b.email ?? '',
  website: b.website ?? '',
  address: b.address ?? '',
  mapsUrl: b.mapsUrl ?? '',
  gstNumber: b.gstNumber ?? '',
  googleReviewUrl: b.googleReviewUrl ?? '',
  instagramUrl: b.instagramUrl ?? '',
  logoId: b.logoId,
  logoUrl: b.logoUrl,
  hours: b.hours ?? defaultHours(),
  showHours: b.showHours,
  isPrimary: b.isPrimary,
  active: b.active,
});

export default function BusinessList({
  profileId,
  profile,
  onChanged,
}: {
  profileId: string;
  profile: ProfileView;
  onChanged: (p: ProfileView, c: Completion) => void;
}) {
  const { toast } = useToast();
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [draft, setDraft] = useState<Draft>(blank(true));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});

  const rows = profile.businesses;
  const atLimit = rows.length >= 5;

  const set =
    (k: keyof Draft) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setDraft((d) => ({
        ...d,
        [k]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value,
      }));

  function startNew() {
    setDraft(blank(rows.length === 0));
    setFields({});
    setError('');
    setEditing('new');
  }

  function startEdit(b: BusinessView) {
    setDraft(fromRow(b));
    setFields({});
    setError('');
    setEditing(b.id);
  }

  async function save() {
    setBusy(true);
    setError('');
    setFields({});

    const path =
      editing === 'new'
        ? `/api/profile/${profileId}/items?kind=business`
        : `/api/profile/${profileId}/items/${editing}?kind=business`;

    const res = await api<{ profile: ProfileView; completion: Completion }>(path, {
      method: editing === 'new' ? 'POST' : 'PATCH',
      json: {
        name: draft.name,
        category: draft.category || null,
        about: draft.about || null,
        phone: draft.phone || '',
        whatsapp: draft.whatsapp || '',
        email: draft.email || '',
        website: draft.website || '',
        address: draft.address || null,
        mapsUrl: draft.mapsUrl || '',
        gstNumber: draft.gstNumber || null,
        googleReviewUrl: draft.googleReviewUrl || '',
        instagramUrl: draft.instagramUrl || '',
        logoId: draft.logoId,
        hours: draft.showHours ? draft.hours : null,
        showHours: draft.showHours,
        isPrimary: draft.isPrimary,
        active: draft.active,
      },
    });
    setBusy(false);

    if (!res.ok) {
      setError(res.error.message);
      setFields(res.error.fields ?? {});
      return;
    }
    onChanged(res.data.profile, res.data.completion);
    setEditing(null);
    toast('Business saved');
  }

  async function remove(id: string, name: string) {
    if (!window.confirm(`Remove ${name} from your profile?`)) return;
    setBusy(true);
    const res = await api<{ profile: ProfileView; completion: Completion }>(
      `/api/profile/${profileId}/items/${id}?kind=business`,
      { method: 'DELETE' },
    );
    setBusy(false);
    if (!res.ok) {
      toast(res.error.message, 'err');
      return;
    }
    onChanged(res.data.profile, res.data.completion);
    toast('Removed');
  }

  async function move(id: string, dir: -1 | 1) {
    const ids = rows.map((r) => r.id);
    const i = ids.indexOf(id);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];

    const res = await api<{ profile: ProfileView; completion: Completion }>(
      `/api/profile/${profileId}/items/reorder?kind=business`,
      { json: { ids } },
    );
    if (!res.ok) {
      toast(res.error.message, 'err');
      return;
    }
    onChanged(res.data.profile, res.data.completion);
  }

  return (
    <div className="stack">
      <p className="muted small">
        Add each business you run. The first one is your main business and shows at the top of your profile. The rest
        appear under it. Leave this empty and none of it shows.
      </p>

      {rows.length === 0 && editing === null ? (
        <div className="empty">
          <h3>No business added yet</h3>
          <p>
            Fill this in if you want your profile to work as a small business page rather than only a personal card.
          </p>
          <button type="button" className="btn btn-accent" onClick={startNew}>
            <IconPlus /> Add a business
          </button>
        </div>
      ) : null}

      {rows.map((b, i) => (
        <div className="item-row" key={b.id}>
          <div style={{ display: 'grid' }}>
            <button type="button" className="grab" aria-label="Move up" onClick={() => void move(b.id, -1)} disabled={i === 0}>
              ▲
            </button>
            <button type="button" className="grab" aria-label="Move down" onClick={() => void move(b.id, 1)} disabled={i === rows.length - 1}>
              ▼
            </button>
          </div>

          {b.logoUrl ? <img src={b.logoUrl} alt="" style={{ objectFit: 'contain', background: 'rgba(255,255,255,.06)' }} /> : null}

          <span className="grow">
            <b>{b.name}</b>
            <span className="muted tiny">
              {[
                b.isPrimary ? 'Main business' : null,
                b.category || null,
                b.showHours ? 'hours shown' : null,
                b.active ? null : 'hidden',
              ].filter(Boolean).join(' · ')}
            </span>
          </span>

          <button type="button" className="btn btn-quiet btn-sm" onClick={() => startEdit(b)}>
            Edit
          </button>
          <button type="button" className="btn btn-danger btn-sm" onClick={() => void remove(b.id, b.name)} aria-label={`Remove ${b.name}`}>
            <IconTrash />
          </button>
        </div>
      ))}

      {editing === null && rows.length > 0 ? (
        atLimit ? (
          <p className="muted tiny">That is five businesses, which is the most one profile can carry.</p>
        ) : (
          <button type="button" className="btn btn-ghost" onClick={startNew} style={{ justifySelf: 'start' }}>
            <IconPlus /> Add another business
          </button>
        )
      ) : null}

      {editing !== null && (
        <div className="card card-tight">
          <div className="card-head">
            <h3>{editing === 'new' ? 'New business' : 'Edit business'}</h3>
          </div>

          {error ? <p className="form-error" role="alert">{error}</p> : null}

          <div className="form">
            <ImagePicker
              label="Business logo"
              url={draft.logoUrl}
              onPicked={(id, url) => setDraft((d) => ({ ...d, logoId: id, logoUrl: url }))}
              onCleared={() => setDraft((d) => ({ ...d, logoId: null, logoUrl: null }))}
            />

            <div className="form-grid-2">
              <TextField label="Business name" value={draft.name} onChange={set('name')} placeholder="Sharma Interiors" error={fields.name} required />
              <TextField label="Category" value={draft.category} onChange={set('category')} placeholder="Interior design studio" error={fields.category} />
            </div>

            <TextArea
              label="About this business"
              value={draft.about}
              onChange={set('about')}
              placeholder="What it does, who it is for, how long it has been going."
              maxLength={2000}
              error={fields.about}
            />

            <div className="form-grid-2">
              <TextField label="Phone" type="tel" prefix="+91" inputMode="numeric" value={draft.phone} onChange={set('phone')} error={fields.phone} />
              <TextField label="WhatsApp" type="tel" prefix="+91" inputMode="numeric" value={draft.whatsapp} onChange={set('whatsapp')} error={fields.whatsapp} />
            </div>
            <div className="form-grid-2">
              <TextField label="Email" type="email" value={draft.email} onChange={set('email')} error={fields.email} />
              <TextField label="Website" value={draft.website} onChange={set('website')} placeholder="yoursite.com" error={fields.website} />
            </div>

            <TextArea label="Address" value={draft.address} onChange={set('address')} error={fields.address} />
            <TextField
              label="Google Maps link"
              value={draft.mapsUrl}
              onChange={set('mapsUrl')}
              placeholder="https://maps.app.goo.gl/"
              hint="Open the place in Google Maps, tap Share, paste the link here."
              error={fields.mapsUrl}
            />

            {/* the optional hours switch */}
            <div className="field">
              <Check
                label={
                  <>
                    <b>Show opening hours for this business</b>
                    <br />
                    <span className="muted small">
                      Off by default. A shop or salon wants these. A consultant usually does not.
                    </span>
                  </>
                }
                checked={draft.showHours}
                onChange={set('showHours')}
              />
            </div>

            {draft.showHours ? (
              <div className="field">
                <label>Opening hours</label>
                <div className="stack-sm">
                  {draft.hours.map((h, i) => (
                    <div key={h.day} className="hours-row">
                      <span className="mono-label">{DAY_LABEL[h.day] ?? h.day}</span>
                      <label className="check">
                        <input
                          type="checkbox"
                          checked={!h.closed}
                          onChange={(e) =>
                            setDraft((d) => {
                              const hours = [...d.hours];
                              hours[i] = { ...hours[i], closed: !e.target.checked };
                              return { ...d, hours };
                            })
                          }
                        />
                        <span className="small">{h.closed ? 'Closed' : 'Open'}</span>
                      </label>
                      <input
                        type="time"
                        value={h.open}
                        disabled={h.closed}
                        aria-label={`${DAY_LABEL[h.day]} opening time`}
                        onChange={(e) =>
                          setDraft((d) => {
                            const hours = [...d.hours];
                            hours[i] = { ...hours[i], open: e.target.value };
                            return { ...d, hours };
                          })
                        }
                      />
                      <input
                        type="time"
                        value={h.close}
                        disabled={h.closed}
                        aria-label={`${DAY_LABEL[h.day]} closing time`}
                        onChange={(e) =>
                          setDraft((d) => {
                            const hours = [...d.hours];
                            hours[i] = { ...hours[i], close: e.target.value };
                            return { ...d, hours };
                          })
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="divider" />

            <div className="form-grid-2">
              <TextField
                label="Google review link"
                value={draft.googleReviewUrl}
                onChange={set('googleReviewUrl')}
                placeholder="https://g.page/r/..."
                hint="Used by a Google Review card or stand."
                error={fields.googleReviewUrl}
              />
              <TextField label="Instagram" value={draft.instagramUrl} onChange={set('instagramUrl')} placeholder="instagram.com/yourshop" error={fields.instagramUrl} />
            </div>
            <TextField label="GST number" value={draft.gstNumber} onChange={set('gstNumber')} placeholder="24AAACC1234A1Z5" error={fields.gstNumber} />

            <Check
              label={
                <>
                  <b>This is my main business</b>
                  <br />
                  <span className="muted small">It shows at the top of your profile. Only one can be the main one.</span>
                </>
              }
              checked={draft.isPrimary}
              onChange={set('isPrimary')}
            />
            <Check
              label="Show this business on my profile"
              checked={draft.active}
              onChange={set('active')}
            />

            <div className="row">
              <button type="button" className="btn btn-accent" onClick={() => void save()} disabled={busy || !draft.name.trim()}>
                {busy ? <span className="spinner" aria-hidden="true" /> : null}
                {busy ? 'Saving' : 'Save business'}
              </button>
              <button type="button" className="btn btn-quiet" onClick={() => setEditing(null)} disabled={busy}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
