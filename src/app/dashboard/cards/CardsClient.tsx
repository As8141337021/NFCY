'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/client';
import { useToast } from '@/components/Toast';
import { TextField, SelectField, Submit, FormError } from '@/components/forms';
import CopyLink from '@/components/CopyLink';
import { CardArt, CardArtDefs } from '@/components/CardArt';
import { IconExternal } from '@/components/icons';

export type CardRow = {
  id: string;
  serial: string;
  code: string;
  status: string;
  productName: string | null;
  productSlug: string | null;
  destinationType: string;
  destinationUrl: string | null;
  profileId: string | null;
  profileUsername: string | null;
  tapCount: number;
  activatedAt: string | null;
  lastTapAt: string | null;
};

export type ProfileOption = { id: string; username: string; fullName: string };

const STATUS_PILL: Record<string, { cls: string; label: string }> = {
  ACTIVE: { cls: 'live', label: 'Active' },
  ASSIGNED: { cls: 'warn', label: 'Needs activating' },
  UNASSIGNED: { cls: '', label: 'Not assigned' },
  SUSPENDED: { cls: 'bad', label: 'Suspended' },
  LOST: { cls: 'bad', label: 'Switched off' },
  REPLACED: { cls: 'bad', label: 'Replaced' },
};

const DESTINATIONS = [
  { id: 'PROFILE', label: 'My NFCY profile' },
  { id: 'GOOGLE_REVIEW', label: 'My Google review page' },
  { id: 'INSTAGRAM', label: 'My Instagram' },
  { id: 'CUSTOM_URL', label: 'Any other link' },
];

export default function CardsClient({
  cards,
  profiles,
  appUrl,
}: {
  cards: CardRow[];
  profiles: ProfileOption[];
  appUrl: string;
}) {
  const router = useRouter();
  const { toast } = useToast();

  const [serial, setSerial] = useState('');
  const [profileId, setProfileId] = useState(profiles[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<{ serial: string; profileUrl: string } | null>(null);

  const [editing, setEditing] = useState<string | null>(null);
  const [dest, setDest] = useState({ destinationType: 'PROFILE', destinationUrl: '', profileId: '' });
  const [destBusy, setDestBusy] = useState(false);
  const [destError, setDestError] = useState('');

  async function activate(e: React.FormEvent) {
    e.preventDefault();
    if (!profileId) {
      setError('Create a profile first, so the card has something to open.');
      return;
    }
    setBusy(true);
    setError('');

    const res = await api<{ serial: string; profileUrl: string }>('/api/nfc/activate', {
      // no activation code: the card was made for this account when the order
      // was paid for, so being signed in is the proof
      json: { serial: serial.trim().toUpperCase(), profileId },
    });
    setBusy(false);

    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    setDone(res.data);
    setSerial('');
    toast('Your card is active');
    router.refresh();
  }

  async function saveDestination(cardId: string) {
    setDestBusy(true);
    setDestError('');

    const res = await api(`/api/cards/${cardId}`, {
      method: 'PATCH',
      json: {
        destinationType: dest.destinationType,
        destinationUrl: dest.destinationType === 'PROFILE' ? '' : dest.destinationUrl,
        profileId: dest.destinationType === 'PROFILE' ? dest.profileId : null,
      },
    });
    setDestBusy(false);

    if (!res.ok) {
      setDestError(res.error.message);
      return;
    }
    setEditing(null);
    toast('Where this card points has been changed');
    router.refresh();
  }

  async function reportLost(cardId: string, serialNo: string) {
    if (!window.confirm(`Switch off card ${serialNo}? Anyone tapping it will get a page saying it is switched off. This cannot be undone from here.`)) {
      return;
    }
    const res = await api(`/api/cards/${cardId}`, { method: 'DELETE' });
    if (!res.ok) {
      toast(res.error.message, 'err');
      return;
    }
    toast('Card switched off');
    router.refresh();
  }

  return (
    <>
      <CardArtDefs />

      {cards.length > 0 && (
        <div className="stack" style={{ marginBottom: 28 }}>
          {cards.map((c) => {
            const pill = STATUS_PILL[c.status] ?? { cls: '', label: c.status };
            const tapUrl = `${appUrl}/t/${c.code}`;
            const isEditing = editing === c.id;

            return (
              <div className="card" key={c.id}>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,150px) minmax(0,1fr)', gap: 22, alignItems: 'start' }}>
                  <div style={{ perspective: 700 }}>
                    <CardArt slug={c.productSlug ?? 'classic-nfc-card'} className="card-svg" />
                  </div>

                  <div>
                    <div className="card-head" style={{ marginBottom: 12 }}>
                      <div>
                        <h2 style={{ fontSize: '1.1rem' }}>{c.productName ?? 'NFCY card'}</h2>
                        <p className="mono-label" style={{ marginTop: 6 }}>{c.serial}</p>
                      </div>
                      <span className={`pill ${pill.cls}`}>{pill.label}</span>
                    </div>

                    {c.status === 'ACTIVE' ? (
                      <>
                        <div className="stats" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', marginBottom: 16 }}>
                          <div className="stat">
                            <p className="stat-k">Taps</p>
                            <p className="stat-v num">{c.tapCount}</p>
                          </div>
                          <div className="stat">
                            <p className="stat-k">Last tapped</p>
                            <p className="stat-v num" style={{ fontSize: '1rem', paddingTop: 8 }}>
                              {c.lastTapAt ? new Date(c.lastTapAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'Not yet'}
                            </p>
                          </div>
                        </div>

                        <p className="mono-label">What the chip stores</p>
                        <div className="row" style={{ marginTop: 8, marginBottom: 16 }}>
                          <CopyLink url={tapUrl} />
                        </div>

                        <p className="mono-label">Where it sends people</p>
                        {isEditing ? (
                          <div className="form" style={{ marginTop: 10 }}>
                            {destError ? <p className="form-error">{destError}</p> : null}
                            <SelectField
                              label="Destination"
                              value={dest.destinationType}
                              onChange={(e) => setDest((d) => ({ ...d, destinationType: e.target.value }))}
                            >
                              {DESTINATIONS.map((d) => (
                                <option key={d.id} value={d.id}>{d.label}</option>
                              ))}
                            </SelectField>

                            {dest.destinationType === 'PROFILE' ? (
                              <SelectField
                                label="Which profile"
                                value={dest.profileId}
                                onChange={(e) => setDest((d) => ({ ...d, profileId: e.target.value }))}
                              >
                                {profiles.map((p) => (
                                  <option key={p.id} value={p.id}>{p.fullName} ({p.username})</option>
                                ))}
                              </SelectField>
                            ) : (
                              <TextField
                                label="Link"
                                value={dest.destinationUrl}
                                onChange={(e) => setDest((d) => ({ ...d, destinationUrl: e.target.value }))}
                                placeholder={dest.destinationType === 'INSTAGRAM' ? 'instagram.com/yourhandle' : 'https://'}
                              />
                            )}

                            <div className="row">
                              <button type="button" className="btn btn-accent btn-sm" onClick={() => void saveDestination(c.id)} disabled={destBusy}>
                                {destBusy ? <span className="spinner" aria-hidden="true" /> : null}
                                Save
                              </button>
                              <button type="button" className="btn btn-quiet btn-sm" onClick={() => setEditing(null)}>
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="row" style={{ marginTop: 8 }}>
                            <span className="small">
                              {c.destinationType === 'PROFILE'
                                ? c.profileUsername
                                  ? `${appUrl.replace(/^https?:\/\//, '')}/${c.profileUsername}`
                                  : 'No profile set'
                                : c.destinationUrl || 'No link set'}
                            </span>
                            {c.destinationType === 'PROFILE' && c.profileUsername ? (
                              <a href={`/${c.profileUsername}`} target="_blank" rel="noopener" className="btn btn-quiet btn-sm">
                                <IconExternal /> Open
                              </a>
                            ) : null}
                            <button
                              type="button"
                              className="btn btn-quiet btn-sm"
                              onClick={() => {
                                setDestError('');
                                setDest({
                                  destinationType: c.destinationType,
                                  destinationUrl: c.destinationUrl ?? '',
                                  profileId: c.profileId ?? profiles[0]?.id ?? '',
                                });
                                setEditing(c.id);
                              }}
                            >
                              Change
                            </button>
                          </div>
                        )}

                        <div className="divider" />
                        <button type="button" className="btn btn-danger btn-sm" onClick={() => void reportLost(c.id, c.serial)}>
                          I lost this card
                        </button>
                      </>
                    ) : c.status === 'ASSIGNED' || c.status === 'UNASSIGNED' ? (
                      <p className="muted small">
                        This card is yours but not switched on yet. Use the form below with the code that came with
                        it, and it starts working straight away.
                      </p>
                    ) : (
                      <p className="muted small">
                        This card no longer resolves. If that is wrong, message us and we will sort it out.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="card">
        <div className="card-head">
          <h2>Activate a card</h2>
        </div>

        {done ? (
          <div className="stack">
            <p className="form-good">
              Card {done.serial} is active. Tapping it opens your profile.
            </p>
            <div className="row">
              <a href={done.profileUrl} target="_blank" rel="noopener" className="btn btn-accent">
                See what people will see
              </a>
              <button type="button" className="btn btn-quiet" onClick={() => setDone(null)}>
                Activate another card
              </button>
            </div>
          </div>
        ) : (
          <form className="form" onSubmit={activate} noValidate>
            <FormError>{error}</FormError>

            <p className="muted small">
              The card number is printed on the back of your card. There is no code to type: the card was made for
              your account when you paid for it, so being signed in here is enough.
            </p>

            <TextField
              label="Card number"
              value={serial}
              onChange={(e) => setSerial(e.target.value.toUpperCase())}
              placeholder="CT-XXXX-XXXX"
              autoCapitalize="characters"
              spellCheck={false}
              required
            />

            {profiles.length > 1 ? (
              <SelectField label="Which profile should it open" value={profileId} onChange={(e) => setProfileId(e.target.value)}>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>{p.fullName} ({p.username})</option>
                ))}
              </SelectField>
            ) : profiles.length === 0 ? (
              <p className="form-error">
                Create a profile first, so the card has something to open.{' '}
                <Link href="/dashboard/profile/new" style={{ color: 'inherit', textDecoration: 'underline' }}>
                  Create my profile
                </Link>
              </p>
            ) : null}

            <Submit busy={busy} disabled={busy || profiles.length === 0}>
              {busy ? 'Activating' : 'Activate my card'}
            </Submit>
          </form>
        )}
      </div>
    </>
  );
}
