import { z } from 'zod';

// ============================================================
// PRIMITIVES
// ============================================================

export const trimmed = (max: number) => z.string().trim().max(max);

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'Please enter your email.')
  .max(180)
  .email('That does not look like an email address.');

/** Indian mobile: ten digits starting 6 to 9, with or without the 91 prefix. */
export const phoneSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/[^\d]/g, ''))
  .refine((v) => /^(91)?[6-9]\d{9}$/.test(v), 'Please enter a 10 digit Indian mobile number.')
  .transform((v) => (v.length === 12 ? v.slice(2) : v));

export const passwordSchema = z
  .string()
  .min(8, 'Use at least 8 characters.')
  .max(200, 'That password is too long.')
  .regex(/[a-z]/, 'Include a lowercase letter.')
  .regex(/[A-Z]/, 'Include an uppercase letter.')
  .regex(/[0-9]/, 'Include a number.');

const RESERVED = new Set([
  'admin', 'api', 'dashboard', 'login', 'logout', 'signup', 'register', 'reset',
  'verify', 'account', 'settings', 'checkout', 'cart', 'orders', 'order', 'p',
  't', 'qr', 'card', 'cards', 'profile', 'profiles', 'about', 'contact', 'help',
  'support', 'privacy', 'terms', 'refund', 'shipping', 'cancellation', 'cookies',
  'pricing', 'blog', 'static', '_next', 'favicon', 'robots', 'sitemap', 'assets',
  'media', 'business', 'teams', 'corporate', 'renew', 'activate', 'www', 'app',
  'nfcy', 'null', 'undefined', 'me', 'new', 'edit', 'delete',
]);

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'Usernames need at least 3 characters.')
  .max(30, 'Usernames can be at most 30 characters.')
  .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, 'Use letters, numbers and hyphens only.')
  .refine((v) => !v.includes('--'), 'Two hyphens in a row is not allowed.')
  .refine((v) => !RESERVED.has(v), 'That username is reserved. Try another.');

export const isReservedUsername = (v: string) => RESERVED.has(v.toLowerCase());

/** Only http and https, and never a javascript: or data: URL. */
export const urlSchema = z
  .string()
  .trim()
  .max(500)
  .refine((v) => {
    if (!v) return true;
    try {
      const u = new URL(v.startsWith('http') ? v : `https://${v}`);
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
      return false;
    }
  }, 'Please enter a valid link starting with https://')
  .transform((v) => (v && !v.startsWith('http') ? `https://${v}` : v));

export const optionalUrl = z.union([urlSchema, z.literal('')]).optional().nullable();
export const optionalText = (max: number) => z.string().trim().max(max).optional().nullable();

export const addressSchema = z.object({
  line1: trimmed(160).min(3, 'Please enter the address.'),
  line2: optionalText(160),
  city: trimmed(80).min(2, 'Please enter the city.'),
  state: trimmed(80).min(2, 'Please enter the state.'),
  pincode: z.string().trim().regex(/^[1-9]\d{5}$/, 'Please enter a 6 digit pincode.'),
  country: trimmed(80).default('India'),
});

export type Address = z.infer<typeof addressSchema>;

// ============================================================
// AUTH
// ============================================================

export const signupSchema = z.object({
  name: trimmed(120).min(2, 'Please enter your name.'),
  email: emailSchema,
  phone: phoneSchema.optional(),
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Please enter your password.').max(200),
});

export const forgotSchema = z.object({ email: emailSchema });

export const resetSchema = z.object({
  token: z.string().min(10).max(200),
  password: passwordSchema,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Enter your current password.').max(200),
  password: passwordSchema,
});

// ============================================================
// PROFILE
// ============================================================

export const createProfileSchema = z.object({
  username: usernameSchema,
  fullName: trimmed(120).min(2, 'Please enter the name for this profile.'),
  designation: optionalText(120),
  company: optionalText(120),
});

export const profileSchema = z.object({
  fullName: trimmed(120).min(2, 'Please enter a name.'),
  designation: optionalText(120),
  company: optionalText(120),
  bio: optionalText(1000),
  // A date input hands over a plain YYYY-MM-DD, which is not an ISO datetime.
  // Asking for one was why this field could never actually be saved.
  dateOfBirth: z
    .union([
      z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a real date.')
        .refine((v) => {
          const t = Date.parse(`${v}T00:00:00Z`);
          if (Number.isNaN(t)) return false;
          const year = Number(v.slice(0, 4));
          return year >= 1900 && t <= Date.now();
        }, 'Use a real date that is not in the future.'),
      z.literal(''),
    ])
    .optional()
    .nullable(),
  showBirthday: z.boolean().default(false),

  phone: z.union([phoneSchema, z.literal('')]).optional().nullable(),
  email: z.union([emailSchema, z.literal('')]).optional().nullable(),
  whatsapp: z.union([phoneSchema, z.literal('')]).optional().nullable(),
  whatsappNote: optionalText(200),
  website: optionalUrl,
  address: optionalText(300),
  mapsUrl: optionalUrl,
  upiId: optionalText(120),
  paymentNote: optionalText(200),

  template: trimmed(40).default('corporate'),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Pick a colour.').default('#34E0F0'),
  isPublic: z.boolean().default(true),
  leadFormEnabled: z.boolean().default(true),
  leadFormTitle: trimmed(120).default('Send me a message'),
  metaTitle: optionalText(80),
  metaDescription: optionalText(200),
});

export const reviewRequestSchema = z.object({
  profileId: z.string().uuid(),
  businessId: z.string().uuid(),
  customerName: trimmed(80).min(2, 'Who are you asking?'),
  phone: z.union([phoneSchema, z.literal('')]).optional().nullable(),
  channel: z.enum(['whatsapp', 'sms', 'copied']).default('whatsapp'),
});

export const profileDocumentSchema = z.object({
  title: trimmed(80).min(2, 'Give the file a name people will recognise.'),
  description: optionalText(200),
  fileId: z.string().uuid('Attach a PDF.'),
  active: z.boolean().default(true),
});

export const businessSchema = z.object({
  name: trimmed(140).min(2, 'Please enter the business name.'),
  category: optionalText(80),
  about: optionalText(2000),
  phone: z.union([phoneSchema, z.literal('')]).optional().nullable(),
  whatsapp: z.union([phoneSchema, z.literal('')]).optional().nullable(),
  email: z.union([emailSchema, z.literal('')]).optional().nullable(),
  website: optionalUrl,
  address: optionalText(300),
  mapsUrl: optionalUrl,
  gstNumber: optionalText(20),
  googleReviewUrl: optionalUrl,
  instagramUrl: optionalUrl,
  hours: z
    .array(
      z.object({
        day: z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']),
        open: z.string().regex(/^\d{2}:\d{2}$/),
        close: z.string().regex(/^\d{2}:\d{2}$/),
        closed: z.boolean().default(false),
      }),
    )
    .max(7)
    .optional()
    .nullable(),
  // Opening hours are a choice, not a requirement. A consultant has none worth
  // showing; a salon lives by them.
  showHours: z.boolean().default(false),
  isPrimary: z.boolean().default(false),
  active: z.boolean().default(true),
});

/**
 * A networking body the person belongs to: BNI, Rotary, JCI, a chamber of
 * commerce, a trade association.
 */
export const affiliationSchema = z.object({
  name: trimmed(120).min(2, 'Which organisation is it?'),
  role: optionalText(80),
  chapter: optionalText(80),
  url: optionalUrl,
  logoId: z.string().uuid().optional().nullable(),
});

export const SOCIAL_PLATFORMS = [
  'instagram', 'facebook', 'linkedin', 'youtube', 'x', 'snapchat',
  'telegram', 'pinterest', 'threads', 'whatsapp', 'website', 'custom',
] as const;

export const socialLinkSchema = z.object({
  platform: z.enum(SOCIAL_PLATFORMS),
  label: optionalText(40),
  url: urlSchema,
});

export const profileProductSchema = z.object({
  name: trimmed(140).min(1, 'Please name this product.'),
  description: optionalText(1000),
  priceMinor: z.number().int().min(0).max(100_000_000).optional().nullable(),
  url: optionalUrl,
  buttonLabel: trimmed(30).default('Buy now'),
  imageId: z.string().uuid().optional().nullable(),
  active: z.boolean().default(true),
});

export const profileServiceSchema = z.object({
  name: trimmed(140).min(1, 'Please name this service.'),
  description: optionalText(1000),
  priceMinor: z.number().int().min(0).max(100_000_000).optional().nullable(),
  durationMin: z.number().int().min(0).max(10_000).optional().nullable(),
  bookingUrl: optionalUrl,
  buttonLabel: trimmed(30).default('Book now'),
  imageId: z.string().uuid().optional().nullable(),
  active: z.boolean().default(true),
});

export const galleryItemSchema = z.object({
  kind: z.enum(['image', 'video']).default('image'),
  caption: optionalText(200),
  mediaId: z.string().uuid().optional().nullable(),
  videoUrl: optionalUrl,
});

export const reorderSchema = z.object({ ids: z.array(z.string().uuid()).max(200) });

// ============================================================
// LEADS
// ============================================================

export const leadSchema = z
  .object({
    name: trimmed(120).min(2, 'Please enter your name.'),
    phone: z.union([phoneSchema, z.literal('')]).optional().nullable(),
    email: z.union([emailSchema, z.literal('')]).optional().nullable(),
    message: optionalText(2000),
    // A honeypot. Real people never fill this because they cannot see it.
    // It accepts anything on purpose: rejecting it here would tell the bot it
    // was spotted. The route drops the submission quietly instead.
    website: z.string().max(300).optional(),
  })
  .refine((v) => Boolean(v.phone || v.email), {
    message: 'Please give a phone number or an email so they can reply.',
    path: ['phone'],
  });

export const leadStatusSchema = z.object({
  status: z.enum(['NEW', 'CONTACTED', 'CONVERTED', 'CLOSED']),
  note: optionalText(1000),
});

// ============================================================
// STORE
// ============================================================

export const cartItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().min(1).max(2000),
  customization: z
    .object({
      name: optionalText(60),
      designation: optionalText(60),
      logoMediaId: z.string().uuid().optional().nullable(),
      // the buyer's own photograph, for a card printed with their face on it
      photoMediaId: z.string().uuid().optional().nullable(),
      colour: optionalText(30),
      finish: optionalText(30),
      customText: optionalText(120),
    })
    .optional()
    .nullable(),
});

/** The artwork a printed card needs, set after the order is paid for. */
export const orderArtworkSchema = z.object({
  orderItemId: z.string().uuid(),
  photoMediaId: z.string().uuid(),
});

export const checkoutSchema = z.object({
  items: z.array(cartItemSchema).min(1, 'Your cart is empty.').max(50),
  customerName: trimmed(120).min(2, 'Please enter your name.'),
  customerEmail: emailSchema,
  customerPhone: phoneSchema,
  companyName: optionalText(140),
  gstNumber: z
    .union([
      z.string().trim().regex(/^\d{2}[A-Z]{5}\d{4}[A-Z]\d[Z][A-Z\d]$/, 'That GST number does not look right.'),
      z.literal(''),
    ])
    .optional()
    .nullable(),
  billingAddress: addressSchema,
  shippingAddress: addressSchema,
  couponCode: optionalText(40),
  notes: optionalText(500),
  idempotencyKey: z.string().uuid(),
});

export const verifyPaymentSchema = z.object({
  razorpay_order_id: z.string().min(4).max(120),
  razorpay_payment_id: z.string().min(4).max(120),
  razorpay_signature: z.string().min(10).max(300),
});

// ============================================================
// NFC
// ============================================================

/**
 * Two ways in.
 *
 * A card bought on this platform is minted against the buyer's account at
 * payment, so there is no code to print and none to type: being signed in as
 * its owner is the proof. A card sold through a shop belongs to nobody yet,
 * so it carries a printed serial and activation code instead.
 */
export const activateCardSchema = z.object({
  serial: z.string().trim().toUpperCase().min(6).max(24),
  activationCode: z.string().trim().toUpperCase().min(4).max(12).optional(),
  profileId: z.string().uuid(),
});

export const cardDestinationSchema = z.object({
  destinationType: z.enum(['PROFILE', 'GOOGLE_REVIEW', 'INSTAGRAM', 'CUSTOM_URL']),
  destinationUrl: optionalUrl,
  profileId: z.string().uuid().optional().nullable(),
});

// ============================================================
// ADMIN
// ============================================================

export const adminProductSchema = z.object({
  name: trimmed(140).min(2),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9-]+$/).max(80),
  sku: z.string().trim().toUpperCase().max(40),
  kind: z.enum(['CARD', 'STAND', 'RENEWAL']),
  tagline: optionalText(200),
  description: optionalText(3000),
  status: z.enum(['ACTIVE', 'DRAFT', 'OUT_OF_STOCK', 'HIDDEN', 'ARCHIVED']),
  priceMinor: z.number().int().min(0).max(100_000_000),
  mrpMinor: z.number().int().min(0).max(100_000_000).optional().nullable(),
  taxPercent: z.number().int().min(0).max(28),
  stock: z.number().int().min(0).max(1_000_000),
  trackStock: z.boolean(),
  badge: optionalText(30),
  position: z.number().int().min(0).max(999),
  destinationType: z.enum(['PROFILE', 'GOOGLE_REVIEW', 'INSTAGRAM', 'CUSTOM_URL']),
  features: z.array(trimmed(120)).max(20),
});

export const adminOrderStatusSchema = z.object({
  status: z.enum([
    'PAYMENT_PENDING', 'PAYMENT_RECEIVED', 'PROFILE_PENDING', 'PROFILE_COMPLETED',
    'DESIGN_PROCESSING', 'MANUFACTURING', 'DISPATCHED', 'DELIVERED', 'ACTIVATED', 'CANCELLED',
  ]),
  note: optionalText(500),
});

export const shipmentSchema = z.object({
  courier: trimmed(80).min(2, 'Which courier?'),
  awb: trimmed(60).min(3, 'Enter the tracking number.'),
  trackingUrl: optionalUrl,
  estimatedDelivery: z.string().datetime().optional().nullable(),
  status: z.enum(['PENDING', 'DISPATCHED', 'IN_TRANSIT', 'DELIVERED', 'RETURNED']).default('DISPATCHED'),
});

export const generateCardsSchema = z.object({
  productId: z.string().uuid(),
  count: z.number().int().min(1).max(1000),
  batch: optionalText(60),
});

export const assignCardSchema = z.object({
  cardId: z.string().uuid(),
  orderItemId: z.string().uuid(),
});

export const couponSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,40}$/, 'Letters, numbers, dashes.'),
  type: z.enum(['PERCENT', 'FIXED']),
  value: z.number().int().min(1).max(100_000_000),
  minOrderMinor: z.number().int().min(0).max(100_000_000).default(0),
  maxDiscountMinor: z.number().int().min(0).max(100_000_000).optional().nullable(),
  firstOrderOnly: z.boolean().default(false),
  minQuantity: z.number().int().min(1).max(10_000).default(1),
  usageLimit: z.number().int().min(1).max(1_000_000).optional().nullable(),
  perUserLimit: z.number().int().min(1).max(1000).optional().nullable(),
  startsAt: z.string().datetime().optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
  active: z.boolean().default(true),
  productIds: z.array(z.string().uuid()).max(50).default([]),
});

export const adminUserSchema = z.object({
  role: z.enum(['CUSTOMER', 'SALES', 'MANUFACTURING', 'SUPPORT', 'OPERATIONS', 'ADMIN', 'SUPER_ADMIN']).optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'DELETED']).optional(),
});

// ============================================================
// ANALYTICS
// ============================================================

export const trackSchema = z.object({
  profileId: z.string().uuid(),
  type: z.enum([
    'CLICK_WHATSAPP', 'CLICK_CALL', 'CLICK_EMAIL', 'CLICK_WEBSITE', 'CLICK_SOCIAL',
    'CLICK_MAPS', 'CLICK_PRODUCT', 'CLICK_SERVICE', 'CLICK_UPI', 'SAVE_CONTACT',
  ]),
  label: optionalText(80),
  source: optionalText(20),
});
