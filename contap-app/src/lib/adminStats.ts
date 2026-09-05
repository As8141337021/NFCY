import 'server-only';
import { db } from './db';

const startOfDay = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};
const startOfMonth = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
};
const startOfYear = () => new Date(new Date().getFullYear(), 0, 1);

/** Revenue only ever counts orders that were actually paid for. */
const PAID = { paidAt: { not: null } } as const;

export async function revenueStats() {
  const [today, month, year, allTime, ordersMonth, avg] = await Promise.all([
    db.order.aggregate({ where: { ...PAID, paidAt: { gte: startOfDay() } }, _sum: { totalMinor: true } }),
    db.order.aggregate({ where: { ...PAID, paidAt: { gte: startOfMonth() } }, _sum: { totalMinor: true } }),
    db.order.aggregate({ where: { ...PAID, paidAt: { gte: startOfYear() } }, _sum: { totalMinor: true } }),
    db.order.aggregate({ where: PAID, _sum: { totalMinor: true }, _count: { _all: true } }),
    db.order.count({ where: { ...PAID, paidAt: { gte: startOfMonth() } } }),
    db.order.aggregate({ where: PAID, _avg: { totalMinor: true } }),
  ]);

  return {
    todayMinor: today._sum.totalMinor ?? 0,
    monthMinor: month._sum.totalMinor ?? 0,
    yearMinor: year._sum.totalMinor ?? 0,
    allTimeMinor: allTime._sum.totalMinor ?? 0,
    paidOrders: allTime._count._all,
    ordersThisMonth: ordersMonth,
    averageOrderMinor: Math.round(avg._avg.totalMinor ?? 0),
  };
}

export async function platformStats() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 864e5);

  const [users, newUsers, profiles, published, cardsMade, cardsActive, pendingOrders, unreadLeads, subs, expiring] =
    await Promise.all([
      db.user.count({ where: { role: 'CUSTOMER', status: 'ACTIVE' } }),
      db.user.count({ where: { role: 'CUSTOMER', createdAt: { gte: thirtyDaysAgo } } }),
      db.profile.count(),
      db.profile.count({ where: { status: 'PUBLISHED' } }),
      db.nfcCard.count(),
      db.nfcCard.count({ where: { status: 'ACTIVE' } }),
      db.order.count({ where: { status: { notIn: ['DELIVERED', 'ACTIVATED', 'CANCELLED'] }, paidAt: { not: null } } }),
      db.lead.count({ where: { status: 'NEW' } }),
      db.subscription.count({ where: { status: 'ACTIVE' } }),
      db.subscription.count({
        where: { status: { in: ['ACTIVE', 'EXPIRING'] }, expiresAt: { lte: new Date(Date.now() + 30 * 864e5) } },
      }),
    ]);

  return {
    users, newUsers, profiles, published, cardsMade, cardsActive,
    pendingOrders, unreadLeads, activeSubscriptions: subs, expiringSoon: expiring,
  };
}

/** Units and revenue per product, from real paid orders only. */
export async function productSales() {
  const paidOrderIds = (await db.order.findMany({ where: PAID, select: { id: true } })).map((o) => o.id);
  if (!paidOrderIds.length) return [];

  const grouped = await db.orderItem.groupBy({
    by: ['productId', 'productName'],
    where: { orderId: { in: paidOrderIds } },
    _sum: { quantity: true, totalMinor: true },
  });

  return grouped
    .map((g) => ({
      productId: g.productId,
      name: g.productName,
      units: g._sum.quantity ?? 0,
      revenueMinor: g._sum.totalMinor ?? 0,
    }))
    .sort((a, b) => b.revenueMinor - a.revenueMinor);
}

/** Revenue per day for the last N days, for the chart. */
export async function revenueSeries(days = 30) {
  const from = startOfDay();
  from.setDate(from.getDate() - (days - 1));

  const orders = await db.order.findMany({
    where: { ...PAID, paidAt: { gte: from } },
    select: { paidAt: true, totalMinor: true },
  });

  const buckets = new Map<string, { date: string; revenueMinor: number; orders: number }>();
  for (let i = 0; i < days; i++) {
    const d = new Date(from);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    buckets.set(key, { date: key, revenueMinor: 0, orders: 0 });
  }

  for (const o of orders) {
    if (!o.paidAt) continue;
    const key = o.paidAt.toISOString().slice(0, 10);
    const b = buckets.get(key);
    if (!b) continue;
    b.revenueMinor += o.totalMinor;
    b.orders += 1;
  }

  return [...buckets.values()];
}

/**
 * How many people who could have renewed actually did.
 * Only counts subscriptions old enough to have faced a renewal, so a brand new
 * platform reports "not enough history yet" rather than a made up number.
 */
export async function renewalRate() {
  const dueBy = new Date();
  const eligible = await db.subscription.count({ where: { expiresAt: { lt: dueBy } } });
  if (eligible === 0) return { rate: null as number | null, eligible: 0, renewed: 0 };

  const renewed = await db.subscription.count({
    where: { expiresAt: { lt: dueBy }, status: 'ACTIVE' },
  });
  return { rate: Math.round((renewed / eligible) * 100), eligible, renewed };
}
