import 'server-only';
import type { Prisma } from '@prisma/client';
import { db } from './db';
import { assetUrl } from './storage';

export const profileInclude = {
  photo: true,
  cover: true,
  businesses: { where: { active: true }, orderBy: { position: 'asc' }, include: { logo: true } },
  affiliations: { orderBy: { position: 'asc' }, include: { logo: true } },
  socialLinks: { orderBy: { position: 'asc' } },
  products: { where: { active: true }, orderBy: { position: 'asc' }, include: { image: true } },
  services: { where: { active: true }, orderBy: { position: 'asc' }, include: { image: true } },
  gallery: { orderBy: { position: 'asc' }, include: { media: true } },
  documents: { orderBy: { position: 'asc' }, include: { file: true } },
} satisfies Prisma.ProfileInclude;

export const editorInclude = {
  ...profileInclude,
  businesses: { orderBy: { position: 'asc' }, include: { logo: true } },
  products: { orderBy: { position: 'asc' }, include: { image: true } },
  services: { orderBy: { position: 'asc' }, include: { image: true } },
} satisfies Prisma.ProfileInclude;

export type FullProfile = Prisma.ProfileGetPayload<{ include: typeof editorInclude }>;

export type Hours = Array<{ day: string; open: string; close: string; closed: boolean }>;

export type BusinessView = {
  id: string;
  name: string;
  category: string | null;
  about: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  mapsUrl: string | null;
  gstNumber: string | null;
  logoId: string | null;
  logoUrl: string | null;
  hours: Hours | null;
  showHours: boolean;
  googleReviewUrl: string | null;
  instagramUrl: string | null;
  isPrimary: boolean;
  active: boolean;
};

export type AffiliationView = {
  id: string;
  name: string;
  role: string | null;
  chapter: string | null;
  url: string | null;
  logoId: string | null;
  logoUrl: string | null;
};

/** The shape both the live preview and the public page render from. */
export type ProfileView = {
  id: string;
  username: string;
  status: string;
  template: string;
  accentColor: string;
  isPublic: boolean;
  verified: boolean;
  fullName: string;
  designation: string | null;
  company: string | null;
  bio: string | null;
  /** A plain YYYY-MM-DD. Kept as a string so no timezone can shift the day. */
  dateOfBirth: string | null;
  showBirthday: boolean;
  /** "14 March", already formatted. The only form the public page ever gets. */
  birthday: string | null;
  photoUrl: string | null;
  coverUrl: string | null;
  phone: string | null;
  email: string | null;
  whatsapp: string | null;
  whatsappNote: string | null;
  website: string | null;
  address: string | null;
  mapsUrl: string | null;
  upiId: string | null;
  paymentNote: string | null;
  leadFormEnabled: boolean;
  leadFormTitle: string;
  metaTitle: string | null;
  metaDescription: string | null;
  businesses: BusinessView[];
  affiliations: AffiliationView[];
  socials: Array<{ id: string; platform: string; label: string | null; url: string }>;
  products: Array<{
    id: string; name: string; description: string | null; priceMinor: number | null;
    url: string | null; buttonLabel: string; imageId: string | null; imageUrl: string | null; active: boolean;
  }>;
  services: Array<{
    id: string; name: string; description: string | null; priceMinor: number | null;
    durationMin: number | null; bookingUrl: string | null; buttonLabel: string;
    imageId: string | null; imageUrl: string | null; active: boolean;
  }>;
  gallery: Array<{ id: string; kind: string; caption: string | null; mediaId: string | null; url: string | null; videoUrl: string | null }>;
  documents: Array<{
    id: string; title: string; description: string | null; fileId: string;
    url: string; sizeLabel: string; downloads: number; active: boolean;
  }>;
};

/** Business hours are stored as JSON, so they get checked before they are trusted. */
function parseHours(raw: unknown): Hours | null {
  if (!Array.isArray(raw)) return null;
  const out: Hours = [];
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue;
    const o = r as Record<string, unknown>;
    if (typeof o.day !== 'string') continue;
    out.push({
      day: o.day,
      open: typeof o.open === 'string' ? o.open : '09:00',
      close: typeof o.close === 'string' ? o.close : '18:00',
      closed: Boolean(o.closed),
    });
  }
  return out.length ? out : null;
}

export function toView(p: FullProfile): ProfileView {
  return {
    id: p.id,
    username: p.username,
    status: p.status,
    template: p.template,
    accentColor: p.accentColor,
    isPublic: p.isPublic,
    verified: p.verified,
    fullName: p.fullName,
    designation: p.designation,
    company: p.company,
    bio: p.bio,
    dateOfBirth: p.dateOfBirth ? p.dateOfBirth.toISOString().slice(0, 10) : null,
    showBirthday: p.showBirthday,
    birthday: p.dateOfBirth ? birthdayLabel(p.dateOfBirth.toISOString().slice(0, 10)) : null,
    photoUrl: p.photo ? assetUrl(p.photo.id, p.photo.externalUrl) : null,
    coverUrl: p.cover ? assetUrl(p.cover.id, p.cover.externalUrl) : null,
    phone: p.phone,
    email: p.email,
    whatsapp: p.whatsapp,
    whatsappNote: p.whatsappNote,
    website: p.website,
    address: p.address,
    mapsUrl: p.mapsUrl,
    upiId: p.upiId,
    paymentNote: p.paymentNote,
    leadFormEnabled: p.leadFormEnabled,
    leadFormTitle: p.leadFormTitle,
    metaTitle: p.metaTitle,
    metaDescription: p.metaDescription,
    businesses: p.businesses.map((b) => ({
      id: b.id,
      name: b.name,
      category: b.category,
      about: b.about,
      phone: b.phone,
      whatsapp: b.whatsapp,
      email: b.email,
      website: b.website,
      address: b.address,
      mapsUrl: b.mapsUrl,
      gstNumber: b.gstNumber,
      logoId: b.logoId,
      logoUrl: b.logo ? assetUrl(b.logo.id, b.logo.externalUrl) : null,
      hours: parseHours(b.hours),
      showHours: b.showHours,
      googleReviewUrl: b.googleReviewUrl,
      instagramUrl: b.instagramUrl,
      isPrimary: b.isPrimary,
      active: b.active,
    })),
    affiliations: p.affiliations.map((a) => ({
      id: a.id,
      name: a.name,
      role: a.role,
      chapter: a.chapter,
      url: a.url,
      logoId: a.logoId,
      logoUrl: a.logo ? assetUrl(a.logo.id, a.logo.externalUrl) : null,
    })),
    socials: p.socialLinks.map((s) => ({ id: s.id, platform: s.platform, label: s.label, url: s.url })),
    products: p.products.map((x) => ({
      id: x.id, name: x.name, description: x.description, priceMinor: x.priceMinor,
      url: x.url, buttonLabel: x.buttonLabel, imageId: x.imageId,
      imageUrl: x.image ? assetUrl(x.image.id, x.image.externalUrl) : null,
      active: x.active,
    })),
    services: p.services.map((x) => ({
      id: x.id, name: x.name, description: x.description, priceMinor: x.priceMinor,
      durationMin: x.durationMin, bookingUrl: x.bookingUrl, buttonLabel: x.buttonLabel,
      imageId: x.imageId,
      imageUrl: x.image ? assetUrl(x.image.id, x.image.externalUrl) : null,
      active: x.active,
    })),
    gallery: p.gallery.map((g) => ({
      id: g.id, kind: g.kind, caption: g.caption, mediaId: g.mediaId,
      url: g.media ? assetUrl(g.media.id, g.media.externalUrl) : null,
      videoUrl: g.videoUrl,
    })),
    documents: p.documents.map((d) => ({
      id: d.id, title: d.title, description: d.description, fileId: d.fileId,
      url: assetUrl(d.file.id, d.file.externalUrl),
      sizeLabel: fileSize(d.file.bytes),
      downloads: d.downloads,
      active: d.active,
    })),
  };
}

/** "1.4 MB", so somebody on mobile data knows what they are about to open. */
function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

/** The business a visitor meets first: the one marked primary, else the first. */
export function primaryBusiness(p: ProfileView): BusinessView | null {
  return p.businesses.find((b) => b.isPrimary && b.active) ?? p.businesses.find((b) => b.active) ?? null;
}

// ============================================================
// COMPLETION
// ============================================================

export type CompletionStep = { key: string; label: string; done: boolean; href: string };

/**
 * What is still missing, in the order it is worth doing.
 * Drives both the progress bar and the list of next actions.
 */
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * Day and month only. The year is somebody's age, which is not what a business
 * card is for. Formatted straight from the YYYY-MM-DD string rather than through
 * Date, so no timezone can move it a day.
 */
export function birthdayLabel(iso: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const month = MONTH_NAMES[Number(m[2]) - 1];
  return month ? `${Number(m[3])} ${month}` : null;
}

/**
 * What a stranger is allowed to receive.
 *
 * The public page renders through a client component, so every field left on
 * this object is readable in the page source whether or not it is drawn. A
 * birthday that is switched off has to be absent, not merely unrendered, and
 * even a shared one goes out as "14 March" with the year stripped.
 */
export function redactForPublic(v: ProfileView): ProfileView {
  return {
    ...v,
    dateOfBirth: null,
    birthday: v.showBirthday ? v.birthday : null,
  };
}

export function completion(p: FullProfile): { percent: number; steps: CompletionStep[] } {
  const anyBusiness = p.businesses.some((b) => b.name.trim().length > 0);
  const anyMaps = Boolean(p.mapsUrl) || p.businesses.some((b) => Boolean(b.mapsUrl));

  const steps: CompletionStep[] = [
    { key: 'photo', label: 'Add a profile photo', done: Boolean(p.photoId), href: '/dashboard/profile?tab=basics' },
    { key: 'designation', label: 'Add your designation', done: Boolean(p.designation), href: '/dashboard/profile?tab=basics' },
    { key: 'bio', label: 'Write a short bio', done: Boolean(p.bio && p.bio.length > 20), href: '/dashboard/profile?tab=basics' },
    { key: 'phone', label: 'Add a phone number', done: Boolean(p.phone), href: '/dashboard/profile?tab=contact' },
    { key: 'whatsapp', label: 'Add your WhatsApp number', done: Boolean(p.whatsapp), href: '/dashboard/profile?tab=contact' },
    { key: 'socials', label: 'Add your social links', done: p.socialLinks.length > 0, href: '/dashboard/profile?tab=socials' },
    { key: 'business', label: 'Add your business details', done: anyBusiness, href: '/dashboard/profile?tab=business' },
    { key: 'maps', label: 'Add a Google Maps location', done: anyMaps, href: '/dashboard/profile?tab=contact' },
    { key: 'items', label: 'Add a product or a service', done: p.products.length + p.services.length > 0, href: '/dashboard/profile?tab=products' },
    { key: 'cover', label: 'Add a cover image', done: Boolean(p.coverId), href: '/dashboard/profile?tab=basics' },
    { key: 'publish', label: 'Publish your profile', done: p.status === 'PUBLISHED', href: '/dashboard/profile' },
  ];

  const done = steps.filter((s) => s.done).length;
  return { percent: Math.round((done / steps.length) * 100), steps };
}

// ============================================================
// USERNAMES
// ============================================================

export async function usernameTaken(username: string): Promise<boolean> {
  const found = await db.profile.findUnique({ where: { username }, select: { id: true } });
  return Boolean(found);
}

/** Three suggestions that are actually free, derived from what they typed. */
export async function suggestUsernames(base: string, limit = 3): Promise<string[]> {
  const clean = base.toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/^-+|-+$/g, '').slice(0, 24) || 'user';
  const year = new Date().getFullYear();
  const candidates = [
    `${clean}1`,
    `${clean}${String(Math.floor(Math.random() * 90) + 10)}`,
    `the${clean}`,
    `${clean}official`,
    `${clean}${year}`,
    `${clean}in`,
    `${clean}hq`,
  ];

  const free: string[] = [];
  for (const c of candidates) {
    if (free.length >= limit) break;
    if (c.length > 30) continue;
    if (!(await usernameTaken(c))) free.push(c);
  }
  return free;
}

export async function slugifyToFreeUsername(name: string): Promise<string> {
  const base =
    name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '')
      .slice(0, 24) || 'user';
  if (!(await usernameTaken(base))) return base;
  const [first] = await suggestUsernames(base, 1);
  return first ?? `${base}${Date.now().toString(36).slice(-4)}`;
}
