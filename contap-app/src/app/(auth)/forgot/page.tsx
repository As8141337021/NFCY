import type { Metadata } from 'next';
import Link from 'next/link';
import AuthShell from '@/components/AuthShell';
import ForgotForm from './ForgotForm';

export const metadata: Metadata = { title: 'Reset your password' };

export default function ForgotPage() {
  return (
    <AuthShell
      title="Reset your password"
      lede="Give us the email on your account and we will send a link to set a new password."
      footer={<Link href="/login" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Back to sign in</Link>}
    >
      <ForgotForm />
    </AuthShell>
  );
}
