import { handler, ok } from '@/lib/api';
import { currentUser } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = handler(async () => ok({ user: await currentUser() }));
