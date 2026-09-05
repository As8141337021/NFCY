import { db } from '@/lib/db';
import { handler, ok, readJson } from '@/lib/api';
import { leadStatusSchema } from '@/lib/validate';
import { requireUser, isStaff, HttpError } from '@/lib/auth';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

async function own(id: string, userId: string, role: string) {
  const lead = await db.lead.findUnique({
    where: { id },
    include: { profile: { select: { userId: true } } },
  });
  if (!lead || (lead.profile.userId !== userId && !isStaff(role as never))) {
    throw new HttpError(404, 'That enquiry is not on your account.', 'not_found');
  }
  return lead;
}

export const PATCH = handler(async (req, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  await own(id, user.id, user.role);

  const input = await readJson(req, leadStatusSchema);
  const lead = await db.lead.update({
    where: { id },
    data: { status: input.status, note: input.note ?? null },
  });

  return ok({ id: lead.id, status: lead.status, note: lead.note });
});

export const DELETE = handler(async (_req, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  await own(id, user.id, user.role);
  await db.lead.delete({ where: { id } });
  return ok({ deleted: true });
});
