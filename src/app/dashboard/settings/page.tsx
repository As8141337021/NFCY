import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { requireUserOrRedirect } from '@/lib/guards';
import SettingsClient from './SettingsClient';

export const metadata: Metadata = { title: 'Settings' };
export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const user = await requireUserOrRedirect('/dashboard/settings');
  const liveCards = await db.nfcCard.count({ where: { userId: user.id, status: 'ACTIVE' } });

  return (
    <>
      <div className="page-head">
        <h1>Settings</h1>
        <p>Your account, your password, and what we do with your data.</p>
      </div>
      <SettingsClient email={user.email} hasLiveCards={liveCards} />
    </>
  );
}
