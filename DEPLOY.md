# Deploying NFCY

Everything in the codebase is ready. What is left needs accounts, and accounts
need you: I will not sign up to services or enter credentials on your behalf.

Two things to create, then one command.

---

## 1. A production database

Vercel does not include Postgres. Use any hosted Postgres; the free tiers are
enough to launch on.

- **Neon** — neon.tech, free tier, connects to Vercel in a few clicks
- **Supabase** — supabase.com, free tier
- **Railway** — railway.app

Create a project, choose a region near your customers (**Mumbai / ap-south-1**
if offered — every page load talks to the database, so distance is latency),
and copy the connection string. It looks like:

```
postgresql://user:password@host.region.provider.tech/dbname?sslmode=require
```

**Use a new, empty database.** The numbers in the admin panel follow the
database, not the domain: point production at your development one and
development data arrives with it.

## 2. A Vercel account

vercel.com, sign up with GitHub or email. The Hobby plan is free and enough to
start; note it is for non-commercial use, so move to Pro before you take real
money.

---

## 3. Deploy

From `contap-app`:

```
npx vercel login      # opens your browser
npx vercel link       # creates the project
```

Then add the environment variables. Every one of these is required except where
noted:

| Variable | Value |
|---|---|
| `DATABASE_URL` | the connection string from step 1 |
| `AUTH_SECRET` | `ITR5B6DDNHnnRUPo6XrxBh4uRgRYgRNhAU9SkwTaRmQ` |
| `CRON_SECRET` | `K8zC35gzk7ZiPu1fgM1w8xgUYVggt1Se` |
| `NEXT_PUBLIC_APP_URL` | `https://nfcy.in` (or the vercel.app URL until the domain is live) |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | your support address |
| `NEXT_PUBLIC_WHATSAPP` | `8141337021` |
| `SEED_ADMIN_EMAIL` | `admin@nfcy.in` |
| `SEED_ADMIN_PASSWORD` | **change this from the development one** |
| `SEED_ADMIN_NAME` | `NFCY Admin` |
| `RAZORPAY_KEY_ID` | from the Razorpay dashboard |
| `RAZORPAY_KEY_SECRET` | from the Razorpay dashboard |
| `RAZORPAY_WEBHOOK_SECRET` | you choose it, then paste the same value into Razorpay |
| `STORAGE_DRIVER` | `db` to start with, see the note below |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASSWORD` / `MAIL_FROM` | optional; without them, messages queue in the admin panel instead of sending |

The two secrets above were generated for this deployment and are not used
anywhere else. Add them either in the Vercel dashboard under Settings →
Environment Variables, or:

```
npx vercel env add AUTH_SECRET production
```

Then:

```
npx vercel --prod
```

The build runs `prisma migrate deploy`, so the database schema is created on the
first deploy. Nothing else to run by hand.

## 4. Seed the catalogue

Once, against the production database:

```
npx dotenv -e .env.production -- npm run db:seed
```

or set `DATABASE_URL` in your shell to the production string and run
`npm run db:seed`. It creates the 8 products, the settings and one
`SUPER_ADMIN`. It creates **no** orders, customers or cards, so the admin panel
opens on genuine zeros.

## 5. Razorpay webhook

In the Razorpay dashboard, add a webhook:

- URL: `https://nfcy.in/api/payment/webhook`
- Secret: the same `RAZORPAY_WEBHOOK_SECRET` you set above
- Events: `payment.captured`, `payment.failed`, `order.paid`

Payment is confirmed by this webhook and its signature, never by the browser
saying so. Until it is wired up, orders can be placed but never become paid.

## 6. The domain

Add `nfcy.in` in Vercel under Settings → Domains and point the nameservers or
the A/CNAME records at Vercel as it instructs.

Then set `NEXT_PUBLIC_APP_URL` to `https://nfcy.in` and redeploy. This matters
more than it looks: every QR code, every vCard and every card redirect is built
from that value, so a card printed while it says `vercel.app` will point at
`vercel.app` forever.

**Set the real domain before you print a single card.**

---

## After the first deploy, check

- `https://nfcy.in/api/health` — reports the database, encoding, catalogue,
  payments, webhook, email, storage and cron individually
- Sign in at `/login` with the seeded admin and confirm you land on `/admin`
- Place a ₹499 order end to end with Razorpay in test mode, and confirm the card
  is minted with its own code and QR

## A note on file storage

`STORAGE_DRIVER=db` keeps uploaded images and PDFs as bytes in Postgres. That
works on any host with no extra account, and it is the right way to start.

It stops being right when the catalogues get big: a free Postgres tier is
around 0.5GB, and a dozen 10MB brochures will fill it. When that day comes,
switch `STORAGE_DRIVER` to `s3` and add the bucket credentials; existing rows
keep working, because each asset records which driver stored it.
