import { redirect } from 'next/navigation';
import Link from 'next/link';
import { requireUserOrRedirect } from '@/lib/guards';
import { isStaff } from '@/lib/auth';
import { db } from '@/lib/db';
import { AppBar, SideNav, type NavGroup } from '@/components/AppShell';

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUserOrRedirect('/dashboard');

  const profileIds = (
    await db.profile.findMany({ where: { userId: user.id }, select: { id: true } })
  ).map((p) => p.id);

  // A staff account is not a customer. Without a profile of their own there is
  // nothing here for them but an invitation to buy a card, which is confusing
  // and, for the person running the shop, nonsense. Staff who do own a card and
  // a profile keep the dashboard.
  if (isStaff(user.role) && profileIds.length === 0) redirect('/admin');

  const [newLeads, openOrders] = await Promise.all([
    profileIds.length
      ? db.lead.count({ where: { profileId: { in: profileIds }, status: 'NEW' } })
      : Promise.resolve(0),
    db.order.count({
      where: { userId: user.id, status: { notIn: ['DELIVERED', 'ACTIVATED', 'CANCELLED'] } },
    }),
  ]);

  const groups: NavGroup[] = [
    {
      items: [
        { href: '/dashboard', label: 'Overview', icon: 'home', exact: true },
        { href: '/dashboard/profile', label: 'My profile', icon: 'user' },
        { href: '/dashboard/cards', label: 'My cards', icon: 'card' },
        { href: '/dashboard/analytics', label: 'Analytics', icon: 'chart' },
      ],
    },
    {
      heading: 'Business',
      items: [
        { href: '/dashboard/leads', label: 'Enquiries', icon: 'inbox', count: newLeads },
        { href: '/dashboard/reviews', label: 'Reviews', icon: 'star' },
        { href: '/dashboard/orders', label: 'Orders', icon: 'box', count: openOrders },
        { href: '/dashboard/renewal', label: 'Renewal', icon: 'refresh' },
      ],
    },
    {
      heading: 'Account',
      items: [{ href: '/dashboard/settings', label: 'Settings', icon: 'cog' }],
    },
  ];

  return (
    <div className="app-shell">
      <div className="env" aria-hidden="true">
        <div className="env-glow" />
      </div>

      <AppBar
        name={user.name}
        role={user.role}
        right={
          <Link href="/cards" className="btn btn-quiet btn-sm nowrap">
            Buy a card
          </Link>
        }
      />

      <div className="app-body">
        <SideNav groups={groups} />
        <main id="main" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}
