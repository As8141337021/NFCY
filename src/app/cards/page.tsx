import type { Metadata } from 'next';
import Link from 'next/link';
import { db } from '@/lib/db';
import { rupees } from '@/lib/money';
import { currentUser, isStaff } from '@/lib/auth';
import { assetUrl } from '@/lib/storage';
import SiteNav from '@/components/SiteNav';
import { CardArt, CardArtDefs } from '@/components/CardArt';
import AddToCart from './AddToCart';

export const metadata: Metadata = {
  title: 'Choose your card',
  description:
    'Six NFCY cards, from ₹499. Every one of them opens the same digital profile, which you change from your phone whenever you want.',
};
export const dynamic = 'force-dynamic';

export default async function CardsPage() {
  const [products, user, renewal] = await Promise.all([
    db.product.findMany({
      where: { status: { in: ['ACTIVE', 'OUT_OF_STOCK'] }, kind: { not: 'RENEWAL' } },
      orderBy: { position: 'asc' },
      include: { images: { orderBy: { position: 'asc' }, include: { media: true }, take: 1 } },
    }),
    currentUser(),
    db.product.findFirst({ where: { kind: 'RENEWAL' } }),
  ]);

  return (
    <>
      <CardArtDefs />
      <div className="env" aria-hidden="true">
        <div className="env-glow" />
        <div className="env-grain" />
      </div>

      <SiteNav signedIn={Boolean(user)} staff={Boolean(user && isStaff(user.role))} />

      <main id="main" tabIndex={-1}>
        <section className="sec" style={{ paddingTop: 'clamp(110px,15vh,170px)' }}>
          <div className="wrap">
            <p className="kicker">The range</p>
            <h1 className="h2">Choose your card.</h1>
            <p className="lede">
              Every one of them opens the same profile. Pick the one you want to hand over.
            </p>

            <div className="grid-cards">
              {products.map((p) => {
                const photo = p.images[0];
                const features = ((p.features as string[] | null) ?? []).slice(0, 6);
                const featured = p.badge === 'Most popular';
                const premium = p.badge === 'Premium';

                return (
                  <article
                    key={p.id}
                    className={`pcard in done${featured ? ' featured' : ''}${premium ? ' premium' : ''}`}
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
                      <h2 style={{ fontSize: '1.28rem', letterSpacing: '-.022em' }}>{p.name}</h2>
                      <p className="price">
                        <span>{rupees(p.priceMinor)}</span>
                        {p.mrpMinor && p.mrpMinor > p.priceMinor ? (
                          <span
                            className="muted"
                            style={{ fontSize: '1rem', textDecoration: 'line-through', marginLeft: 10, fontWeight: 400 }}
                          >
                            {rupees(p.mrpMinor)}
                          </span>
                        ) : null}
                      </p>
                      {p.tagline ? <p className="pcard-line">{p.tagline}</p> : null}

                      {features.length > 0 && (
                        <ul className="feats">
                          {features.map((f) => (
                            <li key={f}>{f}</li>
                          ))}
                        </ul>
                      )}

                      <div style={{ marginTop: 'auto' }}>
                        <AddToCart
                          productId={p.id}
                          name={p.name}
                          priceMinor={p.priceMinor}
                          inStock={p.status === 'ACTIVE' && (!p.trackStock || p.stock > 0)}
                          needsFinish={p.slug === 'signature-portrait-nfc-card'}
                          label={`Add to cart, ${rupees(p.priceMinor)}`}
                        />
                      </div>
                      {renewal ? (
                        <p className="renew">Renewal {rupees(renewal.priceMinor)}/year after the first year.</p>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>

            {products.length === 0 && (
              <div className="empty" style={{ marginTop: 40 }}>
                <h3>No cards on sale right now</h3>
                <p>The catalogue is empty. If you are the admin, add a product to get the store going.</p>
              </div>
            )}
          </div>
        </section>

        <section className="sec" style={{ paddingTop: 0 }}>
          <div className="wrap">
            <div className="card" style={{ display: 'grid', gap: 16 }}>
              <h2 style={{ fontSize: '1.2rem' }}>Ordering more than ten?</h2>
              <p className="muted" style={{ maxWidth: '58ch' }}>
                Bulk pricing, your company branding on every card, and one dashboard that holds every employee
                profile. Tell us how many and what you need.
              </p>
              <p>
                <Link href="/#teams" className="btn btn-ghost">
                  About bulk orders
                </Link>
              </p>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
