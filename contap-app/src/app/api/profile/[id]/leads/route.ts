import { db } from '@/lib/db';
import { handler, ok, readJson, rateLimit, clientKey } from '@/lib/api';
import { leadSchema } from '@/lib/validate';
import { HttpError, requireUser, requireProfileAccess } from '@/lib/auth';
import { track } from '@/lib/analytics';
import { notify } from '@/lib/notify';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

/** A visitor leaving an enquiry on a public profile. Open, so heavily guarded. */
export const POST = handler(async (req, ctx: Ctx) => {
  const { id } = await ctx.params;
  await rateLimit(clientKey(req, 'lead'), 10, 3600);
  await rateLimit(`lead-profile:${id}`, 60, 3600);

  const input = await readJson(req, leadSchema);

  // the honeypot: a real person never fills a field they cannot see
  if (input.website) return ok({ received: true });

  const profile = await db.profile.findUnique({
    where: { id },
    select: { id: true, status: true, leadFormEnabled: true, username: true, user: { select: { id: true, email: true, name: true } } },
  });

  if (!profile || profile.status !== 'PUBLISHED') {
    throw new HttpError(404, 'That profile is not available.', 'not_found');
  }
  if (!profile.leadFormEnabled) {
    throw new HttpError(403, 'This profile is not taking messages right now.', 'disabled');
  }

  const lead = await db.lead.create({
    data: {
      profileId: profile.id,
      name: input.name,
      phone: input.phone || null,
      email: input.email || null,
      message: input.message || null,
      sourceUrl: req.headers.get('referer')?.slice(0, 400) ?? null,
    },
  });

  await track(req, { profileId: profile.id, type: 'LEAD_SUBMITTED' });

  await notify({
    template: 'lead_received',
    to: profile.user.email,
    userId: profile.user.id,
    vars: {
      name: profile.user.name.split(' ')[0],
      leadName: lead.name,
      phone: lead.phone ?? '',
      email: lead.email ?? '',
      message: lead.message ?? '',
    },
  });

  return ok({ received: true });
});

/** The owner reading their own enquiries. */
export const GET = handler(async (req, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  await requireProfileAccess(id, user);

  const url = new URL(req.url);
  const status = url.searchParams.get('status');

  const leads = await db.lead.findMany({
    where: {
      profileId: id,
      ...(status && ['NEW', 'CONTACTED', 'CONVERTED', 'CLOSED'].includes(status)
        ? { status: status as 'NEW' }
        : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 500,
  });

  return ok({ leads });
});
