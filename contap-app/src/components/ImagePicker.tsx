'use client';

import { useRef, useState } from 'react';
import { uploadImage } from '@/lib/client';
import { useToast } from '@/components/Toast';

type Props = {
  label: string;
  hint?: string;
  url: string | null;
  shape?: 'square' | 'round' | 'wide';
  onPicked: (assetId: string, url: string) => void | Promise<void>;
  onCleared?: () => void | Promise<void>;
};

export default function ImagePicker({ label, hint, url, shape = 'square', onPicked, onCleared }: Props) {
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  async function handle(file: File | undefined | null) {
    if (!file) return;
    setError('');
    setBusy(true);

    const res = await uploadImage(file);
    setBusy(false);

    if (!res.ok) {
      setError(res.error.message);
      toast(res.error.message, 'err');
      return;
    }
    await onPicked(res.data.id, res.data.url);
  }

  return (
    <div className="field">
      <label>{label}</label>

      <div
        className={`upload${drag ? ' drag' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          void handle(e.dataTransfer.files?.[0]);
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          onChange={(e) => {
            void handle(e.target.files?.[0]);
            e.target.value = '';
          }}
          aria-label={label}
          disabled={busy}
        />

        {url ? (
          <img className={`upload-thumb ${shape === 'round' ? 'round' : shape === 'wide' ? 'wide' : ''}`} src={url} alt="" />
        ) : (
          <span className={`upload-thumb ${shape === 'round' ? 'round' : shape === 'wide' ? 'wide' : ''}`} aria-hidden="true">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="var(--text-secondary)" strokeWidth="1.6">
              <rect x="3" y="5" width="18" height="14" rx="2.5" />
              <circle cx="8.5" cy="10" r="1.6" />
              <path d="m4 17 5-4.5 4 3.5 3-2.5 4 3.5" />
            </svg>
          </span>
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          <p className="small">
            {busy ? 'Uploading' : url ? 'Click to replace' : 'Click to choose, or drop a file here'}
          </p>
          {hint ? <p className="hint">{hint}</p> : null}
          {busy ? (
            <p className="hint" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="spinner" aria-hidden="true" /> Resizing and uploading
            </p>
          ) : null}
        </div>
      </div>

      {error ? <p className="err">{error}</p> : null}

      {url && onCleared ? (
        <button
          type="button"
          className="btn btn-quiet btn-sm"
          style={{ justifySelf: 'start' }}
          onClick={() => void onCleared()}
        >
          Remove
        </button>
      ) : null}
    </div>
  );
}
