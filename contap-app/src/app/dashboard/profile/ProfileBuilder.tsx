'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/client';
import { useToast } from '@/components/Toast';
import { TextField, TextArea, SelectField, Check } from '@/components/forms';
import ImagePicker from '@/components/ImagePicker';
import ProfileRender from '@/components/ProfileRender';
import CopyLink from '@/components/CopyLink';
import ItemList from './ItemList';
import BusinessList from './BusinessList';
import AffiliationList from './AffiliationList';
import DocumentList from './DocumentList';
import QrPanel from './QrPanel';
import { IconExternal } from '@/components/icons';
import type { ProfileView } from '@/lib/profile';

type Completion = { percent: number; steps: Array<{ key: string; label: string; done: boolean; href: string }> };

const TABS = [
  { id: 'basics', label: 'Basics' },
  { id: 'contact', label: 'Contact' },
  { id: 'business', label: 'Business' },
  { id: 'networking', label: 'Networking' },
  { id: 'socials', label: 'Links' },
  { id: 'products', label: 'Products' },
  { id: 'services', label: 'Services' },
  { id: 'gallery', label: 'Gallery' },
  { id: 'documents', label: 'Files' },
  { id: 'design', label: 'Design' },
  { id: 'qr', label: 'QR code' },
  { id: 'settings', label: 'Visibility' },
] as const;

type TabId = (typeof TABS)[number]['id'];

const TEMPLATES = [
  { id: 'corporate', name: 'Corporate' },
  { id: 'luxury', name: 'Luxury' },
  { id: 'minimal', name: 'Minimal' },
  { id: 'entrepreneur', name: 'Entrepreneur' },
  { id: 'creative', name: 'Creative' },
  { id: 'freelancer', name: 'Freelancer' },
  { id: 'restaurant', name: 'Restaurant' },
  { id: 'salon', name: 'Salon' },
  { id: 'realestate', name: 'Real estate' },
  { id: 'jewellery', name: 'Jewellery' },
  { id: 'consultant', name: 'Consultant' },
  { id: 'professional', name: 'Professional' },
];

const ACCENTS = ['#34E0F0', '#7C5CFF', '#4ADE80', '#F5A524', '#FF6B6B', '#D9B06A', '#FF7AC6', '#5B8DEF'];

type Details = {
  fullName: string; designation: string; company: string; bio: string;
  dateOfBirth: string; showBirthday: boolean;
  phone: string; email: string; whatsapp: string; whatsappNote: string;
  website: string; address: string; mapsUrl: string; upiId: string; paymentNote: string;
  template: string; accentColor: string; isPublic: boolean;
  leadFormEnabled: boolean; leadFormTitle: string;
  metaTitle: string; metaDescription: string;
};

const detailsFrom = (p: ProfileView): Details => ({
  fullName: p.fullName ?? '',
  designation: p.designation ?? '',
  company: p.company ?? '',
  bio: p.bio ?? '',
  dateOfBirth: p.dateOfBirth ?? '',
  showBirthday: p.showBirthday,
  phone: p.phone ?? '',
  email: p.email ?? '',
  whatsapp: p.whatsapp ?? '',
  whatsappNote: p.whatsappNote ?? '',
  website: p.website ?? '',
  address: p.address ?? '',
  mapsUrl: p.mapsUrl ?? '',
  upiId: p.upiId ?? '',
  paymentNote: p.paymentNote ?? '',
  template: p.template ?? 'corporate',
  accentColor: p.accentColor ?? '#34E0F0',
  isPublic: p.isPublic,
  leadFormEnabled: p.leadFormEnabled,
  leadFormTitle: p.leadFormTitle ?? 'Send me a message',
  metaTitle: p.metaTitle ?? '',
  metaDescription: p.metaDescription ?? '',
});

export default function ProfileBuilder({
  initial,
  initialCompletion,
  appUrl,
  card,
  initialTab,
}: {
  initial: ProfileView;
  initialCompletion: Completion;
  appUrl: string;
  card: { serial: string; code: string; status: string } | null;
  initialTab?: string;
}) {
  const { toast } = useToast();
  const [profile, setProfile] = useState(initial);
  const [comp, setComp] = useState(initialCompletion);
  const [tab, setTab] = useState<TabId>(
    (TABS.find((t) => t.id === initialTab)?.id ?? 'basics') as TabId,
  );

  const [details, setDetails] = useState<Details>(detailsFrom(initial));
  const [savingDetails, setSavingDetails] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState('');

  const savedDetails = useMemo(() => detailsFrom(profile), [profile]);
  const detailsDirty = useMemo(
    () => JSON.stringify(details) !== JSON.stringify(savedDetails),
    [details, savedDetails],
  );

  /** The preview reads the unsaved draft, so typing shows up straight away. */
  const preview: ProfileView = useMemo(
    () => ({
      ...profile,
      fullName: details.fullName || 'Your name',
      designation: details.designation || null,
      company: details.company || null,
      bio: details.bio || null,
      dateOfBirth: details.dateOfBirth || null,
      showBirthday: details.showBirthday,
      phone: details.phone || null,
      email: details.email || null,
      whatsapp: details.whatsapp || null,
      whatsappNote: details.whatsappNote || null,
      website: details.website || null,
      address: details.address || null,
      mapsUrl: details.mapsUrl || null,
      upiId: details.upiId || null,
      paymentNote: details.paymentNote || null,
      accentColor: details.accentColor,
      template: details.template,
      leadFormEnabled: details.leadFormEnabled,
      leadFormTitle: details.leadFormTitle,
    }),
    [profile, details],
  );

  // a real browser warning if they try to leave with unsaved text
  useEffect(() => {
    if (!detailsDirty) return;
    const onLeave = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onLeave);
    return () => window.removeEventListener('beforeunload', onLeave);
  }, [detailsDirty]);

  const applyResult = useCallback((p: ProfileView, c: Completion | { percent: number }) => {
    setProfile(p);
    setComp((prev) => ('steps' in c ? (c as Completion) : { ...prev, percent: c.percent }));
  }, []);

  async function saveDetails() {
    setSavingDetails(true);
    setError('');
    setFields({});

    const res = await api<{ profile: ProfileView; completion: Completion }>(`/api/profile/${profile.id}`, {
      method: 'PATCH',
      json: {
        ...details,
        designation: details.designation || null,
        company: details.company || null,
        bio: details.bio || null,
        dateOfBirth: details.dateOfBirth || '',
        phone: details.phone || '',
        email: details.email || '',
        whatsapp: details.whatsapp || '',
        website: details.website || '',
        mapsUrl: details.mapsUrl || '',
      },
    });
    setSavingDetails(false);

    if (!res.ok) {
      setError(res.error.message);
      setFields(res.error.fields ?? {});
      toast(res.error.message, 'err');
      return;
    }
    applyResult(res.data.profile, res.data.completion);
    setDetails(detailsFrom(res.data.profile));
    toast('Saved');
  }

  async function saveImage(key: 'photoId' | 'coverId', assetId: string | null) {
    const res = await api<{ profile: ProfileView; completion: Completion }>(`/api/profile/${profile.id}`, {
      method: 'PATCH',
      json: { [key]: assetId },
    });
    if (!res.ok) {
      toast(res.error.message, 'err');
      return;
    }
    applyResult(res.data.profile, res.data.completion);
    toast(assetId ? 'Image saved' : 'Image removed');
  }

  async function togglePublish() {
    const publish = profile.status !== 'PUBLISHED';
    setPublishing(true);
    const res = await api<{ status: string; url: string }>(`/api/profile/${profile.id}/publish`, {
      json: { publish },
    });
    setPublishing(false);

    if (!res.ok) {
      toast(res.error.message, 'err');
      return;
    }
    setProfile((p) => ({ ...p, status: res.data.status }));
    setComp((c) => ({
      ...c,
      steps: c.steps.map((s) => (s.key === 'publish' ? { ...s, done: publish } : s)),
      percent: Math.round(
        ((c.steps.filter((s) => (s.key === 'publish' ? publish : s.done)).length) / c.steps.length) * 100,
      ),
    }));
    toast(publish ? 'Your profile is live' : 'Your profile is a draft again');
  }

  const url = `${appUrl}/${profile.username}`;
  const setD = (k: keyof Details) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setDetails((d) => ({ ...d, [k]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value }));

  return (
    <>
      <div className="page-head">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1>My profile</h1>
            <p>This is what opens when someone taps your card. Everything here can be changed any time.</p>
          </div>
          <div className="row">
            <span className={`pill ${profile.status === 'PUBLISHED' ? 'live' : 'warn'}`}>
              {profile.status === 'PUBLISHED' ? 'Live' : profile.status.replace('_', ' ').toLowerCase()}
            </span>
            <button
              type="button"
              className={profile.status === 'PUBLISHED' ? 'btn btn-quiet btn-sm' : 'btn btn-accent btn-sm'}
              onClick={() => void togglePublish()}
              disabled={publishing}
            >
              {publishing ? <span className="spinner" aria-hidden="true" /> : null}
              {profile.status === 'PUBLISHED' ? 'Unpublish' : 'Publish'}
            </button>
          </div>
        </div>

        <div className="row" style={{ marginTop: 16 }}>
          <CopyLink url={url} />
          {profile.status === 'PUBLISHED' ? (
            <a href={`/${profile.username}`} target="_blank" rel="noopener" className="btn btn-quiet btn-sm">
              <IconExternal /> Open it
            </a>
          ) : null}
          <span className="muted small">{comp.percent}% complete</span>
          <div className="progress" style={{ flex: 1, minWidth: 140 }}>
            <i style={{ width: `${comp.percent}%` }} />
          </div>
        </div>
      </div>

      <div className="builder">
        <div>
          <div className="tabs" role="tablist">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                className={tab === t.id ? 'on' : ''}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          {error ? <p className="form-error" style={{ marginBottom: 16 }} role="alert">{error}</p> : null}

          {tab === 'basics' && (
            <div className="form">
              <ImagePicker
                label="Profile photo"
                hint="A clear photo of your face. Square works best."
                shape="round"
                url={profile.photoUrl}
                onPicked={(id) => saveImage('photoId', id)}
                onCleared={() => saveImage('photoId', null)}
              />
              <ImagePicker
                label="Cover image"
                hint="The banner behind your photo. Wide images look best."
                shape="wide"
                url={profile.coverUrl}
                onPicked={(id) => saveImage('coverId', id)}
                onCleared={() => saveImage('coverId', null)}
              />
              <TextField label="Full name" value={details.fullName} onChange={setD('fullName')} error={fields.fullName} required />
              <div className="form-grid-2">
                <TextField label="Designation" value={details.designation} onChange={setD('designation')} placeholder="Interior Designer" error={fields.designation} />
                <TextField label="Company" value={details.company} onChange={setD('company')} placeholder="Sharma Interiors" error={fields.company} />
              </div>
              <TextArea
                label="Short bio"
                value={details.bio}
                onChange={setD('bio')}
                placeholder="Two or three lines about what you do and who you do it for."
                hint={`${details.bio.length} of 1000 characters`}
                maxLength={1000}
                error={fields.bio}
              />

              <TextField
                label="Date of birth"
                type="date"
                value={details.dateOfBirth}
                onChange={setD('dateOfBirth')}
                max={new Date().toISOString().slice(0, 10)}
                min="1900-01-01"
                hint="Optional. Nobody sees this unless you switch it on below."
                error={fields.dateOfBirth}
              />

              <Check
                label={
                  <>
                    <b>Show my birthday</b>
                    <br />
                    <span className="muted small">
                      Puts the day and month on your profile, and the full date into the contact card people save.
                      Off by default.
                    </span>
                  </>
                }
                checked={details.showBirthday}
                onChange={(e) => setDetails((d) => ({ ...d, showBirthday: e.target.checked }))}
                disabled={!details.dateOfBirth}
              />
            </div>
          )}

          {tab === 'contact' && (
            <div className="form">
              <div className="form-grid-2">
                <TextField label="Phone" type="tel" prefix="+91" value={details.phone} onChange={setD('phone')} placeholder="98765 43210" inputMode="numeric" error={fields.phone} />
                <TextField label="WhatsApp" type="tel" prefix="+91" value={details.whatsapp} onChange={setD('whatsapp')} placeholder="98765 43210" inputMode="numeric" error={fields.whatsapp} />
              </div>
              <TextField
                label="WhatsApp opening message"
                value={details.whatsappNote}
                onChange={setD('whatsappNote')}
                placeholder="Hi, I found your profile through your NFCY card."
                hint="Already typed for them when they tap WhatsApp. Optional."
                error={fields.whatsappNote}
              />
              <div className="form-grid-2">
                <TextField label="Email" type="email" value={details.email} onChange={setD('email')} placeholder="you@example.com" error={fields.email} />
                <TextField label="Website" value={details.website} onChange={setD('website')} placeholder="yoursite.com" error={fields.website} />
              </div>
              <TextArea label="Address" value={details.address} onChange={setD('address')} placeholder="Shop 4, MG Road, Ahmedabad" error={fields.address} />
              <TextField
                label="Google Maps link"
                value={details.mapsUrl}
                onChange={setD('mapsUrl')}
                placeholder="https://maps.app.goo.gl/"
                hint="Open your place in Google Maps, tap Share, and paste the link here."
                error={fields.mapsUrl}
              />
              <div className="form-grid-2">
                <TextField label="UPI id" value={details.upiId} onChange={setD('upiId')} placeholder="yourname@okhdfcbank" hint="Adds a pay button." error={fields.upiId} />
                <TextField label="Note next to the pay button" value={details.paymentNote} onChange={setD('paymentNote')} placeholder="Advance 50%" error={fields.paymentNote} />
              </div>
            </div>
          )}

          {tab === 'business' && (
            <BusinessList profileId={profile.id} profile={profile} onChanged={applyResult} />
          )}

          {tab === 'networking' && (
            <AffiliationList profileId={profile.id} profile={profile} onChanged={applyResult} />
          )}

          {tab === 'socials' && <ItemList kind="social" profileId={profile.id} profile={profile} onChanged={applyResult} />}
          {tab === 'products' && <ItemList kind="product" profileId={profile.id} profile={profile} onChanged={applyResult} />}
          {tab === 'services' && <ItemList kind="service" profileId={profile.id} profile={profile} onChanged={applyResult} />}
          {tab === 'gallery' && <ItemList kind="gallery" profileId={profile.id} profile={profile} onChanged={applyResult} />}
          {tab === 'documents' && <DocumentList profileId={profile.id} profile={profile} onChanged={applyResult} />}

          {tab === 'qr' && (
            <QrPanel
              profileId={profile.id}
              username={profile.username}
              appUrl={appUrl}
              card={card}
              published={profile.status === 'PUBLISHED'}
            />
          )}

          {tab === 'design' && (
            <div className="form">
              <SelectField label="Template" value={details.template} onChange={setD('template')} hint="Changes the look. Your card never has to change.">
                {TEMPLATES.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </SelectField>

              <div className="field">
                <label>Accent colour</label>
                <div className="row" style={{ gap: 10 }}>
                  {ACCENTS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      aria-label={`Use ${c}`}
                      aria-pressed={details.accentColor.toLowerCase() === c.toLowerCase()}
                      onClick={() => setDetails((d) => ({ ...d, accentColor: c }))}
                      style={{
                        width: 34, height: 34, borderRadius: 10, background: c, cursor: 'pointer',
                        border: details.accentColor.toLowerCase() === c.toLowerCase() ? '2px solid #fff' : '1px solid var(--line-strong)',
                      }}
                    />
                  ))}
                  <input
                    type="color"
                    value={details.accentColor}
                    onChange={setD('accentColor')}
                    aria-label="Pick any colour"
                    style={{ width: 44, height: 34, padding: 2, borderRadius: 10, background: 'transparent', border: '1px solid var(--line-strong)' }}
                  />
                </div>
                <p className="hint">Used for your buttons and highlights. The preview updates as you pick.</p>
              </div>
            </div>
          )}

          {tab === 'settings' && (
            <div className="form">
              <Check
                label={
                  <>
                    <b>Let search engines find this profile</b>
                    <br />
                    <span className="muted small">
                      Off means the page still works for anyone with the link, but Google is told not to list it.
                    </span>
                  </>
                }
                checked={details.isPublic}
                onChange={setD('isPublic')}
              />
              <Check
                label={
                  <>
                    <b>Show the enquiry form</b>
                    <br />
                    <span className="muted small">Visitors can send you a message straight from your profile.</span>
                  </>
                }
                checked={details.leadFormEnabled}
                onChange={setD('leadFormEnabled')}
              />
              {details.leadFormEnabled ? (
                <TextField label="Form heading" value={details.leadFormTitle} onChange={setD('leadFormTitle')} error={fields.leadFormTitle} />
              ) : null}

              <div className="divider" />
              <p className="mono-label">How it looks when shared</p>
              <TextField
                label="Page title"
                value={details.metaTitle}
                onChange={setD('metaTitle')}
                placeholder={`${details.fullName}${details.designation ? `, ${details.designation}` : ''}`}
                hint="Leave empty and we build it from your name and designation."
                maxLength={80}
                error={fields.metaTitle}
              />
              <TextArea
                label="Page description"
                value={details.metaDescription}
                onChange={setD('metaDescription')}
                placeholder="One sentence that shows up under the title in search results."
                maxLength={200}
                hint={`${details.metaDescription.length} of 200 characters`}
                error={fields.metaDescription}
              />
            </div>
          )}

          {/* the details save bar, only for the tabs it applies to */}
          {['basics', 'contact', 'design', 'settings'].includes(tab) && (
            <div className="row" style={{ marginTop: 24 }}>
              <button type="button" className="btn btn-accent" onClick={() => void saveDetails()} disabled={savingDetails || !detailsDirty}>
                {savingDetails ? <span className="spinner" aria-hidden="true" /> : null}
                {savingDetails ? 'Saving' : detailsDirty ? 'Save changes' : 'Saved'}
              </button>
              {detailsDirty ? (
                <button type="button" className="btn btn-quiet" onClick={() => setDetails(detailsFrom(profile))}>
                  Undo
                </button>
              ) : null}
            </div>
          )}
        </div>

        <aside className="builder-preview">
          <div className="pv-url">
            <span>{appUrl.replace(/^https?:\/\//, '')}/</span>
            <b>{profile.username}</b>
          </div>
          <div className="pv-frame">
            <div className="pv-screen">
              <div className="pv-scroll">
                <ProfileRender p={preview} mode="preview" />
              </div>
            </div>
          </div>
          <p className="muted tiny" style={{ textAlign: 'center', marginTop: 12 }}>
            Live preview. Buttons are switched off here so you stay in the editor.
          </p>
        </aside>
      </div>
    </>
  );
}
