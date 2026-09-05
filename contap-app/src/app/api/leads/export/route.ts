import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { currentUser } from '@/lib/auth';

export const runtime = 'nodejs';

/**
 * Excel opens CSVs and will happily execute a cell that starts with =, +, - or @.
 * Prefixing those with a quote makes the value inert without changing what it says.
 */
function cell(v: unknown): string {
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return new NextResponse('Please sign in.', { status: 401 });

  const url = new URL(req.url);
  const status = url.searchParams.get('status');

  const profiles = await db.profile.findMany({ where: { userId: user.id }, select: { id: true } });
  if (!profiles.length) return new NextResponse('No profiles on this account.', { status: 404 });

  const leads = await db.lead.findMany({
    where: {
      profileId: { in: profiles.map((p) => p.id) },
      ...(status && ['NEW', 'CONTACTED', 'CONVERTED', 'CLOSED'].includes(status) ? { status: status as 'NEW' } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 5000,
  });

  const header = ['Received', 'Name', 'Phone', 'Email', 'Message', 'Status', 'Note'];
  const rows = leads.map((l) => [
    l.createdAt.toISOString(),
    l.name,
    l.phone ?? '',
    l.email ?? '',
    l.message ?? '',
    l.status,
    l.note ?? '',
  ]);

  // the BOM makes Excel read it as UTF-8, so Indian names and the rupee sign survive
  const csv = '﻿' + [header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n');

  return new NextResponse(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="nfcy-enquiries-${new Date().toISOString().slice(0, 10)}.csv"`,
      'cache-control': 'no-store',
    },
  });
}
