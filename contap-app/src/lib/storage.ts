import 'server-only';
import crypto from 'node:crypto';
import { db } from './db';
import { env } from './env';
import { HttpError } from './auth';

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // 4MB after the browser has already resized
// a catalogue or price list is bigger than a photo, and nothing resizes it
export const MAX_DOCUMENT_BYTES = 12 * 1024 * 1024;
export const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'] as const;
export const DOCUMENT_MIME = 'application/pdf';

type AllowedMime = (typeof ALLOWED_MIME)[number];

/**
 * Never trust the declared content type. Read the actual magic bytes, because a
 * .php renamed to .jpg would otherwise walk straight into the store.
 */
export function sniffImage(buf: Buffer): AllowedMime | null {
  if (buf.length < 16) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') {
    return 'image/webp';
  }
  // avif and other iso-bmff: "ftyp" at offset 4, brand at 8
  if (buf.subarray(4, 8).toString('ascii') === 'ftyp') {
    const brand = buf.subarray(8, 12).toString('ascii');
    if (brand === 'avif' || brand === 'avis') return 'image/avif';
  }
  return null;
}

/** Pulls width and height straight out of the header. No image library needed. */
export function readDimensions(buf: Buffer, mime: AllowedMime): { width?: number; height?: number } {
  try {
    if (mime === 'image/png') {
      return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
    }
    if (mime === 'image/jpeg') {
      let i = 2;
      while (i < buf.length - 9) {
        if (buf[i] !== 0xff) { i++; continue; }
        const marker = buf[i + 1];
        // SOF0..SOF15, skipping the four that are not frame headers
        if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
          return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
        }
        i += 2 + buf.readUInt16BE(i + 2);
      }
      return {};
    }
    if (mime === 'image/webp') {
      const chunk = buf.subarray(12, 16).toString('ascii');
      if (chunk === 'VP8X') {
        return {
          width: 1 + (buf[24] | (buf[25] << 8) | (buf[26] << 16)),
          height: 1 + (buf[27] | (buf[28] << 8) | (buf[29] << 16)),
        };
      }
      if (chunk === 'VP8 ') {
        return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
      }
      if (chunk === 'VP8L') {
        const b = buf.readUInt32LE(21);
        return { width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 };
      }
    }
  } catch {
    // a header we cannot parse is not a reason to reject the upload
  }
  return {};
}

export type StoredAsset = { id: string; url: string; width?: number; height?: number };

/**
 * A PDF, by its magic bytes rather than by what the browser claimed.
 * Only PDFs: a document upload is not a way to host arbitrary files, and
 * anything else offered for download from a business profile is a liability.
 */
function sniffPdf(buf: Buffer): boolean {
  return buf.subarray(0, 5).toString('latin1') === '%PDF-';
}

/**
 * A document a business hands out: a catalogue, a price list, a brochure.
 * Kept apart from storeUpload so an image field can never be talked into
 * accepting a PDF, or the other way round.
 */
export async function storeDocument(file: File, ownerId: string | null): Promise<{ id: string; bytes: number }> {
  if (file.size > MAX_DOCUMENT_BYTES) {
    throw new HttpError(
      413,
      `That file is ${(file.size / 1048576).toFixed(1)}MB. The limit is 12MB.`,
      'too_large',
    );
  }
  if (file.size === 0) throw new HttpError(400, 'That file is empty.', 'empty');

  const buf = Buffer.from(await file.arrayBuffer());
  if (!sniffPdf(buf)) {
    throw new HttpError(415, 'Please upload a PDF. Other file types are not accepted.', 'bad_type');
  }

  const checksum = crypto.createHash('sha256').update(buf).digest('hex');
  const existing = await db.mediaAsset.findFirst({ where: { checksum, ownerId } });
  if (existing) return { id: existing.id, bytes: existing.bytes };

  if (env.storage.driver === 's3') {
    const externalUrl = await putToS3(buf, DOCUMENT_MIME, checksum);
    const row = await db.mediaAsset.create({
      data: { ownerId, mimeType: DOCUMENT_MIME, bytes: buf.length, checksum, driver: 's3', externalUrl },
    });
    return { id: row.id, bytes: row.bytes };
  }

  const row = await db.mediaAsset.create({
    data: { ownerId, mimeType: DOCUMENT_MIME, bytes: buf.length, checksum, driver: 'db', data: buf },
  });
  return { id: row.id, bytes: row.bytes };
}

/**
 * One entry point for every upload on the platform.
 * driver "db" keeps bytes in Postgres, which works on any host with no account.
 * driver "s3" pushes to a bucket and stores only the URL.
 */
export async function storeUpload(file: File, ownerId: string | null): Promise<StoredAsset> {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new HttpError(413, `That image is ${(file.size / 1048576).toFixed(1)}MB. The limit is 4MB.`, 'too_large');
  }
  if (file.size === 0) throw new HttpError(400, 'That file is empty.', 'empty');

  const buf = Buffer.from(await file.arrayBuffer());
  const mime = sniffImage(buf);
  if (!mime) {
    throw new HttpError(415, 'Please upload a JPG, PNG, WebP or AVIF image.', 'bad_type');
  }

  const { width, height } = readDimensions(buf, mime);
  const checksum = crypto.createHash('sha256').update(buf).digest('hex');

  // the same picture uploaded twice by the same owner is stored once
  const existing = await db.mediaAsset.findFirst({ where: { checksum, ownerId } });
  if (existing) {
    return { id: existing.id, url: assetUrl(existing.id, existing.externalUrl), width: existing.width ?? undefined, height: existing.height ?? undefined };
  }

  if (env.storage.driver === 's3') {
    const externalUrl = await putToS3(buf, mime, checksum);
    const row = await db.mediaAsset.create({
      data: { ownerId, mimeType: mime, bytes: buf.length, width, height, checksum, driver: 's3', externalUrl },
    });
    return { id: row.id, url: externalUrl, width, height };
  }

  const row = await db.mediaAsset.create({
    data: { ownerId, mimeType: mime, bytes: buf.length, width, height, checksum, driver: 'db', data: buf },
  });
  return { id: row.id, url: assetUrl(row.id, null), width, height };
}

export function assetUrl(id: string, externalUrl: string | null | undefined): string {
  return externalUrl || `/api/media/${id}`;
}

// ============================================================
// S3, signed by hand so there is no SDK to install
// ============================================================

async function putToS3(buf: Buffer, mime: string, checksum: string): Promise<string> {
  const { endpoint, region, bucket, accessKeyId, secretAccessKey, publicBaseUrl } = env.storage.s3;
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    throw new HttpError(500, 'Image storage is not configured. Set the S3 values or use STORAGE_DRIVER=db.', 'storage');
  }

  const ext = mime.split('/')[1].replace('jpeg', 'jpg');
  const key = `media/${checksum.slice(0, 2)}/${checksum}.${ext}`;
  const host = new URL(endpoint).host;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = crypto.createHash('sha256').update(buf).digest('hex');

  const canonicalHeaders =
    `content-type:${mime}\nhost:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';
  const canonicalRequest = [
    'PUT', `/${bucket}/${key}`, '', canonicalHeaders, signedHeaders, payloadHash,
  ].join('\n');

  const scope = `${dateStamp}/${region}/s3/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256', amzDate, scope,
    crypto.createHash('sha256').update(canonicalRequest).digest('hex'),
  ].join('\n');

  const hmac = (key: Buffer | string, data: string) => crypto.createHmac('sha256', key).update(data).digest();
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${secretAccessKey}`, dateStamp), region), 's3'), 'aws4_request');
  const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');

  const res = await fetch(`${endpoint.replace(/\/$/, '')}/${bucket}/${key}`, {
    method: 'PUT',
    body: new Uint8Array(buf),
    headers: {
      'content-type': mime,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
      authorization: `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
  });

  if (!res.ok) {
    console.error('[s3]', res.status, await res.text().catch(() => ''));
    throw new HttpError(502, 'The image could not be saved to storage. Please try again.', 'storage');
  }

  return `${(publicBaseUrl || `${endpoint}/${bucket}`).replace(/\/$/, '')}/${key}`;
}

/** Deletes an asset only if nothing still points at it. */
export async function deleteAssetIfOrphan(id: string) {
  const asset = await db.mediaAsset.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          profilePhotos: true, profileCovers: true, businessLogos: true, orgLogos: true,
          profileProducts: true, profileServices: true, galleryItems: true, productImages: true,
        },
      },
    },
  });
  if (!asset) return;
  const uses = Object.values(asset._count).reduce((a, b) => a + b, 0);
  if (uses === 0) await db.mediaAsset.delete({ where: { id } }).catch(() => {});
}
