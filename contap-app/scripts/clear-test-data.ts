/**
 * Clears everything the automated test runs created.
 *
 * Kept: the accounts listed in KEEP, their profiles and orders, the product
 * catalogue, coupons and settings. Everything else — the throwaway
 * @example.com signups, their profiles, orders, payments, cards, leads and
 * analytics — is deleted.
 *
 *   npx tsx scripts/clear-test-data.ts               # show what would go
 *   npx tsx scripts/clear-test-data.ts --yes         # actually delete it
 *   npx tsx scripts/clear-test-data.ts --yes --all   # also wipe the kept
 *       accounts' own orders, cards, leads and analytics, leaving the
 *       accounts, their profiles and the catalogue. For getting the admin
 *       panel back to genuine zeros.
 *
 * This is a development convenience. It is deliberately not wired to an npm
 * script and refuses to run without --yes, because it destroys data.
 */
import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

const db = new PrismaClient();

/** The real accounts. Anything not on this list is treated as test data. */
const KEEP = [
  'arihant.cool812@gmail.com',
  'admin@nfcy.in',
  'admin@jodavo.in', // pre-rename addresses, kept so a stale row is never deleted
  'admin@contap.in', // the pre-rename address, kept so a stale row is never deleted
  'diamondinhouse@gmail.com',
  'arihantsurana143@yahoo.in',
];

async function main() {
  const commit = process.argv.includes('--yes');
  // --all also clears the real accounts' trading records, so every number in
  // the admin panel reads zero. Profiles, accounts and the catalogue stay.
  const all = process.argv.includes('--all');

  const keepIds = (await db.user.findMany({ where: { email: { in: KEEP } }, select: { id: true } })).map((u) => u.id);
  if (keepIds.length === 0) {
    console.error('None of the KEEP accounts exist. Refusing to run: that would empty the database.');
    process.exit(1);
  }

  const orderIds = (
    await db.order.findMany({
      where: all
        ? {}
        : { OR: [{ customerEmail: { contains: '@example.com' } }, { userId: { notIn: keepIds } }] },
      select: { id: true },
    })
  ).map((o) => o.id);

  const profileIds = (
    await db.profile.findMany({ where: { userId: { notIn: keepIds } }, select: { id: true } })
  ).map((p) => p.id);

  console.log(`Keeping ${keepIds.length} accounts: ${KEEP.join(', ')}`);
  console.log(`Test orders: ${orderIds.length}   test profiles: ${profileIds.length}\n`);

  // children before parents, so nothing is left pointing at a row that is gone
  const steps: Array<[string, () => Promise<{ count: number }>]> = [
    ['analytics events', () => db.analyticsEvent.deleteMany({ where: all ? {} : { profileId: { in: profileIds } } })],
    ['leads', () => db.lead.deleteMany({ where: all ? {} : { profileId: { in: profileIds } } })],
    ['review requests', () => db.reviewRequest.deleteMany({ where: all ? {} : { profileId: { in: profileIds } } })],
    ['nfc cards', () => db.nfcCard.deleteMany({ where: all ? {} : { OR: [{ userId: { notIn: keepIds } }, { batch: 'TEST-FIXTURE' }, { orderItem: { orderId: { in: orderIds } } }] } })],
    // Orphans from the old pre-printed batches. Nothing is printed before it is
    // ordered any more, so a card with no owner and no order cannot be real.
    ['orphan cards', () => db.nfcCard.deleteMany({ where: { userId: null, orderItemId: null, profileId: null } })],
    ['subscriptions', () => db.subscription.deleteMany({ where: all ? {} : { userId: { notIn: keepIds } } })],
    ['invoices', () => db.invoice.deleteMany({ where: { orderId: { in: orderIds } } })],
    ['payments', () => db.payment.deleteMany({ where: { orderId: { in: orderIds } } })],
    ['shipments', () => db.shipment.deleteMany({ where: { orderId: { in: orderIds } } })],
    ['order events', () => db.orderStatusEvent.deleteMany({ where: { orderId: { in: orderIds } } })],
    ['order items', () => db.orderItem.deleteMany({ where: { orderId: { in: orderIds } } })],
    ['orders', () => db.order.deleteMany({ where: { id: { in: orderIds } } })],
    ['profiles', () => db.profile.deleteMany({ where: { id: { in: profileIds } } })],
    ['notifications', () => db.notification.deleteMany({ where: all ? {} : { userId: { notIn: keepIds } } })],
    ['sessions', () => db.session.deleteMany({ where: { userId: { notIn: keepIds } } })],
    ['audit entries', () => db.auditLog.deleteMany({ where: all ? {} : { userId: { notIn: keepIds } } })],
    ['users', () => db.user.deleteMany({ where: { id: { notIn: keepIds } } })],
    ['rate limits', () => db.rateLimit.deleteMany({})],
    ['webhook events', () => db.webhookEvent.deleteMany({})],
  ];

  if (!commit) {
    console.log('Dry run. Nothing has been deleted.');
    console.log(`Counts that would be affected:\n`);
    console.log(`  ${String(profileIds.length).padStart(5)}  profiles`);
    console.log(`  ${String(orderIds.length).padStart(5)}  orders`);
    console.log(`  ${String(await db.user.count({ where: { id: { notIn: keepIds } } })).padStart(5)}  users`);
    console.log(`  ${String(await db.nfcCard.count({ where: { OR: [{ userId: { notIn: keepIds } }, { batch: 'TEST-FIXTURE' }] } })).padStart(5)}  nfc cards`);
    console.log('\nRun again with --yes to delete.');
    return;
  }

  for (const [label, run] of steps) {
    try {
      const r = await run();
      console.log(`  ${String(r.count).padStart(5)}  ${label}`);
    } catch (e) {
      console.log(`  FAILED ${label}: ${(e as Error).message.split('\n')[0]}`);
    }
  }

  console.log('\nWhat is left:');
  console.log(`  users        ${await db.user.count()}`);
  console.log(`  profiles     ${await db.profile.count()}`);
  console.log(`  orders       ${await db.order.count()}`);
  console.log(`  cards        ${await db.nfcCard.count()}`);
  console.log(`  products     ${await db.product.count()}  (catalogue untouched)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
