'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/client';
import { TextField, Submit, FormError } from '@/components/forms';

export default function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setFields({});

    const res = await api<{ redirect: string }>('/api/auth/login', { json: { email, password } });

    if (!res.ok) {
      setError(res.error.message);
      setFields(res.error.fields ?? {});
      setBusy(false);
      return;
    }
    // a full navigation, so every server component re-reads the new session
    window.location.href = next && next.startsWith('/') ? next : res.data.redirect;
  }

  return (
    <form className="form" onSubmit={onSubmit} noValidate>
      <FormError>{error}</FormError>

      <TextField
        label="Email"
        type="email"
        name="email"
        autoComplete="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={fields.email}
        required
      />

      <TextField
        label="Password"
        type="password"
        name="password"
        autoComplete="current-password"
        placeholder="Your password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={fields.password}
        required
      />

      <div className="row">
        <Link href="/forgot" className="small" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
          Forgot your password?
        </Link>
      </div>

      <Submit busy={busy}>{busy ? 'Signing in' : 'Sign in'}</Submit>
    </form>
  );
}
