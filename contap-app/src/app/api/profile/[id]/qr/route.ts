import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { qrPng, qrSvg, profileUrl, tapUrl } from '@/lib/qr';
import { cardForProfile } from '@/lib/entitlement';

export const runtime = 'nodejs';

/**
 * The profile's QR, as PNG or SVG.
 * It always encodes the profile URL, so it keeps working when the profile
 * content changes, and it never has to be reprinted.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const format = new URL(req.url).searchParams.get('format') === 'svg' ? 'svg' : 'png';
  const download = new URL(req.url).searchParams.get('download') === '1';
  // clamped so nobody can ask for a 40000px png and tie up the server
  const requested = Number(new URL(req.url).searchParams.get('size') ?? 1024);
  const size = Number.isFinite(requested) ? Math.min(2048, Math.max(256, Math.round(requested))) : 1024;

  const p = await db.profile.findUnique({ where: { id }, select: { username: true, status: true } });
  if (!p) return new NextResponse('Not found', { status: 404 });

  // the card's link when there is a card, so the printed code and the one in
  // the dashboard are the same code
  const card = await cardForProfile(id);
  const url = card ? tapUrl(card.code) : profileUrl(p.username);
  const filename = `nfcy-${p.username}.${format}`;
  const disposition = download ? `attachment; filename="${filename}"` : 'inline';

  if (format === 'svg') {
    return new NextResponse(await qrSvg(url), {
      headers: {
        'content-type': 'image/svg+xml; charset=utf-8',
        'content-disposition': disposition,
        'cache-control': 'public, max-age=86400',
      },
    });
  }

  const png = await qrPng(url, size);
  return new NextResponse(new Uint8Array(png), {
    headers: {
      'content-type': 'image/png',
      'content-disposition': disposition,
      'cache-control': 'public, max-age=86400',
    },
  });
}
