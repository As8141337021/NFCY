import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireStaff, HttpError } from '@/lib/auth';
import { qrPng, qrSvg, tapUrl } from '@/lib/qr';

export const runtime = 'nodejs';

/**
 * The QR that goes on the physical card.
 *
 * It encodes the card's own short code, nfcy.in/t/<CODE>, exactly what the
 * NFC chip stores. That code exists the moment the batch is made, months before
 * anybody buys the card and long before there is a profile to point at, so the
 * card can be printed and the QR is correct from the start. When the customer
 * activates it, the same code starts resolving to their profile.
 *
 * This is why it must never be a QR of the profile URL: that URL does not exist
 * at print time, and would change if the customer ever changed their username.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  // this route returns an image, not JSON, so it is not wrapped by handler()
  // and has to turn a refusal into a status itself rather than a 500
  try {
    await requireStaff('cards.view');
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    return new NextResponse(status === 401 ? 'Sign in' : 'Not allowed', { status });
  }

  const { id } = await ctx.params;
  const url = new URL(req.url);
  const format = url.searchParams.get('format') === 'png' ? 'png' : 'svg';
  const download = url.searchParams.get('download') === '1';

  // clamped so nobody can ask for a 40000px png and tie up the server
  const requested = Number(url.searchParams.get('size') ?? 1024);
  const size = Number.isFinite(requested) ? Math.min(2048, Math.max(256, Math.round(requested))) : 1024;

  const card = await db.nfcCard.findUnique({ where: { id }, select: { code: true, serial: true } });
  if (!card) return new NextResponse('Not found', { status: 404 });

  const target = tapUrl(card.code);
  const filename = `nfcy-${card.serial}.${format}`;
  const disposition = download ? `attachment; filename="${filename}"` : 'inline';

  // a printer wants vector; svg is the default here for that reason
  if (format === 'svg') {
    return new NextResponse(await qrSvg(target, size), {
      headers: {
        'content-type': 'image/svg+xml; charset=utf-8',
        'content-disposition': disposition,
        'cache-control': 'private, no-store',
      },
    });
  }

  const png = await qrPng(target, size);
  return new NextResponse(new Uint8Array(png), {
    headers: {
      'content-type': 'image/png',
      'content-disposition': disposition,
      'cache-control': 'private, no-store',
    },
  });
}
