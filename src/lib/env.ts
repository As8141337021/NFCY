/**
 * Every environment variable is read here and nowhere else, so a missing one
 * fails loudly at the edge instead of silently deep inside a request.
 */

function required(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === '') {
    throw new Error(
      `Missing required environment variable ${name}. Copy .env.example to .env and fill it in.`,
    );
  }
  return v;
}

function optional(name: string, fallback = ''): string {
  return process.env[name]?.trim() || fallback;
}

export const env = {
  get databaseUrl() {
    return required('DATABASE_URL');
  },
  get authSecret() {
    const s = required('AUTH_SECRET');
    if (s.length < 32) throw new Error('AUTH_SECRET must be at least 32 characters.');
    return s;
  },
  get appUrl() {
    return optional('NEXT_PUBLIC_APP_URL', 'http://localhost:3000').replace(/\/+$/, '');
  },

  razorpay: {
    get keyId() {
      return optional('RAZORPAY_KEY_ID');
    },
    get keySecret() {
      return optional('RAZORPAY_KEY_SECRET');
    },
    get webhookSecret() {
      return optional('RAZORPAY_WEBHOOK_SECRET');
    },
    get configured() {
      return Boolean(optional('RAZORPAY_KEY_ID') && optional('RAZORPAY_KEY_SECRET'));
    },
  },

  storage: {
    get driver() {
      return optional('STORAGE_DRIVER', 'db') as 'db' | 's3';
    },
    get s3() {
      return {
        endpoint: optional('S3_ENDPOINT'),
        region: optional('S3_REGION'),
        bucket: optional('S3_BUCKET'),
        accessKeyId: optional('S3_ACCESS_KEY_ID'),
        secretAccessKey: optional('S3_SECRET_ACCESS_KEY'),
        publicBaseUrl: optional('S3_PUBLIC_BASE_URL'),
      };
    },
  },

  mail: {
    get configured() {
      return Boolean(optional('SMTP_HOST') && optional('SMTP_USER'));
    },
    get host() {
      return optional('SMTP_HOST');
    },
    get port() {
      return Number(optional('SMTP_PORT', '587'));
    },
    get user() {
      return optional('SMTP_USER');
    },
    get password() {
      return optional('SMTP_PASSWORD');
    },
    get from() {
      return optional('MAIL_FROM', 'NFCY <hello@nfcy.in>');
    },
  },

  seed: {
    get adminEmail() {
      return optional('SEED_ADMIN_EMAIL', 'admin@nfcy.in');
    },
    get adminPassword() {
      return optional('SEED_ADMIN_PASSWORD', 'ChangeThisNow!2026');
    },
    get adminName() {
      return optional('SEED_ADMIN_NAME', 'NFCY Admin');
    },
  },

  get cronSecret() {
    return optional('CRON_SECRET');
  },

  get whatsapp() {
    return optional('NEXT_PUBLIC_WHATSAPP', '918141337021');
  },
  get supportEmail() {
    return optional('NEXT_PUBLIC_SUPPORT_EMAIL', 'hello@nfcy.in');
  },

  get isProd() {
    return process.env.NODE_ENV === 'production';
  },
};
