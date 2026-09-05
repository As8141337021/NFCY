'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, uploadImage, rupees } from '@/lib/client';
import { useToast } from '@/components/Toast';
import { TextField, TextArea, SelectField, Check } from '@/components/forms';
import { IconTrash, IconCheck } from '@/components/icons';

export type ProductForm = {
  id: string;
  name: string; slug: string; sku: string; kind: string;
  tagline: string; description: string; status: string;
  priceRupees: string; mrpRupees: string; taxPercent: string;
  stock: string; trackStock: boolean; badge: string; position: string;
  destinationType: string; features: string[];
};

export type ProductImage = { id: string; url: string; alt: string | null; isPrimary: boolean; position: number };

export default function ProductEditor({
  initial,
  initialImages,
  isNew,
}: {
  initial: ProductForm;
  initialImages: ProductImage[];
  isNew: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();

  const [f, setF] = useState(initial);
  const [images, setImages] = useState(initialImages);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [featureText, setFeatureText] = useState(initial.features.join('\n'));

  const set = (k: keyof ProductForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setF((p) => ({ ...p, [k]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value }));

  const toMinor = (v: string) => {
    const n = Number(String(v).trim());
    return Number.isFinite(n) ? Math.round(n * 100) : 0;
  };

  async function save() {
    setBusy(true);
    setError('');
    setFields({});

    const body = {
      name: f.name,
      slug: f.slug,
      sku: f.sku,
      kind: f.kind,
      tagline: f.tagline || null,
      description: f.description || null,
      status: f.status,
      priceMinor: toMinor(f.priceRupees),
      mrpMinor: f.mrpRupees.trim() ? toMinor(f.mrpRupees) : null,
      taxPercent: Number(f.taxPercent) || 0,
      stock: Number(f.stock) || 0,
      trackStock: f.trackStock,
      badge: f.badge || null,
      position: Number(f.position) || 0,
      destinationType: f.destinationType,
      features: featureText.split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 20),
    };

    const res = await api<{ id: string }>(isNew ? '/api/admin/products' : `/api/admin/products/${f.id}`, {
      method: isNew ? 'POST' : 'PUT',
      json: body,
    });
    setBusy(false);

    if (!res.ok) {
      setError(res.error.message);
      setFields(res.error.fields ?? {});
      return;
    }
    toast('Product saved');
    if (isNew) window.location.href = `/admin/products/${res.data.id}`;
    else router.refresh();
  }

  async function addImage(file: File | undefined) {
    if (!file || isNew) return;
    setUploading(true);
    setError('');

    const up = await uploadImage(file);
    if (!up.ok) {
      setUploading(false);
      setError(up.error.message);
      return;
    }
    const res = await api<{ images: ProductImage[] }>(`/api/admin/products/${f.id}/images`, {
      json: { mediaId: up.data.id, alt: f.name },
    });
    setUploading(false);

    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    setImages(res.data.images);
    toast('Picture added');
    router.refresh();
  }

  async function removeImage(imageId: string) {
    const res = await api<{ images: ProductImage[] }>(`/api/admin/products/${f.id}/images?imageId=${imageId}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      toast(res.error.message, 'err');
      return;
    }
    setImages(res.data.images);
    router.refresh();
  }

  async function makePrimary(imageId: string) {
    const res = await api<{ images: ProductImage[] }>(`/api/admin/products/${f.id}/images`, {
      method: 'PATCH',
      json: { ids: images.map((i) => i.id), primaryId: imageId },
    });
    if (!res.ok) {
      toast(res.error.message, 'err');
      return;
    }
    setImages(res.data.images);
    toast('Main picture set');
    router.refresh();
  }

  async function moveImage(imageId: string, dir: -1 | 1) {
    const ids = images.map((i) => i.id);
    const i = ids.indexOf(imageId);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];

    const res = await api<{ images: ProductImage[] }>(`/api/admin/products/${f.id}/images`, {
      method: 'PATCH',
      json: { ids },
    });
    if (!res.ok) {
      toast(res.error.message, 'err');
      return;
    }
    setImages(res.data.images);
  }

  return (
    <div className="stack">
      {error ? <p className="form-error" role="alert">{error}</p> : null}

      <div className="card">
        <div className="card-head">
          <h2>Details</h2>
          <span className="muted small">Customers see all of this</span>
        </div>
        <div className="form">
          <TextField label="Name" value={f.name} onChange={set('name')} error={fields.name} required />
          <TextField label="Tagline" value={f.tagline} onChange={set('tagline')} error={fields.tagline} hint="The one line under the price on the shop page." />
          <TextArea label="Description" value={f.description} onChange={set('description')} error={fields.description} />
          <TextArea
            label="Features"
            value={featureText}
            onChange={(e) => setFeatureText(e.target.value)}
            placeholder={'One per line\nNFC chip and QR backup\nFull digital profile'}
            hint="One per line. Up to twenty. These become the ticked list on the product card."
          />
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Price and stock</h2>
          <span className="muted small">Shown prices include GST</span>
        </div>
        <div className="form">
          <div className="form-grid-2">
            <TextField
              label="Price in rupees"
              type="number"
              min={0}
              step="1"
              value={f.priceRupees}
              onChange={set('priceRupees')}
              error={fields.priceMinor}
              hint={`Customers see ${rupees(toMinor(f.priceRupees))}`}
              required
            />
            <TextField
              label="Struck through price"
              type="number"
              min={0}
              step="1"
              value={f.mrpRupees}
              onChange={set('mrpRupees')}
              error={fields.mrpMinor}
              hint="Optional. Leave empty for no discount badge."
            />
          </div>
          <div className="form-grid-2">
            <TextField label="GST percent" type="number" min={0} max={28} value={f.taxPercent} onChange={set('taxPercent')} error={fields.taxPercent} />
            <TextField label="Stock on hand" type="number" min={0} value={f.stock} onChange={set('stock')} error={fields.stock} />
          </div>
          <Check
            label={
              <>
                <b>Track stock for this product</b>
                <br />
                <span className="muted small">
                  On, and an order cannot exceed what is on hand. Off, and it always sells.
                </span>
              </>
            }
            checked={f.trackStock}
            onChange={set('trackStock')}
          />
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Shop settings</h2>
        </div>
        <div className="form">
          <div className="form-grid-2">
            <SelectField label="Status" value={f.status} onChange={set('status')} hint="Only Active products can be bought.">
              <option value="ACTIVE">Active</option>
              <option value="DRAFT">Draft</option>
              <option value="OUT_OF_STOCK">Out of stock</option>
              <option value="HIDDEN">Hidden</option>
              <option value="ARCHIVED">Archived</option>
            </SelectField>
            <SelectField label="Type" value={f.kind} onChange={set('kind')}>
              <option value="CARD">Card</option>
              <option value="STAND">Stand</option>
              <option value="RENEWAL">Renewal</option>
            </SelectField>
          </div>
          <div className="form-grid-2">
            <TextField label="Badge" value={f.badge} onChange={set('badge')} placeholder="Most popular" error={fields.badge} />
            <TextField label="Order on the page" type="number" min={0} value={f.position} onChange={set('position')} error={fields.position} />
          </div>
          <SelectField
            label="What the card points at by default"
            value={f.destinationType}
            onChange={set('destinationType')}
            hint="Cards made for this product start with this destination."
          >
            <option value="PROFILE">The customer's NFCY profile</option>
            <option value="GOOGLE_REVIEW">Their Google review page</option>
            <option value="INSTAGRAM">Their Instagram</option>
            <option value="CUSTOM_URL">Any link they choose</option>
          </SelectField>
          <div className="form-grid-2">
            <TextField label="Link name" value={f.slug} onChange={set('slug')} error={fields.slug} hint="Lowercase, hyphens." required />
            <TextField label="SKU" value={f.sku} onChange={set('sku')} error={fields.sku} required />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Pictures</h2>
          <span className="muted small">
            {images.length === 0 ? 'Without a photo, the drawn card art is shown' : `${images.length} uploaded`}
          </span>
        </div>

        {isNew ? (
          <p className="muted small">Save the product first, then you can upload pictures for it.</p>
        ) : (
          <>
            <div className="upload" style={{ marginBottom: 16 }}>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                onChange={(e) => {
                  void addImage(e.target.files?.[0]);
                  e.target.value = '';
                }}
                aria-label="Upload a product picture"
                disabled={uploading}
              />
              <span className="upload-thumb" aria-hidden="true">+</span>
              <div>
                <p className="small">{uploading ? 'Uploading' : 'Click to upload, or drop a file here'}</p>
                <p className="hint">JPG, PNG, WebP or AVIF. Resized in your browser before it is sent.</p>
              </div>
            </div>

            {images.length > 0 && (
              <div className="stack-sm">
                {images.map((img, i) => (
                  <div className="item-row" key={img.id}>
                    <div style={{ display: 'grid' }}>
                      <button type="button" className="grab" onClick={() => void moveImage(img.id, -1)} disabled={i === 0} aria-label="Move up">▲</button>
                      <button type="button" className="grab" onClick={() => void moveImage(img.id, 1)} disabled={i === images.length - 1} aria-label="Move down">▼</button>
                    </div>
                    <img src={img.url} alt={img.alt ?? ''} />
                    <span className="grow">
                      <b>{img.isPrimary ? 'Main picture' : `Picture ${i + 1}`}</b>
                      <span className="muted tiny">{img.alt}</span>
                    </span>
                    {!img.isPrimary ? (
                      <button type="button" className="btn btn-quiet btn-sm" onClick={() => void makePrimary(img.id)}>
                        <IconCheck /> Make main
                      </button>
                    ) : null}
                    <button type="button" className="btn btn-danger btn-sm" onClick={() => void removeImage(img.id)} aria-label="Remove picture">
                      <IconTrash />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <div className="row">
        <button type="button" className="btn btn-accent" onClick={() => void save()} disabled={busy}>
          {busy ? <span className="spinner" aria-hidden="true" /> : null}
          {busy ? 'Saving' : isNew ? 'Create product' : 'Save product'}
        </button>
      </div>
    </div>
  );
}
