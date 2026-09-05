import { Suspense } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import AuthShell from '@/components/AuthShell';
import { currentUser, isStaff } from '@/lib/auth';
import SignupForm from './SignupForm';

export const metadata: Metadata = { title: 'Create your account' };
export const dynamic = 'force-dynamic';

export default async function SignupPage() {
  const user = await currentUser();
  if (user) redirect(isStaff(user.role) ? '/admin' : '/dashboard');

  return (
    <AuthShell
      title="Create your account"
      lede="Takes a minute. Your profile comes next, and you can change every word of it later."
      footer={
        <>
          Already have an account? <Link href="/login" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Sign in</Link>
        </>
      }
    >
      <Suspense fallback={<div className="skeleton" style={{ height: 420 }} />}>
        <SignupForm />
      </Suspense>
    </AuthShell>
  );
}
