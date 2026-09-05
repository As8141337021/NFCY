'use client';

import { useState } from 'react';
import { api } from '@/lib/client';
import { TextField, Submit, FormError, FormGood } from '@/components/forms';

export default function ForgotForm() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setFields({});

    const res = await api('/api/auth/forgot', { json: { email } });
    setBusy(false);

    if (!res.ok) {
      setError(res.error.message);
      setFields(res.error.fields ?? {});
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="stack">
        <FormGood>If that email has an account, a reset link is on its way.</FormGood>
        <p className="muted small">
          The link works for one hour. Check your spam folder if it has not arrived in a few minutes.
        </p>
      </div>
    );
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
      <Submit busy={busy}>{busy ? 'Sending' : 'Send the reset link'}</Submit>
    </form>
  );
}
