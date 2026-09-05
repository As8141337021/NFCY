import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { requireUserOrRedirect } from '@/lib/guards';
import AnalyticsClient from './AnalyticsClient';

export const metadata: Metadata = { title: 'Analytics' };
export const dynamic = 'force-dynamic';

export default async function AnalyticsPage() {
  const user = await requireUserOrRedirect('/dashboard/analytics');
  const count = await db.profile.count({ where: { userId: user.id } });

  return (
    <>
      <div className="page-head">
        <h1>Analytics</h1>
        <p>What happens after someone taps. Views, scans, and which buttons people actually press.</p>
      </div>
      <AnalyticsClient hasProfile={count > 0} />
    </>
  );
}
