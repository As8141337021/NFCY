'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/client';
import { TextField, Submit, FormError } from '@/components/forms';

const RULES = [
  { test: (v: string) => v.length >= 8, label: '8 characters or more' },
  { test: (v: string) => /[a-z]/.test(v) && /[A-Z]/.test(v), label: 'an uppercase and a lowercase letter' },
  { test: (v: string) => /[0-9]/.test(v), label: 'a number' },
];

export default function SignupForm() {
  const params = useSearchParams();
  const next = params.get('next');

  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [touchedPw, setTouchedPw] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setFields({});

    const res = await api('/api/auth/signup', {
      json: {
        name: form.name,
        email: form.email,
        phone: form.phone || undefined,
        password: form.password,
      },
    });

    if (!res.ok) {
      setError(res.error.message);
      setFields(res.error.fields ?? {});
      setBusy(false);
      return;
    }
    window.location.href = next && next.startsWith('/') ? next : '/dashboard';
  }

  return (
    <form className="form" onSubmit={onSubmit} noValidate>
      <FormError>{error}</FormError>

      <TextField
        label="Your name"
        name="name"
        autoComplete="name"
        placeholder="Rahul Sharma"
        value={form.name}
        onChange={set('name')}
        error={fields.name}
        required
      />

      <TextField
        label="Email"
        type="email"
        name="email"
        autoComplete="email"
        placeholder="you@example.com"
        value={form.email}
        onChange={set('email')}
        error={fields.email}
        required
      />

      <TextField
        label="Mobile number"
        type="tel"
        name="phone"
        inputMode="numeric"
        autoComplete="tel"
        prefix="+91"
        placeholder="98765 43210"
        value={form.phone}
        onChange={set('phone')}
        error={fields.phone}
        hint="Optional. We use it for delivery updates only."
      />

      <div>
        <TextField
          label="Password"
          type="password"
          name="password"
          autoComplete="new-password"
          placeholder="Pick something you will remember"
          value={form.password}
          onChange={set('password')}
          onBlur={() => setTouchedPw(true)}
          error={fields.password}
          required
        />
        {(touchedPw || form.password) && (
          <ul className="todo" style={{ marginTop: 10 }}>
            {RULES.map((r) => {
              const passed = r.test(form.password);
              return (
                <li key={r.label} className={passed ? 'done' : ''}>
                  <span className="box" aria-hidden="true" />
                  {r.label}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Submit busy={busy}>{busy ? 'Creating your account' : 'Create my account'}</Submit>

      <p className="muted tiny" style={{ textAlign: 'center' }}>
        By creating an account you agree to our terms and privacy policy.
      </p>
    </form>
  );
}
