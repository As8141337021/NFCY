import crypto from 'node:crypto';

/** No 0/O/1/I/L, so a serial read off a card by a human cannot be mistyped. */
const SAFE = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

export function safeCode(length: number): string {
  const bytes = crypto.randomBytes(length * 2);
  let out = '';
  for (let i = 0; out.length < length && i < bytes.length; i++) {
    const v = bytes[i];
    // reject the tail of the byte range so every character stays equally likely
    if (v < 248) out += SAFE[v % SAFE.length];
  }
  return out.length === length ? out : safeCode(length);
}

/** What the NFC chip stores: nfcy.in/t/<code> */
export const nfcCode = () => safeCode(8);

/** Printed on the card so support can read it out loud. */
export const cardSerial = () => `CT-${safeCode(4)}-${safeCode(4)}`;

/** Shown to the customer once, to activate the card. */
export const activationCode = () => safeCode(6);

export function orderNumber(sequence: number, at = new Date()): string {
  return `CT-${at.getFullYear()}-${String(sequence).padStart(6, '0')}`;
}

export function invoiceNumber(sequence: number, at = new Date()): string {
  const fy = at.getMonth() >= 3 ? at.getFullYear() : at.getFullYear() - 1;
  return `INV-${fy}-${String(fy + 1).slice(2)}-${String(sequence).padStart(5, '0')}`;
}

export const randomToken = () => crypto.randomBytes(32).toString('base64url');

export const sha256 = (v: string) => crypto.createHash('sha256').update(v).digest('hex');

/** Constant time compare, so a token check cannot be timed. */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}
