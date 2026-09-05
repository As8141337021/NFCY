/**
 * Seeds the catalogue and the first admin.
 * Safe to run more than once: everything upserts, and prices are only written
 * on first create so an admin's later price edit is never overwritten.
 */
import { PrismaClient, type ProductKind, type CardDestinationType } from '@prisma/client';
import bcrypt from 'bcryptjs';
import 'dotenv/config';

const db = new PrismaClient();

type Seed = {
  slug: string;
  sku: string;
  name: string;
  kind: ProductKind;
  tagline: string;
  description: string;
  priceMinor: number;
  mrpMinor?: number;
  badge?: string;
  position: number;
  destinationType: CardDestinationType;
  features: string[];
};

const PRODUCTS: Seed[] = [
  {
    slug: 'classic-nfc-card',
    sku: 'CT-CLASSIC',
    name: 'Classic NFC Card',
    kind: 'CARD',
    tagline: 'The everyday card. Full digital profile, QR on the back, share your contact in one tap.',
    description:
      'A smart business card for professionals, freelancers, sales teams and small businesses. Tap it on any phone and your NFCY profile opens. Nothing to install on either side.',
    priceMinor: 49900,
    position: 1,
    destinationType: 'PROFILE',
    features: [
      'NFC chip and QR backup',
      'Full digital profile',
      'Save contact in one tap',
      'WhatsApp, socials, website',
      'Google Maps directions',
      'Tap and click analytics',
      'Edit your profile any time',
      'No app needed by the person you meet',
    ],
  },
  {
    slug: 'black-matte-gold-nfc-card',
    sku: 'CT-MATTE-GOLD',
    name: 'Black Matte Gold NFC Card',
    kind: 'CARD',
    tagline: 'Matte black with gold detail. The one people turn over in their hand before they hand it back.',
    description:
      'A premium professional card in a matte black finish with gold styled branding. Everything the Classic does, plus products, services and a gallery on your profile.',
    priceMinor: 69900,
    badge: 'Most popular',
    position: 2,
    destinationType: 'PROFILE',
    features: [
      'Matte black finish, gold detail',
      'NFC chip and QR backup',
      'Products and services on your profile',
      'Photo gallery',
      'WhatsApp, socials, website, maps',
      'Tap and click analytics',
      'Edit your profile any time',
      'No app needed by the person you meet',
    ],
  },
  {
    slug: 'signature-portrait-nfc-card',
    sku: 'CT-PORTRAIT',
    name: 'Signature Portrait NFC Card',
    kind: 'CARD',
    tagline: 'Your own face on it, in black or silver matte. The card nobody has to be told whose it is.',
    description:
      'A matte card printed with your photograph, in black or silver. Made for a founder, a director or anyone who hands a card to people who will meet a hundred others that week. You choose the finish when you order and upload the photograph afterwards, from your dashboard.',
    priceMinor: 99900,
    badge: 'Personalised',
    position: 3,
    destinationType: 'PROFILE',
    features: [
      'Your photograph printed on the card',
      'Black matte or silver matte',
      'NFC chip and QR backup',
      'Everything on the Black Matte Gold profile',
      'Upload or change your photo before it is printed',
      'Edit your profile any time',
      'No app needed by the person you meet',
    ],
  },
  {
    slug: 'premium-metal-nfc-card',
    sku: 'CT-METAL',
    name: 'Premium Metal NFC Card',
    kind: 'CARD',
    tagline: 'Machined metal, real weight. Laser finish, premium profile design, lead capture built in.',
    description:
      'For founders, directors and business owners. A solid metal card with a laser finish, premium profile templates, a verified badge and lead capture on your profile.',
    priceMinor: 239900,
    badge: 'Premium',
    position: 4,
    destinationType: 'PROFILE',
    features: [
      'Solid metal build',
      'Laser finished, NFC and QR',
      'Premium profile designs',
      'Products, services and gallery',
      'Enquiry form and lead capture',
      'Full analytics',
      'Priority support',
      'Edit your profile any time',
    ],
  },
  {
    slug: 'google-review-card',
    sku: 'CT-REVIEW-CARD',
    name: 'Google Review Card',
    kind: 'CARD',
    tagline: 'Sits at your counter. Customers tap and land on your Google review page. No searching, no typing.',
    description:
      'For restaurants, salons, clinics, hotels, retail and any business with a counter. A customer taps and lands straight on your real Google review page. You change where it points whenever you want.',
    priceMinor: 69900,
    position: 5,
    destinationType: 'GOOGLE_REVIEW',
    features: [
      'Taps straight to your review page',
      'QR backup for every phone',
      'Your logo and branding',
      'Change the destination any time',
      'Scan and tap counts',
      'Built for counters and desks',
    ],
  },
  {
    slug: 'google-review-stand',
    sku: 'CT-REVIEW-STAND',
    name: 'Google Review Stand',
    kind: 'STAND',
    tagline: 'The tabletop version. Restaurant tables, reception desks, salon counters.',
    description:
      'A weighted tabletop stand carrying the same NFC and QR as the review card, sized to sit on a table or counter and stay put.',
    priceMinor: 89900,
    position: 6,
    destinationType: 'GOOGLE_REVIEW',
    features: [
      'Weighted tabletop stand',
      'NFC and QR on one face',
      'Your logo and branding',
      'Change the destination any time',
      'Scan and tap counts',
      'Sits upright, stays put',
    ],
  },
  {
    slug: 'instagram-nfc-card',
    sku: 'CT-INSTAGRAM',
    name: 'Instagram NFC Card',
    kind: 'CARD',
    tagline: 'One tap opens your Instagram. Change which profile it points at whenever you want.',
    description:
      'For creators, shops and anyone who grows on Instagram. Tap and the phone opens your Instagram profile. Repoint it at a different handle any time from your dashboard.',
    priceMinor: 69900,
    position: 7,
    destinationType: 'INSTAGRAM',
    features: [
      'Taps straight to your Instagram',
      'QR backup for every phone',
      'Your handle and branding',
      'Repoint it any time',
      'Tap and scan counts',
      'Built for creators and shops',
    ],
  },
  {
    slug: 'annual-renewal',
    sku: 'CT-RENEWAL',
    name: 'Profile renewal, one year',
    kind: 'RENEWAL',
    tagline: 'Keeps your profile online for another year.',
    description:
      'Hosting, your short link, your QR, your analytics, and the right to change any of it whenever you want. The card itself is yours and is never bricked.',
    priceMinor: 29900,
    position: 100,
    destinationType: 'PROFILE',
    features: [
      'Profile stays online',
      'Your link and QR keep working',
      'Analytics kept and continued',
      'Unlimited edits',
    ],
  },
];

async function main() {
  console.log('Seeding NFCY...\n');

  // ---- catalogue ----
  for (const p of PRODUCTS) {
    const existing = await db.product.findUnique({ where: { slug: p.slug } });
    if (existing) {
      // Never touch price, mrp, stock or status: the admin owns those.
      await db.product.update({
        where: { slug: p.slug },
        data: {
          name: p.name,
          sku: p.sku,
          kind: p.kind,
          tagline: p.tagline,
          description: p.description,
          badge: p.badge ?? null,
          position: p.position,
          destinationType: p.destinationType,
          features: p.features,
        },
      });
      console.log(`  kept  ${p.name} at the admin's price`);
    } else {
      await db.product.create({
        data: {
          slug: p.slug,
          sku: p.sku,
          name: p.name,
          kind: p.kind,
          tagline: p.tagline,
          description: p.description,
          status: 'ACTIVE',
          priceMinor: p.priceMinor,
          mrpMinor: p.mrpMinor ?? null,
          taxPercent: 18,
          stock: 0,
          trackStock: false,
          badge: p.badge ?? null,
          position: p.position,
          destinationType: p.destinationType,
          features: p.features,
        },
      });
      console.log(`  new   ${p.name}  ₹${(p.priceMinor / 100).toFixed(0)}`);
    }
  }

  // ---- first admin ----
  const email = (process.env.SEED_ADMIN_EMAIL ?? 'admin@nfcy.in').toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeThisNow!2026';
  const name = process.env.SEED_ADMIN_NAME ?? 'NFCY Admin';

  const admin = await db.user.upsert({
    where: { email },
    create: {
      email,
      name,
      role: 'SUPER_ADMIN',
      passwordHash: await bcrypt.hash(password, 12),
      emailVerified: new Date(),
    },
    update: { role: 'SUPER_ADMIN' },
  });
  console.log(`\n  admin ${admin.email}`);
  if (password === 'ChangeThisNow!2026') {
    console.log('  WARNING: still using the default admin password. Change SEED_ADMIN_PASSWORD.');
  }

  // ---- settings the admin can edit later ----
  const settings: Array<[string, unknown]> = [
    ['shipping.flatRateMinor', 0],
    ['shipping.freeAboveMinor', 0],
    ['renewal.priceMinor', 29900],
    ['renewal.reminderDays', [30, 15, 7, 1]],
    ['store.currency', 'INR'],
  ];
  for (const [key, value] of settings) {
    await db.setting.upsert({
      where: { key },
      create: { key, value: value as never },
      update: {},
    });
  }
  console.log(`  settings ${settings.length} keys\n`);

  const counts = {
    products: await db.product.count(),
    users: await db.user.count(),
  };
  console.log(`Done. ${counts.products} products, ${counts.users} users.`);
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
