import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { requireUserOrRedirect } from '@/lib/guards';
import LeadsClient from './LeadsClient';

export const metadata: Metadata = { title: 'Enquiries' };
export const dynamic = 'force-dynamic';

export default async function LeadsPage() {
  const user = await requireUserOrRedirect('/dashboard/leads');

  const profiles = await db.profile.findMany({ where: { userId: user.id }, select: { id: true } });
  const leads = profiles.length
    ? await db.lead.findMany({
        where: { profileId: { in: profiles.map((p) => p.id) } },
        orderBy: { createdAt: 'desc' },
        take: 500,
      })
    : [];

  return (
    <>
      <div className="page-head">
        <h1>Enquiries</h1>
        <p>Everyone who filled in the form on your profile. Reply on WhatsApp in one tap.</p>
      </div>

      <LeadsClient
        leads={leads.map((l) => ({
          id: l.id,
          name: l.name,
          phone: l.phone,
          email: l.email,
          message: l.message,
          status: l.status,
          note: l.note,
          createdAt: l.createdAt.toISOString(),
        }))}
      />
    </>
  );
}
