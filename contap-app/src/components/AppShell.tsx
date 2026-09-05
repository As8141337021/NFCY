'use client';

import BrandWord from '@/components/BrandWord';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { api } from '@/lib/client';
import { BrandMark } from '@/components/AuthShell';
import { NAV_ICONS, type NavIconName } from '@/components/icons';

/**
 * `icon` is a NAME, not a component. Server components build these lists, and
 * a function cannot cross the server to client boundary.
 */
export type NavItem = {
  href: string;
  label: string;
  icon: NavIconName;
  count?: number;
  exact?: boolean;
};

export type NavGroup = { heading?: string; items: NavItem[] };

export function AppBar({
  name,
  role,
  tag,
  right,
}: {
  name: string;
  role: string;
  tag?: string;
  right?: React.ReactNode;
}) {
  const router = useRouter();
  const initials = name.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

  async function signOut() {
    await api('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <header className="appbar">
      <div className="appbar-in">
        <Link href="/" className="brand">
          <BrandMark size={24} />
          <BrandWord />
        </Link>
        {tag ? <span className="appbar-tag">{tag}</span> : null}

        <div className="appbar-user">
          {right}
          <span className="avatar" title={`${name} (${role.toLowerCase().replace('_', ' ')})`}>
            {initials || '?'}
          </span>
          <button type="button" className="btn btn-quiet btn-sm" onClick={signOut}>
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}

export function SideNav({ groups }: { groups: NavGroup[] }) {
  const pathname = usePathname();

  const isOn = (item: NavItem) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + '/');

  return (
    <nav className="side" aria-label="Sections">
      {groups.map((g, i) => (
        <div key={g.heading ?? i} style={{ display: 'contents' }}>
          {g.heading ? <p className="mono-label side-head">{g.heading}</p> : null}
          {g.items.map((item) => {
            const Icon = NAV_ICONS[item.icon];
            return (
              <Link key={item.href} href={item.href} className={isOn(item) ? 'on' : ''}>
                <Icon />
                <span>{item.label}</span>
                {item.count ? <span className="side-count">{item.count}</span> : null}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
