'use client';

import BrandWord from '@/components/BrandWord';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { BrandMark } from '@/components/AuthShell';
import { useCart } from '@/lib/cart';

export default function SiteNav({ signedIn, staff = false }: { signedIn: boolean; staff?: boolean }) {
  const { count, ready } = useCart();
  const [solid, setSolid] = useState(false);

  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className={`nav${solid ? ' solid' : ''}`}>
      <div className="nav-in">
        <Link className="brand" href="/">
          <BrandMark size={26} />
          <BrandWord />
        </Link>

        <nav className="nav-links" aria-label="Main">
          <Link href="/cards">Cards</Link>
          <Link href="/#how">How it works</Link>
          <Link href="/#profile">The profile</Link>
          <Link href="/#faq">FAQ</Link>
        </nav>

        <div className="row" style={{ gap: 10, marginLeft: 'auto' }}>
          {ready && count > 0 ? (
            <Link href="/checkout" className="btn btn-ghost btn-sm nowrap">
              Cart · {count}
            </Link>
          ) : null}
          {/* staff land in the admin panel; sending them to the customer
              dashboard puts them in a buying journey they are not on */}
          <Link href={signedIn ? (staff ? '/admin' : '/dashboard') : '/login'} className="btn btn-quiet btn-sm nowrap">
            {signedIn ? (staff ? 'Admin' : 'Dashboard') : 'Sign in'}
          </Link>
          <Link href="/cards" className="btn btn-accent nav-cta nowrap">
            Get your card
          </Link>
        </div>
      </div>
    </header>
  );
}
