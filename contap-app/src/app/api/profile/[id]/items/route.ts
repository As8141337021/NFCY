import { db } from '@/lib/db';
import { handler, ok } from '@/lib/api';
import { requireUser, requireProfileAccess, HttpError } from '@/lib/auth';
import {
  socialLinkSchema, profileProductSchema, profileServiceSchema,
  galleryItemSchema, businessSchema, affiliationSchema, profileDocumentSchema,
} from '@/lib/validate';
import { editorInclude, toView, completion, type FullProfile } from '@/lib/profile';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

const KINDS = ['social', 'product', 'service', 'gallery', 'business', 'affiliation', 'document'] as const;
type ItemKind = (typeof KINDS)[number];

const LIMITS: Record<ItemKind, number> = {
  social: 20,
  product: 60,
  service: 60,
  gallery: 40,
  // Enough for someone genuinely running several ventures, few enough that a
  // profile stays readable to the person who tapped the card.
  business: 5,
  affiliation: 12,
  // a catalogue, a price list, a brochure: more than this is a website
  document: 12,
};

function kindOf(req: Request): ItemKind {
  const k = new URL(req.url).searchParams.get('kind') as ItemKind | null;
  if (!k || !KINDS.includes(k)) throw new HttpError(400, 'That list does not exist.', 'bad_kind');
  return k;
}

async function countFor(kind: ItemKind, profileId: string) {
  if (kind === 'social') return db.socialLink.count({ where: { profileId } });
  if (kind === 'product') return db.profileProduct.count({ where: { profileId } });
  if (kind === 'service') return db.profileService.count({ where: { profileId } });
  if (kind === 'business') return db.business.count({ where: { profileId } });
  if (kind === 'affiliation') return db.affiliation.count({ where: { profileId } });
  if (kind === 'document') return db.profileDocument.count({ where: { profileId } });
  return db.galleryItem.count({ where: { profileId } });
}

export const POST = handler(async (req, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  await requireProfileAccess(id, user);

  const kind = kindOf(req);
  const body = await req.json().catch(() => ({}));

  const count = await countFor(kind, id);
  if (count >= LIMITS[kind]) {
    throw new HttpError(409, `You can add up to ${LIMITS[kind]} of those.`, 'limit');
  }
  const position = count;

  if (kind === 'social') {
    const v = socialLinkSchema.parse(body);
    await db.socialLink.create({
      data: { profileId: id, platform: v.platform, label: v.label || null, url: v.url, position },
    });
  } else if (kind === 'product') {
    const v = profileProductSchema.parse(body);
    await db.profileProduct.create({
      data: {
        profileId: id, name: v.name, description: v.description || null,
        priceMinor: v.priceMinor ?? null, url: v.url || null,
        buttonLabel: v.buttonLabel, imageId: v.imageId ?? null, active: v.active, position,
      },
    });
  } else if (kind === 'service') {
    const v = profileServiceSchema.parse(body);
    await db.profileService.create({
      data: {
        profileId: id, name: v.name, description: v.description || null,
        priceMinor: v.priceMinor ?? null, durationMin: v.durationMin ?? null,
        bookingUrl: v.bookingUrl || null, buttonLabel: v.buttonLabel,
        imageId: v.imageId ?? null, active: v.active, position,
      },
    });
  } else if (kind === 'business') {
    const v = businessSchema.parse(body);
    const logoId = typeof (body as { logoId?: unknown }).logoId === 'string' ? (body as { logoId: string }).logoId : null;
    // the first business a person adds is their main one by default
    const makePrimary = v.isPrimary || count === 0;
    if (makePrimary) {
      await db.business.updateMany({ where: { profileId: id }, data: { isPrimary: false } });
    }
    await db.business.create({
      data: {
        profileId: id, position, isPrimary: makePrimary, active: v.active,
        name: v.name, category: v.category || null, about: v.about || null,
        phone: v.phone || null, whatsapp: v.whatsapp || null, email: v.email || null,
        website: v.website || null, address: v.address || null, mapsUrl: v.mapsUrl || null,
        gstNumber: v.gstNumber || null, logoId,
        hours: (v.hours ?? null) as never, showHours: v.showHours,
        googleReviewUrl: v.googleReviewUrl || null, instagramUrl: v.instagramUrl || null,
      },
    });
  } else if (kind === 'document') {
    const v = profileDocumentSchema.parse(body);
    // the file must be a PDF this person actually uploaded
    const file = await db.mediaAsset.findUnique({ where: { id: v.fileId }, select: { mimeType: true, ownerId: true } });
    if (!file || file.mimeType !== 'application/pdf') {
      throw new HttpError(422, 'That file is not a PDF.', 'validation');
    }
    if (file.ownerId && file.ownerId !== user.id) {
      throw new HttpError(403, 'That file is not yours.', 'forbidden');
    }
    await db.profileDocument.create({
      data: {
        profileId: id, position, title: v.title,
        description: v.description || null, fileId: v.fileId, active: v.active,
      },
    });
  } else if (kind === 'affiliation') {
    const v = affiliationSchema.parse(body);
    await db.affiliation.create({
      data: {
        profileId: id, position, name: v.name, role: v.role || null,
        chapter: v.chapter || null, url: v.url || null, logoId: v.logoId ?? null,
      },
    });
  } else {
    const v = galleryItemSchema.parse(body);
    if (!v.mediaId && !v.videoUrl) {
      throw new HttpError(422, 'Add an image or a video link.', 'validation');
    }
    await db.galleryItem.create({
      data: {
        profileId: id, kind: v.kind, caption: v.caption || null,
        mediaId: v.mediaId ?? null, videoUrl: v.videoUrl || null, position,
      },
    });
  }

  const fresh = (await db.profile.findUnique({ where: { id }, include: editorInclude })) as FullProfile;
  return ok({ profile: toView(fresh), completion: completion(fresh) });
});
