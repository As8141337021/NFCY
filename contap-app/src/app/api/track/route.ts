import { db } from '@/lib/db';
import { handler, ok, readJson, rateLimit, clientKey } from '@/lib/api';
import { trackSchema } from '@/lib/validate';
import { track } from '@/lib/analytics';

export const runtime = 'nodejs';

/**
 * Records a click on a public profile. Open by design, so it is rate limited
 * and only accepts a fixed list of event types against a profile that is
 * actually published.
 */
export const POST = handler(async (req) => {
  await rateLimit(clientKey(req, 'track'), 240, 300);

  const input = await readJson(req, trackSchema);

  const profile = await db.profile.findUnique({
    where: { id: input.profileId },
    select: { id: true, status: true },
  });

  // silently accept, so a bot learns nothing from the response
  if (!profile || profile.status !== 'PUBLISHED') return ok({ recorded: false });

  await track(req, {
    profileId: profile.id,
    type: input.type,
    label: input.label ?? null,
    source: input.source ?? null,
  });

  return ok({ recorded: true });
});
