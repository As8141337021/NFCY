# NFCY

The marketing site, the customer dashboard, the public profiles, the NFC
redirects, the shop and the admin panel, in one Next.js application backed by
one PostgreSQL database.

One domain does everything:

| Address | What it is |
|---|---|
| `nfcy.in` | the marketing site |
| `nfcy.in/rahulsharma` | a customer's public profile |
| `nfcy.in/t/ABX92831` | what the NFC chip actually stores |
| `nfcy.in/cards` | the shop |
| `nfcy.in/dashboard` | the customer's own area, including the profile builder |
| `nfcy.in/admin` | orders, cards, products, customers, revenue |

---

## How the NFC part works

The chip stores **one short URL and nothing else**: `nfcy.in/t/<code>`.

Everything about where that goes lives in the database. So a customer can change
their phone number, swap which Instagram account the card opens, or point a
Google Review card at a new listing, and every card they have ever handed out
follows along. No card is ever reprogrammed and no card is ever reprinted.

A card is made blank, assigned to an order, and only becomes live when the
customer activates it with a code that ships alongside. That code is stored as a
bcrypt hash, so nobody, us included, can read it back out of the database.

---

## Running it locally

You need Node 20 or newer. You do **not** need to install PostgreSQL: the dev
database runs from a real Postgres binary that ships with a package.

```bash
npm install
cp .env.example .env          # then fill in AUTH_SECRET, see below
npm run pg:start              # leave this running in its own terminal
npm run db:push               # create the tables
npm run db:seed               # the six products, the renewal, and your admin
npm run dev
```

Generate the one secret you cannot leave empty:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Then open http://localhost:3000. Sign in to the admin panel with the
`SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` from your `.env`.

**Change that password before anything is public.** The seed prints a warning
while it is still the default.

### One thing worth knowing about the dev database

`npm run pg:start` forces the cluster to UTF8. Without that, `initdb` inherits
the Windows system locale and creates a WIN1252 database, which cannot store the
rupee sign at all. Every price, every Indian language name and every message
containing ₹ would fail to save. The script refuses to start on a non-UTF8
cluster, and `/api/health` reports the encoding in production too.

If you ever see that error, stop the database, delete `.pgdata`, and start again.

### Do not run `next build` while `next dev` is running

They share the `.next` folder. A build mid-session leaves the dev server serving
404s for its own chunks, which looks like a broken app. Stop dev first, or delete
`.next` afterwards.

---

## Environment variables

Everything is read in `src/lib/env.ts` and nowhere else, so a missing value
fails loudly instead of silently deep inside a request.

### Required

| Name | What it does |
|---|---|
| `DATABASE_URL` | PostgreSQL. `npm run pg:start` prints the local one. |
| `AUTH_SECRET` | 32+ random bytes. Signs sessions and the daily analytics salt. |
| `NEXT_PUBLIC_APP_URL` | The public origin. Profile links, QR codes and NFC redirects are built from it. |

### Payments

| Name | What it does |
|---|---|
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Test keys work with no KYC. |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | The same key id, for the browser checkout widget. |
| `RAZORPAY_WEBHOOK_SECRET` | You choose this when adding the webhook. |

Without these the shop still works: orders are created and saved, and the
customer is told plainly that payment is not switched on yet. Nothing pretends
to have been paid.

### Optional

| Name | What happens without it |
|---|---|
| `SMTP_*`, `MAIL_FROM` | Messages queue in the database and are visible under Admin → Messages. Nothing is lost and nothing is faked. |
| `STORAGE_DRIVER` | Defaults to `db`, which keeps uploads in Postgres and works anywhere. Set `s3` plus the `S3_*` values to use a bucket. |
| `CRON_SECRET` | Renewal reminders do not run. The endpoint refuses to work at all rather than running unprotected. |

---

## Database migrations

`prisma/migrations/0_init` is the baseline: the whole schema as one migration,
with the existing dev database marked as already having it. A production
database is created with

```
npm run db:deploy   # prisma migrate deploy
npm run db:seed     # products, settings, one SUPER_ADMIN
```

The seed creates **no** orders, payments, cards, customers or analytics, so a
fresh deployment opens with every number at zero. Those numbers follow the
database, not the domain: point production at a new Postgres rather than at a
development one, or development data arrives with it.

After changing `schema.prisma`, generate a migration with `npm run db:migrate`
rather than `prisma db push`, so production has something to apply.

---

## Going live on Vercel

1. **Database.** Create a Postgres on [Neon](https://neon.tech) or Supabase.
   Both are UTF8 by default. Copy the connection string.
2. **Import the repo into Vercel** and add every variable above.
   `NEXT_PUBLIC_APP_URL` must be the real domain, with no trailing slash.
3. **Create the tables.** From your machine, with the production `DATABASE_URL`
   in the environment:
   ```bash
   npx prisma migrate deploy   # or: npx prisma db push
   npm run db:seed
   ```
4. **Check it.** Open `https://your-domain/api/health`. It reports whether the
   database is reachable, whether the encoding is safe, whether the catalogue is
   seeded, and which optional services are wired up.
5. **Razorpay webhook.** In the Razorpay dashboard add a webhook pointing at
   `https://your-domain/api/payment/webhook`, with the secret you put in
   `RAZORPAY_WEBHOOK_SECRET`, subscribed to `payment.captured`,
   `payment.failed` and `refund.processed`.
6. **Cron.** `vercel.json` already schedules the daily renewal run at 04:00.
   It will not do anything until `CRON_SECRET` is set.
7. **Change the admin password**, and delete the seeded admin if you made a real
   one.

---

## How money is handled

This is the part worth reading carefully.

- **Prices are never sent by the browser.** The cart posts product ids and
  quantities. Every rupee is recomputed on the server from the database, by one
  function (`priceCart`), used both for the displayed total and for the charge,
  so the two cannot drift apart.
- **An order is never marked paid from the frontend.** The browser's return trip
  is a convenience. Before anything is marked paid, the signature is verified
  AND Razorpay is asked directly what happened to that payment, and the amount
  is compared with the order.
- **The webhook is the authority.** It verifies an HMAC over the raw request
  body, records every event id so a replay changes nothing, and always answers
  200 once the signature is good so the gateway stops retrying.
- **Checkout is idempotent.** Each attempt carries a key, and the same key always
  returns the same order. A double click, a refresh mid payment or a retried
  request cannot create a second order or a second charge.
- **Displayed prices include GST.** The tax is split back out for the invoice.
- **Stock only moves when money actually arrives**, not when an order is created.

---

## What a customer can put on a profile

The builder at `/dashboard/profile` has a tab per subject. Everything on it is
saved to the database and rendered on the public page; nothing is decorative.

**Businesses.** Up to five per profile. One is the main business and appears at
the top of the page with its logo, category, description, address and GST
number. The rest appear under "Also runs", each expandable to its own WhatsApp,
call, directions, website and opening hours. The first business added becomes
the main one automatically; deleting the main one promotes the next.

**Opening hours are optional and off by default**, per business. A shop or a
salon wants them, a consultant does not. The seven day rows only appear once the
switch is on, and each day can be marked closed independently.

**Networking organisations.** BNI, Rotary, JCI, a chamber of commerce, a trade
association: name, your role, your chapter, a link, and the organisation's logo.
These render as a "Member of" row, which is often the fastest way for a visitor
to place someone. Ten common Indian bodies are one tap away; any other can be
typed.

**QR code.** Generated automatically the moment a profile exists. There is
nothing to press. It encodes the profile URL rather than the profile content, so
it keeps working forever and never has to be reprinted when the content changes.
The QR tab offers PNG at 512/1024/2048 px and an SVG for print.

**Date of birth.** Optional, on the Basics tab, and private by default. The
switch beside it stays locked until a date is entered. When it is on, the
profile shows the **day and month only** — the year is somebody's age, which is
not what a business card is for — while the saved contact carries the full date
as a vCard `BDAY`, so the other person's phone puts the reminder on the right
day.

The year never reaches the browser at all. The public page renders through a
client component, so anything left on the view object is readable in the page
source whether or not it is drawn; `redactForPublic` in `src/lib/profile.ts`
strips the raw date and passes only the formatted "14 March". Dates are stored
as a SQL `DATE` and formatted from the `YYYY-MM-DD` string by hand, so no
timezone can shift the day.

**Accent colour.** The colour chosen in the Design tab drives the whole public
page, buttons included. The text on top of it is picked by luminance, so a
button stays readable whatever colour someone chooses.

A profile is a `DRAFT` until it is published. A draft link resolves, but shows a
"not live yet" page rather than the content — which is the usual reason someone
reports that their information "is not showing". The Publish button sits in the
builder header, and the dashboard overview says plainly when a profile is still
a draft.

---

## Printing the QR on a card

The card is manufactured long before anyone buys it, so there is no profile to
make a QR of. That is why the QR must encode the **card's own short code**, not
a profile URL:

```
nfcy.in/t/RMVNSE4U      <- what the chip stores, and what the QR encodes
```

That code exists the moment a batch is generated. Tapping and scanning land in
the same place, and when the customer activates the card the same code starts
resolving to their profile. A card is never reprinted, and a customer who
changes their username does not invalidate the print run.

Never print a QR of `nfcy.in/<username>` on a card. That URL does not exist at
print time and it changes if the customer renames themselves.

**How to actually print one:** make a batch on `/admin/cards`, then open
`/admin/cards/print`. Each tile is one card: its QR, the serial to print beside
it, and the encoded URL so a proof can be checked by eye. Print the page, or
save it as a PDF for the card printer. Each QR also downloads on its own as SVG
from `/api/admin/cards/<id>/qr`, which is what a printer will ask for — a card
QR is usually printed at 12 to 16 mm, and vector stays sharp at any size.

The QR in a customer's own dashboard is a different thing: it encodes their
profile URL, for a poster or a shop window they print themselves.

---

## Getting into the admin panel

The admin panel is at `/admin`. There is no separate admin login: staff sign in
at `/login` like everyone else and are redirected to `/admin` instead of
`/dashboard` because of their role.

`npm run seed` creates one `SUPER_ADMIN` from these variables, and updates the
role if the account already exists:

```
SEED_ADMIN_EMAIL="admin@nfcy.in"
SEED_ADMIN_PASSWORD="ChangeThisNow!2026"
SEED_ADMIN_NAME="NFCY Admin"
```

Change `SEED_ADMIN_PASSWORD` before deploying anywhere real; the seed prints a
warning while the default is still in use. Further staff are promoted from
`/admin/users` by someone who already holds a higher role.

---

## Roles

| Role | Can do |
|---|---|
| `CUSTOMER` | their own profile, cards, orders, enquiries, renewal |
| `SALES` | view orders and analytics |
| `MANUFACTURING` | view orders, manage cards, mark shipments |
| `SUPPORT` | view orders, users and profiles |
| `OPERATIONS` | the above plus updating orders and profiles |
| `ADMIN` | the above plus products, coupons, users, the audit log |
| `SUPER_ADMIN` | everything, including settings |

Permissions are checked on the server for every action. Nothing is inferred from
what the interface happens to render. Nobody can grant a role at or above their
own, and suspending an account signs it out everywhere immediately.

---

## Privacy

Analytics are deliberately coarse and no raw IP address is ever stored. A repeat
visitor is a salted daily hash, which stops meaning anything the next day. Bots
and link previews are excluded from view counts. A customer can take their
profile out of search results while keeping the link working.

Deleting an account removes profiles, links, enquiries and analytics, switches
off any live cards, and detaches orders and invoices rather than destroying them,
because those are financial records.

---

## Tests

The dev server must be running.

```bash
npm test              # all three suites
npm run test:profile  # accounts, profiles, publishing, QR, vCard, enquiries, analytics
npm run test:commerce # catalogue, cart, orders, the payment webhook, cards, activation, renewals
npm run test:pages    # every page rendered as the role that should see it
```

They run against the real HTTP API with a real cookie jar, so what passes is
what a browser gets. The commerce suite exercises the webhook signature check
and the replay guard for real.

`test:pages` exists because an earlier bug returned 500 on the entire dashboard
while every API test stayed green: a server component was passing icon functions
to a client component, which React cannot serialise. Rendering every route
catches that whole class of problem.

---

## Layout

```
prisma/schema.prisma     the data model
prisma/seed.ts           six products, the renewal, the first admin
scripts/devdb.ts         a real Postgres for development, forced to UTF8
src/lib/                 env, db, auth, validation, pricing, orders, razorpay,
                         analytics, storage, qr, vcard, notifications, audit
src/app/                 pages and API routes
src/components/          shared UI, the profile renderer, the hero
tests/                   the three suites and their harness
```

Money is always an integer number of paise. Never a float, never a string, never
a value that came from a browser.
