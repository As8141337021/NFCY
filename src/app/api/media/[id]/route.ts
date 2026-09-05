import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

/**
 * Serves an image stored in the database. Public on purpose: these are profile
 * photos and product pictures that appear on public pages. The id is a uuid, so
 * the set is not enumerable.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const asset = await db.mediaAsset.findUnique({
    where: { id },
    select: { data: true, mimeType: true, externalUrl: true, driver: true },
  });

  if (!asset) return new NextResponse('Not found', { status: 404 });

  if (asset.driver === 's3' && asset.externalUrl) {
    return NextResponse.redirect(asset.externalUrl, 308);
  }
  if (!asset.data) return new NextResponse('Not found', { status: 404 });

  return new NextResponse(new Uint8Array(asset.data), {
    headers: {
      'content-type': asset.mimeType,
      // the bytes at a given id never change, so this can be cached hard
      'cache-control': 'public, max-age=31536000, immutable',
      'content-length': String(asset.data.length),
      'x-content-type-options': 'nosniff',
      'content-disposition': 'inline',
    },
  });
}
