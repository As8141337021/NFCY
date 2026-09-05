import { Suspense } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import AuthShell from '@/components/AuthShell';
import { currentUser, isStaff } from '@/lib/auth';
import LoginForm from './LoginForm';

export const metadata: Metadata = { title: 'Sign in' };
export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const user = await currentUser();
  if (user) redirect(isStaff(user.role) ? '/admin' : '/dashboard');

  return (
    <AuthShell
      title="Sign in"
      lede="Your profile, your card and your orders live in one place."
      footer={
        <>
          New here? <Link href="/signup" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Create an account</Link>
        </>
      }
    >
      <Suspense fallback={<div className="skeleton" style={{ height: 260 }} />}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
