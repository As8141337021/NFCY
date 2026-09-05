import Link from 'next/link';
import type { Metadata } from 'next';
import { BrandMark } from '@/components/AuthShell';

export const metadata: Metadata = { title: 'Card tapped', robots: { index: false, follow: false } };

const STATES: Record<string, { title: string; body: string; cta: 'activate' | 'home' }> = {
  inactive: {
    title: 'This card is not active yet',
    body: 'The card works. It just has not been pointed at a profile. If it is yours, sign in and activate it with the code that came with it.',
    cta: 'activate',
  },
  nodestination: {
    title: 'This card has no destination yet',
    body: 'The owner has not set where this card should send people. If it is yours, sign in and set the link.',
    cta: 'activate',
  },
  disabled: {
    title: 'This card has been switched off',
    body: 'The owner turned this card off, which usually means it was lost or replaced. Nothing is wrong with your phone.',
    cta: 'home',
  },
  unknown: {
    title: 'We do not recognise that card',
    body: 'That link does not match any NFCY card. Check that the whole address came through, or try tapping again.',
    cta: 'home',
  },
};

export default async function TapPage({ searchParams }: { searchParams: Promise<{ state?: string; serial?: string }> }) {
  const { state, serial } = await searchParams;
  const s = STATES[state ?? ''] ?? STATES.unknown;

  return (
    <>
      <div className="env" aria-hidden="true">
        <div className="env-glow" />
        <div className="env-grain" />
      </div>
      <main className="center-page" id="main">
        <div style={{ width: '100%', maxWidth: 440 }}>
          <Link href="/" className="brand" style={{ marginBottom: 28, display: 'inline-flex' }}>
            <BrandMark />
            <span className="brand-word">NFCY</span>
          </Link>

          <div className="card">
            <h1 style={{ fontSize: '1.4rem' }}>{s.title}</h1>
            <p className="muted" style={{ marginTop: 12 }}>{s.body}</p>

            {serial ? (
              <p className="mono-label" style={{ marginTop: 18 }}>
                Card {serial}
              </p>
            ) : null}

            <div className="stack-sm" style={{ marginTop: 24 }}>
              {s.cta === 'activate' ? (
                <Link href="/dashboard/cards" className="btn btn-accent full">
                  Sign in and activate this card
                </Link>
              ) : null}
              <Link href="/" className="btn btn-ghost full">
                What is NFCY?
              </Link>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
