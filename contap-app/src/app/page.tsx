import Link from 'next/link';
import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { rupees } from '@/lib/money';
import { currentUser, isStaff } from '@/lib/auth';
import { assetUrl } from '@/lib/storage';
import SiteNav from '@/components/SiteNav';
import { CardArt, CardArtDefs } from '@/components/CardArt';
import HeroScrub from '@/components/home/HeroScrub';
import DemoHold from '@/components/home/DemoHold';
import Reveals from '@/components/home/Reveals';

export const metadata: Metadata = {
  title: 'NFCY. Your digital identity. One tap away.',
  description:
    'One NFC card that opens your whole profile. Contact, business, socials, products and location, shared in one tap and changed from your phone. Cards from ₹499.',
  alternates: { canonical: env.appUrl },
};

export const dynamic = 'force-dynamic';

const FAQ = [
  ['Do they need an app?', 'No. Their phone opens your profile in its browser, the same way it opens a website. Nothing to install.'],
  ['Does it work on iPhone?', 'Yes. Every iPhone from the XS onward reads a NFCY card without an app. Older iPhones use the QR on the back.'],
  ['Does it work on Android?', 'Yes, on any Android with NFC, which is most of them. QR covers the rest.'],
  ['Honestly, is this just a link? Could I not do this for free?', 'You could. The link is the easy part. What you are buying is the thing that link opens, the ability to change it forever, the analytics behind it, and an object worth handing to someone. If you only want a free link page, take one. We built this for people who want the object too.'],
  ['What if I change my phone number?', 'Change it on your profile. Every card you ever gave out points at the new number instantly. Nothing gets reprinted.'],
  ['What if I lose my card?', 'Switch it off from your dashboard and order a replacement. Your profile and your link stay exactly the same.'],
  ['Can I change where my Instagram card points?', 'Yes, any time, from the dashboard. The card never changes.'],
  ['What if NFC does not work on their phone?', 'Every card has a QR code printed on the back. It goes to the same place.'],
  ['How long does delivery take?', 'We tell you the real date at checkout and you track it from your dashboard. We would rather quote a date we can hit.'],
  ['Can a company order fifty?', 'Yes. Bulk pricing, your branding, and one dashboard for every employee profile.'],
];

const STEPS = [
  ['01', 'Pick your card.', 'Six of them. From ₹499.'],
  ['02', 'Your card arrives.', 'Printed for you, chipped, and already carrying your own link.'],
  ['03', 'Build your profile.', 'Name, business, socials, WhatsApp, products, location. Takes about ten minutes.'],
  ['04', 'Tap and share.', 'Hold it near any phone. Your profile opens. That is the whole thing.'],
];

export default async function Home() {
  const [products, renewal, user] = await Promise.all([
    db.product.findMany({
      where: { status: { in: ['ACTIVE', 'OUT_OF_STOCK'] }, kind: { not: 'RENEWAL' } },
      orderBy: { position: 'asc' },
      include: { images: { where: { isPrimary: true }, include: { media: true }, take: 1 } },
    }),
    db.product.findFirst({ where: { kind: 'RENEWAL' }, select: { priceMinor: true } }),
    currentUser(),
  ]);

  const renewalPrice = renewal?.priceMinor ?? 29900;
  const cheapest = products.length ? Math.min(...products.map((p) => p.priceMinor)) : 59900;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'NFCY',
    description: 'NFC business cards and digital identity profiles for India.',
    url: env.appUrl,
    contactPoint: { '@type': 'ContactPoint', contactType: 'sales', telephone: `+${env.whatsapp}`, areaServed: 'IN' },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <CardArtDefs />
      <svg className="defs" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id="heroFace" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#20252F" />
            <stop offset="0.45" stopColor="#12161E" />
            <stop offset="1" stopColor="#080A0F" />
          </linearGradient>
          <linearGradient id="heroSheen" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0" />
            <stop offset="0.42" stopColor="#fff" stopOpacity="0.16" />
            <stop offset="0.55" stopColor="#fff" stopOpacity="0.03" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>

      <div className="env" aria-hidden="true">
        <div className="env-glow" />
        <div className="env-grain" />
      </div>

      <SiteNav signedIn={Boolean(user)} staff={Boolean(user && isStaff(user.role))} />
      <Reveals />

      <main id="main" tabIndex={-1}>
        <HeroScrub />

        {/* trust strip */}
        <section className="strip reveal" aria-label="What you get">
          <ul className="strip-list">
            <li><span className="tick" aria-hidden="true" />No app for them. No app for you.</li>
            <li><span className="tick" aria-hidden="true" />Works on iPhone and Android.</li>
            <li><span className="tick" aria-hidden="true" />QR printed on the back, always.</li>
            <li><span className="tick" aria-hidden="true" />Change it any time, free.</li>
          </ul>
        </section>

        {/* how it works */}
        <section className="sec how" id="how">
          <div className="wrap">
            <p className="kicker reveal">How it works</p>
            <h2 className="h2 reveal">Four steps, then you stop thinking about it.</h2>

            <div className="steps" id="steps">
              <svg className="steps-line" viewBox="0 0 4 100" preserveAspectRatio="none" aria-hidden="true">
                <path
                  id="steps-path"
                  d="M2 0 V100"
                  fill="none"
                  stroke="var(--accent)"
                  strokeOpacity=".38"
                  strokeWidth="1.4"
                  strokeDasharray="100"
                  strokeDashoffset="100"
                />
              </svg>

              {STEPS.map(([n, title, body], i) => (
                <article className="step reveal" key={n}>
                  <div className="step-art" aria-hidden="true">
                    <StepArt index={i} />
                  </div>
                  <p className="step-n">{n}</p>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <DemoHold />

        {/* the cards */}
        <section className="sec cards" id="cards">
          <div className="wrap">
            <p className="kicker reveal">The range</p>
            <h2 className="h2 reveal">Choose your card.</h2>
            <p className="lede reveal">Every one of them opens the same profile. Pick the one you want to hand over.</p>

            <div className="grid-cards">
              {products.map((p) => {
                const photo = p.images[0];
                const features = ((p.features as string[] | null) ?? []).slice(0, 6);
                const featured = p.badge === 'Most popular';
                const premium = p.badge === 'Premium';

                return (
                  <article
                    key={p.id}
                    className={`pcard reveal${featured ? ' featured' : ''}${premium ? ' premium' : ''}`}
                  >
                    {p.badge ? <span className={`badge${premium ? ' gold' : ''}`}>{p.badge}</span> : null}

                    <div className="pcard-art">
                      {photo ? (
                        <img
                          src={assetUrl(photo.media.id, photo.media.externalUrl)}
                          alt={photo.alt ?? p.name}
                          style={{ width: '100%', height: 'auto', borderRadius: 14, display: 'block' }}
                        />
                      ) : (
                        <CardArt slug={p.slug} className="card-svg" />
                      )}
                      <span className="sheen" aria-hidden="true" />
                    </div>

                    <div className="pcard-body">
                      <h3>{p.name}</h3>
                      <p className="price"><span>{rupees(p.priceMinor)}</span></p>
                      {p.tagline ? <p className="pcard-line">{p.tagline}</p> : null}
                      {features.length ? (
                        <ul className="feats">
                          {features.map((f) => (
                            <li key={f}>{f}</li>
                          ))}
                        </ul>
                      ) : null}
                      <Link className="btn btn-accent full" href="/cards" style={{ marginTop: 'auto' }}>
                        Get this card, {rupees(p.priceMinor)}
                      </Link>
                      <p className="renew">Renewal {rupees(renewalPrice)}/year after the first year.</p>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* comparison */}
        <section className="sec versus" id="versus">
          <div className="wrap">
            <p className="kicker reveal">Paper against NFCY</p>
            <h2 className="h2 reveal">One of these you reprint. One of these you edit.</h2>

            <div className="vs">
              <div className="vs-col vs-old reveal">
                <h3>A paper card</h3>
                <ul>
                  <li>Printed once, wrong forever.</li>
                  <li>Reprint the whole box to fix one line.</li>
                  <li>Ends up in a drawer.</li>
                  <li>Tells them your number and nothing else.</li>
                  <li>You never know if anyone looked.</li>
                </ul>
              </div>
              <div className="vs-col vs-new reveal">
                <h3>A NFCY card</h3>
                <ul>
                  <li>Change it from your phone.</li>
                  <li>One card, forever.</li>
                  <li>They save your contact in one tap.</li>
                  <li>Business, products, location, socials, payment.</li>
                  <li>You see every tap, scan and click.</li>
                </ul>
              </div>
            </div>
            <p className="vs-cta reveal">
              <Link className="btn btn-accent" href="/cards">
                Upgrade your identity
              </Link>
            </p>
          </div>
        </section>

        {/* the profile */}
        <section className="sec profile" id="profile">
          <div className="wrap">
            <p className="kicker reveal">Behind the tap</p>
            <h2 className="h2 reveal">It is not a link page. It is your business.</h2>
            <p className="lede reveal">
              A NFCY profile holds everything a customer needs before they decide, and everything you need to know
              after they leave.
            </p>

            <div className="grid-prof">
              <article className="prof reveal">
                <h3>Who you are</h3>
                <p>Profile photo, cover, name, designation, company and a short bio. The parts a person reads in the first two seconds.</p>
              </article>
              <article className="prof reveal">
                <h3>Your business</h3>
                <p>Business name, logo, category, working hours, address and a Google Maps button that opens directions in one tap.</p>
              </article>
              <article className="prof reveal">
                <h3>What you sell</h3>
                <p>Products with prices and photos, services with duration, a gallery, and a portfolio if the work is the pitch.</p>
              </article>
              <article className="prof reveal">
                <h3>How they reach you</h3>
                <p>Call, WhatsApp with your message already typed, email, website, every social account, UPI details, and an enquiry form.</p>
              </article>
              <article className="prof reveal wide">
                <h3>What you learn</h3>
                <p>
                  Profile views, taps, QR scans, and which button people press. Whether they called, messaged on
                  WhatsApp, opened Instagram or asked for directions. Enquiries land in one list you can mark as
                  contacted, converted or closed.
                </p>
              </article>
            </div>
          </div>
        </section>

        {/* counter products */}
        <section className="sec counters" id="counters">
          <div className="wrap counters-wrap">
            <div className="counters-copy">
              <p className="kicker reveal">For shops, salons and restaurants</p>
              <h2 className="h2 reveal">Some cards never leave the counter.</h2>
              <p className="lede reveal">
                A customer who is already happy will leave a review. They just will not go looking for your listing.
                Put the card in front of them and it takes fifteen seconds.
              </p>
              <ul className="tags reveal">
                {['Restaurants', 'Salons', 'Clinics', 'Hotels', 'Jewellery', 'Retail', 'Workshops', 'Reception desks'].map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
              <p className="note reveal">
                NFCY sends people to your real Google listing. Nothing more. Reviews are theirs to write.
              </p>
              <p className="reveal counters-cta">
                <Link className="btn btn-ghost" href="/cards">
                  See the counter products
                </Link>
              </p>
            </div>
            <div className="counters-art reveal" aria-hidden="true">
              <CounterScene />
            </div>
          </div>
        </section>

        {/* teams */}
        <section className="sec teams" id="teams">
          <div className="wrap teams-wrap">
            <div className="teams-copy">
              <p className="kicker reveal">Corporate and bulk</p>
              <h2 className="h2 reveal">Fifty people, one identity.</h2>
              <p className="lede reveal">
                Order in bulk, brand every card, and manage every employee profile from one place. New joiner gets a
                card and a profile the same week. Someone leaves and you switch their card off.
              </p>
              <ul className="vols reveal">
                {['10', '50', '100', '500', '1000+'].map((n) => (
                  <li key={n}>
                    <span>{n}</span>cards
                  </li>
                ))}
              </ul>
              <div className="team-points">
                <p className="reveal"><strong>One dashboard.</strong> Every employee profile, every card, in one place.</p>
                <p className="reveal"><strong>Your branding.</strong> Company logo and colours on every card and every profile.</p>
                <p className="reveal"><strong>One invoice.</strong> Consolidated billing, GST details on file.</p>
              </div>
              <p className="reveal">
                <a className="btn btn-accent" href={`https://wa.me/${env.whatsapp}?text=${encodeURIComponent('Hi NFCY. I want to talk about a bulk order.')}`} target="_blank" rel="noopener">
                  Talk about a bulk order
                </a>
              </p>
            </div>
            <div className="teams-art reveal" aria-hidden="true">
              <TeamScene />
            </div>
          </div>
        </section>

        {/* renewal, said out loud */}
        <section className="sec renewal" id="renewal">
          <div className="wrap renewal-wrap">
            <div className="renewal-badge reveal" aria-hidden="true">
              <span className="rb-num">{rupees(renewalPrice)}</span>
              <span className="rb-unit">per year</span>
            </div>
            <div className="renewal-copy">
              <p className="kicker reveal">Pricing, with nothing hidden</p>
              <h2 className="h2 reveal">About the {rupees(renewalPrice)}.</h2>
              <p className="reveal">
                Your card is yours. You buy it once. The {rupees(renewalPrice)} a year keeps your profile online: the
                hosting, the short link on your card, the QR, the analytics, and the right to change any of it whenever
                you want.
              </p>
              <p className="reveal">
                If you stop paying, the card is not bricked. The profile pauses until you renew. We will remind you
                before it happens, four times, and you will never find out by having your card fail in front of someone.
              </p>
              <p className="reveal strong">
                You will always see your plan, your activation date, your renewal date and the days left.
              </p>
            </div>
          </div>
        </section>

        {/* faq */}
        <section className="sec faq" id="faq">
          <div className="wrap">
            <p className="kicker reveal">Straight answers</p>
            <h2 className="h2 reveal">Questions people actually ask.</h2>
            <div className="faq-list">
              {FAQ.map(([q, a]) => (
                <details className="reveal" key={q}>
                  <summary>{q}</summary>
                  <p>{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* the one call to action */}
        <section className="sec get" id="get">
          <div className="wrap get-wrap">
            <div className="get-copy">
              <h2 className="h2 reveal">Get your card.</h2>
              <p className="lede reveal">
                Pick a card, wait for it to arrive, build your profile, and start handing it over. From{' '}
                {rupees(cheapest)}.
              </p>

              <ol className="next reveal">
                <li>
                  <span>01</span>
                  <p><strong>Pick your card.</strong> Pay online, and you get a real delivery date.</p>
                </li>
                <li>
                  <span>02</span>
                  <p><strong>Your card arrives.</strong> Printed for your order, with your own link on the chip.</p>
                </li>
                <li>
                  <span>03</span>
                  <p><strong>Build your profile.</strong> Then one tap in your dashboard and the card is live.</p>
                </li>
              </ol>

              <p className="get-alt reveal">
                Would rather just message?{' '}
                <a href={`https://wa.me/${env.whatsapp}`} target="_blank" rel="noopener">
                  Open WhatsApp
                </a>
                .
              </p>
            </div>

            <div className="card reveal">
              <div className="card-head">
                <h3>Start now</h3>
              </div>
              <p className="muted small" style={{ marginBottom: 22 }}>
                You can build your whole profile before you buy anything, and see exactly what people will see when
                they tap.
              </p>
              <div className="stack-sm">
                <Link href="/cards" className="btn btn-accent full">
                  See the cards
                </Link>
                <Link href={user ? '/dashboard' : '/signup'} className="btn btn-ghost full">
                  {user ? 'Go to my dashboard' : 'Create my profile first'}
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="foot">
        <div className="wrap foot-in">
          <div className="foot-brand">
            <Link className="brand" href="/">
              <svg className="brand-mark" viewBox="0 0 32 32" aria-hidden="true">
                <g fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <path d="M13 10a8 8 0 0 1 0 12" />
                  <path d="M18 7a13 13 0 0 1 0 18" />
                </g>
                <circle cx="9.5" cy="16" r="2.2" fill="currentColor" />
              </svg>
              <span className="brand-word">NFCY</span>
            </Link>
            <p>Your digital identity. One tap away.</p>
          </div>

          <div className="foot-cols">
            <div>
              <h4>Cards</h4>
              {products.map((p) => (
                <Link key={p.id} href="/cards">
                  {p.name}, {rupees(p.priceMinor)}
                </Link>
              ))}
            </div>
            <div>
              <h4>Company</h4>
              <a href="#how">How it works</a>
              <a href="#profile">The profile</a>
              <a href="#teams">For teams</a>
              <a href="#renewal">Renewal</a>
              <a href="#faq">FAQ</a>
            </div>
            <div>
              <h4>Talk to us</h4>
              <a href={`https://wa.me/${env.whatsapp}`} target="_blank" rel="noopener">
                WhatsApp
              </a>
              <a href={`tel:+${env.whatsapp}`}>Call us</a>
              <a href={`mailto:${env.supportEmail}`}>{env.supportEmail}</a>
            </div>
            <div>
              <h4>Account</h4>
              <Link href="/login">Sign in</Link>
              <Link href="/signup">Create an account</Link>
              <Link href="/dashboard">Dashboard</Link>
              <Link href="/cards">Buy a card</Link>
            </div>
          </div>
        </div>

        <div className="wrap foot-base">
          <p>
            NFCY is a new brand. The card visuals on this page are renders, and they will be replaced with
            photographs of the real product.
          </p>
          <p className="mono">© {new Date().getFullYear()} NFCY</p>
        </div>
      </footer>
    </>
  );
}

function StepArt({ index }: { index: number }) {
  if (index === 0) {
    return (
      <svg viewBox="0 0 120 90">
        <rect x="8" y="24" width="62" height="40" rx="7" fill="#151A24" stroke="#33405A" />
        <rect x="26" y="16" width="62" height="40" rx="7" fill="#1B2029" stroke="#33405A" />
        <rect x="44" y="8" width="62" height="40" rx="7" fill="#20262F" stroke="#34E0F0" strokeOpacity=".6" />
        <circle cx="96" cy="38" r="3" fill="#34E0F0" />
      </svg>
    );
  }
  if (index === 1) {
    return (
      <svg viewBox="0 0 120 90">
        <rect x="34" y="6" width="52" height="78" rx="9" fill="#151A24" stroke="#33405A" />
        <circle cx="60" cy="26" r="8" fill="#34E0F0" fillOpacity=".28" stroke="#34E0F0" strokeOpacity=".7" />
        <rect x="44" y="42" width="32" height="4" rx="2" fill="#EAF0F6" fillOpacity=".3" />
        <rect x="44" y="51" width="24" height="4" rx="2" fill="#EAF0F6" fillOpacity=".18" />
        <rect x="44" y="60" width="32" height="4" rx="2" fill="#EAF0F6" fillOpacity=".18" />
        <rect x="44" y="69" width="18" height="4" rx="2" fill="#34E0F0" fillOpacity=".7" />
      </svg>
    );
  }
  if (index === 2) {
    return (
      <svg viewBox="0 0 120 90">
        <path d="M18 34 L60 18 L102 34 L102 72 L18 72 Z" fill="#151A24" stroke="#33405A" />
        <path d="M18 34 L60 52 L102 34" fill="none" stroke="#33405A" />
        <rect x="42" y="8" width="36" height="24" rx="5" fill="#20262F" stroke="#34E0F0" strokeOpacity=".6" />
        <circle cx="60" cy="20" r="2.6" fill="#34E0F0" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 120 90">
      <rect x="16" y="24" width="48" height="34" rx="6" fill="#1B2029" stroke="#33405A" transform="rotate(-10 40 41)" />
      <rect x="68" y="10" width="36" height="70" rx="8" fill="#151A24" stroke="#33405A" />
      <g fill="none" stroke="#34E0F0" strokeWidth="2.4" strokeLinecap="round" opacity=".9">
        <path d="M62 36a10 10 0 0 1 0 18" />
        <path d="M56 30a18 18 0 0 1 0 30" />
      </g>
    </svg>
  );
}

function CounterScene() {
  return (
    <svg viewBox="0 0 360 300">
      <defs>
        <linearGradient id="gStandFace2" x1="0" y1="0" x2=".7" y2="1">
          <stop offset="0" stopColor="#242B37" />
          <stop offset="1" stopColor="#0C0F16" />
        </linearGradient>
        <linearGradient id="gDeskTop" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#2A313D" stopOpacity="0" />
          <stop offset=".18" stopColor="#2A313D" />
          <stop offset=".82" stopColor="#2A313D" />
          <stop offset="1" stopColor="#2A313D" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="gDeskFront" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#141922" />
          <stop offset="1" stopColor="#141922" stopOpacity="0" />
        </linearGradient>
      </defs>

      <rect x="0" y="212" width="360" height="4" fill="url(#gDeskTop)" />
      <rect x="14" y="216" width="332" height="62" fill="url(#gDeskFront)" />
      <ellipse cx="180" cy="214" rx="92" ry="8" fill="#000" fillOpacity=".6" />

      <path d="M98 66 L262 66 L272 194 L88 194 Z" fill="url(#gStandFace2)" stroke="#3A4454" strokeWidth="1.4" />
      <path d="M98 66 L262 66" stroke="#525F76" strokeWidth="1.4" />
      <path d="M88 194 L272 194 L284 212 L76 212 Z" fill="#171C26" stroke="#3A4454" strokeWidth="1.2" />

      <text x="180" y="100" textAnchor="middle" fontFamily="var(--display)" fontSize="15" fontWeight="700" letterSpacing="-.2" fill="#EAF0F6" fillOpacity=".92">
        Rate us on Google
      </text>
      <g transform="translate(186,144)" fill="none" stroke="#34E0F0" strokeWidth="3.4" strokeLinecap="round">
        <path d="M0 -15a14 14 0 0 1 0 30" />
        <path d="M10 -26a25 25 0 0 1 0 52" />
      </g>
      <circle cx="177" cy="144" r="4" fill="#34E0F0" />
      <text x="180" y="180" textAnchor="middle" fontFamily="var(--mono)" fontSize="9" letterSpacing="1.9" fill="#34E0F0" fillOpacity=".8">
        TAP OR SCAN
      </text>

      <g transform="translate(292,112) rotate(11)">
        <rect x="0" y="0" width="48" height="92" rx="10" fill="#12161E" stroke="#3A4454" strokeWidth="1.2" />
        <rect x="5" y="6" width="38" height="80" rx="7" fill="#06080C" />
        <g fill="#D9B06A" transform="translate(24,32) scale(.52)">
          <path d="M0 -14l4.2 8.6 9.5 1.4-6.9 6.7 1.6 9.4L0 11.6l-8.4 4.5 1.6-9.4-6.9-6.7 9.5-1.4z" />
        </g>
        <rect x="12" y="50" width="24" height="4" rx="2" fill="#EAF0F6" fillOpacity=".22" />
        <rect x="15" y="60" width="18" height="4" rx="2" fill="#EAF0F6" fillOpacity=".14" />
      </g>
      <g className="counters-wave" stroke="#34E0F0" fill="none" strokeWidth="2" strokeLinecap="round">
        <path d="M262 132a28 28 0 0 1 0 38" opacity=".55" />
        <path d="M274 120a44 44 0 0 1 0 62" opacity=".3" />
      </g>
    </svg>
  );
}

function TeamScene() {
  return (
    <svg viewBox="0 0 300 340">
      <defs>
        <linearGradient id="gNode" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1B212B" />
          <stop offset="1" stopColor="#0B0E14" />
        </linearGradient>
      </defs>

      <g stroke="#34E0F0" strokeOpacity=".3" strokeWidth="1.2" fill="none">
        <path d="M150 62 V92 M74 122 V92 H226 V122" />
        <path d="M74 158 V186 H40 V212 M74 186 H108 V212" />
        <path d="M226 158 V186 H192 V212 M226 186 H260 V212" />
      </g>

      <g className="tnode">
        <rect x="96" y="28" width="108" height="36" rx="9" fill="url(#gNode)" stroke="#34E0F0" strokeOpacity=".45" />
        <text x="150" y="51" textAnchor="middle" fontFamily="var(--display)" fontSize="14" fontWeight="600" fill="#EAF0F6">
          Company
        </text>
      </g>

      <g>
        <rect x="22" y="122" width="104" height="36" rx="9" fill="url(#gNode)" stroke="#33405A" />
        <text x="74" y="145" textAnchor="middle" fontFamily="var(--body)" fontSize="12.5" fill="#96A2B4">Sales</text>
        <rect x="174" y="122" width="104" height="36" rx="9" fill="url(#gNode)" stroke="#33405A" />
        <text x="226" y="145" textAnchor="middle" fontFamily="var(--body)" fontSize="12.5" fill="#96A2B4">Operations</text>
      </g>

      <g>
        {[10, 78, 162, 230].map((x) => (
          <rect key={x} x={x} y="212" width="60" height="40" rx="7" fill="url(#gNode)" stroke="#33405A" />
        ))}
        <g fill="none" stroke="#34E0F0" strokeOpacity=".7" strokeWidth="1.8" strokeLinecap="round">
          {[52, 120, 204, 272].map((x) => (
            <path key={x} d={`M${x} 226a7 7 0 0 1 0 12`} />
          ))}
        </g>
        <g fill="#EAF0F6" fillOpacity=".2">
          {[20, 88, 172, 240].map((x) => (
            <g key={x}>
              <rect x={x} y="224" width="24" height="4" rx="2" />
              <rect x={x} y="234" width="16" height="4" rx="2" />
            </g>
          ))}
        </g>
      </g>

      <text x="150" y="292" textAnchor="middle" fontFamily="var(--mono)" fontSize="9.5" letterSpacing="1.8" fill="#96A2B4">
        COMPANY / TEAMS / CARDS
      </text>
      <text x="150" y="314" textAnchor="middle" fontFamily="var(--body)" fontSize="12" fill="#96A2B4">
        Every card switched on and off from one place.
      </text>
    </svg>
  );
}
