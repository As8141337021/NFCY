import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import Link from 'next/link';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { editorInclude, toView, redactForPublic, type FullProfile } from '@/lib/profile';
import { profileUrl, tapUrl, qrDataUrl } from '@/lib/qr';
import { cardForProfile } from '@/lib/entitlement';
import { track, looksLikeBot } from '@/lib/analytics';
import ProfileRender from '@/components/ProfileRender';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ username: string }>; searchParams: Promise<{ s?: string }> };

async function load(username: string) {
  return (await db.profile.findUnique({
    where: { username: username.toLowerCase() },
    include: editorInclude,
  })) as FullProfile | null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const p = await load(username);

  if (!p || p.status !== 'PUBLISHED') {
    return { title: 'Profile not found', robots: { index: false, follow: false } };
  }

  const title = p.metaTitle || `${p.fullName}${p.designation ? `, ${p.designation}` : ''}`;
  const description =
    p.metaDescription ||
    p.bio?.slice(0, 180) ||
    `${p.fullName}${p.company ? ` at ${p.company}` : ''}. Contact, business and links in one place.`;

  const url = profileUrl(p.username);

  return {
    title,
    description,
    alternates: { canonical: url },
    // a private profile is never indexed, whatever a crawler does with the link
    robots: p.isPublic
      ? { index: true, follow: true }
      : { index: false, follow: false, nocache: true },
    openGraph: {
      type: 'profile',
      title,
      description,
      url,
      images: p.photo ? [{ url: `${env.appUrl}/api/media/${p.photo.id}` }] : undefined,
    },
  };
}

export default async function PublicProfile({ params, searchParams }: Props) {
  const { username } = await params;
  const { s } = await searchParams;

  const p = await load(username);
  if (!p) notFound();

  if (p.status === 'DRAFT') return <Unpublished name={p.fullName} />;
  if (p.status === 'SUSPENDED') return <Suspended />;
  if (p.status === 'RENEWAL_REQUIRED') return <NeedsRenewal name={p.fullName} />;

  // count the view, but never count a crawler or a link preview
  const h = await headers();
  const ua = h.get('user-agent') ?? '';
  if (!looksLikeBot(ua)) {
    const source = s === 'nfc' ? 'nfc' : s === 'qr' ? 'qr' : h.get('referer') ? 'link' : 'direct';
    await track(new Request(profileUrl(p.username), { headers: h }), {
      profileId: p.id,
      type: 'PROFILE_VIEW',
      source,
    });
  }

  const view = redactForPublic(toView(p));
  // One code, not two. If this profile has a card, the QR encodes the card's
  // own link, exactly what the chip holds, so a scan and a tap land in the same
  // place and are counted the same way.
  const card = await cardForProfile(p.id);
  const qr = await qrDataUrl(card ? tapUrl(card.code) : profileUrl(p.username), 340);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: p.fullName,
    jobTitle: p.designation ?? undefined,
    worksFor: p.company ? { '@type': 'Organization', name: p.company } : undefined,
    url: profileUrl(p.username),
    telephone: p.phone ? `+91${p.phone}` : undefined,
    email: p.email ?? undefined,
    sameAs: p.socialLinks.map((l) => l.url),
  };

  return (
    <>
      {p.isPublic ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      ) : null}
      <main id="main">
        <ProfileRender p={view} mode="live" source={s ?? null} qrDataUrl={qr} />
      </main>
    </>
  );
}

function Shell({ title, body, cta }: { title: string; body: string; cta?: React.ReactNode }) {
  return (
    <main className="center-page" id="main">
      <div className="card" style={{ maxWidth: 460, textAlign: 'center' }}>
        <h1 style={{ fontSize: '1.4rem' }}>{title}</h1>
        <p className="muted" style={{ marginTop: 12 }}>{body}</p>
        {cta ? <div style={{ marginTop: 22 }}>{cta}</div> : null}
      </div>
    </main>
  );
}

const Unpublished = ({ name }: { name: string }) => (
  <Shell
    title="This profile is not live yet"
    body={`${name} is still putting this together. Check back shortly.`}
    cta={<Link href="/" className="btn btn-ghost">About NFCY</Link>}
  />
);

const Suspended = () => (
  <Shell title="This profile is unavailable" body="This profile has been suspended. If it is yours, get in touch and we will sort it out." />
);

const NeedsRenewal = ({ name }: { name: string }) => (
  <Shell
    title="This profile is paused"
    body={`${name}'s profile is waiting on its yearly renewal. The card still works. As soon as it is renewed, this page comes straight back.`}
    cta={<Link href="/login" className="btn btn-accent">Sign in to renew</Link>}
  />
);
