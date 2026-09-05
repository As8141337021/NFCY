import 'server-only';
import QRCode from 'qrcode';
import { env } from './env';

export const profileUrl = (username: string) => `${env.appUrl}/${username}`;
/**
 * What the chip stores and the printed QR encodes: the card's own short link.
 * /t/ still answers for anything already printed.
 */
export const tapUrl = (code: string) => `${env.appUrl}/c/${code}`;

const OPTS = {
  errorCorrectionLevel: 'M' as const,
  margin: 2,
  color: { dark: '#090B10', light: '#FFFFFF' },
};

export async function qrSvg(text: string, size = 512): Promise<string> {
  return QRCode.toString(text, { ...OPTS, type: 'svg', width: size });
}

export async function qrPng(text: string, size = 1024): Promise<Buffer> {
  return QRCode.toBuffer(text, { ...OPTS, type: 'png', width: size });
}

export async function qrDataUrl(text: string, size = 320): Promise<string> {
  return QRCode.toDataURL(text, { ...OPTS, width: size });
}
