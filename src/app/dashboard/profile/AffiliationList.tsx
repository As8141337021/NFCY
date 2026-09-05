'use client';

import { useState } from 'react';
import { api } from '@/lib/client';
import { useToast } from '@/components/Toast';
import ImagePicker from '@/components/ImagePicker';
import { TextField } from '@/components/forms';
import { IconPlus, IconTrash } from '@/components/icons';
import type { ProfileView, AffiliationView } from '@/lib/profile';

type Completion = { percent: number; steps?: Array<{ key: string; label: string; done: boolean; href: string }> };

/** The bodies people actually name in Indian business networking. */
const COMMON = [
  'BNI',
  'Rotary Club',
  'Lions Club',
  'JCI',
  'FICCI',
  'CII',
  'Chamber of Commerce',
  'Young Indians',
  'TiE',
  'EO',
];

type Draft = { name: string; role: string; chapter: string; url: string; logoId: string | null; logoUrl: string | null };
const blank = (): Draft => ({ name: '', role: '', chapter: '', url: '', logoId: null, logoUrl: null });

export default function AffiliationList({
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
  const [draft, setDraft] = useState<Draft>(blank());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});

  const rows = profile.affiliations;

  const set = (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setDraft((d) => ({ ...d, [k]: e.target.value }));

  function startNew() {
    setDraft(blank());
    setFields({});
    setError('');
    setEditing('new');
  }

  function startEdit(a: AffiliationView) {
    setDraft({
      name: a.name,
      role: a.role ?? '',
      chapter: a.chapter ?? '',
      url: a.url ?? '',
      logoId: a.logoId,
      logoUrl: a.logoUrl,
    });
    setFields({});
    setError('');
    setEditing(a.id);
  }

  async function save() {
    setBusy(true);
    setError('');
    setFields({});

    const path =
      editing === 'new'
        ? `/api/profile/${profileId}/items?kind=affiliation`
        : `/api/profile/${profileId}/items/${editing}?kind=affiliation`;

    const res = await api<{ profile: ProfileView; completion: Completion }>(path, {
      method: editing === 'new' ? 'POST' : 'PATCH',
      json: {
        name: draft.name,
        role: draft.role || null,
        chapter: draft.chapter || null,
        url: draft.url || '',
        logoId: draft.logoId,
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
    toast('Saved');
  }

  async function remove(id: string, name: string) {
    if (!window.confirm(`Remove ${name} from your profile?`)) return;
    const res = await api<{ profile: ProfileView; completion: Completion }>(
      `/api/profile/${profileId}/items/${id}?kind=affiliation`,
      { method: 'DELETE' },
    );
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
      `/api/profile/${profileId}/items/reorder?kind=affiliation`,
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
        The networking bodies you belong to, with their logos. These show as a "Member of" row on your profile, which
        is often the fastest way for someone to place you.
      </p>

      {rows.length === 0 && editing === null ? (
        <div className="empty">
          <h3>No organisations added</h3>
          <p>BNI, Rotary, JCI, a chamber of commerce, a trade association. Add each one with its logo.</p>
          <button type="button" className="btn btn-accent" onClick={startNew}>
            <IconPlus /> Add an organisation
          </button>
        </div>
      ) : null}

      {rows.map((a, i) => (
        <div className="item-row" key={a.id}>
          <div style={{ display: 'grid' }}>
            <button type="button" className="grab" aria-label="Move up" onClick={() => void move(a.id, -1)} disabled={i === 0}>
              ▲
            </button>
            <button type="button" className="grab" aria-label="Move down" onClick={() => void move(a.id, 1)} disabled={i === rows.length - 1}>
              ▼
            </button>
          </div>

          {a.logoUrl ? (
            <img src={a.logoUrl} alt="" style={{ objectFit: 'contain', background: 'rgba(255,255,255,.06)' }} />
          ) : null}

          <span className="grow">
            <b>{a.name}</b>
            <span className="muted tiny">{[a.role, a.chapter].filter(Boolean).join(' · ') || 'No role set'}</span>
          </span>

          <button type="button" className="btn btn-quiet btn-sm" onClick={() => startEdit(a)}>
            Edit
          </button>
          <button type="button" className="btn btn-danger btn-sm" onClick={() => void remove(a.id, a.name)} aria-label={`Remove ${a.name}`}>
            <IconTrash />
          </button>
        </div>
      ))}

      {editing === null && rows.length > 0 ? (
        <button type="button" className="btn btn-ghost" onClick={startNew} style={{ justifySelf: 'start' }}>
          <IconPlus /> Add another organisation
        </button>
      ) : null}

      {editing !== null && (
        <div className="card card-tight">
          <div className="card-head">
            <h3>{editing === 'new' ? 'New organisation' : 'Edit organisation'}</h3>
          </div>

          {error ? <p className="form-error" role="alert">{error}</p> : null}

          <div className="form">
            <ImagePicker
              label="Organisation logo"
              hint="Their logo, not yours. A transparent PNG looks best."
              url={draft.logoUrl}
              onPicked={(id, url) => setDraft((d) => ({ ...d, logoId: id, logoUrl: url }))}
              onCleared={() => setDraft((d) => ({ ...d, logoId: null, logoUrl: null }))}
            />

            <TextField
              label="Organisation"
              value={draft.name}
              onChange={set('name')}
              placeholder="BNI"
              error={fields.name}
              required
            />

            {editing === 'new' ? (
              <div className="field">
                <label>Common ones</label>
                <div className="row" style={{ gap: 8 }}>
                  {COMMON.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className="btn btn-quiet btn-sm"
                      onClick={() => setDraft((d) => ({ ...d, name: c }))}
                    >
                      {c}
                    </button>
                  ))}
                </div>
                <p className="hint">Tap one to fill the name, or type any other.</p>
              </div>
            ) : null}

            <div className="form-grid-2">
              <TextField
                label="Your role"
                value={draft.role}
                onChange={set('role')}
                placeholder="Member, President, Secretary"
                error={fields.role}
              />
              <TextField
                label="Chapter or branch"
                value={draft.chapter}
                onChange={set('chapter')}
                placeholder="Ahmedabad West"
                error={fields.chapter}
              />
            </div>

            <TextField
              label="Link"
              value={draft.url}
              onChange={set('url')}
              placeholder="https://"
              hint="Optional. Their site, or your member page."
              error={fields.url}
            />

            <div className="row">
              <button type="button" className="btn btn-accent" onClick={() => void save()} disabled={busy || !draft.name.trim()}>
                {busy ? <span className="spinner" aria-hidden="true" /> : null}
                {busy ? 'Saving' : 'Save'}
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
