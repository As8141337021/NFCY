import { Suspense } from 'react';
import type { Metadata } from 'next';
import AuthShell from '@/components/AuthShell';
import ResetForm from './ResetForm';

export const metadata: Metadata = { title: 'Set a new password' };

export default function ResetPage() {
  return (
    <AuthShell title="Set a new password" lede="Pick something you will remember. Every other device gets signed out.">
      <Suspense fallback={<div className="skeleton" style={{ height: 240 }} />}>
        <ResetForm />
      </Suspense>
    </AuthShell>
  );
}
