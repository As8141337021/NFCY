import 'server-only';
import { db } from './db';

/**
 * Who changed what. Written for every staff action that touches money, access
 * or a customer's data. Never blocks the action it is recording.
 */
export async function audit(input: {
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
}) {
  try {
    await db.auditLog.create({
      data: {
        userId: input.userId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        before: (input.before ?? undefined) as never,
        after: (input.after ?? undefined) as never,
      },
    });
  } catch (e) {
    console.error('[audit]', e);
  }
}
