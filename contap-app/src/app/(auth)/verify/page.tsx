import Link from 'next/link';
import type { Metadata } from 'next';
import AuthShell from '@/components/AuthShell';

export const metadata: Metadata = { title: 'Confirm your email' };

const STATES: Record<string, { title: string; body: string; good: boolean }> = {
  done: {
    title: 'Email confirmed',
    body: 'Thanks. Your email address is confirmed and your account is fully set up.',
    good: true,
  },
  already: {
    title: 'Already confirmed',
    body: 'That link was used before. Your email is confirmed and nothing else is needed.',
    good: true,
  },
  expired: {
    title: 'That link has expired',
    body: 'Confirmation links last 24 hours. Sign in and we will send you a fresh one.',
    good: false,
  },
  missing: {
    title: 'That link is incomplete',
    body: 'The confirmation link was missing its token. Open the link from your email again.',
    good: false,
  },
};

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string; token?: string }>;
}) {
  const { state, token } = await searchParams;

  // arriving with a raw token means the email client stripped the redirect: send it on
  if (token && !state) {
    return (
      <AuthShell title="Confirming your email" lede="One moment.">
        <meta httpEquiv="refresh" content={`0;url=/api/auth/verify?token=${encodeURIComponent(token)}`} />
        <a className="btn btn-accent full" href={`/api/auth/verify?token=${encodeURIComponent(token)}`}>
          Continue
        </a>
      </AuthShell>
    );
  }

  const s = STATES[state ?? ''] ?? STATES.missing;

  return (
    <AuthShell title={s.title}>
      <div className="stack">
        <p className={s.good ? 'form-good' : 'form-error'}>{s.body}</p>
        <Link href="/dashboard" className="btn btn-accent full">
          Go to my dashboard
        </Link>
      </div>
    </AuthShell>
  );
}
