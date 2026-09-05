'use client';

import { useState } from 'react';
import { api, rupees } from '@/lib/client';
import { useToast } from '@/components/Toast';
import ImagePicker from '@/components/ImagePicker';
import { TextField, TextArea, SelectField, Check } from '@/components/forms';
import { SOCIAL_ICONS, SOCIAL_LABELS, IconTrash, IconPlus } from '@/components/icons';
import type { ProfileView } from '@/lib/profile';

export type Kind = 'social' | 'product' | 'service' | 'gallery';

type Props = {
  kind: Kind;
  profileId: string;
  profile: ProfileView;
  onChanged: (p: ProfileView, completion: { percent: number }) => void;
};

const PLATFORMS = Object.keys(SOCIAL_LABELS);

type Draft = Record<string, unknown>;

const blank = (kind: Kind): Draft => {
  if (kind === 'social') return { platform: 'instagram', label: '', url: '' };
  if (kind === 'product') return { name: '', description: '', price: '', url: '', buttonLabel: 'Buy now', imageId: null, imageUrl: null, active: true };
  if (kind === 'service') return { name: '', description: '', price: '', durationMin: '', bookingUrl: '', buttonLabel: 'Book now', imageId: null, imageUrl: null, active: true };
  return { kind: 'image', caption: '', mediaId: null, mediaUrl: null, videoUrl: '' };
};

export default function ItemList({ kind, profileId, profile, onChanged }: Props) {
  const { toast } = useToast();
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [draft, setDraft] = useState<Draft>(blank(kind));
  const [busy, setBusy] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState('');

  const rows =
    kind === 'social' ? profile.socials
    : kind === 'product' ? profile.products
    : kind === 'service' ? profile.services
    : profile.gallery;

  function startNew() {
    setDraft(blank(kind));
    setFields({});
    setError('');
    setEditing('new');
  }

  function startEdit(row: Record<string, unknown>) {
    setFields({});
    setError('');
    if (kind === 'social') {
      setDraft({ platform: row.platform, label: row.label ?? '', url: row.url });
    } else if (kind === 'product') {
      setDraft({
        name: row.name, description: row.description ?? '',
        price: row.priceMinor != null ? String((row.priceMinor as number) / 100) : '',
        url: row.url ?? '', buttonLabel: row.buttonLabel,
        imageId: row.imageId ?? null, imageUrl: row.imageUrl ?? null, active: row.active,
      });
    } else if (kind === 'service') {
      setDraft({
        name: row.name, description: row.description ?? '',
        price: row.priceMinor != null ? String((row.priceMinor as number) / 100) : '',
        durationMin: row.durationMin != null ? String(row.durationMin) : '',
        bookingUrl: row.bookingUrl ?? '', buttonLabel: row.buttonLabel,
        imageId: row.imageId ?? null, imageUrl: row.imageUrl ?? null, active: row.active,
      });
    } else {
      setDraft({ kind: row.kind, caption: row.caption ?? '', mediaId: row.mediaId ?? null, mediaUrl: row.url ?? null, videoUrl: row.videoUrl ?? '' });
    }
    setEditing(row.id as string);
  }

  function bodyFor(): Record<string, unknown> {
    const d = draft;
    const toMinor = (v: unknown) => {
      const n = Number(String(v ?? '').trim());
      return String(v ?? '').trim() === '' || Number.isNaN(n) ? null : Math.round(n * 100);
    };
    if (kind === 'social') return { platform: d.platform, label: d.label || null, url: d.url };
    if (kind === 'product')
      return {
        name: d.name, description: d.description || null, priceMinor: toMinor(d.price),
        url: d.url || '', buttonLabel: d.buttonLabel || 'Buy now',
        imageId: (d.imageId as string | null) ?? null, active: Boolean(d.active),
      };
    if (kind === 'service')
      return {
        name: d.name, description: d.description || null, priceMinor: toMinor(d.price),
        durationMin: String(d.durationMin ?? '').trim() === '' ? null : Number(d.durationMin),
        bookingUrl: d.bookingUrl || '', buttonLabel: d.buttonLabel || 'Book now',
        imageId: (d.imageId as string | null) ?? null, active: Boolean(d.active),
      };
    return {
      kind: d.kind, caption: d.caption || null,
      mediaId: (d.mediaId as string | null) ?? null,
      videoUrl: d.videoUrl || '',
    };
  }

  async function save() {
    setBusy(true);
    setError('');
    setFields({});

    const path =
      editing === 'new'
        ? `/api/profile/${profileId}/items?kind=${kind}`
        : `/api/profile/${profileId}/items/${editing}?kind=${kind}`;

    const res = await api<{ profile: ProfileView; completion: { percent: number } }>(path, {
      method: editing === 'new' ? 'POST' : 'PATCH',
      json: bodyFor(),
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

  async function remove(id: string) {
    setBusy(true);
    const res = await api<{ profile: ProfileView; completion: { percent: number } }>(
      `/api/profile/${profileId}/items/${id}?kind=${kind}`,
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

  async function move(id: string, direction: -1 | 1) {
    const ids = rows.map((r) => r.id);
    const i = ids.indexOf(id);
    const j = i + direction;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];

    const res = await api<{ profile: ProfileView; completion: { percent: number } }>(
      `/api/profile/${profileId}/items/reorder?kind=${kind}`,
      { json: { ids } },
    );
    if (!res.ok) {
      toast(res.error.message, 'err');
      return;
    }
    onChanged(res.data.profile, res.data.completion);
  }

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setDraft((d) => ({ ...d, [k]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value }));

  return (
    <div className="stack">
      {rows.length === 0 && editing === null ? (
        <div className="empty">
          <h3>{EMPTY[kind].title}</h3>
          <p>{EMPTY[kind].body}</p>
          <button type="button" className="btn btn-accent" onClick={startNew}>
            <IconPlus /> {EMPTY[kind].cta}
          </button>
        </div>
      ) : null}

      {rows.map((row, i) => {
        const r = row as unknown as Record<string, unknown>;
        const Icon = kind === 'social' ? SOCIAL_ICONS[r.platform as string] ?? SOCIAL_ICONS.custom : null;
        const img = (r.imageUrl ?? r.url) as string | null;

        return (
          <div key={r.id as string} className="item-row">
            <div style={{ display: 'grid' }}>
              <button type="button" className="grab" aria-label="Move up" onClick={() => void move(r.id as string, -1)} disabled={i === 0}>
                ▲
              </button>
              <button type="button" className="grab" aria-label="Move down" onClick={() => void move(r.id as string, 1)} disabled={i === rows.length - 1}>
                ▼
              </button>
            </div>

            {Icon ? (
              <span style={{ width: 40, display: 'grid', placeItems: 'center', color: 'var(--accent)' }}>
                <Icon className="" />
              </span>
            ) : img && kind !== 'social' ? (
              <img src={img} alt="" />
            ) : null}

            <span className="grow">
              <b>
                {kind === 'social'
                  ? (r.label as string) || SOCIAL_LABELS[r.platform as string] || (r.platform as string)
                  : kind === 'gallery'
                    ? (r.caption as string) || ((r.videoUrl as string) ? 'Video' : 'Image')
                    : (r.name as string)}
              </b>
              <span className="muted tiny">
                {kind === 'social'
                  ? (r.url as string)
                  : kind === 'gallery'
                    ? (r.videoUrl as string) || ''
                    : [
                        r.priceMinor != null ? rupees(r.priceMinor as number) : null,
                        r.durationMin ? `${r.durationMin} min` : null,
                        r.active === false ? 'Hidden' : null,
                      ].filter(Boolean).join(' · ')}
              </span>
            </span>

            <button type="button" className="btn btn-quiet btn-sm" onClick={() => startEdit(r)}>
              Edit
            </button>
            <button type="button" className="btn btn-danger btn-sm" onClick={() => void remove(r.id as string)} aria-label="Remove">
              <IconTrash />
            </button>
          </div>
        );
      })}

      {editing === null && rows.length > 0 ? (
        <button type="button" className="btn btn-ghost" onClick={startNew} style={{ justifySelf: 'start' }}>
          <IconPlus /> {EMPTY[kind].cta}
        </button>
      ) : null}

      {editing !== null && (
        <div className="card card-tight">
          <div className="card-head">
            <h3>{editing === 'new' ? EMPTY[kind].cta : 'Edit'}</h3>
          </div>

          {error ? <p className="form-error" role="alert">{error}</p> : null}

          <div className="form">
            {kind === 'social' && (
              <>
                <SelectField label="Which platform" value={String(draft.platform)} onChange={set('platform')}>
                  {PLATFORMS.map((p) => (
                    <option key={p} value={p}>{SOCIAL_LABELS[p]}</option>
                  ))}
                </SelectField>
                <TextField
                  label="Link"
                  value={String(draft.url ?? '')}
                  onChange={set('url')}
                  placeholder="instagram.com/yourhandle"
                  error={fields.url}
                />
                {draft.platform === 'custom' && (
                  <TextField
                    label="What to call it"
                    value={String(draft.label ?? '')}
                    onChange={set('label')}
                    placeholder="My portfolio"
                    error={fields.label}
                  />
                )}
              </>
            )}

            {(kind === 'product' || kind === 'service') && (
              <>
                <TextField
                  label={kind === 'product' ? 'Product name' : 'Service name'}
                  value={String(draft.name ?? '')}
                  onChange={set('name')}
                  placeholder={kind === 'product' ? 'Modular kitchen design' : 'Home consultation'}
                  error={fields.name}
                />
                <TextArea
                  label="Description"
                  value={String(draft.description ?? '')}
                  onChange={set('description')}
                  placeholder="A line or two about what this is."
                  error={fields.description}
                />
                <div className="form-grid-2">
                  <TextField
                    label="Price in rupees"
                    type="number"
                    min={0}
                    step="1"
                    value={String(draft.price ?? '')}
                    onChange={set('price')}
                    placeholder="4999"
                    hint="Leave empty to show no price."
                    error={fields.priceMinor}
                  />
                  {kind === 'service' ? (
                    <TextField
                      label="Duration in minutes"
                      type="number"
                      min={0}
                      value={String(draft.durationMin ?? '')}
                      onChange={set('durationMin')}
                      placeholder="60"
                      error={fields.durationMin}
                    />
                  ) : (
                    <TextField
                      label="Button label"
                      value={String(draft.buttonLabel ?? '')}
                      onChange={set('buttonLabel')}
                      placeholder="Buy now"
                      error={fields.buttonLabel}
                    />
                  )}
                </div>
                <TextField
                  label={kind === 'product' ? 'Where the button goes' : 'Booking link'}
                  value={String((kind === 'product' ? draft.url : draft.bookingUrl) ?? '')}
                  onChange={set(kind === 'product' ? 'url' : 'bookingUrl')}
                  placeholder="https://"
                  hint="Optional. Without it the card is shown but does not link anywhere."
                  error={fields.url ?? fields.bookingUrl}
                />
                {kind === 'service' && (
                  <TextField
                    label="Button label"
                    value={String(draft.buttonLabel ?? '')}
                    onChange={set('buttonLabel')}
                    placeholder="Book now"
                  />
                )}
                <ImagePicker
                  label="Picture"
                  url={(draft.imageUrl as string | null) ?? null}
                  onPicked={(id, url) => setDraft((d) => ({ ...d, imageId: id, imageUrl: url }))}
                  onCleared={() => setDraft((d) => ({ ...d, imageId: null, imageUrl: null }))}
                />
                <Check
                  label="Show this on my profile"
                  checked={Boolean(draft.active)}
                  onChange={set('active')}
                />
              </>
            )}

            {kind === 'gallery' && (
              <>
                <SelectField label="Type" value={String(draft.kind)} onChange={set('kind')}>
                  <option value="image">Image</option>
                  <option value="video">Video link</option>
                </SelectField>
                {draft.kind === 'image' ? (
                  <ImagePicker
                    label="Image"
                    url={(draft.mediaUrl as string | null) ?? null}
                    onPicked={(id, url) => setDraft((d) => ({ ...d, mediaId: id, mediaUrl: url }))}
                    onCleared={() => setDraft((d) => ({ ...d, mediaId: null, mediaUrl: null }))}
                  />
                ) : (
                  <TextField
                    label="Video link"
                    value={String(draft.videoUrl ?? '')}
                    onChange={set('videoUrl')}
                    placeholder="https://youtube.com/watch?v="
                    error={fields.videoUrl}
                  />
                )}
                <TextField
                  label="Caption"
                  value={String(draft.caption ?? '')}
                  onChange={set('caption')}
                  placeholder="Optional"
                />
              </>
            )}

            <div className="row">
              <button type="button" className="btn btn-accent" onClick={() => void save()} disabled={busy}>
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

const EMPTY: Record<Kind, { title: string; body: string; cta: string }> = {
  social: {
    title: 'No links yet',
    body: 'Add the accounts you actually want people to follow. They appear as tappable icons on your profile.',
    cta: 'Add a link',
  },
  product: {
    title: 'No products yet',
    body: 'List what you sell, with a price and a picture. Each one becomes a card people can tap.',
    cta: 'Add a product',
  },
  service: {
    title: 'No services yet',
    body: 'List what you do, how long it takes and what it costs. Add a booking link if you have one.',
    cta: 'Add a service',
  },
  gallery: {
    title: 'Nothing in the gallery',
    body: 'Photos of your work, your shop or your products. This is often the part people scroll to.',
    cta: 'Add to the gallery',
  },
};
