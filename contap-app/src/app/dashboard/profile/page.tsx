import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { cardForProfile } from '@/lib/entitlement';
import { requireUserOrRedirect } from '@/lib/guards';
import { editorInclude, toView, completion, type FullProfile } from '@/lib/profile';
import ProfileBuilder from './ProfileBuilder';

export const metadata: Metadata = { title: 'My profile' };
export const dynamic = 'force-dynamic';

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await requireUserOrRedirect('/dashboard/profile');
  const { tab } = await searchParams;

  const profile = (await db.profile.findFirst({
    where: { userId: user.id },
    include: editorInclude,
    orderBy: { createdAt: 'asc' },
  })) as FullProfile | null;

  if (!profile) redirect('/dashboard/profile/new');

  // the card whose code every QR for this profile carries
  const card = await cardForProfile(profile.id);

  return (
    <ProfileBuilder
      initial={toView(profile)}
      initialCompletion={completion(profile)}
      appUrl={env.appUrl}
      card={card ? { serial: card.serial, code: card.code, status: card.status } : null}
      initialTab={tab}
    />
  );
}
