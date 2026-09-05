'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/client';
import { TextField, Submit, FormError } from '@/components/forms';

export default function ResetForm() {
  const token = useSearchParams().get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});

  if (!token) {
    return (
      <div className="stack">
        <FormError>That link is missing its token. Ask for a new reset link.</FormError>
        <Link href="/forgot" className="btn btn-accent full">
          Send me a new link
        </Link>
      </div>
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setFields({ confirm: 'Those two do not match.' });
      return;
    }
    setBusy(true);
    setError('');
    setFields({});

    const res = await api('/api/auth/reset', { json: { token, password } });
    if (!res.ok) {
      setError(res.error.message);
      setFields(res.error.fields ?? {});
      setBusy(false);
      return;
    }
    window.location.href = '/dashboard';
  }

  return (
    <form className="form" onSubmit={onSubmit} noValidate>
      <FormError>{error}</FormError>
      <TextField
        label="New password"
        type="password"
        autoComplete="new-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={fields.password}
        hint="At least 8 characters, with an uppercase letter and a number."
        required
      />
      <TextField
        label="Type it again"
        type="password"
        autoComplete="new-password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        error={fields.confirm}
        required
      />
      <Submit busy={busy}>{busy ? 'Saving' : 'Set my new password'}</Submit>
    </form>
  );
}
