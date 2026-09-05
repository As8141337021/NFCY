/**
 * The acceptance journey, driven against a running server.
 *   npm run dev       (in one terminal)
 *   npm test          (in another)
 */
import { Client, check, section, summary, uniq, sleep, anonOpen } from './harness';
import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

/**
 * Rate limits are real and shared per IP, so every client in this suite looks
 * like one very busy person. Clearing the counters first keeps the run
 * deterministic without weakening the limits themselves.
 */
const db = new PrismaClient();

async function resetRateLimits() {
  await db.rateLimit.deleteMany({});
}

const run = async () => {
  await resetRateLimits();

  const email = `${uniq('e2e')}@example.com`;
  const password = 'TestPass123';
  const username = uniq('rahul');
  const c = new Client('customer');

  let profileId = '';

  // ============================================================
  section('1. Accounts');

  {
    const bad = await c.json('/api/auth/signup', {
      json: { name: 'R', email: 'not-an-email', password: 'weak' },
    });
    check('a bad signup is rejected with field errors', bad.status === 422 && Boolean(bad.error?.fields), bad.error);
    check('the email field is named in the errors', Boolean(bad.error?.fields?.email), bad.error?.fields);
    check('the password field is named in the errors', Boolean(bad.error?.fields?.password), bad.error?.fields);
  }

  {
    const res = await c.json<{ id: string; email: string }>('/api/auth/signup', {
      json: { name: 'Rahul Sharma', email, password },
    });
    check('signup succeeds', res.ok && res.status === 200, res.error);
    check('the session cookie is set', c.cookieHeader.includes('nfcy_session'));
  }

  {
    const dupe = await new Client().json('/api/auth/signup', {
      json: { name: 'Someone Else', email, password },
    });
    check('the same email cannot sign up twice', dupe.status === 409, dupe.error);
  }

  {
    const me = await c.json<{ user: { email: string; role: string } | null }>('/api/auth/me');
    check('the session identifies the right user', me.data.user?.email === email, me.data.user);
    check('a new account is a CUSTOMER', me.data.user?.role === 'CUSTOMER');
  }

  // ============================================================
  section('2. Usernames');

  {
    const free = await c.json<{ available: boolean }>(`/api/profile/username?u=${username}`);
    check('a fresh username reads as available', free.data.available === true, free.data);

    const reserved = await c.json<{ available: boolean; reason: string }>('/api/profile/username?u=admin');
    check('a reserved username is refused', reserved.data.available === false, reserved.data);

    const short = await c.json<{ available: boolean }>('/api/profile/username?u=ab');
    check('a too short username is refused', short.data.available === false);
  }

  // ============================================================
  section('3. The profile');

  {
    // A profile is the page a card opens, so it cannot exist without one.
    const tooEarly = await c.json('/api/profile', {
      json: { username, fullName: 'Rahul Sharma', designation: 'Interior Designer', company: 'Sharma Interiors' },
    });
    check('a profile cannot be created before a card is bought', tooEarly.status === 403, {
      status: tooEarly.status,
      code: tooEarly.error?.code,
    });
    check('and it says why, without blaming the person', tooEarly.error?.code === 'card_required', tooEarly.error);

    // Buying is exercised end to end in the commerce suite. Here the card is
    // simply put in place so the profile work has its precondition.
    const me = await db.user.findUnique({ where: { email }, select: { id: true } });
    const product = await db.product.findFirst({ where: { kind: { not: 'RENEWAL' } }, select: { id: true, destinationType: true } });
    await db.nfcCard.create({
      data: {
        code: `T${Date.now().toString(36).toUpperCase()}`.slice(0, 8),
        serial: `CT-TEST-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
        activationHash: '$2a$10$testtesttesttesttesttesttesttesttesttesttesttesttestte',
        productId: product?.id ?? null,
        userId: me?.id ?? null,
        destinationType: product?.destinationType ?? 'PROFILE',
        status: 'ASSIGNED',
        batch: 'TEST-FIXTURE',
      },
    });

    const res = await c.json<{ id: string; username: string }>('/api/profile', {
      json: { username, fullName: 'Rahul Sharma', designation: 'Interior Designer', company: 'Sharma Interiors' },
    });
    check('with a card owned, the profile is created', res.ok, res.error);
    profileId = res.data.id;

    const taken = await c.json<{ available: boolean; suggestions: string[] }>(`/api/profile/username?u=${username}`);
    check('the username now reads as taken', taken.data.available === false);
    check('alternatives are suggested', taken.data.suggestions.length > 0, taken.data);
  }

  {
    const other = new Client('stranger');
    const otherSignup = await other.json('/api/auth/signup', {
      json: { name: 'Nosy Person', email: `${uniq('nosy')}@example.com`, password },
    });
    check('a second account can be created', otherSignup.ok, otherSignup.error);
    const peek = await other.json(`/api/profile/${profileId}`);
    check('another signed in user cannot read this profile', peek.status === 403, { status: peek.status });

    const edit = await other.json(`/api/profile/${profileId}`, {
      method: 'PATCH',
      json: { fullName: 'Hijacked' },
    });
    check('another user cannot edit it either', edit.status === 403, { status: edit.status });

    const anon = new Client('anonymous');
    const anonRead = await anon.json(`/api/profile/${profileId}`);
    check('a signed out visitor cannot read the editor api', anonRead.status === 401, { status: anonRead.status });
  }

  {
    const res = await c.json<{ profile: { fullName: string; whatsapp: string }; completion: { percent: number } }>(
      `/api/profile/${profileId}`,
      {
        method: 'PATCH',
        json: {
          fullName: 'Rahul Sharma',
          designation: 'Interior Designer',
          company: 'Sharma Interiors',
          bio: 'Twelve years of turning small flats into places people actually want to come home to.',
          phone: '9876543210',
          whatsapp: '98765 43210',
          email: 'rahul@example.com',
          website: 'sharmainteriors.in',
          address: 'Shop 4, CG Road, Ahmedabad',
          mapsUrl: 'https://maps.app.goo.gl/example',
          upiId: 'rahul@okhdfcbank',
          template: 'corporate',
          accentColor: '#34E0F0',
          isPublic: true,
          leadFormEnabled: true,
          leadFormTitle: 'Send me a message',
        },
      },
    );
    check('the details save', res.ok, res.error);
    check('a spaced phone number is normalised', res.data.profile.whatsapp === '9876543210', res.data.profile.whatsapp);
    check('a bare domain becomes a full url', String((res.data.profile as unknown as { website: string }).website).startsWith('https://'), res.data.profile);
    check('completion goes up as fields are filled', res.data.completion.percent > 0, res.data.completion);
  }

  {
    const bad = await c.json(`/api/profile/${profileId}`, {
      method: 'PATCH',
      json: { fullName: 'Rahul Sharma', phone: '123', accentColor: 'blue' },
    });
    check('a bad phone number is rejected', bad.status === 422, bad.error);
    check('a bad colour is rejected', Boolean(bad.error?.fields?.accentColor), bad.error?.fields);
  }

  // ============================================================
  section('4. Links, products, services');

  {
    const social = await c.json<{ profile: { socials: Array<{ id: string; url: string }> } }>(
      `/api/profile/${profileId}/items?kind=social`,
      { json: { platform: 'instagram', url: 'instagram.com/sharmainteriors' } },
    );
    check('a social link is added', social.ok && social.data.profile.socials.length === 1, social.error);
    check('the link is stored as a full url', social.data.profile.socials[0]?.url.startsWith('https://'), social.data.profile.socials[0]);

    const product = await c.json<{ profile: { products: Array<{ id: string; priceMinor: number }> } }>(
      `/api/profile/${profileId}/items?kind=product`,
      { json: { name: 'Modular kitchen design', description: 'Design, drawings and a fixed quote.', priceMinor: 1499900, buttonLabel: 'Enquire', active: true } },
    );
    check('a product is added', product.ok && product.data.profile.products.length === 1, product.error);
    check('the price is stored in paise', product.data.profile.products[0]?.priceMinor === 1499900, product.data.profile.products[0]);

    const service = await c.json<{ profile: { services: Array<{ id: string }> } }>(
      `/api/profile/${profileId}/items?kind=service`,
      { json: { name: 'Home consultation', priceMinor: 200000, durationMin: 90, buttonLabel: 'Book now', active: true } },
    );
    check('a service is added', service.ok && service.data.profile.services.length === 1, service.error);

    const s2 = await c.json<{ profile: { socials: Array<{ id: string }> } }>(
      `/api/profile/${profileId}/items?kind=social`,
      { json: { platform: 'linkedin', url: 'linkedin.com/in/rahul' } },
    );
    const ids = s2.data.profile.socials.map((x) => x.id);
    const reordered = await c.json<{ profile: { socials: Array<{ id: string }> } }>(
      `/api/profile/${profileId}/items/reorder?kind=social`,
      { json: { ids: [ids[1], ids[0]] } },
    );
    check('reordering sticks', reordered.data.profile.socials[0]?.id === ids[1], reordered.data.profile.socials);

    const badItem = await c.json(`/api/profile/${profileId}/items?kind=social`, {
      json: { platform: 'instagram', url: 'javascript:alert(1)' },
    });
    check('a javascript: link is refused', badItem.status === 422, badItem.error);
  }

  // ============================================================
  section('4b. Businesses and networking bodies');

  {
    const b1 = await c.json<{ profile: { businesses: Array<{ id: string; name: string; isPrimary: boolean; showHours: boolean }> } }>(
      `/api/profile/${profileId}/items?kind=business`,
      { json: { name: 'Sharma Interiors', category: 'Interior design studio', phone: '9876543210', showHours: false } },
    );
    check('a business is added', b1.ok && b1.data.profile.businesses.length === 1, b1.error);
    check('the first one becomes the main business by itself', b1.data.profile.businesses[0]?.isPrimary === true, b1.data.profile.businesses[0]);
    check('opening hours are off unless asked for', b1.data.profile.businesses[0]?.showHours === false, b1.data.profile.businesses[0]);

    const b2 = await c.json<{ profile: { businesses: Array<{ id: string; name: string; isPrimary: boolean; showHours: boolean; hours: unknown }> } }>(
      `/api/profile/${profileId}/items?kind=business`,
      {
        json: {
          name: 'Sharma Cafe', category: 'Coffee shop', whatsapp: '9812345678',
          showHours: true,
          hours: [
            { day: 'mon', open: '08:00', close: '22:00', closed: false },
            { day: 'sun', open: '09:00', close: '18:00', closed: true },
          ],
        },
      },
    );
    check('a second business can be added', b2.ok && b2.data.profile.businesses.length === 2, b2.error);
    check('the second one is not the main business', b2.data.profile.businesses[1]?.isPrimary === false, b2.data.profile.businesses[1]);
    check('hours are kept when the switch is on', Array.isArray(b2.data.profile.businesses[1]?.hours), b2.data.profile.businesses[1]?.hours);

    const b3 = await c.json<{ profile: { businesses: Array<{ name: string }> } }>(
      `/api/profile/${profileId}/items?kind=business`,
      { json: { name: 'Sharma Realty', showHours: false } },
    );
    check('a third business can be added', b3.ok && b3.data.profile.businesses.length === 3, b3.error);

    // making the cafe the main one must demote the first
    const cafeId = b2.data.profile.businesses[1].id;
    const promoted = await c.json<{ profile: { businesses: Array<{ id: string; isPrimary: boolean }> } }>(
      `/api/profile/${profileId}/items/${cafeId}?kind=business`,
      { method: 'PATCH', json: { name: 'Sharma Cafe', isPrimary: true, showHours: true, hours: [{ day: 'mon', open: '08:00', close: '22:00', closed: false }] } },
    );
    const primaries = promoted.data.profile.businesses.filter((x) => x.isPrimary);
    check('only one business can be the main one at a time', primaries.length === 1, promoted.data.profile.businesses);
    check('and it is the one just promoted', primaries[0]?.id === cafeId, primaries[0]);

    const bad = await c.json(`/api/profile/${profileId}/items?kind=business`, { json: { name: 'X' } });
    check('a one letter business name is refused', bad.status === 422, bad.error);
  }

  {
    const a1 = await c.json<{ profile: { affiliations: Array<{ id: string; name: string; role: string | null }> } }>(
      `/api/profile/${profileId}/items?kind=affiliation`,
      { json: { name: 'BNI', role: 'Member', chapter: 'Ahmedabad West', url: 'bni.com' } },
    );
    check('a networking organisation is added', a1.ok && a1.data.profile.affiliations.length === 1, a1.error);
    check('the role is kept', a1.data.profile.affiliations[0]?.role === 'Member', a1.data.profile.affiliations[0]);

    const a2 = await c.json<{ profile: { affiliations: Array<{ id: string }> } }>(
      `/api/profile/${profileId}/items?kind=affiliation`,
      { json: { name: 'Rotary Club', role: 'Secretary' } },
    );
    check('a second organisation is added', a2.data.profile.affiliations.length === 2, a2.error);

    const ids = a2.data.profile.affiliations.map((x) => x.id);
    const reordered = await c.json<{ profile: { affiliations: Array<{ id: string }> } }>(
      `/api/profile/${profileId}/items/reorder?kind=affiliation`,
      { json: { ids: [ids[1], ids[0]] } },
    );
    check('organisations can be reordered', reordered.data.profile.affiliations[0]?.id === ids[1], reordered.data.profile.affiliations);

    const stranger = new Client('nosy-org');
    await stranger.json('/api/auth/signup', { json: { name: 'Nosy', email: `${uniq('org')}@example.com`, password } });
    const notMine = await stranger.json(`/api/profile/${profileId}/items?kind=affiliation`, { json: { name: 'Sneaky' } });
    check('someone else cannot add one to this profile', notMine.status === 403, { status: notMine.status });
  }

  // ============================================================
  section('5. Publishing and the public page');

  {
    const anon = new Client('visitor');

    const draft = await anon.text(`/${username}`);
    check('an unpublished profile does not show its content', !draft.body.includes('Modular kitchen design'), {
      status: draft.status,
    });
    check('an unpublished profile says so plainly', draft.body.includes('not live yet'), { status: draft.status });

    const pub = await c.json<{ status: string; url: string }>(`/api/profile/${profileId}/publish`, {
      json: { publish: true },
    });
    check('publishing works', pub.ok && pub.data.status === 'PUBLISHED', pub.error);

    const live = await anon.text(`/${username}`);
    check('the public page returns 200', live.status === 200, { status: live.status });
    check('it shows the name', live.body.includes('Rahul Sharma'));
    check('it shows the designation', live.body.includes('Interior Designer'));
    check('it shows the product', live.body.includes('Modular kitchen design'));
    check('it shows the price in rupees', live.body.includes('14,999'), live.body.match(/₹[\d,]+/g)?.slice(0, 5));
    check('it carries a canonical link', live.body.includes('rel="canonical"'));
    check('it carries structured data', live.body.includes('application/ld+json'));
    check('it renders a QR image', live.body.includes('data:image/png;base64'));
    check('it shows the main business', live.body.includes('Sharma Cafe'), live.body.match(/Sharma[^<]*/g)?.slice(0, 4));
    check('it also lists the other businesses', live.body.includes('Sharma Interiors') && live.body.includes('Sharma Realty'));
    check('it shows the networking bodies', live.body.includes('BNI') && live.body.includes('Rotary Club'));
    check('it shows opening hours only where they were switched on', live.body.includes('Opening hours'));

    const missing = await anon.text('/nobody-here-at-all');
    check('an unknown username is a 404', missing.status === 404, { status: missing.status });
  }

  // ============================================================
  section('6. Save contact and QR');

  {
    const anon = new Client('visitor');
    const vcf = await anon.text(`/api/profile/${profileId}/vcard`);
    check('the vcard downloads', vcf.status === 200, { status: vcf.status });
    check('it is a vcard', vcf.headers.get('content-type')?.includes('text/vcard') === true, vcf.headers.get('content-type'));
    check('it names the person', vcf.body.includes('FN:Rahul Sharma'));
    check('it carries the phone with the country code', vcf.body.includes('+919876543210'));
    check('it is offered as a download', vcf.headers.get('content-disposition')?.includes('attachment') === true);

    const png = await anon.raw(`/api/profile/${profileId}/qr`);
    check('the QR png renders', png.status === 200 && png.headers.get('content-type') === 'image/png');

    const svg = await anon.text(`/api/profile/${profileId}/qr?format=svg`);
    check('the QR svg renders', svg.status === 200 && svg.body.includes('<svg'));
  }

  // ============================================================
  section('7. Enquiries');

  {
    const anon = new Client('visitor');

    const empty = await anon.json(`/api/profile/${profileId}/leads`, { json: { name: 'A' } });
    check('an enquiry with no name is rejected', empty.status === 422, empty.error);

    const noContact = await anon.json(`/api/profile/${profileId}/leads`, { json: { name: 'Priya Mehta' } });
    check('an enquiry with no way to reply is rejected', noContact.status === 422, noContact.error);

    const good = await anon.json(`/api/profile/${profileId}/leads`, {
      json: { name: 'Priya Mehta', phone: '9812345678', message: 'Can you quote for a 2BHK?' },
    });
    check('a real enquiry is accepted', good.ok, good.error);

    const bot = await anon.json(`/api/profile/${profileId}/leads`, {
      json: { name: 'Spam Bot', phone: '9812345678', website: 'http://spam.example' },
    });
    check('the honeypot swallows a bot without an error', bot.ok, bot.error);

    const list = await c.json<{ leads: Array<{ name: string }> }>(`/api/profile/${profileId}/leads`);
    check('the owner sees the real enquiry', list.data.leads.some((l) => l.name === 'Priya Mehta'), list.data.leads);
    check('the bot submission was not stored', !list.data.leads.some((l) => l.name === 'Spam Bot'), list.data.leads.map((l) => l.name));

    const stranger = new Client('stranger2');
    const strangerSignup = await stranger.json('/api/auth/signup', { json: { name: 'Someone', email: `${uniq('s')}@example.com`, password } });
    check('a third account can be created', strangerSignup.ok, strangerSignup.error);
    const peek = await stranger.json(`/api/profile/${profileId}/leads`);
    check('someone else cannot read the enquiries', peek.status === 403, { status: peek.status });
  }

  // ============================================================
  section('8. Analytics');

  {
    const anon = new Client('visitor');
    await anon.json('/api/track', { json: { profileId, type: 'CLICK_WHATSAPP' } });
    await anon.json('/api/track', { json: { profileId, type: 'CLICK_CALL' } });

    const bad = await anon.json('/api/track', { json: { profileId, type: 'NOT_A_REAL_EVENT' } });
    check('an unknown event type is refused', bad.status === 422, bad.error);

    const ghost = await anon.json('/api/track', {
      json: { profileId: '00000000-0000-0000-0000-000000000000', type: 'CLICK_CALL' },
    });
    check('tracking against a missing profile is quietly ignored', ghost.ok, ghost.error);

    await sleep(300);
    const stats = await c.json<{ totals: { views: number; clicks: number; leads: number } }>(
      `/api/analytics?profileId=${profileId}&days=7`,
    );
    check('the owner can read their analytics', stats.ok, stats.error);
    check('clicks were counted', (stats.data.totals?.clicks ?? 0) >= 2, stats.data.totals);
    check('the enquiry was counted', (stats.data.totals?.leads ?? 0) >= 1, stats.data.totals);
    check('the page view was counted', (stats.data.totals?.views ?? 0) >= 1, stats.data.totals);
  }

  // ============================================================
  section('9. Signing in and out');

  {
    await c.json('/api/auth/logout', { method: 'POST' });
    const after = await c.json<{ user: unknown }>('/api/auth/me');
    check('signing out ends the session', after.data.user === null, after.data);

    const wrong = await c.json('/api/auth/login', { json: { email, password: 'WrongPass123' } });
    check('a wrong password is refused', wrong.status === 401, wrong.error);
    check('the message does not say whether the account exists', wrong.error?.message === 'That email and password do not match.', wrong.error);

    const right = await c.json<{ redirect: string }>('/api/auth/login', { json: { email, password } });
    check('the right password signs in', right.ok, right.error);
    check('a customer is sent to the dashboard', right.data.redirect === '/dashboard', right.data);
  }

  // ============================================================
  section('9b. Date of birth, and keeping it private');

  {
    const base = {
      fullName: 'Rahul Sharma',
      designation: 'Interior Designer',
      company: 'Sharma Interiors',
      phone: '9876543210',
      accentColor: '#34E0F0',
      template: 'corporate',
      leadFormTitle: 'Send me a message',
    };

    const bad = await c.json(`/api/profile/${profileId}`, {
      method: 'PATCH',
      json: { ...base, dateOfBirth: '14-03-1990' },
    });
    check('a date in the wrong shape is refused', bad.status === 422, bad.error);

    const future = await c.json(`/api/profile/${profileId}`, {
      method: 'PATCH',
      json: { ...base, dateOfBirth: '2099-01-01' },
    });
    check('a date in the future is refused', future.status === 422, future.error);

    const ancient = await c.json(`/api/profile/${profileId}`, {
      method: 'PATCH',
      json: { ...base, dateOfBirth: '1823-01-01' },
    });
    check('a date before 1900 is refused', ancient.status === 422, ancient.error);

    const saved = await c.json<{ profile: { dateOfBirth: string | null; showBirthday: boolean } }>(
      `/api/profile/${profileId}`,
      { method: 'PATCH', json: { ...base, dateOfBirth: '1990-03-14', showBirthday: false } },
    );
    check('a real date saves', saved.ok && saved.data.profile.dateOfBirth === '1990-03-14', saved.error ?? saved.data);
    check('the day does not shift across timezones', saved.data?.profile.dateOfBirth === '1990-03-14', saved.data);
    check('sharing it is off unless asked for', saved.data?.profile.showBirthday === false, saved.data);

    const hiddenPage = (await c.text(`/${username}`)).body;
    check('a private birthday is not drawn on the public page', !hiddenPage.includes('pp-birthday'), 'the birthday block rendered');
    check('and the date is not hiding in the page source either', !hiddenPage.includes('1990-03-14') && !hiddenPage.includes('14 March'), 'the date leaked into the payload');

    const hiddenCard = (await c.text(`/api/profile/${profileId}/vcard`)).body;
    check('and not in the saved contact', !hiddenCard.includes('BDAY'), hiddenCard.slice(0, 200));

    const shown = await c.json<{ profile: { showBirthday: boolean } }>(`/api/profile/${profileId}`, {
      method: 'PATCH',
      json: { ...base, dateOfBirth: '1990-03-14', showBirthday: true },
    });
    check('it can be switched on', shown.ok && shown.data.profile.showBirthday === true, shown.error);

    const shownPage = (await c.text(`/${username}`)).body;
    check('the public page then shows the day and month', shownPage.includes('14 March'), shownPage.slice(0, 120));
    // The QR is a base64 image; four given digits turn up in random base64
    // often enough that searching the raw bytes is not a real test. Strip the
    // image data and check the actual document.
    const withoutImages = shownPage.replace(/data:image\/[a-z+]+;base64,[A-Za-z0-9+/=]+/g, '');
    check('but the birth year never reaches the browser at all', !withoutImages.includes('1990'), 'the year leaked into the page source');
    check('nor the full date in any form', !shownPage.includes('1990-03-14'), 'the raw date leaked');

    const shownCard = (await c.text(`/api/profile/${profileId}/vcard`)).body;
    check('the saved contact carries the full date for a phone reminder', shownCard.includes('BDAY:1990-03-14'), shownCard.slice(0, 300));

    const cleared = await c.json<{ profile: { dateOfBirth: string | null } }>(`/api/profile/${profileId}`, {
      method: 'PATCH',
      json: { ...base, dateOfBirth: '', showBirthday: true },
    });
    check('clearing the date empties it', cleared.ok && cleared.data.profile.dateOfBirth === null, cleared.error);

    const clearedPage = (await c.text(`/${username}`)).body;
    check('and nothing is shown with the switch still on but no date', !clearedPage.includes('pp-birthday'), 'the birthday block rendered');
  }

  // ============================================================
  section('9c. Files a business hands out');

  {
    // What the sniffer actually looks at is the leading %PDF- signature, so
    // this is a genuine PDF header rather than a whole document.
    const pdf = Buffer.from('%PDF-1.4 test fixture');
    const form = new FormData();
    form.append('file', new Blob([pdf], { type: 'application/pdf' }), 'catalogue.pdf');
    const up = await c.form<{ id: string; bytes: number }>('/api/media/document', form);
    check('a PDF uploads', up.ok && Boolean(up.data.id), up.error);
    const fileId = up.data?.id ?? '';

    // a PNG renamed .pdf must not get through
    const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(40)]);
    const sneaky = new FormData();
    sneaky.append('file', new Blob([png], { type: 'application/pdf' }), 'sneaky.pdf');
    const bad = await c.form('/api/media/document', sneaky);
    check('a renamed image is refused on its magic bytes', bad.status === 415, { status: bad.status });

    const made = await c.json<{ profile: { documents: Array<{ id: string; title: string; sizeLabel: string; downloads: number }> } }>(
      `/api/profile/${profileId}/items?kind=document`,
      { json: { title: 'Diwali catalogue', description: '42 designs', fileId, active: true } },
    );
    check('the file is added to the profile', made.ok && made.data.profile.documents.length === 1, made.error);
    const docId = made.data?.profile.documents[0]?.id ?? '';
    check('its size is shown in something a person reads', /B|KB|MB/.test(made.data?.profile.documents[0]?.sizeLabel ?? ''), made.data?.profile.documents[0]);
    check('and it starts on zero opens', made.data?.profile.documents[0]?.downloads === 0);

    const notPdf = await c.json(`/api/profile/${profileId}/items?kind=document`, {
      json: { title: 'Sneaky', fileId: '00000000-0000-0000-0000-000000000000', active: true },
    });
    check('a file that is not a PDF cannot be attached', notPdf.status === 422 || notPdf.status === 404, notPdf.error);

    // the public page, and the open that gets counted
    await c.json(`/api/profile/${profileId}/publish`, { json: { publish: true } });
    const page = (await c.text(`/${username}`)).body;
    check('the file shows on the public profile', page.includes('Diwali catalogue'), page.slice(0, 120));

    const open = await anonOpen(`/api/profile/${profileId}/documents/${docId}/open`);
    check('opening it redirects to the file', open.status === 302, { status: open.status });

    const after = await db.profileDocument.findUnique({ where: { id: docId }, select: { downloads: true } });
    check('and the open is counted', after?.downloads === 1, after);

    const gone = await c.json<{ profile: { documents: unknown[] } }>(
      `/api/profile/${profileId}/items/${docId}?kind=document`,
      { method: 'DELETE' },
    );
    check('it can be removed again', gone.ok && gone.data.profile.documents.length === 0, gone.error);
  }

  // ============================================================
  section('9d. Asking a real customer for a review');

  {
    const biz = await c.json<{ profile: { businesses: Array<{ id: string }> } }>(
      `/api/profile/${profileId}/items?kind=business`,
      { json: { name: 'Sharma Interiors', active: true, showHours: false, isPrimary: true } },
    );
    const businessId = biz.data?.profile.businesses[0]?.id ?? '';

    const noUrl = await c.json('/api/review-requests', {
      json: { profileId, businessId, customerName: 'Meera', channel: 'copied' },
    });
    check('without a Google review link there is nowhere to send anyone', noUrl.status === 422, noUrl.error);
    check('and it says which link is missing', noUrl.error?.code === 'no_review_url', noUrl.error);

    await c.json(`/api/profile/${profileId}/items/${businessId}?kind=business`, {
      method: 'PATCH',
      json: { name: 'Sharma Interiors', active: true, showHours: false, isPrimary: true, googleReviewUrl: 'https://g.page/r/example/review' },
    });

    const asked = await c.json<{ id: string; link: string }>('/api/review-requests', {
      json: { profileId, businessId, customerName: 'Meera', phone: '9876543210', channel: 'whatsapp' },
    });
    check('a customer can be asked', asked.ok && asked.data.link.includes('/r/'), asked.error);

    const stranger = new Client('review-stranger');
    await stranger.json('/api/auth/signup', { json: { name: 'Nope', email: `${uniq('nr')}@example.com`, password } });
    const notMine = await stranger.json('/api/review-requests', {
      json: { profileId, businessId, customerName: 'Meera', channel: 'copied' },
    });
    check('nobody can send asks from a profile that is not theirs', notMine.status === 404, { status: notMine.status });

    const token = asked.data?.link.split('/r/')[1] ?? '';
    const hop = await anonOpen(`/r/${token}`);
    check('the link forwards to the business own Google page', hop.headers.get('location') === 'https://g.page/r/example/review', hop.headers.get('location'));

    const row = await db.reviewRequest.findUnique({ where: { token }, select: { openCount: true, openedAt: true } });
    check('the open is counted', row?.openCount === 1, row);
    check('and the first open is dated', row?.openedAt !== null, row);

    const dud = await anonOpen('/r/NOSUCHTOKEN');
    check('an unknown link goes somewhere friendly rather than crashing', dud.status === 302, { status: dud.status });
  }

  // ============================================================
  section('10. Deleting');

  {
    const gallery = await c.json<{ profile: { gallery: Array<{ id: string }> } }>(
      `/api/profile/${profileId}/items?kind=gallery`,
      { json: { kind: 'video', videoUrl: 'https://youtube.com/watch?v=abc' } },
    );
    const gid = gallery.data.profile.gallery[0]?.id;
    check('a gallery video is added', Boolean(gid), gallery.error);

    const del = await c.json<{ profile: { gallery: unknown[] } }>(
      `/api/profile/${profileId}/items/${gid}?kind=gallery`,
      { method: 'DELETE' },
    );
    check('it can be removed again', del.ok && del.data.profile.gallery.length === 0, del.error);

    const crossDelete = await c.json(`/api/profile/${profileId}/items/${gid}?kind=product`, { method: 'DELETE' });
    check('deleting with the wrong list is refused', crossDelete.status === 404, { status: crossDelete.status });
  }

  await db.$disconnect();
  return summary();
};

run().then((code) => process.exit(code)).catch((e) => {
  console.error('\nThe harness itself blew up:', e);
  process.exit(1);
});
