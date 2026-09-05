'use client';

import { useState } from 'react';
import type { ProfileView, BusinessView } from '@/lib/profile';
import { api, rupees } from '@/lib/client';
import {
  SOCIAL_ICONS, SOCIAL_LABELS, IconWhatsApp, IconPhone, IconMail,
  IconMap, IconGlobe, IconDownload, IconCheck, IconExternal, IconCake,
} from '@/components/icons';

type Mode = 'preview' | 'live';

type Props = {
  p: ProfileView;
  mode: Mode;
  /** Live only: where the visitor came from, for the analytics. */
  source?: string | null;
  qrDataUrl?: string | null;
};

const DAY_NAMES: Record<string, string> = {
  mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday',
  fri: 'Friday', sat: 'Saturday', sun: 'Sunday',
};

/** The accent as an rgba string, for the soft fills behind badges. */
function rgba(hex: string, a: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return `rgba(52,224,240,${a})`;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/**
 * Dark text on a light accent, light text on a dark one.
 * The Design tab lets anyone pick any colour, and a "Save contact" button
 * nobody can read is not a design choice.
 */
function readableInk(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return '#06080C';
  const n = parseInt(m[1], 16);
  const chan = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const L = 0.2126 * chan((n >> 16) & 255) + 0.7152 * chan((n >> 8) & 255) + 0.0722 * chan(n & 255);
  const onBlack = (L + 0.05) / 0.05;
  const onWhite = 1.05 / (L + 0.05);
  return onBlack >= onWhite ? '#06080C' : '#FFFFFF';
}

export default function ProfileRender({ p, mode, source, qrDataUrl }: Props) {
  const live = mode === 'live';
  const accent = p.accentColor || '#34E0F0';

  const active = p.businesses.filter((b) => b.active);
  // the one a visitor meets first, then everything else they also run
  const b = active.find((x) => x.isPrimary) ?? active[0] ?? null;
  const others = active.filter((x) => x !== b);

  const phone = p.phone || b?.phone || null;
  const whatsapp = p.whatsapp || b?.whatsapp || null;
  const email = p.email || b?.email || null;
  const website = p.website || b?.website || null;
  // the main business shows its own address and map link, falling back to the
  // profile's, so nothing entered anywhere is lost and nothing appears twice
  const bizAddress = b ? b.address || p.address || null : null;
  const bizMaps = b ? b.mapsUrl || p.mapsUrl || null : null;

  function hit(type: string, label?: string) {
    if (!live) return;
    void api('/api/track', {
      json: { profileId: p.id, type, label: label ?? null, source: source ?? null },
      keepalive: true,
    } as RequestInit & { json: unknown });
  }

  /** In the preview nothing should navigate away from the editor. */
  const guard = (e: React.MouseEvent) => {
    if (!live) e.preventDefault();
  };

  const initials = p.fullName
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  return (
    <div
      className={`pp${live ? '' : ' pp-preview'}`}
      style={
        {
          // the whole profile, buttons included, takes the colour they picked
          '--pp-accent': accent,
          '--accent': accent,
          '--accent-hover': accent,
          '--accent-muted': rgba(accent, 0.16),
          '--ink': readableInk(accent),
        } as React.CSSProperties
      }
    >
      <div className="pp-cover">{p.coverUrl ? <img src={p.coverUrl} alt="" /> : null}</div>

      <div className="pp-body">
        {p.photoUrl ? (
          <img className="pp-avatar" src={p.photoUrl} alt={p.fullName} />
        ) : (
          <div className="pp-avatar" aria-hidden="true">{initials || '?'}</div>
        )}

        <h1 className="pp-name">
          {p.fullName}
          {p.verified ? (
            <span className="pp-verified" title="Verified by NFCY">
              <IconCheck /> Verified
            </span>
          ) : null}
        </h1>

        {(p.designation || p.company || b?.name) && (
          <p className="pp-role">
            {p.designation}
            {p.designation && (p.company || b?.name) ? ' at ' : ''}
            {p.company || b?.name}
          </p>
        )}

        {p.bio ? <p className="pp-bio">{p.bio}</p> : null}

        {p.birthday ? (
          <p className="pp-birthday">
            <IconCake /> Birthday {p.birthday}
          </p>
        ) : null}

        {/* the actions a visitor most likely wants */}
        <div className="pp-actions">
          <a
            className="btn btn-accent wide"
            href={live ? `/api/profile/${p.id}/vcard` : '#'}
            onClick={(e) => { guard(e); hit('SAVE_CONTACT'); }}
          >
            <IconDownload /> Save contact
          </a>

          {whatsapp ? (
            <a
              className="btn btn-ghost"
              href={`https://wa.me/91${whatsapp}${p.whatsappNote ? `?text=${encodeURIComponent(p.whatsappNote)}` : ''}`}
              target="_blank" rel="noopener"
              onClick={(e) => { guard(e); hit('CLICK_WHATSAPP'); }}
            >
              <IconWhatsApp /> WhatsApp
            </a>
          ) : null}

          {phone ? (
            <a className="btn btn-ghost" href={`tel:+91${phone}`} onClick={(e) => { guard(e); hit('CLICK_CALL'); }}>
              <IconPhone /> Call
            </a>
          ) : null}

          {/* No Directions here. Each business carries its own, in its own block,
              so a person with three shops does not get three identical buttons
              at the top of the page pointing at whichever address won. */}

          {email ? (
            <a className="btn btn-ghost" href={`mailto:${email}`} onClick={(e) => { guard(e); hit('CLICK_EMAIL'); }}>
              <IconMail /> Email
            </a>
          ) : null}

          {website ? (
            <a className="btn btn-ghost" href={website} target="_blank" rel="noopener" onClick={(e) => { guard(e); hit('CLICK_WEBSITE'); }}>
              <IconGlobe /> Website
            </a>
          ) : null}
        </div>

        {/* The main business, with everything that was entered for it.
            It used to render only when "About" was filled in, so a logo, a
            category, an address and a GST number that someone had carefully
            typed never reached the page at all. */}
        {b ? (
          <section className="pp-section">
            <h2>{b.name}</h2>

            <div className="pp-biz-card">
              <div className="pp-biz-main">
                {b.logoUrl ? (
                  <img src={b.logoUrl} alt={b.name} />
                ) : (
                  <span className="pp-org-mark" aria-hidden="true">{b.name.slice(0, 2).toUpperCase()}</span>
                )}
                <div className="grow">
                  {/* the name is already the section heading above */}
                  {b.category ? <p className="pp-biz-cat">{b.category}</p> : <b className="pp-biz-name">{b.name}</b>}
                </div>
              </div>

              {b.about ? <p className="pp-biz-about">{b.about}</p> : null}

              {(bizAddress || b.phone || b.whatsapp || b.email || b.website || b.gstNumber) ? (
                <dl className="pp-biz-rows">
                  {bizAddress ? (
                    <div><dt><IconMap /> Address</dt><dd>{bizAddress}</dd></div>
                  ) : null}
                  {b.phone ? (
                    <div><dt><IconPhone /> Phone</dt><dd><a href={`tel:+91${b.phone}`} onClick={(e) => { guard(e); hit('CLICK_CALL', b.name); }}>+91 {b.phone}</a></dd></div>
                  ) : null}
                  {b.whatsapp && b.whatsapp !== b.phone ? (
                    <div><dt><IconWhatsApp /> WhatsApp</dt><dd><a href={`https://wa.me/91${b.whatsapp}`} target="_blank" rel="noopener" onClick={(e) => { guard(e); hit('CLICK_WHATSAPP', b.name); }}>+91 {b.whatsapp}</a></dd></div>
                  ) : null}
                  {b.email ? (
                    <div><dt><IconMail /> Email</dt><dd><a href={`mailto:${b.email}`} onClick={(e) => { guard(e); hit('CLICK_EMAIL', b.name); }}>{b.email}</a></dd></div>
                  ) : null}
                  {b.website ? (
                    <div><dt><IconGlobe /> Website</dt><dd><a href={b.website} target="_blank" rel="noopener" onClick={(e) => { guard(e); hit('CLICK_WEBSITE', b.name); }}>{b.website.replace(/^https?:\/\//, '')}</a></dd></div>
                  ) : null}
                  {b.gstNumber ? (
                    <div><dt>GST</dt><dd className="num">{b.gstNumber}</dd></div>
                  ) : null}
                </dl>
              ) : null}

              {(bizMaps || b.googleReviewUrl || b.instagramUrl) ? (
                <div className="pp-biz-links">
                  {bizMaps ? (
                    <a className="btn btn-ghost btn-sm" href={bizMaps} target="_blank" rel="noopener"
                       onClick={(e) => { guard(e); hit('CLICK_MAPS', b.name); }}>
                      <IconMap /> Directions
                    </a>
                  ) : null}
                  {b.googleReviewUrl ? (
                    <a className="btn btn-ghost btn-sm" href={b.googleReviewUrl} target="_blank" rel="noopener"
                       onClick={(e) => { guard(e); hit('REVIEW_REDIRECT', b.name); }}>
                      <IconExternal /> Write a review
                    </a>
                  ) : null}
                  {b.instagramUrl ? (
                    <a className="btn btn-ghost btn-sm" href={b.instagramUrl} target="_blank" rel="noopener"
                       onClick={(e) => { guard(e); hit('CLICK_LINK', b.name); }}>
                      <IconExternal /> Instagram
                    </a>
                  ) : null}
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        {b?.showHours && b.hours && b.hours.length > 0 ? (
          <section className="pp-section">
            <h2>Opening hours</h2>
            <div className="pp-hours">
              {b.hours.map((h) => (
                <div key={h.day}>
                  <span>{DAY_NAMES[h.day] ?? h.day}</span>
                  <span className={h.closed ? 'muted' : ''}>{h.closed ? 'Closed' : `${h.open} to ${h.close}`}</span>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {/* everything else this person runs */}
        {others.length > 0 && (
          <section className="pp-section">
            <h2>{others.length === 1 ? 'Also runs' : 'Also runs these'}</h2>
            <div className="stack-sm">
              {others.map((biz) => (
                <OtherBusiness key={biz.id} biz={biz} live={live} guard={guard} hit={hit} />
              ))}
            </div>
          </section>
        )}

        {p.documents.filter((d) => d.active).length > 0 && (
          <section className="pp-section">
            <h2>Files you can download</h2>
            <div className="stack-sm">
              {p.documents.filter((d) => d.active).map((d) => (
                <a
                  key={d.id}
                  className="pp-doc"
                  href={live ? `/api/profile/${p.id}/documents/${d.id}/open` : '#'}
                  target="_blank"
                  rel="noopener"
                  onClick={(e) => { guard(e); hit('DOCUMENT_OPENED', d.title); }}
                >
                  <span className="pp-doc-mark" aria-hidden="true">PDF</span>
                  <span className="grow">
                    <b>{d.title}</b>
                    {d.description ? <span className="muted tiny">{d.description}</span> : null}
                  </span>
                  <span className="pp-doc-size">{d.sizeLabel}</span>
                  <IconDownload />
                </a>
              ))}
            </div>
          </section>
        )}

        {p.services.filter((s) => s.active).length > 0 && (
          <section className="pp-section">
            <h2>Services</h2>
            <div className="stack-sm">
              {p.services.filter((s) => s.active).map((s) => (
                <a
                  key={s.id}
                  className="pp-card"
                  href={s.bookingUrl || '#'}
                  target={s.bookingUrl ? '_blank' : undefined}
                  rel="noopener"
                  onClick={(e) => { if (!s.bookingUrl) e.preventDefault(); else { guard(e); hit('CLICK_SERVICE', s.name); } }}
                >
                  {s.imageUrl ? <img src={s.imageUrl} alt="" /> : null}
                  <span className="grow">
                    <b>{s.name}</b>
                    {s.description ? <p>{s.description}</p> : null}
                    {s.durationMin ? <p className="tiny">{s.durationMin} minutes</p> : null}
                  </span>
                  {s.priceMinor != null ? <span className="pp-price">{rupees(s.priceMinor)}</span> : null}
                </a>
              ))}
            </div>
          </section>
        )}

        {p.products.filter((x) => x.active).length > 0 && (
          <section className="pp-section">
            <h2>Products</h2>
            <div className="stack-sm">
              {p.products.filter((x) => x.active).map((x) => (
                <a
                  key={x.id}
                  className="pp-card"
                  href={x.url || '#'}
                  target={x.url ? '_blank' : undefined}
                  rel="noopener"
                  onClick={(e) => { if (!x.url) e.preventDefault(); else { guard(e); hit('CLICK_PRODUCT', x.name); } }}
                >
                  {x.imageUrl ? <img src={x.imageUrl} alt="" /> : null}
                  <span className="grow">
                    <b>{x.name}</b>
                    {x.description ? <p>{x.description}</p> : null}
                  </span>
                  {x.priceMinor != null ? <span className="pp-price">{rupees(x.priceMinor)}</span> : null}
                </a>
              ))}
            </div>
          </section>
        )}

        {p.gallery.length > 0 && (
          <section className="pp-section">
            <h2>Gallery</h2>
            <div className="pp-gallery">
              {p.gallery.map((g) => (g.url ? <img key={g.id} src={g.url} alt={g.caption ?? ''} loading="lazy" /> : null))}
            </div>
          </section>
        )}

        {/* networking bodies: BNI, Rotary, a chamber of commerce */}
        {p.affiliations.length > 0 && (
          <section className="pp-section">
            <h2>Member of</h2>
            <div className="pp-orgs">
              {p.affiliations.map((a) => {
                const inner = (
                  <>
                    {a.logoUrl ? (
                      <img src={a.logoUrl} alt="" />
                    ) : (
                      <span className="pp-org-mark" aria-hidden="true">
                        {a.name.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                    <span className="grow">
                      <b>{a.name}</b>
                      {a.role || a.chapter ? (
                        <p>{[a.role, a.chapter].filter(Boolean).join(' · ')}</p>
                      ) : null}
                    </span>
                    {a.url ? <IconExternal /> : null}
                  </>
                );
                return a.url ? (
                  <a
                    key={a.id}
                    className="pp-org"
                    href={a.url}
                    target="_blank"
                    rel="noopener"
                    onClick={(e) => { guard(e); hit('CLICK_SOCIAL', `affiliation:${a.name}`); }}
                  >
                    {inner}
                  </a>
                ) : (
                  <div key={a.id} className="pp-org">{inner}</div>
                );
              })}
            </div>
          </section>
        )}

        {p.socials.length > 0 && (
          <section className="pp-section">
            <h2>Find me on</h2>
            <div className="pp-socials">
              {p.socials.map((s) => {
                const Icon = SOCIAL_ICONS[s.platform] ?? SOCIAL_ICONS.custom;
                return (
                  <a
                    key={s.id}
                    className="pp-social"
                    href={s.url}
                    target="_blank"
                    rel="noopener"
                    aria-label={s.label || SOCIAL_LABELS[s.platform] || s.platform}
                    title={s.label || SOCIAL_LABELS[s.platform] || s.platform}
                    onClick={(e) => { guard(e); hit('CLICK_SOCIAL', s.platform); }}
                  >
                    <Icon />
                  </a>
                );
              })}
            </div>
          </section>
        )}

        {/* Only for someone with no business at all. Once there is one, its
            address and its Directions live in its own block, and repeating them
            here just gave the same link a second and third button. */}
        {!b && (p.address || p.mapsUrl) && (
          <section className="pp-section">
            <h2>Where to find me</h2>
            {p.address ? <p className="muted" style={{ whiteSpace: 'pre-wrap' }}>{p.address}</p> : null}
            {p.mapsUrl ? (
              <p style={{ marginTop: 12 }}>
                <a className="btn btn-ghost" href={p.mapsUrl} target="_blank" rel="noopener" onClick={(e) => { guard(e); hit('CLICK_MAPS'); }}>
                  <IconMap /> Open in Google Maps
                </a>
              </p>
            ) : null}
          </section>
        )}

        {p.upiId ? (
          <section className="pp-section">
            <h2>Pay</h2>
            <a
              className="pp-card"
              href={`upi://pay?pa=${encodeURIComponent(p.upiId)}&pn=${encodeURIComponent(b?.name || p.fullName)}`}
              onClick={(e) => { guard(e); hit('CLICK_UPI'); }}
            >
              <span className="grow">
                <b>UPI</b>
                <p>{p.upiId}</p>
                {p.paymentNote ? <p className="tiny">{p.paymentNote}</p> : null}
              </span>
            </a>
          </section>
        ) : null}

        {p.leadFormEnabled ? (
          <LeadForm profileId={p.id} title={p.leadFormTitle} live={live} onSent={() => hit('LEAD_SUBMITTED')} />
        ) : null}

        {qrDataUrl ? (
          <section className="pp-section">
            <h2>Scan to open this profile</h2>
            <div className="pp-qr">
              <img src={qrDataUrl} alt="QR code for this profile" />
              <p className="muted tiny">Point any camera at it.</p>
            </div>
          </section>
        ) : null}

        <footer className="pp-foot">
          <a href={live ? 'https://nfcy.in' : '#'} onClick={guard}>
            Made with NFCY
          </a>
        </footer>
      </div>

      <div className="pp-bar">
        <div className="pp-bar-in">
          <a
            className="btn btn-accent"
            href={live ? `/api/profile/${p.id}/vcard` : '#'}
            onClick={(e) => { guard(e); hit('SAVE_CONTACT'); }}
          >
            Save contact
          </a>
          {whatsapp ? (
            <a
              className="btn btn-ghost"
              href={`https://wa.me/91${whatsapp}`}
              target="_blank" rel="noopener"
              onClick={(e) => { guard(e); hit('CLICK_WHATSAPP'); }}
            >
              WhatsApp
            </a>
          ) : phone ? (
            <a className="btn btn-ghost" href={`tel:+91${phone}`} onClick={(e) => { guard(e); hit('CLICK_CALL'); }}>
              Call
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** A second or third venture, with its own logo and its own way to reach it. */
function OtherBusiness({
  biz,
  live,
  guard,
  hit,
}: {
  biz: BusinessView;
  live: boolean;
  guard: (e: React.MouseEvent) => void;
  hit: (type: string, label?: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const hasMore = Boolean(biz.about || biz.phone || biz.whatsapp || biz.website || biz.mapsUrl || (biz.showHours && biz.hours));

  return (
    <div className="pp-biz">
      <div className="pp-biz-head">
        {biz.logoUrl ? (
          <img src={biz.logoUrl} alt="" />
        ) : (
          <span className="pp-org-mark" aria-hidden="true">{biz.name.slice(0, 2).toUpperCase()}</span>
        )}
        <span className="grow">
          <b>{biz.name}</b>
          {biz.category ? <p>{biz.category}</p> : null}
        </span>
        {hasMore ? (
          <button type="button" className="btn btn-quiet btn-sm" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
            {open ? 'Less' : 'More'}
          </button>
        ) : null}
      </div>

      {open ? (
        <div className="pp-biz-body">
          {biz.about ? <p className="muted small" style={{ whiteSpace: 'pre-wrap' }}>{biz.about}</p> : null}

          <div className="pp-actions" style={{ marginTop: 14 }}>
            {biz.whatsapp ? (
              <a className="btn btn-ghost btn-sm" href={`https://wa.me/91${biz.whatsapp}`} target="_blank" rel="noopener"
                 onClick={(e) => { guard(e); hit('CLICK_WHATSAPP', biz.name); }}>
                <IconWhatsApp /> WhatsApp
              </a>
            ) : null}
            {biz.phone ? (
              <a className="btn btn-ghost btn-sm" href={`tel:+91${biz.phone}`}
                 onClick={(e) => { guard(e); hit('CLICK_CALL', biz.name); }}>
                <IconPhone /> Call
              </a>
            ) : null}
            {biz.mapsUrl ? (
              <a className="btn btn-ghost btn-sm" href={biz.mapsUrl} target="_blank" rel="noopener"
                 onClick={(e) => { guard(e); hit('CLICK_MAPS', biz.name); }}>
                <IconMap /> Directions
              </a>
            ) : null}
            {biz.website ? (
              <a className="btn btn-ghost btn-sm" href={biz.website} target="_blank" rel="noopener"
                 onClick={(e) => { guard(e); hit('CLICK_WEBSITE', biz.name); }}>
                <IconGlobe /> Website
              </a>
            ) : null}
          </div>

          {biz.showHours && biz.hours && biz.hours.length > 0 ? (
            <div className="pp-hours" style={{ marginTop: 16 }}>
              {biz.hours.map((h) => (
                <div key={h.day}>
                  <span>{DAY_NAMES[h.day] ?? h.day}</span>
                  <span className={h.closed ? 'muted' : ''}>{h.closed ? 'Closed' : `${h.open} to ${h.close}`}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function LeadForm({
  profileId,
  title,
  live,
  onSent,
}: {
  profileId: string;
  title: string;
  live: boolean;
  onSent: () => void;
}) {
  const [form, setForm] = useState({ name: '', phone: '', email: '', message: '', website: '' });
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!live) {
      setError('This is a preview. The form works on your live profile.');
      return;
    }
    setBusy(true);
    setError('');
    setFields({});

    const res = await api(`/api/profile/${profileId}/leads`, { json: form });
    setBusy(false);

    if (!res.ok) {
      setError(res.error.message);
      setFields(res.error.fields ?? {});
      return;
    }
    setSent(true);
    onSent();
  }

  return (
    <section className="pp-section">
      <h2>{title}</h2>
      {sent ? (
        <p className="form-good">Thanks. Your message has been sent and they will get back to you.</p>
      ) : (
        <form className="form" onSubmit={submit} noValidate>
          {error ? <p className="form-error" role="alert">{error}</p> : null}

          <div className={`field${fields.name ? ' bad' : ''}`}>
            <label htmlFor="lead-name">Your name</label>
            <input id="lead-name" type="text" value={form.name} onChange={set('name')} placeholder="Your name" required />
            {fields.name ? <p className="err">{fields.name}</p> : null}
          </div>

          <div className={`field${fields.phone ? ' bad' : ''}`}>
            <label htmlFor="lead-phone">Phone</label>
            <div className="prefix-wrap">
              <span className="prefix">+91</span>
              <input id="lead-phone" type="tel" inputMode="numeric" value={form.phone} onChange={set('phone')} placeholder="98765 43210" />
            </div>
            {fields.phone ? <p className="err">{fields.phone}</p> : null}
          </div>

          <div className={`field${fields.email ? ' bad' : ''}`}>
            <label htmlFor="lead-email">Email</label>
            <input id="lead-email" type="email" value={form.email} onChange={set('email')} placeholder="you@example.com" />
            {fields.email ? <p className="err">{fields.email}</p> : null}
          </div>

          <div className="field">
            <label htmlFor="lead-message">Message</label>
            <textarea id="lead-message" value={form.message} onChange={set('message')} placeholder="What would you like to ask?" />
          </div>

          {/* honeypot: hidden from people, tempting to bots */}
          <input
            type="text"
            name="website"
            value={form.website}
            onChange={set('website')}
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }}
          />

          <button type="submit" className="btn btn-accent full" disabled={busy} aria-busy={busy}>
            {busy ? <span className="spinner" aria-hidden="true" /> : null}
            {busy ? 'Sending' : 'Send message'}
          </button>
        </form>
      )}
    </section>
  );
}
