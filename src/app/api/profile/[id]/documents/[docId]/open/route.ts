import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { assetUrl } from '@/lib/storage';
import { track, looksLikeBot } from '@/lib/analytics';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Opening a document goes through here rather than straight at the file, so the
 * owner can see which of their brochures anyone actually wanted. The count is
 * the real number of opens; nothing is estimated.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string; docId: string }> }) {
  const { id, docId } = await ctx.params;

  const doc = await db.profileDocument.findFirst({
    where: { id: docId, profileId: id, active: true },
    include: {
      file: { select: { id: true, externalUrl: true } },
      profile: { select: { id: true, status: true } },
    },
  });
  if (!doc || doc.profile.status !== 'PUBLISHED') {
    return new NextResponse('Not found', { status: 404 });
  }

  if (!looksLikeBot(req.headers.get('user-agent') ?? '')) {
    await db.profileDocument.update({ where: { id: doc.id }, data: { downloads: { increment: 1 } } }).catch(() => {});
    await track(req, { profileId: doc.profileId, type: 'DOCUMENT_OPENED', label: doc.title });
  }

  return NextResponse.redirect(new URL(assetUrl(doc.file.id, doc.file.externalUrl), req.url), 302);
}
