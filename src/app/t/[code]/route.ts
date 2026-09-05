import { redirect } from 'next/navigation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The old card path. Cards are printed with /c/<code> now, but chips already
 * in someone's wallet still hold /t/<code>, and a printed card can never be
 * reprogrammed. This forwards them for as long as those cards exist.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  redirect(`/c/${encodeURIComponent(code)}`);
}
