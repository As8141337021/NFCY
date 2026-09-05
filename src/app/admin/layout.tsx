import { db } from '@/lib/db';
import { requireStaffOrRedirect } from '@/lib/guards';
import { can } from '@/lib/auth';
import { AppBar, SideNav, type NavGroup, type NavItem } from '@/components/AppShell';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireStaffOrRedirect('orders.view');

  const [openOrders, unassignedCards, expiring] = await Promise.all([
    db.order.count({ where: { paidAt: { not: null }, status: { notIn: ['DELIVERED', 'ACTIVATED', 'CANCELLED'] } } }),
    // cards created by a payment and not yet activated: the print queue
    db.nfcCard.count({ where: { status: 'ASSIGNED' } }),
    db.subscription.count({
      where: { status: { in: ['ACTIVE', 'EXPIRING'] }, expiresAt: { lte: new Date(Date.now() + 30 * 864e5) } },
    }),
  ]);

  // the sidebar only ever shows what this role is actually allowed to open
  const allGroups: NavGroup[] = [
    {
      items: [{ href: '/admin', label: 'Overview', icon: 'home', exact: true }],
    },
    {
      heading: 'Operations',
      items: [
        { href: '/admin/orders', label: 'Orders', icon: 'box', count: openOrders },
        ...(can(staff.role, 'cards.view')
          ? ([{ href: '/admin/cards', label: 'NFC cards', icon: 'card', count: unassignedCards }] as NavItem[])
          : []),
        { href: '/admin/renewals', label: 'Renewals', icon: 'refresh', count: expiring },
      ],
    },
    {
      heading: 'Catalogue',
      items: [
        ...(can(staff.role, 'products.view') ? ([{ href: '/admin/products', label: 'Products', icon: 'tag' }] as NavItem[]) : []),
        ...(can(staff.role, 'coupons.manage') ? ([{ href: '/admin/coupons', label: 'Coupons', icon: 'tag' }] as NavItem[]) : []),
      ],
    },
    {
      heading: 'People',
      items: [
        ...(can(staff.role, 'users.view') ? ([{ href: '/admin/users', label: 'Customers', icon: 'users' }] as NavItem[]) : []),
        ...(can(staff.role, 'profiles.view') ? ([{ href: '/admin/profiles', label: 'Profiles', icon: 'user' }] as NavItem[]) : []),
      ],
    },
    {
      heading: 'System',
      items: [
        { href: '/admin/notifications', label: 'Messages', icon: 'bell' },
        ...(can(staff.role, 'audit.view') ? ([{ href: '/admin/audit', label: 'Audit log', icon: 'shield' }] as NavItem[]) : []),
      ],
    },
  ];
  const groups = allGroups.filter((g) => g.items.length > 0);

  return (
    <div className="app-shell">
      <div className="env" aria-hidden="true">
        <div className="env-glow" />
      </div>

      <AppBar name={staff.name} role={staff.role} tag="Admin" />

      <div className="app-body">
        <SideNav groups={groups} />
        <main id="main" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}
