import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { requireUserOrRedirect } from '@/lib/guards';
import { isStaff } from '@/lib/auth';
import { assetUrl } from '@/lib/storage';
import CardArtwork from './CardArtwork';
import { rupees } from '@/lib/money';
import { ORDER_FLOW, ORDER_LABEL, ORDER_BLURB } from '@/lib/orders';
import { IconExternal } from '@/components/icons';

export const metadata: Metadata = { title: 'Order' };
export const dynamic = 'force-dynamic';

type Address = { line1?: string; line2?: string; city?: string; state?: string; pincode?: string; country?: string };

const showAddress = (a: unknown) => {
  const x = (a ?? {}) as Address;
  return [x.line1, x.line2, x.city, x.state, x.pincode, x.country].filter(Boolean).join(', ');
};

const BANNER: Record<string, { cls: string; text: string }> = {
  paid: { cls: 'form-good', text: 'Payment received. Everything below is up to date.' },
  confirming: {
    cls: 'form-good',
    text: 'Your payment went through and we are confirming it with the bank. This page updates by itself, usually within a minute.',
  },
  unpaid: {
    cls: 'form-error',
    text: 'This order is saved but not paid for yet. Nothing has been charged.',
  },
};

export default async function OrderDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ state?: string }>;
}) {
  const user = await requireUserOrRedirect('/dashboard/orders');
  const { id } = await params;
  const { state } = await searchParams;

  const order = await db.order.findUnique({
    where: { id },
    include: {
      items: { include: { product: { select: { slug: true } }, cards: { orderBy: { createdAt: 'asc' } } } },
      payments: { orderBy: { createdAt: 'desc' } },
      shipment: true,
      invoice: true,
      statusEvents: { orderBy: { createdAt: 'asc' } },
    },
  });

  if (!order) notFound();
  if (order.userId !== user.id && !isStaff(user.role)) notFound();

  const payment = order.payments[0];
  const currentIndex = ORDER_FLOW.indexOf(order.status as (typeof ORDER_FLOW)[number]);
  const banner = state ? BANNER[state] : null;

  // Lines for a card that is printed with the buyer's photograph on it. The
  // photo is asked for here rather than at checkout, so nobody has to find a
  // good one while they are paying.
  const printedToOrder = order.paidAt
    ? order.items.filter((i) => i.product?.slug === 'signature-portrait-nfc-card')
    : [];
  const artworkLocked = ['DISPATCHED', 'DELIVERED', 'ACTIVATED', 'CANCELLED'].includes(order.status);
  const photoIds = printedToOrder
    .map((i) => (i.customization as { photoMediaId?: string } | null)?.photoMediaId)
    .filter((x): x is string => typeof x === 'string');
  const photos = photoIds.length
    ? await db.mediaAsset.findMany({ where: { id: { in: photoIds } }, select: { id: true, externalUrl: true } })
    : [];
  const photoUrlFor = (mediaId: string | undefined) => {
    if (!mediaId) return null;
    const a = photos.find((x) => x.id === mediaId);
    return a ? assetUrl(a.id, a.externalUrl) : null;
  };

  // the first card on this order that is waiting to be activated
  const cardNeedingActivation = order.items
    .flatMap((i) => i.cards)
    .find((c) => c.status === 'ASSIGNED' || c.status === 'UNASSIGNED');

  return (
    <>
      <div className="page-head">
        <Link href="/dashboard/orders" className="muted small" style={{ textDecoration: 'none' }}>
          ← All orders
        </Link>
        <h1 style={{ marginTop: 10 }}>Order {order.orderNumber}</h1>
        <p>
          Placed on{' '}
          {order.createdAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
          {order.paidAt ? ' · paid' : ' · not paid yet'}
        </p>
      </div>

      {printedToOrder.map((i) => {
        const custom = (i.customization ?? {}) as { finish?: string; photoMediaId?: string };
        return (
          <CardArtwork
            key={i.id}
            orderId={order.id}
            orderItemId={i.id}
            productName={i.productName}
            finish={custom.finish ?? null}
            photoUrl={photoUrlFor(custom.photoMediaId)}
            locked={artworkLocked}
          />
        );
      })}

      {banner ? <p className={banner.cls} style={{ marginBottom: 20 }}>{banner.text}</p> : null}

      {cardNeedingActivation ? (
        <div className="card" style={{ marginBottom: 20, borderColor: 'rgba(52,224,240,.4)' }}>
          <div className="card-head">
            <h2>Your card is waiting to be switched on</h2>
          </div>
          <p className="muted small">
            Card {cardNeedingActivation.serial} has been assigned to you. Activate it with the code that came
            with it and it starts working immediately.
          </p>
          <p style={{ marginTop: 16 }}>
            <Link href="/dashboard/cards" className="btn btn-accent btn-sm">
              Activate my card
            </Link>
          </p>
        </div>
      ) : null}

      <div className="stack">
        <div className="card">
          <div className="card-head">
            <h2>Where it has got to</h2>
            <span className={`pill ${order.status === 'CANCELLED' ? 'bad' : order.status === 'ACTIVATED' ? 'live' : 'warn'}`}>
              {ORDER_LABEL[order.status] ?? order.status}
            </span>
          </div>

          {order.status === 'CANCELLED' ? (
            <p className="muted small">{ORDER_BLURB.CANCELLED}</p>
          ) : (
            <div className="timeline">
              {ORDER_FLOW.map((step, i) => {
                const done = currentIndex >= 0 && i < currentIndex;
                const now = step === order.status;
                return (
                  <div key={step} className={`tl${done ? ' done' : ''}${now ? ' now' : ''}`}>
                    <span className="tl-dot" aria-hidden="true" />
                    <div>
                      <b style={{ color: done || now ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                        {ORDER_LABEL[step]}
                      </b>
                      {now ? <p>{ORDER_BLURB[step]}</p> : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {order.shipment && order.shipment.awb ? (
          <div className="card">
            <div className="card-head">
              <h2>Tracking</h2>
            </div>
            <div className="stack-sm">
              <div className="sum-line">
                <span className="muted">Courier</span>
                <span>{order.shipment.courier}</span>
              </div>
              <div className="sum-line">
                <span className="muted">Tracking number</span>
                <span className="num">{order.shipment.awb}</span>
              </div>
              {order.shipment.dispatchedAt ? (
                <div className="sum-line">
                  <span className="muted">Dispatched</span>
                  <span>{order.shipment.dispatchedAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                </div>
              ) : null}
              {order.shipment.estimatedDelivery ? (
                <div className="sum-line">
                  <span className="muted">Expected</span>
                  <span>{order.shipment.estimatedDelivery.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                </div>
              ) : null}
            </div>
            {order.shipment.trackingUrl ? (
              <p style={{ marginTop: 16 }}>
                <a href={order.shipment.trackingUrl} target="_blank" rel="noopener" className="btn btn-ghost btn-sm">
                  <IconExternal /> Track it with the courier
                </a>
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="card">
          <div className="card-head">
            <h2>What you ordered</h2>
          </div>
          {order.items.map((i) => (
            <div className="sum-item" key={i.id}>
              <span style={{ flex: 1, minWidth: 0 }}>
                <b style={{ display: 'block', fontWeight: 600 }}>{i.productName}</b>
                <span className="muted tiny">
                  {i.quantity} x {rupees(i.unitMinor)}
                  {i.cards.length > 0 ? ` · card ${i.cards.map((c) => c.serial).join(', ')}` : ''}
                </span>
              </span>
              <span className="num">{rupees(i.totalMinor)}</span>
            </div>
          ))}

          <div style={{ marginTop: 16 }}>
            <div className="sum-line">
              <span className="muted">Subtotal</span>
              <span className="num">{rupees(order.subtotalMinor)}</span>
            </div>
            {order.discountMinor > 0 ? (
              <div className="sum-line">
                <span className="muted">Discount{order.couponCode ? ` (${order.couponCode})` : ''}</span>
                <span className="num" style={{ color: 'var(--accent)' }}>-{rupees(order.discountMinor)}</span>
              </div>
            ) : null}
            <div className="sum-line">
              <span className="muted">Shipping</span>
              <span className="num">{order.shippingMinor === 0 ? 'Free' : rupees(order.shippingMinor)}</span>
            </div>
            <div className="sum-line total">
              <span>Total</span>
              <span className="num">{rupees(order.totalMinor)}</span>
            </div>
            <p className="muted tiny" style={{ marginTop: 6 }}>Includes {rupees(order.taxMinor)} GST.</p>
          </div>
        </div>

        <div className="stats" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))' }}>
          <div className="card">
            <div className="card-head">
              <h2>Payment</h2>
              <span className={`pill ${payment?.status === 'SUCCESSFUL' ? 'live' : payment?.status === 'FAILED' ? 'bad' : 'warn'}`}>
                {payment?.status === 'SUCCESSFUL' ? 'Paid' : payment?.status === 'FAILED' ? 'Failed' : 'Pending'}
              </span>
            </div>
            {payment ? (
              <div className="stack-sm">
                <div className="sum-line">
                  <span className="muted">Amount</span>
                  <span className="num">{rupees(payment.amountMinor)}</span>
                </div>
                {payment.method ? (
                  <div className="sum-line">
                    <span className="muted">Method</span>
                    <span style={{ textTransform: 'capitalize' }}>{payment.method}</span>
                  </div>
                ) : null}
                {payment.gatewayPaymentId ? (
                  <div className="sum-line">
                    <span className="muted">Reference</span>
                    <span className="num tiny">{payment.gatewayPaymentId}</span>
                  </div>
                ) : null}
                {payment.refundedMinor > 0 ? (
                  <div className="sum-line">
                    <span className="muted">Refunded</span>
                    <span className="num">{rupees(payment.refundedMinor)}</span>
                  </div>
                ) : null}
                {payment.failureReason ? <p className="err">{payment.failureReason}</p> : null}
              </div>
            ) : (
              <p className="muted small">
                No payment has been started for this order yet. We will be in touch to collect it.
              </p>
            )}
            {order.invoice ? (
              <p style={{ marginTop: 16 }}>
                <a href={`/api/orders/${order.id}/invoice`} className="btn btn-quiet btn-sm">
                  Invoice {order.invoice.invoiceNumber}
                </a>
              </p>
            ) : null}
          </div>

          <div className="card">
            <div className="card-head">
              <h2>Delivery details</h2>
            </div>
            <div className="stack-sm small">
              <p><span className="muted">Name</span><br />{order.customerName}</p>
              <p><span className="muted">Phone</span><br />+91 {order.customerPhone}</p>
              <p><span className="muted">Email</span><br />{order.customerEmail}</p>
              <p><span className="muted">Ships to</span><br />{showAddress(order.shippingAddress)}</p>
              {order.gstNumber ? <p><span className="muted">GST</span><br />{order.gstNumber}</p> : null}
              {order.notes ? <p><span className="muted">Your note</span><br />{order.notes}</p> : null}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
