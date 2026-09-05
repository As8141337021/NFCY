'use client';

import { useRef, useState } from 'react';
import { api } from '@/lib/client';
import { useToast } from '@/components/Toast';
import { TextField, TextArea, Check } from '@/components/forms';
import { IconPlus, IconTrash, IconDownload } from '@/components/icons';
import type { ProfileView } from '@/lib/profile';

type Completion = { percent: number; steps?: Array<{ key: string; label: string; done: boolean; href: string }> };
type Doc = ProfileView['documents'][number];

type Draft = { title: string; description: string; fileId: string; fileName: string; sizeLabel: string; active: boolean };
const blank = (): Draft => ({ title: '', description: '', fileId: '', fileName: '', sizeLabel: '', active: true });

const size = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1048576).toFixed(1)} MB`;

/**
 * Catalogues, price lists, brochures. The kind of thing a customer asks for on
 * WhatsApp and never gets, because it is sitting on somebody's laptop.
 */
export default function DocumentList({
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
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  const rows = profile.documents;

  function startNew() {
    setDraft(blank());
    setFields({});
    setError('');
    setEditing('new');
  }

  function startEdit(d: Doc) {
    setDraft({
      title: d.title,
      description: d.description ?? '',
      fileId: d.fileId,
      fileName: d.title,
      sizeLabel: d.sizeLabel,
      active: d.active,
    });
    setFields({});
    setError('');
    setEditing(d.id);
  }

  async function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setUploading(true);

    const form = new FormData();
    form.append('file', file);
    const res = await fetch('/api/media/document', { method: 'POST', body: form });
    const json = (await res.json().catch(() => null)) as
      | { ok: true; data: { id: string; bytes: number } }
      | { ok: false; error: { message: string } }
      | null;
    setUploading(false);
    if (e.target) e.target.value = '';

    if (!json || !json.ok) {
      setError(json && !json.ok ? json.error.message : 'That upload did not go through. Please try again.');
      return;
    }

    setDraft((d) => ({
      ...d,
      fileId: json.data.id,
      fileName: file.name,
      sizeLabel: size(json.data.bytes),
      // a name is already there in the filename, so save them typing it twice
      title: d.title || file.name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').slice(0, 80),
    }));
  }

  async function save() {
    if (!draft.fileId) {
      setError('Choose a PDF first.');
      return;
    }
    setBusy(true);
    setError('');
    setFields({});

    const path =
      editing === 'new'
        ? `/api/profile/${profileId}/items?kind=document`
        : `/api/profile/${profileId}/items/${editing}?kind=document`;

    const res = await api<{ profile: ProfileView; completion: Completion }>(path, {
      method: editing === 'new' ? 'POST' : 'PATCH',
      json: {
        title: draft.title,
        description: draft.description || null,
        fileId: draft.fileId,
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
    toast('Saved');
  }

  async function remove(id: string, title: string) {
    if (!window.confirm(`Remove ${title} from your profile?`)) return;
    const res = await api<{ profile: ProfileView; completion: Completion }>(
      `/api/profile/${profileId}/items/${id}?kind=document`,
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
      `/api/profile/${profileId}/items/reorder?kind=document`,
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
        A catalogue, a price list, a brochure, a rate card. PDFs only, up to 12MB each. Anyone who taps your card can
        open them, and you can see how many times each one was opened.
      </p>

      {rows.length === 0 && editing === null ? (
        <div className="empty">
          <h3>No files yet</h3>
          <p>Upload the catalogue people keep asking you to send on WhatsApp.</p>
          <button type="button" className="btn btn-accent" onClick={startNew}>
            <IconPlus /> Add a file
          </button>
        </div>
      ) : null}

      {rows.map((d, i) => (
        <div className="item-row" key={d.id}>
          <div style={{ display: 'grid' }}>
            <button type="button" className="grab" aria-label="Move up" onClick={() => void move(d.id, -1)} disabled={i === 0}>
              ▲
            </button>
            <button type="button" className="grab" aria-label="Move down" onClick={() => void move(d.id, 1)} disabled={i === rows.length - 1}>
              ▼
            </button>
          </div>

          <span className="grow">
            <b>{d.title}</b>
            <span className="muted tiny">
              PDF · {d.sizeLabel} · opened {d.downloads} {d.downloads === 1 ? 'time' : 'times'}
              {d.active ? '' : ' · hidden'}
            </span>
          </span>

          <a className="btn btn-quiet btn-sm" href={d.url} target="_blank" rel="noopener">
            <IconDownload /> Open
          </a>
          <button type="button" className="btn btn-quiet btn-sm" onClick={() => startEdit(d)}>
            Edit
          </button>
          <button type="button" className="btn btn-danger btn-sm" onClick={() => void remove(d.id, d.title)} aria-label={`Remove ${d.title}`}>
            <IconTrash />
          </button>
        </div>
      ))}

      {editing === null && rows.length > 0 ? (
        <button type="button" className="btn btn-ghost" onClick={startNew} style={{ justifySelf: 'start' }}>
          <IconPlus /> Add another file
        </button>
      ) : null}

      {editing !== null && (
        <div className="card card-tight">
          <div className="card-head">
            <h3>{editing === 'new' ? 'New file' : 'Edit file'}</h3>
          </div>

          {error ? <p className="form-error" role="alert">{error}</p> : null}

          <div className="form">
            <div className="field">
              <label htmlFor="doc-file">PDF</label>
              <input
                id="doc-file"
                ref={fileRef}
                type="file"
                accept="application/pdf,.pdf"
                onChange={(e) => void pickFile(e)}
                disabled={uploading}
              />
              <p className="hint">
                {uploading
                  ? 'Uploading…'
                  : draft.fileId
                    ? `${draft.fileName || 'File attached'} · ${draft.sizeLabel}`
                    : 'Up to 12MB. Only PDFs are accepted.'}
              </p>
            </div>

            <TextField
              label="What is it called"
              value={draft.title}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
              placeholder="Diwali collection catalogue"
              error={fields.title}
              required
            />

            <TextArea
              label="One line about it"
              value={draft.description}
              onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
              placeholder="42 designs, updated October 2026."
              maxLength={200}
              error={fields.description}
            />

            <Check
              label={<>Show this file on my profile</>}
              checked={draft.active}
              onChange={(e) => setDraft((d) => ({ ...d, active: e.target.checked }))}
            />

            <div className="row">
              <button
                type="button"
                className="btn btn-accent"
                onClick={() => void save()}
                disabled={busy || uploading || !draft.title.trim() || !draft.fileId}
              >
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
