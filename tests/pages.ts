/**
 * Every page, rendered.
 *
 * The API suites proved the logic but never asked a single dashboard or admin
 * page to render, which is how a server to client boundary bug shipped a 500 on
 * the entire dashboard while every API test stayed green. This closes that gap:
 * each route is fetched as the role that should be able to see it, and a 500 is
 * a failure whatever the reason.
 */
import { PrismaClient } from '@prisma/client';
import 'dotenv/config';
import { Client, check, section, summary, uniq } from './harness';

const db = new PrismaClient();

const run = async () => {
  await db.rateLimit.deleteMany({});

  const password = 'TestPass123';
  const email = `${uniq('pg')}@example.com`;
  const username = uniq('pgdemo');
  const customer = new Client('customer');
  const admin = new Client('admin');
  const anon = new Client('anonymous');

  // ============================================================
  section('Setting up a customer with everything on their account');

  {
    const signup = await customer.json('/api/auth/signup', {
      json: { name: 'Test Renderer', email, password },
    });
    check('the test customer exists', signup.ok, signup.error);

    // A profile needs a card behind it. Buying is covered end to end in the
    // commerce suite; here the card is planted so the pages have something to
    // render.
    const me = await db.user.findUnique({ where: { email }, select: { id: true } });
    const product = await db.product.findFirst({ where: { kind: { not: 'RENEWAL' } }, select: { id: true, destinationType: true } });
    await db.nfcCard.create({
      data: {
        code: `P${Date.now().toString(36).toUpperCase()}`.slice(0, 8),
        serial: `CT-PAGE-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
        activationHash: '$2a$10$testtesttesttesttesttesttesttesttesttesttesttesttestte',
        productId: product?.id ?? null,
        userId: me?.id ?? null,
        destinationType: product?.destinationType ?? 'PROFILE',
        status: 'ASSIGNED',
        batch: 'TEST-FIXTURE',
      },
    });

    const prof = await customer.json<{ id: string }>('/api/profile', {
      json: { username, fullName: 'Test Renderer', designation: 'Tester' },
    });
    check('with a profile, once a card is owned', prof.ok, prof.error);

    await customer.json(`/api/profile/${prof.data.id}/items?kind=social`, {
      json: { platform: 'instagram', url: 'instagram.com/test' },
    });
    await customer.json(`/api/profile/${prof.data.id}/publish`, { json: { publish: true } });
    await anon.json(`/api/profile/${prof.data.id}/leads`, {
      json: { name: 'A Visitor', phone: '9812345678', message: 'Hello' },
    });

    const login = await admin.json('/api/auth/login', {
      json: {
        email: process.env.SEED_ADMIN_EMAIL ?? 'admin@nfcy.in',
        password: process.env.SEED_ADMIN_PASSWORD ?? 'ChangeThisNow!2026',
      },
    });
    check('the admin can sign in', login.ok, login.error);
  }

  const anyOrder = await db.order.findFirst({ orderBy: { createdAt: 'desc' }, select: { id: true } });
  const anyProduct = await db.product.findFirst({ select: { id: true } });

  // ============================================================
  section('Public pages');

  const publicPages: Array<[string, string]> = [
    ['/', 'the marketing home'],
    ['/cards', 'the shop'],
    ['/checkout', 'checkout'],
    ['/login', 'sign in'],
    ['/signup', 'sign up'],
    ['/forgot', 'forgot password'],
    ['/reset?token=abc', 'reset password'],
    ['/verify?state=done', 'email confirmed'],
    ['/verify?state=expired', 'expired confirmation link'],
    ['/tap?state=inactive', 'a tap on an unactivated card'],
    ['/tap?state=unknown', 'a tap on an unknown card'],
    [`/${username}`, 'a public profile'],
  ];

  for (const [path, label] of publicPages) {
    const res = await anon.text(path);
    check(`${label} renders`, res.status === 200, { path, status: res.status });
  }

  {
    const missing = await anon.text('/definitely-not-a-real-username');
    check('an unknown profile is a 404, not a crash', missing.status === 404, { status: missing.status });
  }

  // ============================================================
  section('Customer pages');

  const customerPages: Array<[string, string]> = [
    ['/dashboard', 'the dashboard overview'],
    ['/dashboard/profile', 'the profile builder'],
    ['/dashboard/cards', 'my cards'],
    ['/dashboard/analytics', 'analytics'],
    ['/dashboard/leads', 'enquiries'],
    ['/dashboard/orders', 'orders'],
    ['/dashboard/renewal', 'renewal'],
    ['/dashboard/settings', 'settings'],
  ];

  for (const [path, label] of customerPages) {
    const res = await customer.text(path);
    check(`${label} renders`, res.status === 200, { path, status: res.status });
    check(`${label} is not an error page`, !/Application error|Internal Server Error/i.test(res.body), { path });
  }

  {
    // a customer with no profile yet is sent to create one rather than shown a broken page
    const fresh = new Client('fresh');
    await fresh.json('/api/auth/signup', {
      json: { name: 'No Profile Yet', email: `${uniq('np')}@example.com`, password },
    });
    const dash = await fresh.text('/dashboard');
    check('a brand new account gets a working dashboard', dash.status === 200, { status: dash.status });
    check('and is told to create a profile', /Create my profile/.test(dash.body));

    const builder = await fresh.raw('/dashboard/profile');
    check('the builder redirects them to the create step', builder.status === 307 || builder.status === 302, {
      status: builder.status,
    });
  }

  {
    for (const [path] of customerPages) {
      const res = await anon.raw(path);
      check(`a signed out visitor is bounced off ${path}`, res.status === 307 || res.status === 302, {
        path,
        status: res.status,
      });
    }
  }

  // ============================================================
  section('Admin pages');

  const adminPages: Array<[string, string]> = [
    ['/admin', 'the admin overview'],
    ['/admin/orders', 'the order list'],
    ['/admin/orders?filter=needs-card', 'orders needing a card'],
    ['/admin/orders?filter=unpaid', 'unpaid orders'],
    ['/admin/products', 'products'],
    ['/admin/products/new', 'a new product'],
    ['/admin/cards', 'NFC cards'],
    ['/admin/cards?status=UNASSIGNED', 'cards in stock'],
    ['/admin/cards/print', 'the print sheet for the card printer'],
    ['/admin/users', 'customers'],
    ['/admin/profiles', 'profiles'],
    ['/admin/coupons', 'coupons'],
    ['/admin/renewals', 'renewals'],
    ['/admin/notifications', 'messages'],
    ['/admin/audit', 'the audit log'],
  ];

  for (const [path, label] of adminPages) {
    const res = await admin.text(path);
    check(`${label} renders`, res.status === 200, { path, status: res.status });
    check(`${label} is not an error page`, !/Application error|Internal Server Error/i.test(res.body), { path });
  }

  if (anyOrder) {
    const res = await admin.text(`/admin/orders/${anyOrder.id}`);
    check('an order detail page renders', res.status === 200, { status: res.status });
  }
  if (anyProduct) {
    const res = await admin.text(`/admin/products/${anyProduct.id}`);
    check('a product editor renders', res.status === 200, { status: res.status });
  }

  {
    for (const [path] of adminPages.slice(0, 6)) {
      const res = await customer.raw(path);
      check(`a customer is bounced off ${path}`, res.status === 307 || res.status === 302, {
        path,
        status: res.status,
      });
    }
  }

  // ============================================================
  section('Health');

  {
    const res = await anon.json<{ checks: Record<string, { ok: boolean; detail: string }> }>('/api/health');
    check('the health check answers', res.status === 200, { status: res.status });
    check('the database is reachable', res.data.checks?.database?.ok === true, res.data.checks?.database);
    check(
      'the database is UTF8, so the rupee sign is safe',
      res.data.checks?.encoding?.ok === true,
      res.data.checks?.encoding,
    );
    check('the catalogue is seeded', res.data.checks?.catalogue?.ok === true, res.data.checks?.catalogue);
  }

  await db.$disconnect();
  return summary();
};

run()
  .then((code) => process.exit(code))
  .catch(async (e) => {
    console.error('\nThe harness itself blew up:', e);
    await db.$disconnect();
    process.exit(1);
  });
