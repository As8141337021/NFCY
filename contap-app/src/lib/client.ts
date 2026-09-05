'use client';

/**
 * The one way the browser talks to the API.
 * Every call returns either data or a typed error. Nothing throws a raw
 * exception at a component, so every screen can show a real error state.
 */

export type ApiError = {
  message: string;
  code?: string;
  fields?: Record<string, string>;
  status: number;
};

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiError };

export async function api<T = unknown>(
  path: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<ApiResult<T>> {
  const { json, ...rest } = init;
  try {
    const res = await fetch(path, {
      ...rest,
      method: rest.method ?? (json !== undefined ? 'POST' : 'GET'),
      headers: {
        ...(json !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(rest.headers ?? {}),
      },
      body: json !== undefined ? JSON.stringify(json) : rest.body,
      credentials: 'same-origin',
    });

    let payload: unknown = null;
    const text = await res.text();
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = null;
      }
    }

    const p = payload as { ok?: boolean; data?: T; error?: Omit<ApiError, 'status'> } | null;

    if (!res.ok || !p?.ok) {
      return {
        ok: false,
        error: {
          message: p?.error?.message ?? 'Something went wrong. Please try again.',
          code: p?.error?.code,
          fields: p?.error?.fields,
          status: res.status,
        },
      };
    }
    return { ok: true, data: p.data as T };
  } catch {
    return {
      ok: false,
      error: {
        message: 'We could not reach the server. Check your connection and try again.',
        code: 'network',
        status: 0,
      },
    };
  }
}

/**
 * Shrinks a picked image in the browser before it is uploaded, so a 6MB phone
 * photo becomes a couple of hundred KB and the upload works on mobile data.
 */
export async function resizeImage(
  file: File,
  maxEdge = 1600,
  quality = 0.86,
): Promise<File> {
  if (!file.type.startsWith('image/')) return file;
  // SVG and AVIF are left alone: canvas would rasterise or fail on them.
  if (file.type === 'image/svg+xml') return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);

    // Nothing to gain from re-encoding an already small file.
    if (scale === 1 && file.size < 400_000) {
      bitmap.close();
      return file;
    }

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', quality),
    );
    if (!blob || blob.size >= file.size) return file;

    return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

export async function uploadImage(file: File): Promise<ApiResult<{ id: string; url: string }>> {
  const resized = await resizeImage(file);
  const form = new FormData();
  form.append('file', resized);
  return api<{ id: string; url: string }>('/api/media/upload', { method: 'POST', body: form });
}

export const rupees = (minor: number): string => {
  const abs = Math.abs(minor);
  const whole = Math.floor(abs / 100);
  const paise = abs % 100;
  const s = String(whole);
  const grouped =
    s.length <= 3 ? s : s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + s.slice(-3);
  return `${minor < 0 ? '-' : ''}₹${grouped}${paise ? '.' + String(paise).padStart(2, '0') : ''}`;
};

export function dateLabel(v: string | Date | null | undefined): string {
  if (!v) return '';
  const d = typeof v === 'string' ? new Date(v) : v;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function daysBetween(a: Date, b: Date): number {
  return Math.ceil((b.getTime() - a.getTime()) / 86_400_000);
}
