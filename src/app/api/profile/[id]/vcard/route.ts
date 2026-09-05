import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { buildVCard, vcardFilename } from '@/lib/vcard';
import { profileUrl } from '@/lib/qr';
import { track } from '@/lib/analytics';

export const runtime = 'nodejs';

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const p = await db.profile.findUnique({
    where: { id },
    include: { businesses: { where: { active: true }, orderBy: { position: 'asc' } } },
  });

  if (!p || (p.status !== 'PUBLISHED' && p.status !== 'DRAFT')) {
    return new NextResponse('Not found', { status: 404 });
  }

  // the card carries the person's main business, not every venture they run
  const biz = p.businesses.find((b) => b.isPrimary) ?? p.businesses[0] ?? null;

  const vcf = buildVCard({
    fullName: p.fullName,
    designation: p.designation,
    company: p.company ?? biz?.name ?? null,
    phone: p.phone ?? biz?.phone ?? null,
    whatsapp: p.whatsapp ?? biz?.whatsapp ?? null,
    email: p.email ?? biz?.email ?? null,
    website: p.website ?? biz?.website ?? null,
    address: p.address ?? biz?.address ?? null,
    bio: p.bio,
    birthday: p.showBirthday && p.dateOfBirth ? p.dateOfBirth.toISOString().slice(0, 10) : null,
    profileUrl: profileUrl(p.username),
  });

  if (p.status === 'PUBLISHED') {
    await track(req, { profileId: p.id, type: 'SAVE_CONTACT' });
  }

  return new NextResponse(vcf, {
    headers: {
      'content-type': 'text/vcard; charset=utf-8',
      'content-disposition': `attachment; filename="${vcardFilename(p.fullName)}"`,
      'cache-control': 'no-store',
    },
  });
}
