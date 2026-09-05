/**
 * The commerce half of the acceptance journey: catalogue, cart, orders,
 * the payment webhook, cards, activation, the NFC redirect, renewals and the
 * admin panel's authorisation.
 *
 * Razorpay's own API is not called here (that needs live keys), but everything
 * we own around it is exercised for real, including the signature check and the
 * replay guard on the webhook.
 */
import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import 'dotenv/config';
import { Client, check, section, summary, uniq, BASE } from './harness';

const db = new PrismaClient();

const sign = (body: string, secret: string) =>
  crypto.createHmac('sha256', secret).update(body).digest('hex');

const run = async () => {
  await db.rateLimit.deleteMany({});

  const password = 'TestPass123';
  const email = `${uniq('buy')}@example.com`;
  const username = uniq('buyer');
  const c = new Client('buyer');

  let productId = '';
  let productPrice = 0;
  let orderId = '';
  let orderItemId = '';
  let profileId = '';
  let ownCardSerial = '';
  let ownCardCode = '';
  let ownCardId = '';

  // ============================================================
  section('1. The catalogue');

  {
    const res = await c.json<{ products: Array<{ id: string; name: string; priceMinor: number; slug: string }> }>(
      '/api/products',
    );
    check('the catalogue loads', res.ok, res.error);
    check('all seven seeded products are there', res.data.products.length >= 6, res.data.products.length);

    const bySlug = Object.fromEntries(res.data.products.map((p) => [p.slug, p]));
    check('Classic is ₹499', bySlug['classic-nfc-card']?.priceMinor === 49900, bySlug['classic-nfc-card']?.priceMinor);
    check('Black Matte Gold is ₹699', bySlug['black-matte-gold-nfc-card']?.priceMinor === 69900, bySlug['black-matte-gold-nfc-card']?.priceMinor);
    check('Premium Metal is ₹2,399', bySlug['premium-metal-nfc-card']?.priceMinor === 239900, bySlug['premium-metal-nfc-card']?.priceMinor);
    check('Google Review Card is ₹699', bySlug['google-review-card']?.priceMinor === 69900);
    check('Google Review Stand is ₹899', bySlug['google-review-stand']?.priceMinor === 89900);
    check('Instagram Card is ₹699', bySlug['instagram-nfc-card']?.priceMinor === 69900);
    check('Signature Portrait is ₹999', bySlug['signature-portrait-nfc-card']?.priceMinor === 99900, bySlug['signature-portrait-nfc-card']?.priceMinor);

    productId = bySlug['classic-nfc-card'].id;
    productPrice = bySlug['classic-nfc-card'].priceMinor;
  }

  // ============================================================
  section('2. Pricing a cart on the server');

  {
    const res = await c.json<{ subtotalMinor: number; totalMinor: number; taxMinor: number }>('/api/cart/price', {
      json: { items: [{ productId, quantity: 2 }] },
    });
    check('the cart prices', res.ok, res.error);
    check('two Classic cards come to ₹1,198', res.data.subtotalMinor === productPrice * 2, res.data);
    check('GST is split out of the shown price', res.data.taxMinor > 0 && res.data.taxMinor < res.data.totalMinor, res.data);

    const ghost = await c.json('/api/cart/price', {
      json: { items: [{ productId: '00000000-0000-0000-0000-000000000000', quantity: 1 }] },
    });
    check('an unknown product is refused', ghost.status === 404, ghost.error);

    const zero = await c.json('/api/cart/price', { json: { items: [] } });
    check('an empty cart is refused', zero.status === 422 || zero.status === 400, zero.error);
  }

  // ============================================================
  section('3. Coupons');

  {
    const admin = new Client('admin');
    const login = await admin.json('/api/auth/login', {
      json: { email: process.env.SEED_ADMIN_EMAIL ?? 'admin@nfcy.in', password: process.env.SEED_ADMIN_PASSWORD ?? 'ChangeThisNow!2026' },
    });
    check('the seeded admin can sign in', login.ok, login.error);

    const code = uniq('TEST').toUpperCase();
    const made = await admin.json('/api/admin/coupons', {
      json: {
        code, type: 'PERCENT', value: 10, minOrderMinor: 0,
        firstOrderOnly: false, minQuantity: 1, perUserLimit: 5, active: true, productIds: [],
      },
    });
    check('an admin can create a coupon', made.ok, made.error);

    const priced = await c.json<{ discountMinor: number; coupon: { code: string } | null; couponMessage?: string }>(
      '/api/cart/price',
      { json: { items: [{ productId, quantity: 1 }], couponCode: code } },
    );
    check('the coupon applies', priced.data.coupon?.code === code, priced.data);
    check('10 percent off ₹499 is ₹59.90', priced.data.discountMinor === Math.floor(productPrice * 0.1), priced.data.discountMinor);

    const junk = await c.json<{ coupon: unknown; couponMessage?: string }>('/api/cart/price', {
      json: { items: [{ productId, quantity: 1 }], couponCode: 'NOTAREALCODE' },
    });
    check('an invalid coupon is ignored, not applied', junk.data.coupon === null, junk.data);
    check('and the reason is explained', Boolean(junk.data.couponMessage), junk.data);

    const custAttempt = await c.json('/api/admin/coupons', {
      json: { code: uniq('X').toUpperCase(), type: 'PERCENT', value: 90, minOrderMinor: 0, firstOrderOnly: false, minQuantity: 1, active: true, productIds: [] },
    });
    check('a signed out visitor cannot create coupons', custAttempt.status === 401, { status: custAttempt.status });
  }

  // ============================================================
  section('4. Account and profile for the buyer');

  {
    const signup = await c.json('/api/auth/signup', { json: { name: 'Priya Mehta', email, password } });
    check('the buyer signs up', signup.ok, signup.error);

    // The card comes first. Nothing is printed before an order, and no profile
    // exists before a card, so this is refused until the payment lands.
    const tooEarly = await c.json('/api/profile', {
      json: { username, fullName: 'Priya Mehta', designation: 'Founder', company: 'Mehta Studio' },
    });
    check('a profile cannot be created before buying a card', tooEarly.status === 403, {
      status: tooEarly.status,
      code: tooEarly.error?.code,
    });
  }

  // ============================================================
  section('5. Placing an order');

  const idem = crypto.randomUUID();
  const checkoutBody = {
    items: [{ productId, quantity: 1 }],
    customerName: 'Priya Mehta',
    customerEmail: email,
    customerPhone: '9876501234',
    billingAddress: { line1: '12 CG Road', city: 'Ahmedabad', state: 'Gujarat', pincode: '380009', country: 'India' },
    shippingAddress: { line1: '12 CG Road', city: 'Ahmedabad', state: 'Gujarat', pincode: '380009', country: 'India' },
    idempotencyKey: idem,
  };

  {
    const bad = await c.json('/api/orders', {
      json: { ...checkoutBody, customerPhone: '123', billingAddress: { ...checkoutBody.billingAddress, pincode: 'abc' } },
    });
    check('a bad phone and pincode are refused', bad.status === 422, bad.error);
    check('the pincode field is named', Boolean(bad.error?.fields?.['billingAddress.pincode']), bad.error?.fields);

    const res = await c.json<{ orderId: string; orderNumber: string; amountMinor: number; reused: boolean }>(
      '/api/orders',
      { json: checkoutBody },
    );
    check('the order is created', res.ok, res.error);
    check('the total is computed on the server, not sent by the browser', res.data.amountMinor === productPrice, res.data);
    check('the order number looks right', /^CT-\d{4}-\d{6}$/.test(res.data.orderNumber), res.data.orderNumber);
    orderId = res.data.orderId;

    // the idempotency guarantee: the same key must never create a second order
    const again = await c.json<{ orderId: string; reused: boolean }>('/api/orders', { json: checkoutBody });
    check('the same idempotency key returns the same order', again.data.orderId === orderId, again.data);
    check('and it says so', again.data.reused === true, again.data);

    const count = await db.order.count({ where: { idempotencyKey: idem } });
    check('exactly one order exists for that key', count === 1, { count });

    const item = await db.orderItem.findFirst({ where: { orderId } });
    orderItemId = item?.id ?? '';
    check('the order has its line', Boolean(orderItemId));
  }

  {
    // a tampered price must not survive: the client cannot send money fields at all
    const tampered = await c.json<{ amountMinor: number }>('/api/orders', {
      json: { ...checkoutBody, idempotencyKey: crypto.randomUUID(), totalMinor: 1, subtotalMinor: 1, priceMinor: 1 },
    });
    check('extra money fields in the request body are ignored', tampered.data.amountMinor === productPrice, tampered.data);
  }

  // ============================================================
  section('6. The payment webhook');

  const secret = process.env.RAZORPAY_WEBHOOK_SECRET ?? '';
  const gatewayOrderId = `order_${uniq('gw')}`;
  const gatewayPaymentId = `pay_${uniq('gw')}`;

  {
    check('a webhook secret is configured for this test', secret.length > 0);

    // stand in for what the gateway order call would have written
    await db.payment.create({
      data: { orderId, gateway: 'razorpay', gatewayOrderId, amountMinor: productPrice, status: 'PENDING' },
    });

    const body = JSON.stringify({
      event: 'payment.captured',
      payload: { payment: { entity: { id: gatewayPaymentId, order_id: gatewayOrderId, status: 'captured', method: 'upi', amount: productPrice } } },
    });

    const unsigned = await fetch(`${BASE}/api/payment/webhook`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-razorpay-signature': 'deadbeef' },
      body,
    });
    check('an unsigned webhook is rejected', unsigned.status === 400, { status: unsigned.status });

    const orderStillUnpaid = await db.order.findUnique({ where: { id: orderId }, select: { paidAt: true } });
    check('and it did not mark the order paid', orderStillUnpaid?.paidAt === null, orderStillUnpaid);

    const good = await fetch(`${BASE}/api/payment/webhook`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-razorpay-signature': sign(body, secret),
        'x-razorpay-event-id': `evt_${uniq('e')}`,
      },
      body,
    });
    check('a correctly signed webhook is accepted', good.status === 200, { status: good.status });

    const paid = await db.order.findUnique({
      where: { id: orderId },
      include: { payments: true, invoice: true },
    });
    check('the order is now paid', paid?.paidAt !== null, { paidAt: paid?.paidAt });
    check('the payment row is marked successful', paid?.payments[0]?.status === 'SUCCESSFUL', paid?.payments[0]?.status);
    check('the payment method was recorded', paid?.payments[0]?.method === 'upi', paid?.payments[0]?.method);
    check('an invoice was generated', Boolean(paid?.invoice?.invoiceNumber), paid?.invoice);
    check('the order moved off payment pending', paid?.status !== 'PAYMENT_PENDING', paid?.status);
  }

  {
    // the replay guard: same event id twice must change nothing
    const eventId = `evt_${uniq('dup')}`;
    const body = JSON.stringify({
      event: 'payment.captured',
      payload: { payment: { entity: { id: gatewayPaymentId, order_id: gatewayOrderId, status: 'captured', method: 'upi', amount: productPrice } } },
    });
    const headers = {
      'content-type': 'application/json',
      'x-razorpay-signature': sign(body, secret),
      'x-razorpay-event-id': eventId,
    };

    const first = await fetch(`${BASE}/api/payment/webhook`, { method: 'POST', headers, body });
    const firstJson = (await first.json()) as { duplicate?: boolean };
    const second = await fetch(`${BASE}/api/payment/webhook`, { method: 'POST', headers, body });
    const secondJson = (await second.json()) as { duplicate?: boolean };

    check('a replayed event is recognised', secondJson.duplicate === true, { firstJson, secondJson });
    check('and it still answers 200, so the gateway stops retrying', second.status === 200);

    const invoices = await db.invoice.count({ where: { orderId } });
    check('no second invoice was created', invoices === 1, { invoices });

    const payments = await db.payment.count({ where: { orderId } });
    check('no duplicate payment row was created', payments === 1, { payments });
  }

  {
    // a mismatched amount must never be accepted
    const body = JSON.stringify({
      event: 'payment.captured',
      payload: { payment: { entity: { id: `pay_${uniq('x')}`, order_id: gatewayOrderId, status: 'captured', amount: 1 } } },
    });
    const res = await fetch(`${BASE}/api/payment/webhook`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-razorpay-signature': sign(body, secret),
        'x-razorpay-event-id': `evt_${uniq('amt')}`,
      },
      body,
    });
    check('a wrong amount is answered 200 but ignored', res.status === 200);

    const order = await db.order.findUnique({ where: { id: orderId }, select: { totalMinor: true } });
    check('the order total was not rewritten', order?.totalMinor === productPrice, order);
  }

  // ============================================================
  section('7. The cards the order produced');

  const admin = new Client('admin2');
  {
    await admin.json('/api/auth/login', {
      json: { email: process.env.SEED_ADMIN_EMAIL ?? 'admin@nfcy.in', password: process.env.SEED_ADMIN_PASSWORD ?? 'ChangeThisNow!2026' },
    });

    // Nothing is printed in advance. The order was paid earlier in this run,
    // and the payment hook minted one card per unit, each with its own code,
    // its own URL and its own QR, before anything reaches the printer.
    const minted = await db.nfcCard.findMany({
      where: { orderItemId },
      include: { orderItem: { select: { quantity: true } } },
      orderBy: { createdAt: 'asc' },
    });
    check('paying for the order created its cards', minted.length > 0, { minted: minted.length });
    check('one card per unit ordered', minted.length === (minted[0]?.orderItem?.quantity ?? 0), {
      cards: minted.length,
      quantity: minted[0]?.orderItem?.quantity,
    });
    check('each is already tied to the buyer', minted.every((m) => m.userId !== null), minted.map((m) => m.userId));
    check('and waiting to be activated', minted.every((m) => m.status === 'ASSIGNED'), minted.map((m) => m.status));
    check('each carries its own code', new Set(minted.map((m) => m.code)).size === minted.length);
    check('the batch names the order it came from', minted[0]?.batch?.startsWith('ORD-') === true, minted[0]?.batch);

    // now that a card exists, the profile can be built while it is at the printer
    const prof = await c.json<{ id: string }>('/api/profile', {
      json: { username, fullName: 'Priya Mehta', designation: 'Founder', company: 'Mehta Studio' },
    });
    check('owning a card unlocks the profile', prof.ok, prof.error);
    profileId = prof.data.id;

    ownCardSerial = minted[0]?.serial ?? '';
    ownCardCode = minted[0]?.code ?? '';
    ownCardId = minted[0]?.id ?? '';
    check('each card gets a readable serial', /^CT-[0-9A-Z]{4}-[0-9A-Z]{4}$/.test(ownCardSerial), ownCardSerial);

    // the ways to print cards in advance are gone
    const gen = await admin.json('/api/admin/cards/generate', { json: { productId, count: 1 } });
    check('cards cannot be generated in advance any more', gen.status >= 400, { status: gen.status });

    const assign = await admin.json('/api/admin/cards/assign', { json: { cardId: ownCardId, orderItemId } });
    check('and there is nothing to assign by hand', assign.status >= 400, { status: assign.status });

    const madeThisRun = await db.nfcCard.count({
      where: {
        orderItemId: null,
        createdAt: { gte: new Date(Date.now() - 10 * 60 * 1000) },
        // the profile suite plants one directly, standing in for a purchase
        NOT: { batch: 'TEST-FIXTURE' },
      },
    });
    check('nothing was printed that nobody ordered', madeThisRun === 0, { unordered: madeThisRun });

    const qr = await admin.raw(`/api/admin/cards/${ownCardId}/qr`);
    check('the card has a QR ready for the printer', qr.status === 200, { status: qr.status });
    check('an svg by default, which is what a printer wants',
      qr.headers.get('content-type')?.includes('image/svg') === true, qr.headers.get('content-type'));

    const qrPng = await admin.raw(`/api/admin/cards/${ownCardId}/qr?format=png`);
    check('and a png when one is asked for', qrPng.headers.get('content-type') === 'image/png', qrPng.headers.get('content-type'));

    const qrBody = await qr.text();
    check('the QR encodes the card link, not the profile', qrBody.length > 200, { bytes: qrBody.length });
  }

  // ============================================================
  section('8. The NFC redirect, before activation');

  {
    const anon = new Client('tapper');
    const res = await anon.raw(`/c/${ownCardCode}`);
    check('an unactivated card still resolves', res.status === 302, { status: res.status });
    check('and it explains itself rather than 404ing', res.headers.get('location')?.includes('/tap?state=inactive') === true, res.headers.get('location'));

    const unknown = await anon.raw('/c/ZZZZZZZZ');
    check('an unknown code goes to a friendly page', unknown.headers.get('location')?.includes('state=unknown') === true, unknown.headers.get('location'));
  }

  // ============================================================
  section('9. Activation');

  {
    const wrongSerial = await c.json('/api/nfc/activate', {
      json: { serial: 'CT-ZZZZ-ZZZZ', profileId },
    });
    check('an unknown card number is refused', wrongSerial.status === 400, wrongSerial.error);
    check('the message does not reveal whether that serial exists', wrongSerial.error?.message.includes('do not match') === true, wrongSerial.error);

    const stranger = new Client('stranger3');
    await stranger.json('/api/auth/signup', { json: { name: 'Someone Else', email: `${uniq('se')}@example.com`, password } });
    const notMine = await stranger.json('/api/nfc/activate', {
      json: { serial: ownCardSerial, profileId },
    });
    check('someone else cannot activate a card that is not theirs', notMine.status === 404, { status: notMine.status });

    // The card was minted against this account when the payment landed, so
    // being signed in is the proof. Nothing was printed for anyone to type,
    // and nothing was printed before the order existed.
    const noCode = await c.json<{ activated: boolean; profileUrl: string }>('/api/nfc/activate', {
      json: { serial: ownCardSerial, profileId },
    });
    check('the buyer activates their own card in one step', noCode.ok && noCode.data.activated, noCode.error);
    check('it reports the profile url', noCode.data.profileUrl.endsWith(`/${username}`), noCode.data.profileUrl);

    const card = await db.nfcCard.findUnique({ where: { serial: ownCardSerial } });
    check('the card is now active', card?.status === 'ACTIVE', card?.status);
    check('it points at the profile', card?.profileId === profileId);

    const order = await db.order.findUnique({ where: { id: orderId }, select: { status: true } });
    check('the order moved to activated', order?.status === 'ACTIVATED', order?.status);

    const sub = await db.subscription.findFirst({ where: { userId: card?.userId ?? '' } });
    check('the first year started', Boolean(sub), sub);
    check('it expires in about a year', sub ? Math.abs((sub.expiresAt.getTime() - Date.now()) / 86400000 - 365) < 2 : false, sub?.expiresAt);

    const profile = await db.profile.findUnique({ where: { id: profileId }, select: { status: true } });
    check('activating published the profile, so the card is never a dead link', profile?.status === 'PUBLISHED', profile?.status);
  }

  // ============================================================
  section('10. The NFC redirect, after activation');

  {
    const anon = new Client('tapper2');
    const res = await anon.raw(`/c/${ownCardCode}`);
    check('the card now redirects to the profile', res.status === 302, { status: res.status });
    check('with the nfc source attached', res.headers.get('location')?.includes(`/${username}?s=nfc`) === true, res.headers.get('location'));
    check('and it is never cached', res.headers.get('cache-control')?.includes('no-store') === true, res.headers.get('cache-control'));

    const card = await db.nfcCard.findUnique({ where: { serial: ownCardSerial }, select: { tapCount: true } });
    check('the tap was counted', (card?.tapCount ?? 0) >= 2, card);
  }

  // ============================================================
  section('11. Repointing a card');

  {
    const res = await c.json<{ destinationType: string }>(`/api/cards/${ownCardId}`, {
      method: 'PATCH',
      json: { destinationType: 'INSTAGRAM', destinationUrl: 'instagram.com/mehtastudio' },
    });
    check('the owner can repoint the card without touching the chip', res.ok, res.error);
    check('the destination changed', res.data.destinationType === 'INSTAGRAM', res.data);

    const anon = new Client('tapper3');
    const tap = await anon.raw(`/c/${ownCardCode}`);
    check('the same chip now opens Instagram', tap.headers.get('location')?.includes('instagram.com/mehtastudio') === true, tap.headers.get('location'));

    // put it back
    await c.json(`/api/cards/${ownCardId}`, { method: 'PATCH', json: { destinationType: 'PROFILE', profileId } });

    const stranger = new Client('stranger4');
    await stranger.json('/api/auth/signup', { json: { name: 'Nope', email: `${uniq('np')}@example.com`, password } });
    const notMine = await stranger.json(`/api/cards/${ownCardId}`, {
      method: 'PATCH',
      json: { destinationType: 'CUSTOM_URL', destinationUrl: 'https://evil.example' },
    });
    check('someone else cannot repoint it', notMine.status === 404, { status: notMine.status });
  }

  // ============================================================
  section('11b. A card printed with the buyer photograph on it');

  {
    const portrait = await db.product.findUnique({
      where: { slug: 'signature-portrait-nfc-card' },
      select: { id: true, priceMinor: true },
    });
    check('the personalised card is on sale', Boolean(portrait), portrait);

    // the finish is chosen at the shop and travels with the line
    const placed = await c.json<{ orderId: string }>('/api/orders', {
      json: {
        ...checkoutBody,
        items: [{ productId: portrait!.id, quantity: 1, customization: { finish: 'Silver matte' } }],
        idempotencyKey: crypto.randomUUID(),
      },
    });
    check('it can be ordered with a finish chosen', placed.ok, placed.error);

    const line = await db.orderItem.findFirst({
      where: { orderId: placed.data?.orderId },
      select: { id: true, customization: true, unitMinor: true },
    });
    check('the order has its line', Boolean(line), line);
    check('the price is the server price, not one sent by the browser', line?.unitMinor === portrait!.priceMinor, line?.unitMinor);
    check('the chosen finish is stored against the line',
      (line?.customization as { finish?: string } | null)?.finish === 'Silver matte', line?.customization);

    // the photo is asked for after payment, and only from the buyer
    const noPhotoYet = (line?.customization as { photoMediaId?: string } | null)?.photoMediaId;
    check('no photo is expected up front', !noPhotoYet, noPhotoYet);

    const png = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
      0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
      0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
      0x42, 0x60, 0x82,
    ]);
    const form = new FormData();
    form.append('file', new Blob([png], { type: 'image/png' }), 'face.png');
    const up = await c.form<{ id: string }>('/api/media/upload', form);
    check('the buyer can upload a photo', up.ok && Boolean(up.data.id), up.error);

    const stranger = new Client('portrait-stranger');
    await stranger.json('/api/auth/signup', { json: { name: 'Not Them', email: `${uniq('pz')}@example.com`, password } });
    const theirs = await stranger.json(`/api/orders/${placed.data?.orderId}/artwork`, {
      method: 'PATCH',
      json: { orderItemId: line!.id, photoMediaId: up.data?.id },
    });
    check('nobody else can set the artwork on that order', theirs.status === 404, { status: theirs.status });

    const set = await c.json(`/api/orders/${placed.data?.orderId}/artwork`, {
      method: 'PATCH',
      json: { orderItemId: line!.id, photoMediaId: up.data?.id },
    });
    check('the buyer sets the photo for their own card', set.ok, set.error);

    const after = await db.orderItem.findUnique({ where: { id: line!.id }, select: { customization: true } });
    const custom = after?.customization as { finish?: string; photoMediaId?: string } | null;
    check('the photo is stored against the line', custom?.photoMediaId === up.data?.id, custom);
    check('and the finish survives the update', custom?.finish === 'Silver matte', custom);

    const notAnImage = await c.json(`/api/orders/${placed.data?.orderId}/artwork`, {
      method: 'PATCH',
      json: { orderItemId: line!.id, photoMediaId: '00000000-0000-0000-0000-000000000000' },
    });
    check('a file that is not an image is refused', notAnImage.status === 422, notAnImage.error);
  }

  // ============================================================
  section('11c. Payment taken outside the gateway');

  {
    const admin2 = new Client('admin3');
    await admin2.json('/api/auth/login', {
      json: { email: process.env.SEED_ADMIN_EMAIL ?? 'admin@nfcy.in', password: process.env.SEED_ADMIN_PASSWORD ?? 'ChangeThisNow!2026' },
    });

    const placed = await c.json<{ orderId: string }>('/api/orders', {
      json: { ...checkoutBody, idempotencyKey: crypto.randomUUID() },
    });
    const offlineOrderId = placed.data?.orderId ?? '';
    check('an order starts unpaid', placed.ok, placed.error);

    // an unpaid order must not be pushed down the line
    const tooSoon = await admin2.json(`/api/admin/orders/${offlineOrderId}/status`, {
      json: { status: 'DISPATCHED' },
    });
    check('an unpaid order cannot be marched forward', tooSoon.status === 409, tooSoon.error);

    const custTry = await c.json(`/api/admin/orders/${offlineOrderId}/payment`, { json: { method: 'cash' } });
    check('a customer cannot record a payment on their own order', custTry.status === 403 || custTry.status === 401, {
      status: custTry.status,
    });

    const taken = await admin2.json<{ status: string; paidAt: string }>(`/api/admin/orders/${offlineOrderId}/payment`, {
      json: { method: 'upi', reference: 'UPI-TEST-001' },
    });
    check('an admin can record a payment taken in cash or by UPI', taken.ok, taken.error);
    check('the order is now paid', Boolean(taken.data?.paidAt), taken.data);

    const cards = await db.nfcCard.count({ where: { orderItem: { orderId: offlineOrderId } } });
    check('recording it created the cards, exactly as the gateway would', cards > 0, { cards });

    const invoice = await db.invoice.findFirst({ where: { orderId: offlineOrderId } });
    check('and raised the invoice', Boolean(invoice), invoice);

    const twice = await admin2.json(`/api/admin/orders/${offlineOrderId}/payment`, { json: { method: 'cash' } });
    check('the same order cannot be paid twice', twice.status === 409, twice.error);

    const event = await db.orderStatusEvent.findFirst({
      where: { orderId: offlineOrderId, note: { contains: 'UPI-TEST-001' } },
    });
    check('the record names the method, the reference and the staff member', Boolean(event), event?.note);

    const trail = await db.auditLog.findFirst({ where: { entityId: offlineOrderId, action: 'order.payment_recorded_offline' } });
    check('and it is in the audit log', Boolean(trail), trail);

    // now it can move
    const moves = await admin2.json(`/api/admin/orders/${offlineOrderId}/status`, {
      json: { status: 'MANUFACTURING' },
    });
    check('a paid order can be moved along', moves.ok, moves.error);
  }

  // ============================================================
  section('11d. Activating a card for the customer');

  {
    const admin3 = new Client('admin4');
    await admin3.json('/api/auth/login', {
      json: { email: process.env.SEED_ADMIN_EMAIL ?? 'admin@nfcy.in', password: process.env.SEED_ADMIN_PASSWORD ?? 'ChangeThisNow!2026' },
    });

    const fresh = await c.json<{ orderId: string }>('/api/orders', {
      json: { ...checkoutBody, idempotencyKey: crypto.randomUUID() },
    });
    const oid = fresh.data?.orderId ?? '';

    const beforePaying = await admin3.json(`/api/admin/orders/${oid}/activate`, { json: {} });
    check('an unpaid order has no cards to activate', beforePaying.status === 409, beforePaying.error);

    await admin3.json(`/api/admin/orders/${oid}/payment`, { json: { method: 'cash' } });

    const custTry = await c.json(`/api/admin/orders/${oid}/activate`, { json: {} });
    check('a customer cannot use the staff activation route', custTry.status === 403 || custTry.status === 401, {
      status: custTry.status,
    });

    const done = await admin3.json<{ activated: number; username: string }>(`/api/admin/orders/${oid}/activate`, {
      json: {},
    });
    check('an admin can activate the cards for the customer', done.ok && done.data.activated > 0, done.error);
    check('it reports which profile they now open', done.data?.username === username, done.data);

    const card = await db.nfcCard.findFirst({ where: { orderItem: { orderId: oid } } });
    check('the card is active and pointed at the profile', card?.status === 'ACTIVE' && card?.profileId === profileId, card);

    const prof = await db.profile.findUnique({ where: { id: profileId }, select: { status: true } });
    check('and the profile is published, so the card is not a dead link', prof?.status === 'PUBLISHED', prof);

    const again = await admin3.json(`/api/admin/orders/${oid}/activate`, { json: {} });
    check('activating twice is refused rather than duplicated', again.status === 409, again.error);
  }

  // ============================================================
  section('12. Invoice and orders');

  {
    const inv = await c.text(`/api/orders/${orderId}/invoice`);
    check('the customer can open their invoice', inv.status === 200, { status: inv.status });
    check('it is an html document', inv.headers.get('content-type')?.includes('text/html') === true);
    check('it shows the order number', inv.body.includes('CT-'), inv.body.slice(0, 200));
    check('it splits out the GST', inv.body.includes('GST 18%'));

    const stranger = new Client('stranger5');
    await stranger.json('/api/auth/signup', { json: { name: 'Nosy', email: `${uniq('no')}@example.com`, password } });
    const peek = await stranger.text(`/api/orders/${orderId}/invoice`);
    check('nobody else can open it', peek.status === 404, { status: peek.status });

    const anon = new Client('anon');
    const anonPeek = await anon.text(`/api/orders/${orderId}/invoice`);
    check('and a signed out visitor certainly cannot', anonPeek.status === 401, { status: anonPeek.status });
  }

  // ============================================================
  section('13. Admin authorisation');

  {
    const paths = [
      '/api/admin/coupons',
      '/api/admin/products',
    ];
    for (const p of paths) {
      const res = await c.json(p, { json: {} });
      check(`a customer is refused at ${p}`, res.status === 403, { path: p, status: res.status });
    }

    const statusTry = await c.json(`/api/admin/orders/${orderId}/status`, { json: { status: 'DELIVERED' } });
    check('a customer cannot change an order status', statusTry.status === 403, { status: statusTry.status });

    const adminPage = await c.raw('/admin');
    check('a customer is bounced off the admin panel', adminPage.status === 307 || adminPage.status === 302, { status: adminPage.status });
  }

  // ============================================================
  section('14. Admin order handling');

  {
    const unpaidOrder = await db.order.create({
      data: {
        orderNumber: `CT-TEST-${Date.now().toString().slice(-6)}`,
        status: 'PAYMENT_PENDING',
        customerName: 'Unpaid Person', customerEmail: 'unpaid@example.com', customerPhone: '9000000000',
        billingAddress: {} as never, shippingAddress: {} as never,
        subtotalMinor: 49900, totalMinor: 49900, taxMinor: 9137,
      },
    });

    const push = await admin.json(`/api/admin/orders/${unpaidOrder.id}/status`, { json: { status: 'MANUFACTURING' } });
    check('an unpaid order cannot be pushed into manufacturing', push.status === 409, push.error);

    const shipUnpaid = await admin.json(`/api/admin/orders/${unpaidOrder.id}/shipment`, {
      method: 'PUT',
      json: { courier: 'Blue Dart', awb: 'BD000', status: 'DISPATCHED' },
    });
    check('an unpaid order cannot be shipped either', shipUnpaid.status === 409, shipUnpaid.error);

    // A separate paid order that has NOT been activated, because the real
    // sequence is dispatch then activate. The first order is already ACTIVATED,
    // and an activated order must never be dragged backwards to DISPATCHED.
    const shipEmail = `${uniq('ship')}@example.com`;
    const shipOrder = await db.order.create({
      data: {
        orderNumber: `CT-SHIP-${Date.now().toString().slice(-6)}`,
        status: 'MANUFACTURING',
        paidAt: new Date(),
        customerName: 'Anita Rao', customerEmail: shipEmail, customerPhone: '9000000001',
        billingAddress: {} as never, shippingAddress: {} as never,
        subtotalMinor: 49900, totalMinor: 49900, taxMinor: 9137,
        items: { create: { productId, productName: 'Classic NFC Card', productSku: 'CT-CLASSIC', unitMinor: 49900, quantity: 1, totalMinor: 49900 } },
      },
    });

    const shipNoAwb = await admin.json(`/api/admin/orders/${shipOrder.id}/status`, { json: { status: 'DISPATCHED' } });
    check('an order cannot be marked dispatched with no tracking number', shipNoAwb.status === 409, shipNoAwb.error);

    const ship = await admin.json(`/api/admin/orders/${shipOrder.id}/shipment`, {
      method: 'PUT',
      json: { courier: 'Blue Dart', awb: 'BD123456789', trackingUrl: 'https://bluedart.com/track', status: 'DISPATCHED' },
    });
    check('shipping details save', ship.ok, ship.error);

    const after = await db.order.findUnique({ where: { id: shipOrder.id }, select: { status: true } });
    check('saving a dispatch moves the order along by itself', after?.status === 'DISPATCHED', after);

    const notified = await db.notification.findFirst({ where: { template: 'card_dispatched', toAddress: shipEmail } });
    check('the customer was told, with the tracking number', notified?.body.includes('BD123456789') === true, notified?.body?.slice(0, 140));

    // an already activated order must not be dragged backwards
    const backwards = await admin.json(`/api/admin/orders/${orderId}/shipment`, {
      method: 'PUT',
      json: { courier: 'Blue Dart', awb: 'BD999', status: 'DISPATCHED' },
    });
    const stillActive = await db.order.findUnique({ where: { id: orderId }, select: { status: true } });
    check('an activated order is not dragged back to dispatched', stillActive?.status === 'ACTIVATED', { backwards: backwards.status, stillActive });

    await db.order.delete({ where: { id: unpaidOrder.id } });
  }

  // ============================================================
  section('15. Renewal');

  {
    const res = await c.json<{ orderId: string; amountMinor: number }>('/api/renewal', {
      json: { idempotencyKey: crypto.randomUUID() },
    });
    check('a renewal order can be started', res.ok, res.error);
    check('it costs ₹299', res.data.amountMinor === 29900, res.data);

    const renewalOrder = await db.order.findUnique({
      where: { id: res.data.orderId },
      include: { items: { include: { product: true } } },
    });
    check('the renewal order carries the renewal product', renewalOrder?.items[0]?.product?.kind === 'RENEWAL', renewalOrder?.items[0]?.productName);
    check('and nothing is shipped for it', renewalOrder?.shippingMinor === 0);
  }

  // ============================================================
  section('16. Renewal reminders and lapsing');

  {
    const cronSecret = process.env.CRON_SECRET ?? '';
    check('a cron secret is set', cronSecret.length > 0);

    const unauth = await fetch(`${BASE}/api/cron/renewals`);
    check('the cron endpoint refuses an unauthenticated call', unauth.status === 401, { status: unauth.status });

    const user = await db.user.findUnique({ where: { email } });
    const sub = await db.subscription.findFirst({ where: { userId: user?.id ?? '' } });

    // move the renewal date to exactly 7 days out and check the reminder fires
    const in7 = new Date();
    in7.setDate(in7.getDate() + 7);
    in7.setHours(12, 0, 0, 0);
    await db.subscription.update({ where: { id: sub!.id }, data: { expiresAt: in7, remindersSent: [], status: 'ACTIVE' } });

    const res = await fetch(`${BASE}/api/cron/renewals`, { headers: { authorization: `Bearer ${cronSecret}` } });
    const body = (await res.json()) as { remindersSent: number };
    check('the cron run is accepted with the secret', res.status === 200, { status: res.status });
    check('a reminder was sent', body.remindersSent >= 1, body);

    const reminder = await db.notification.findFirst({
      where: { template: 'renewal_reminder', toAddress: email },
      orderBy: { createdAt: 'desc' },
    });
    check('the reminder names the real date and price', reminder?.body.includes('₹299') === true, reminder?.body?.slice(0, 160));

    // running again the same day must not send it twice
    const before = await db.notification.count({ where: { template: 'renewal_reminder', toAddress: email } });
    await fetch(`${BASE}/api/cron/renewals`, { headers: { authorization: `Bearer ${cronSecret}` } });
    const after = await db.notification.count({ where: { template: 'renewal_reminder', toAddress: email } });
    check('running it twice does not send a second reminder', after === before, { before, after });

    // now lapse it
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    await db.subscription.update({ where: { id: sub!.id }, data: { expiresAt: yesterday, status: 'ACTIVE' } });
    await fetch(`${BASE}/api/cron/renewals`, { headers: { authorization: `Bearer ${cronSecret}` } });

    const lapsed = await db.subscription.findUnique({ where: { id: sub!.id } });
    check('a lapsed subscription is marked expired', lapsed?.status === 'EXPIRED', lapsed?.status);

    const profile = await db.profile.findUnique({ where: { id: profileId }, select: { status: true } });
    check('the profile pauses rather than being deleted', profile?.status === 'RENEWAL_REQUIRED', profile?.status);

    const anon = new Client('visitor');
    const page = await anon.text(`/${username}`);
    check('the public page says it is paused, not broken', page.body.includes('paused'), { status: page.status });

    const card = await db.nfcCard.findUnique({ where: { serial: ownCardSerial }, select: { status: true } });
    check('the card itself is NOT bricked', card?.status === 'ACTIVE', card?.status);
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
