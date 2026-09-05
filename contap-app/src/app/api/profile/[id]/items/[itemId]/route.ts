import { db } from '@/lib/db';
import { handler, ok } from '@/lib/api';
import { requireUser, requireProfileAccess, HttpError } from '@/lib/auth';
import {
  socialLinkSchema, profileProductSchema, profileServiceSchema,
  galleryItemSchema, businessSchema, affiliationSchema, profileDocumentSchema,
} from '@/lib/validate';
import { editorInclude, toView, completion, type FullProfile } from '@/lib/profile';
import { deleteAssetIfOrphan } from '@/lib/storage';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string; itemId: string }> };

const KINDS = ['social', 'product', 'service', 'gallery', 'business', 'affiliation', 'document'] as const;
type ItemKind = (typeof KINDS)[number];

function kindOf(req: Request): ItemKind {
  const k = new URL(req.url).searchParams.get('kind') as ItemKind | null;
  if (!k || !KINDS.includes(k)) throw new HttpError(400, 'That list does not exist.', 'bad_kind');
  return k;
}

function tableFor(kind: ItemKind) {
  return kind === 'social' ? db.socialLink
    : kind === 'product' ? db.profileProduct
    : kind === 'service' ? db.profileService
    : kind === 'business' ? db.business
    : kind === 'affiliation' ? db.affiliation
    : kind === 'document' ? db.profileDocument
    : db.galleryItem;
}

/** An item is only touchable through the profile that owns it. */
async function assertOwned(kind: ItemKind, itemId: string, profileId: string) {
  const table = tableFor(kind) as { findUnique: (a: unknown) => Promise<{ profileId: string } | null> };
  const row = await table.findUnique({ where: { id: itemId } });
  if (!row || row.profileId !== profileId) throw new HttpError(404, 'That item is not on this profile.', 'not_found');
  return row;
}

export const PATCH = handler(async (req, ctx: Ctx) => {
  const user = await requireUser();
  const { id, itemId } = await ctx.params;
  await requireProfileAccess(id, user);

  const kind = kindOf(req);
  await assertOwned(kind, itemId, id);
  const body = await req.json().catch(() => ({}));

  if (kind === 'social') {
    const v = socialLinkSchema.parse(body);
    await db.socialLink.update({
      where: { id: itemId },
      data: { platform: v.platform, label: v.label || null, url: v.url },
    });
  } else if (kind === 'product') {
    const v = profileProductSchema.parse(body);
    const old = await db.profileProduct.findUnique({ where: { id: itemId }, select: { imageId: true } });
    await db.profileProduct.update({
      where: { id: itemId },
      data: {
        name: v.name, description: v.description || null, priceMinor: v.priceMinor ?? null,
        url: v.url || null, buttonLabel: v.buttonLabel, imageId: v.imageId ?? null, active: v.active,
      },
    });
    if (old?.imageId && old.imageId !== v.imageId) await deleteAssetIfOrphan(old.imageId);
  } else if (kind === 'service') {
    const v = profileServiceSchema.parse(body);
    const old = await db.profileService.findUnique({ where: { id: itemId }, select: { imageId: true } });
    await db.profileService.update({
      where: { id: itemId },
      data: {
        name: v.name, description: v.description || null, priceMinor: v.priceMinor ?? null,
        durationMin: v.durationMin ?? null, bookingUrl: v.bookingUrl || null,
        buttonLabel: v.buttonLabel, imageId: v.imageId ?? null, active: v.active,
      },
    });
    if (old?.imageId && old.imageId !== v.imageId) await deleteAssetIfOrphan(old.imageId);
  } else if (kind === 'business') {
    const v = businessSchema.parse(body);
    const logoId = 'logoId' in (body as object) ? ((body as { logoId: string | null }).logoId ?? null) : undefined;
    const old = await db.business.findUnique({ where: { id: itemId }, select: { logoId: true } });

    // exactly one business can be the main one
    if (v.isPrimary) {
      await db.business.updateMany({ where: { profileId: id }, data: { isPrimary: false } });
    }

    await db.business.update({
      where: { id: itemId },
      data: {
        name: v.name, category: v.category || null, about: v.about || null,
        phone: v.phone || null, whatsapp: v.whatsapp || null, email: v.email || null,
        website: v.website || null, address: v.address || null, mapsUrl: v.mapsUrl || null,
        gstNumber: v.gstNumber || null,
        hours: (v.hours ?? null) as never, showHours: v.showHours,
        googleReviewUrl: v.googleReviewUrl || null, instagramUrl: v.instagramUrl || null,
        isPrimary: v.isPrimary, active: v.active,
        ...(logoId !== undefined ? { logoId } : {}),
      },
    });

    if (logoId !== undefined && old?.logoId && old.logoId !== logoId) await deleteAssetIfOrphan(old.logoId);

    // never leave the profile without a main business
    const stillPrimary = await db.business.count({ where: { profileId: id, isPrimary: true } });
    if (stillPrimary === 0) {
      const first = await db.business.findFirst({ where: { profileId: id }, orderBy: { position: 'asc' } });
      if (first) await db.business.update({ where: { id: first.id }, data: { isPrimary: true } });
    }
  } else if (kind === 'document') {
    const v = profileDocumentSchema.parse(body);
    const old = await db.profileDocument.findUnique({ where: { id: itemId }, select: { fileId: true } });
    await db.profileDocument.update({
      where: { id: itemId },
      data: { title: v.title, description: v.description || null, fileId: v.fileId, active: v.active },
    });
    if (old?.fileId && old.fileId !== v.fileId) await deleteAssetIfOrphan(old.fileId);
  } else if (kind === 'affiliation') {
    const v = affiliationSchema.parse(body);
    const old = await db.affiliation.findUnique({ where: { id: itemId }, select: { logoId: true } });
    await db.affiliation.update({
      where: { id: itemId },
      data: {
        name: v.name, role: v.role || null, chapter: v.chapter || null,
        url: v.url || null, logoId: v.logoId ?? null,
      },
    });
    if (old?.logoId && old.logoId !== v.logoId) await deleteAssetIfOrphan(old.logoId);
  } else {
    const v = galleryItemSchema.parse(body);
    await db.galleryItem.update({
      where: { id: itemId },
      data: { kind: v.kind, caption: v.caption || null, mediaId: v.mediaId ?? null, videoUrl: v.videoUrl || null },
    });
  }

  const fresh = (await db.profile.findUnique({ where: { id }, include: editorInclude })) as FullProfile;
  return ok({ profile: toView(fresh), completion: completion(fresh) });
});

export const DELETE = handler(async (req, ctx: Ctx) => {
  const user = await requireUser();
  const { id, itemId } = await ctx.params;
  await requireProfileAccess(id, user);

  const kind = kindOf(req);
  await assertOwned(kind, itemId, id);

  if (kind === 'social') {
    await db.socialLink.delete({ where: { id: itemId } });
  } else if (kind === 'product') {
    const row = await db.profileProduct.delete({ where: { id: itemId } });
    if (row.imageId) await deleteAssetIfOrphan(row.imageId);
  } else if (kind === 'service') {
    const row = await db.profileService.delete({ where: { id: itemId } });
    if (row.imageId) await deleteAssetIfOrphan(row.imageId);
  } else if (kind === 'business') {
    const row = await db.business.delete({ where: { id: itemId } });
    if (row.logoId) await deleteAssetIfOrphan(row.logoId);
    // if the main one was removed, promote whatever is now first
    if (row.isPrimary) {
      const next = await db.business.findFirst({ where: { profileId: id }, orderBy: { position: 'asc' } });
      if (next) await db.business.update({ where: { id: next.id }, data: { isPrimary: true } });
    }
  } else if (kind === 'document') {
    const row = await db.profileDocument.delete({ where: { id: itemId } });
    await deleteAssetIfOrphan(row.fileId);
  } else if (kind === 'affiliation') {
    const row = await db.affiliation.delete({ where: { id: itemId } });
    if (row.logoId) await deleteAssetIfOrphan(row.logoId);
  } else {
    const row = await db.galleryItem.delete({ where: { id: itemId } });
    if (row.mediaId) await deleteAssetIfOrphan(row.mediaId);
  }

  const fresh = (await db.profile.findUnique({ where: { id }, include: editorInclude })) as FullProfile;
  return ok({ profile: toView(fresh), completion: completion(fresh) });
});
