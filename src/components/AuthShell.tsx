import Link from 'next/link';
import BrandWord from '@/components/BrandWord';

export function BrandMark({ size = 30 }: { size?: number }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true" style={{ color: 'var(--accent)' }}>
      <g fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
        <path d="M13 10a8 8 0 0 1 0 12" />
        <path d="M18 7a13 13 0 0 1 0 18" />
      </g>
      <circle cx="9.5" cy="16" r="2.2" fill="currentColor" />
    </svg>
  );
}

export default function AuthShell({
  title,
  lede,
  children,
  footer,
}: {
  title: string;
  lede?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
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
            <BrandWord />
          </Link>

          <div className="card">
            <h1 style={{ fontSize: '1.55rem', letterSpacing: '-.03em' }}>{title}</h1>
            {lede ? (
              <p className="muted" style={{ marginTop: 10, marginBottom: 24, fontSize: '.95rem' }}>
                {lede}
              </p>
            ) : (
              <div style={{ height: 20 }} />
            )}
            {children}
          </div>

          {footer ? (
            <p className="muted small" style={{ marginTop: 20, textAlign: 'center' }}>
              {footer}
            </p>
          ) : null}
        </div>
      </main>
    </>
  );
}
