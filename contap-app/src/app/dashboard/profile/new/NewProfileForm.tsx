'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/client';
import { TextField, Submit, FormError } from '@/components/forms';
import { IconCheck } from '@/components/icons';

type Availability =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'free'; username: string }
  | { state: 'taken'; reason: string; suggestions: string[] }
  | { state: 'invalid'; reason: string };

export default function NewProfileForm({ suggested, defaultName, appUrl }: { suggested: string; defaultName: string; appUrl: string }) {
  const [username, setUsername] = useState(suggested);
  const [fullName, setFullName] = useState(defaultName);
  const [designation, setDesignation] = useState('');
  const [company, setCompany] = useState('');

  const [avail, setAvail] = useState<Availability>({ state: 'idle' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const value = username.trim().toLowerCase();

    if (value.length < 3) {
      setAvail(value.length === 0 ? { state: 'idle' } : { state: 'invalid', reason: 'At least 3 characters.' });
      return;
    }

    setAvail({ state: 'checking' });
    const mine = ++seq.current;

    timer.current = setTimeout(async () => {
      const res = await api<{ available: boolean; username: string; reason: string | null; suggestions: string[] }>(
        `/api/profile/username?u=${encodeURIComponent(value)}`,
      );
      if (mine !== seq.current) return; // a newer keystroke already won

      if (!res.ok) {
        setAvail({ state: 'invalid', reason: res.error.message });
        return;
      }
      if (res.data.available) setAvail({ state: 'free', username: res.data.username });
      else if (res.data.suggestions.length || res.data.reason?.includes('taken'))
        setAvail({ state: 'taken', reason: res.data.reason ?? 'That one is taken.', suggestions: res.data.suggestions });
      else setAvail({ state: 'invalid', reason: res.data.reason ?? 'That username cannot be used.' });
    }, 350);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [username]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setFields({});

    const res = await api<{ id: string }>('/api/profile', {
      json: { username: username.trim().toLowerCase(), fullName, designation, company },
    });

    if (!res.ok) {
      setError(res.error.message);
      setFields(res.error.fields ?? {});
      setBusy(false);
      return;
    }
    window.location.href = '/dashboard/profile';
  }

  const canSubmit = avail.state === 'free' && fullName.trim().length >= 2;

  return (
    <form className="form" onSubmit={onSubmit} noValidate>
      <FormError>{error}</FormError>

      <div className={`field${avail.state === 'taken' || avail.state === 'invalid' ? ' bad' : ''}`}>
        <label htmlFor="username">Your NFCY link</label>
        <div className="prefix-wrap">
          <span className="prefix">{appUrl.replace(/^https?:\/\//, '')}/</span>
          <input
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
            placeholder="rahulsharma"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={30}
            required
          />
        </div>

        {avail.state === 'checking' && <p className="hint">Checking</p>}
        {avail.state === 'free' && (
          <p className="okmsg">
            <span style={{ display: 'inline-flex', width: 13, height: 13, verticalAlign: '-2px' }}>
              <IconCheck />
            </span>{' '}
            {avail.username} is available
          </p>
        )}
        {avail.state === 'invalid' && <p className="err">{avail.reason}</p>}
        {avail.state === 'taken' && (
          <>
            <p className="err">{avail.reason}</p>
            {avail.suggestions.length > 0 && (
              <div className="row" style={{ gap: 8, marginTop: 4 }}>
                {avail.suggestions.map((s) => (
                  <button key={s} type="button" className="btn btn-quiet btn-sm" onClick={() => setUsername(s)}>
                    {s}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
        {avail.state === 'idle' && (
          <p className="hint">This is the address people land on. Pick it carefully, it is hard to change later.</p>
        )}
      </div>

      <TextField
        label="Name on the profile"
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        placeholder="Rahul Sharma"
        error={fields.fullName}
        required
      />

      <div className="form-grid-2">
        <TextField
          label="Designation"
          value={designation}
          onChange={(e) => setDesignation(e.target.value)}
          placeholder="Interior Designer"
          error={fields.designation}
        />
        <TextField
          label="Company"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          placeholder="Sharma Interiors"
          error={fields.company}
        />
      </div>

      <Submit busy={busy} disabled={!canSubmit || busy}>
        {busy ? 'Creating' : 'Create my profile'}
      </Submit>
      <p className="muted tiny" style={{ textAlign: 'center' }}>
        Everything here can be changed afterwards, except the link.
      </p>
    </form>
  );
}
