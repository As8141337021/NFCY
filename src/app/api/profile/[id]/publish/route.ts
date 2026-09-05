import { db } from '@/lib/db';
import { handler, ok } from '@/lib/api';
import { requireUser, requireProfileAccess, HttpError } from '@/lib/auth';
import { profileUrl } from '@/lib/qr';
import { notify } from '@/lib/notify';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

export const POST = handler(async (req, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  await requireProfileAccess(id, user);

  const body = (await req.json().catch(() => ({}))) as { publish?: boolean };
  const publish = body.publish !== false;

  const profile = await db.profile.findUniqueOrThrow({ where: { id } });

  if (profile.status === 'SUSPENDED') {
    throw new HttpError(403, 'This profile is suspended. Contact support.', 'suspended');
  }
  if (profile.status === 'RENEWAL_REQUIRED' && publish) {
    throw new HttpError(
      402,
      'This profile is waiting on a renewal. Renew it and it comes straight back.',
      'renewal_required',
    );
  }
  if (publish && !profile.fullName.trim()) {
    throw new HttpError(422, 'Add a name before publishing.', 'validation');
  }

  const updated = await db.profile.update({
    where: { id },
    data: {
      status: publish ? 'PUBLISHED' : 'DRAFT',
      publishedAt: publish ? (profile.publishedAt ?? new Date()) : profile.publishedAt,
    },
  });

  if (publish && !profile.publishedAt) {
    await notify({
      template: 'profile_published',
      to: user.email,
      userId: user.id,
      vars: { name: user.name.split(' ')[0], url: profileUrl(updated.username) },
      dedupeKey: `published:${updated.id}`,
    });
  }

  return ok({ status: updated.status, url: profileUrl(updated.username) });
});
