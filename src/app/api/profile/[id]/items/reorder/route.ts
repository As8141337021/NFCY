import { db } from '@/lib/db';
import { handler, ok, readJson } from '@/lib/api';
import { requireUser, requireProfileAccess, HttpError } from '@/lib/auth';
import { reorderSchema } from '@/lib/validate';
import { editorInclude, toView, completion, type FullProfile } from '@/lib/profile';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };
const KINDS = ['social', 'product', 'service', 'gallery', 'business', 'affiliation', 'document'] as const;
type ItemKind = (typeof KINDS)[number];

export const POST = handler(async (req, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  await requireProfileAccess(id, user);

  const kind = new URL(req.url).searchParams.get('kind') as ItemKind | null;
  if (!kind || !KINDS.includes(kind)) throw new HttpError(400, 'That list does not exist.', 'bad_kind');

  const { ids } = await readJson(req, reorderSchema);

  // Only ids that really belong to this profile are moved, so a crafted request
  // cannot reorder somebody else's items.
  const owned =
    kind === 'social' ? await db.socialLink.findMany({ where: { profileId: id }, select: { id: true } })
    : kind === 'product' ? await db.profileProduct.findMany({ where: { profileId: id }, select: { id: true } })
    : kind === 'service' ? await db.profileService.findMany({ where: { profileId: id }, select: { id: true } })
    : kind === 'business' ? await db.business.findMany({ where: { profileId: id }, select: { id: true } })
    : kind === 'affiliation' ? await db.affiliation.findMany({ where: { profileId: id }, select: { id: true } })
    : kind === 'document' ? await db.profileDocument.findMany({ where: { profileId: id }, select: { id: true } })
    : await db.galleryItem.findMany({ where: { profileId: id }, select: { id: true } });

  const ownedIds = new Set(owned.map((o) => o.id));
  const ordered = ids.filter((x) => ownedIds.has(x));

  await db.$transaction(
    ordered.map((itemId, position) => {
      if (kind === 'social') return db.socialLink.update({ where: { id: itemId }, data: { position } });
      if (kind === 'product') return db.profileProduct.update({ where: { id: itemId }, data: { position } });
      if (kind === 'service') return db.profileService.update({ where: { id: itemId }, data: { position } });
      if (kind === 'business') return db.business.update({ where: { id: itemId }, data: { position } });
      if (kind === 'affiliation') return db.affiliation.update({ where: { id: itemId }, data: { position } });
      if (kind === 'document') return db.profileDocument.update({ where: { id: itemId }, data: { position } });
      return db.galleryItem.update({ where: { id: itemId }, data: { position } });
    }),
  );

  const fresh = (await db.profile.findUnique({ where: { id }, include: editorInclude })) as FullProfile;
  return ok({ profile: toView(fresh), completion: completion(fresh) });
});
