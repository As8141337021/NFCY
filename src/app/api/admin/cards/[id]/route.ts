import { db } from '@/lib/db';
import { handler, ok, readJson } from '@/lib/api';
import { z } from 'zod';
import { requireStaff, HttpError } from '@/lib/auth';
import { audit } from '@/lib/audit';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  status: z.enum(['UNASSIGNED', 'ASSIGNED', 'ACTIVE', 'SUSPENDED', 'LOST', 'REPLACED']).optional(),
  notes: z.string().trim().max(500).optional().nullable(),
  unassign: z.boolean().optional(),
});

export const PATCH = handler(async (req, ctx: Ctx) => {
  const staff = await requireStaff('cards.manage');
  const { id } = await ctx.params;
  const input = await readJson(req, schema);

  const card = await db.nfcCard.findUnique({ where: { id } });
  if (!card) throw new HttpError(404, 'No such card.', 'not_found');

  const data: Record<string, unknown> = {};
  if (input.status) data.status = input.status;
  if (input.notes !== undefined) data.notes = input.notes;

  if (input.unassign) {
    data.userId = null;
    data.profileId = null;
    data.orderItemId = null;
    data.status = 'UNASSIGNED';
    data.activatedAt = null;
    data.assignedAt = null;
  }

  if (!Object.keys(data).length) throw new HttpError(400, 'Nothing to change.', 'empty');

  const updated = await db.nfcCard.update({ where: { id }, data });

  await audit({
    userId: staff.id,
    action: input.unassign ? 'card.unassigned' : 'card.updated',
    entityType: 'NfcCard',
    entityId: id,
    before: { status: card.status, userId: card.userId },
    after: { status: updated.status, userId: updated.userId },
  });

  return ok({ id: updated.id, status: updated.status });
});
