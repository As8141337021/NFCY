import { handler, ok, rateLimit, clientKey } from '@/lib/api';
import { usernameSchema } from '@/lib/validate';
import { usernameTaken, suggestUsernames } from '@/lib/profile';
import { requireUser } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Live availability check for the username picker. Signed in only, and rate limited. */
export const GET = handler(async (req) => {
  await requireUser();
  await rateLimit(clientKey(req, 'username-check'), 120, 300);

  const raw = new URL(req.url).searchParams.get('u') ?? '';
  const parsed = usernameSchema.safeParse(raw);

  if (!parsed.success) {
    return ok({
      available: false,
      username: raw.toLowerCase(),
      reason: parsed.error.errors[0]?.message ?? 'That username cannot be used.',
      suggestions: [] as string[],
    });
  }

  const username = parsed.data;
  const taken = await usernameTaken(username);

  return ok({
    available: !taken,
    username,
    reason: taken ? 'That one is taken.' : null,
    suggestions: taken ? await suggestUsernames(username) : [],
  });
});
