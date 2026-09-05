import Link from 'next/link';
import type { Metadata } from 'next';
import type { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { requireStaffOrRedirect } from '@/lib/guards';
import { qrDataUrl, tapUrl } from '@/lib/qr';

export const metadata: Metadata = { title: 'Print sheet' };
export const dynamic = 'force-dynamic';

const MAX = 200;

/**
 * The sheet a card printer works from.
 *
 * Each tile is one physical card: its QR, the serial that gets printed beside
 * it, and the URL the QR encodes so a human can check a proof against it. The
 * QR is of the card's own short code, which is the same thing the NFC chip
 * stores, so tapping and scanning land in the same place.
 *
 * Every card here belongs to somebody: nothing is printed before it is ordered,
 * so each tile also names the buyer and the order it came from. That is how a
 * finished card gets into the right envelope.
 */
export default async function PrintSheet({
  searchParams,
}: {
  searchParams: Promise<{ batch?: string; status?: string; limit?: string }>;
}) {
  await requireStaffOrRedirect('cards.view');
  const { batch = '', status = 'ASSIGNED', limit } = await searchParams;

  const take = Math.min(MAX, Math.max(1, Number(limit) || MAX));

  const where: Prisma.NfcCardWhereInput = {
    ...(batch ? { batch } : {}),
    ...(status && status !== 'all' ? { status: status as 'ASSIGNED' } : {}),
  };

  const [cards, batches] = await Promise.all([
    db.nfcCard.findMany({
      where,
      orderBy: [{ batch: 'asc' }, { serial: 'asc' }],
      take,
      select: {
        id: true, code: true, serial: true, batch: true, status: true,
        user: { select: { name: true, email: true } },
        orderItem: { select: { productName: true, order: { select: { orderNumber: true, customerName: true } } } },
      },
    }),
    db.nfcCard.groupBy({ by: ['batch'], _count: { _all: true }, orderBy: { batch: 'desc' } }),
  ]);

  // generated on the server so the sheet prints with no network requests at all
  const tiles = await Promise.all(
    cards.map(async (c) => ({
      ...c,
      url: tapUrl(c.code),
      qr: await qrDataUrl(tapUrl(c.code), 420),
    })),
  );

  return (
    <>
      <div className="page-head no-print">
        <h1>Print sheet</h1>
        <p>
          One tile per card. The QR encodes the card&apos;s own short code, the same address the chip is programmed
          with, so a scan and a tap land in the same place. Each tile names the buyer and the order, so a finished
          card goes into the right envelope. Print this page, or save it as a PDF for the card printer.
        </p>
      </div>

      <div className="card no-print" style={{ marginBottom: 22 }}>
        <div className="card-head">
          <h2>Choose a batch</h2>
          <span className="muted small">
            {tiles.length} card{tiles.length === 1 ? '' : 's'} shown{cards.length === take ? `, capped at ${MAX}` : ''}
          </span>
        </div>

        <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
          <Link href="/admin/cards/print" className={`btn btn-sm ${batch ? 'btn-quiet' : 'btn-accent'}`}>
            Every unassigned card
          </Link>
          {batches
            .filter((b) => b.batch)
            .map((b) => (
              <Link
                key={b.batch}
                href={`/admin/cards/print?batch=${encodeURIComponent(b.batch as string)}`}
                className={`btn btn-sm ${batch === b.batch ? 'btn-accent' : 'btn-quiet'}`}
              >
                {b.batch} <span className="muted">({b._count._all})</span>
              </Link>
            ))}
        </div>

        <p className="muted tiny" style={{ marginTop: 14 }}>
          Each QR is also downloadable on its own as SVG, which is what a printer will ask for. Vector stays sharp at
          any size, and a card QR is usually printed at 12 to 16 mm.
        </p>
      </div>

      {tiles.length === 0 ? (
        <div className="empty no-print">
          <h3>No cards match</h3>
          <p>Make a batch on the NFC cards page first, then come back here to print it.</p>
          <Link href="/admin/cards" className="btn btn-accent">
            Go to NFC cards
          </Link>
        </div>
      ) : (
        <div className="print-sheet">
          {tiles.map((t) => (
            <div className="print-tile" key={t.id}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={t.qr} alt={`QR for card ${t.serial}`} />
              <p className="print-serial">{t.serial}</p>
              <p className="print-url">{t.url}</p>
              <p className="print-who">
                {t.orderItem?.order?.customerName ?? t.user?.name ?? 'Unclaimed'}
                {t.orderItem?.order?.orderNumber ? <><br />{t.orderItem.order.orderNumber}</> : null}
                {t.orderItem?.productName ? <><br />{t.orderItem.productName}</> : null}
              </p>
              <a className="btn btn-quiet btn-sm no-print" href={`/api/admin/cards/${t.id}/qr?download=1`} download>
                SVG
              </a>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
