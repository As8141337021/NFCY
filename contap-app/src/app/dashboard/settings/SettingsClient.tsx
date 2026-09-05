'use client';

import { useState } from 'react';
import { api } from '@/lib/client';
import { useToast } from '@/components/Toast';
import { TextField, Submit, FormError, FormGood } from '@/components/forms';

export default function SettingsClient({ email, hasLiveCards }: { email: string; hasLiveCards: number }) {
  const { toast } = useToast();

  const [pw, setPw] = useState({ currentPassword: '', password: '', confirm: '' });
  const [pwBusy, setPwBusy] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwDone, setPwDone] = useState(false);
  const [pwFields, setPwFields] = useState<Record<string, string>>({});

  const [del, setDel] = useState({ password: '', confirm: '' });
  const [delOpen, setDelOpen] = useState(false);
  const [delBusy, setDelBusy] = useState(false);
  const [delError, setDelError] = useState('');

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (pw.password !== pw.confirm) {
      setPwFields({ confirm: 'Those two do not match.' });
      return;
    }
    setPwBusy(true);
    setPwError('');
    setPwFields({});
    setPwDone(false);

    const res = await api('/api/account/password', {
      json: { currentPassword: pw.currentPassword, password: pw.password },
    });
    setPwBusy(false);

    if (!res.ok) {
      setPwError(res.error.message);
      setPwFields(res.error.fields ?? {});
      return;
    }
    setPw({ currentPassword: '', password: '', confirm: '' });
    setPwDone(true);
    toast('Password changed');
  }

  async function deleteAccount(e: React.FormEvent) {
    e.preventDefault();
    setDelBusy(true);
    setDelError('');

    const res = await api('/api/account/delete', { json: del });
    setDelBusy(false);

    if (!res.ok) {
      setDelError(res.error.message);
      return;
    }
    window.location.href = '/';
  }

  return (
    <div className="stack">
      <div className="card">
        <div className="card-head">
          <h2>Account</h2>
        </div>
        <p className="muted small">
          Signed in as <strong style={{ color: 'var(--text-primary)' }}>{email}</strong>
        </p>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Change your password</h2>
        </div>
        <form className="form" onSubmit={changePassword} noValidate>
          <FormError>{pwError}</FormError>
          {pwDone ? <FormGood>Your password has been changed.</FormGood> : null}

          <TextField
            label="Current password"
            type="password"
            autoComplete="current-password"
            value={pw.currentPassword}
            onChange={(e) => setPw((p) => ({ ...p, currentPassword: e.target.value }))}
            error={pwFields.currentPassword}
            required
          />
          <div className="form-grid-2">
            <TextField
              label="New password"
              type="password"
              autoComplete="new-password"
              value={pw.password}
              onChange={(e) => setPw((p) => ({ ...p, password: e.target.value }))}
              error={pwFields.password}
              hint="At least 8 characters, with an uppercase letter and a number."
              required
            />
            <TextField
              label="Type it again"
              type="password"
              autoComplete="new-password"
              value={pw.confirm}
              onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))}
              error={pwFields.confirm}
              required
            />
          </div>
          <Submit busy={pwBusy} className="btn btn-accent">
            {pwBusy ? 'Saving' : 'Change my password'}
          </Submit>
        </form>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Privacy</h2>
        </div>
        <p className="muted small">
          We count views, taps, scans and button presses on your profile. We do not store the IP address of anyone who
          visits it, and a repeat visitor is recorded as a salted daily hash that stops meaning anything the next day.
        </p>
        <p className="muted small" style={{ marginTop: 12 }}>
          You can switch your profile out of search results any time under Visibility in the profile editor. That
          keeps the link working while telling search engines not to list it.
        </p>
      </div>

      <div className="card" style={{ borderColor: 'rgba(224,100,90,.35)' }}>
        <div className="card-head">
          <h2>Delete your account</h2>
        </div>

        {!delOpen ? (
          <>
            <p className="muted small">
              This removes your profiles, your links and your enquiries. Orders and invoices are kept, because they are
              financial records, but they are detached from you.
              {hasLiveCards > 0
                ? ` Your ${hasLiveCards} active card${hasLiveCards === 1 ? '' : 's'} will stop working.`
                : ''}
            </p>
            <p style={{ marginTop: 18 }}>
              <button type="button" className="btn btn-danger btn-sm" onClick={() => setDelOpen(true)}>
                I want to delete my account
              </button>
            </p>
          </>
        ) : (
          <form className="form" onSubmit={deleteAccount} noValidate>
            <FormError>{delError}</FormError>
            <p className="form-error">
              This cannot be undone. Your profile pages will stop loading immediately.
            </p>
            <TextField
              label="Your password"
              type="password"
              autoComplete="current-password"
              value={del.password}
              onChange={(e) => setDel((d) => ({ ...d, password: e.target.value }))}
              required
            />
            <TextField
              label="Type DELETE to confirm"
              value={del.confirm}
              onChange={(e) => setDel((d) => ({ ...d, confirm: e.target.value.toUpperCase() }))}
              placeholder="DELETE"
              required
            />
            <div className="row">
              <button type="submit" className="btn btn-danger" disabled={delBusy}>
                {delBusy ? <span className="spinner" aria-hidden="true" /> : null}
                {delBusy ? 'Deleting' : 'Delete my account for good'}
              </button>
              <button type="button" className="btn btn-quiet" onClick={() => setDelOpen(false)} disabled={delBusy}>
                Keep my account
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
