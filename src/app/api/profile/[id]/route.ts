import { db } from '@/lib/db';
import { handler, ok, readJson } from '@/lib/api';
import { profileSchema } from '@/lib/validate';
import { requireUser, requireProfileAccess, HttpError } from '@/lib/auth';
import { editorInclude, toView, completion, type FullProfile } from '@/lib/profile';
import { deleteAssetIfOrphan } from '@/lib/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export const GET = handler(async (_req, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  await requireProfileAccess(id, user);

  const profile = (await db.profile.findUnique({ where: { id }, include: editorInclude })) as FullProfile;
  return ok({ profile: toView(profile), completion: completion(profile) });
});

const imageFields = ['photoId', 'coverId'] as const;

export const PATCH = handler(async (req, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  await requireProfileAccess(id, user);

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  // images are set separately from the text fields, so the editor can save either alone
  const imagePatch: Record<string, string | null> = {};
  for (const f of imageFields) {
    if (f in body) {
      const v = body[f];
      if (v !== null && typeof v !== 'string') throw new HttpError(422, 'That image reference is not valid.');
      imagePatch[f] = (v as string | null) ?? null;
    }
  }

  const before = await db.profile.findUnique({ where: { id }, select: { photoId: true, coverId: true } });

  let data: Record<string, unknown> = { ...imagePatch };

  // a body carrying any text field is a full save of the details panel
  const hasDetails = 'fullName' in body;
  if (hasDetails) {
    const input = profileSchema.parse(body);
    data = {
      ...data,
      fullName: input.fullName,
      designation: input.designation || null,
      company: input.company || null,
      bio: input.bio || null,
      // midnight UTC of the day itself, so the stored date is the date typed
      dateOfBirth: input.dateOfBirth ? new Date(`${input.dateOfBirth}T00:00:00.000Z`) : null,
      showBirthday: input.showBirthday,
      phone: input.phone || null,
      email: input.email || null,
      whatsapp: input.whatsapp || null,
      whatsappNote: input.whatsappNote || null,
      website: input.website || null,
      address: input.address || null,
      mapsUrl: input.mapsUrl || null,
      upiId: input.upiId || null,
      paymentNote: input.paymentNote || null,
      template: input.template,
      accentColor: input.accentColor,
      isPublic: input.isPublic,
      leadFormEnabled: input.leadFormEnabled,
      leadFormTitle: input.leadFormTitle,
      metaTitle: input.metaTitle || null,
      metaDescription: input.metaDescription || null,
    };
  }

  if (!Object.keys(data).length) throw new HttpError(400, 'There was nothing to save.', 'empty_patch');

  await db.profile.update({ where: { id }, data });

  // clean up a replaced image once nothing points at it any more
  for (const f of imageFields) {
    const old = before?.[f];
    if (old && f in imagePatch && imagePatch[f] !== old) await deleteAssetIfOrphan(old);
  }

  const fresh = (await db.profile.findUnique({ where: { id }, include: editorInclude })) as FullProfile;
  return ok({ profile: toView(fresh), completion: completion(fresh) });
});

export const DELETE = handler(async (_req, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  await requireProfileAccess(id, user);

  const linkedCards = await db.nfcCard.count({ where: { profileId: id, status: 'ACTIVE' } });
  if (linkedCards > 0) {
    throw new HttpError(
      409,
      'A live card still points at this profile. Point the card somewhere else first, so nobody taps a dead link.',
      'card_linked',
    );
  }

  await db.profile.delete({ where: { id } });
  return ok({ deleted: true });
});
