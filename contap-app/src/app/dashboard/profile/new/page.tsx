import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { requireUserOrRedirect } from '@/lib/guards';
import { slugifyToFreeUsername } from '@/lib/profile';
import { mayCreateProfile } from '@/lib/entitlement';
import Link from 'next/link';
import NewProfileForm from './NewProfileForm';

export const metadata: Metadata = { title: 'Create your profile' };
export const dynamic = 'force-dynamic';

export default async function NewProfilePage() {
  const user = await requireUserOrRedirect('/dashboard/profile/new');

  const existing = await db.profile.count({ where: { userId: user.id } });
  if (existing > 0) redirect('/dashboard/profile');

  // the card comes first: it is what opens the profile and what carries the QR
  if (!(await mayCreateProfile(user))) {
    return (
      <>
        <div className="page-head">
          <h1>Your card comes first</h1>
          <p>A profile is the page your card opens, so the card is where it starts.</p>
        </div>

        <div className="card" style={{ maxWidth: 620 }}>
          <p className="muted">
            Order a card and your profile opens up straight away, while the card is still being printed. Your QR
            code is made at the same moment and is the same one printed on the card, so there is only ever one code
            to scan.
          </p>
          <div className="row" style={{ marginTop: 20 }}>
            <Link href="/cards" className="btn btn-accent">Look at the cards</Link>
            <Link href="/dashboard/orders" className="btn btn-quiet">My orders</Link>
          </div>
        </div>
      </>
    );
  }

  const suggested = await slugifyToFreeUsername(user.name);

  return (
    <>
      <div className="page-head">
        <h1>Create your profile</h1>
        <p>
          Two things to decide and then you are in the editor. Your link is the address people land on when they tap
          your card.
        </p>
      </div>

      <div className="card" style={{ maxWidth: 620 }}>
        <NewProfileForm suggested={suggested} defaultName={user.name} appUrl={env.appUrl} />
      </div>
    </>
  );
}
