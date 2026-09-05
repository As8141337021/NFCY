import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { requireStaffOrRedirect } from '@/lib/guards';
import { can } from '@/lib/auth';
import { rupees } from '@/lib/money';
import { ORDER_LABEL } from '@/lib/orders';
import OrderActions from './OrderActions';

export const metadata: Metadata = { title: 'Order' };
export const dynamic = 'force-dynamic';

type Address = { line1?: string; line2?: string; city?: string; state?: string; pincode?: string; country?: string };
const showAddress = (a: unknown) => {
  const x = (a ?? {}) as Address;
  return [x.line1, x.line2, x.city, x.state, x.pincode, x.country].filter(Boolean).join(', ');
};

export default async function AdminOrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaffOrRedirect('orders.view');
  const { id } = await params;

  const order = await db.order.findUnique({
    where: { id },
    include: {
      items: { include: { product: true, cards: { orderBy: { createdAt: 'asc' } } } },
      payments: { orderBy: { createdAt: 'desc' } },
      shipment: true,
      invoice: true,
      statusEvents: { orderBy: { createdAt: 'desc' } },
      user: { select: { id: true, name: true, email: true, phone: true, profiles: { select: { username: true, status: true } } } },
    },
  });

  if (!order) notFound();

  // only cards for the right product, and only ones nobody has yet
  const productIds = order.items.map((i) => i.productId).filter((x): x is string => Boolean(x));

  const payment = order.payments[0];
  const canUpdate = can(staff.role, 'orders.update') || can(staff.role, 'orders.ship');

  return (
    <>
      <div className="page-head">
        <Link href="/admin/orders" className="muted small" style={{ textDecoration: 'none' }}>
          ← All orders
        </Link>
        <div className="row" style={{ marginTop: 10, justifyContent: 'space-between' }}>
          <h1>{order.orderNumber}</h1>
          <div className="row">
            <span className={`pill ${order.paidAt ? 'live' : 'bad'}`}>{order.paidAt ? 'Paid' : 'Unpaid'}</span>
            <span className="pill">{ORDER_LABEL[order.status] ?? order.status}</span>
          </div>
        </div>
        <p>
          Placed {order.createdAt.toLocaleString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
          {order.paidAt ? ` · paid ${order.paidAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : ''}
        </p>
      </div>

      <div className="stack">
        <div className="stats" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))' }}>
          <div className="card">
            <div className="card-head"><h2>Customer</h2></div>
            <div className="stack-sm small">
              <p><span className="muted">Name</span><br />{order.customerName}</p>
              <p><span className="muted">Phone</span><br /><a href={`https://wa.me/91${order.customerPhone}`} target="_blank" rel="noopener" style={{ color: 'var(--accent)' }}>+91 {order.customerPhone}</a></p>
              <p><span className="muted">Email</span><br />{order.customerEmail}</p>
              {order.companyName ? <p><span className="muted">Company</span><br />{order.companyName}</p> : null}
              {order.gstNumber ? <p><span className="muted">GST</span><br />{order.gstNumber}</p> : null}
              {order.user ? (
                <p>
                  <span className="muted">Account</span><br />
                  <Link href={`/admin/users?q=${encodeURIComponent(order.user.email)}`} style={{ color: 'var(--accent)' }}>
                    {order.user.email}
                  </Link>
                  {order.user.profiles.length ? (
                    <>
                      <br />
                      <span className="muted tiny">
                        Profile: {order.user.profiles.map((p) => `${p.username} (${p.status.toLowerCase()})`).join(', ')}
                      </span>
                    </>
                  ) : (
                    <>
                      <br />
                      <span className="pill warn" style={{ marginTop: 6 }}>No profile built yet</span>
                    </>
                  )}
                </p>
              ) : (
                <p><span className="muted">Account</span><br />Ordered without signing in</p>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-head"><h2>Delivery</h2></div>
            <div className="stack-sm small">
              <p><span className="muted">Ship to</span><br />{showAddress(order.shippingAddress)}</p>
              <p><span className="muted">Bill to</span><br />{showAddress(order.billingAddress)}</p>
              {order.notes ? <p><span className="muted">Customer note</span><br />{order.notes}</p> : null}
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <h2>Payment</h2>
              <span className={`pill ${payment?.status === 'SUCCESSFUL' ? 'live' : payment?.status === 'FAILED' ? 'bad' : 'warn'}`}>
                {payment?.status ?? 'None'}
              </span>
            </div>
            <div className="stack-sm small">
              <p><span className="muted">Total</span><br /><span className="num">{rupees(order.totalMinor)}</span></p>
              {payment?.gatewayPaymentId ? <p><span className="muted">Gateway reference</span><br /><span className="num tiny">{payment.gatewayPaymentId}</span></p> : null}
              {payment?.method ? <p><span className="muted">Method</span><br /><span style={{ textTransform: 'capitalize' }}>{payment.method}</span></p> : null}
              {payment?.refundedMinor ? <p><span className="muted">Refunded</span><br /><span className="num">{rupees(payment.refundedMinor)}</span></p> : null}
              {payment?.failureReason ? <p className="err">{payment.failureReason}</p> : null}
              {order.invoice ? (
                <p>
                  <a href={`/api/orders/${order.id}/invoice`} className="btn btn-quiet btn-sm" target="_blank" rel="noopener">
                    Invoice {order.invoice.invoiceNumber}
                  </a>
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head"><h2>Items</h2></div>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Qty</th>
                  <th>Unit</th>
                  <th>Total</th>
                  <th>Card</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((i) => (
                  <tr key={i.id}>
                    <td>{i.productName}<br /><span className="muted tiny">{i.productSku}</span></td>
                    <td className="num">{i.quantity}</td>
                    <td className="num">{rupees(i.unitMinor)}</td>
                    <td className="num">{rupees(i.totalMinor)}</td>
                    <td>
                      {(i.customization as { finish?: string; photoMediaId?: string } | null)?.finish ||
                      (i.customization as { photoMediaId?: string } | null)?.photoMediaId ? (
                        <span className="tiny" style={{ display: 'block', marginBottom: 6 }}>
                          {(i.customization as { finish?: string }).finish ? (
                            <span className="pill">{(i.customization as { finish?: string }).finish}</span>
                          ) : null}
                          {(i.customization as { photoMediaId?: string }).photoMediaId ? (
                            <a
                              href={`/api/media/${(i.customization as { photoMediaId: string }).photoMediaId}`}
                              target="_blank"
                              rel="noopener"
                              style={{ display: 'inline-block', marginLeft: 6 }}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={`/api/media/${(i.customization as { photoMediaId: string }).photoMediaId}`}
                                alt="Photo to print on this card"
                                width={40}
                                height={40}
                                style={{ borderRadius: 6, objectFit: 'cover', verticalAlign: 'middle' }}
                              />
                            </a>
                          ) : (
                            <span className="pill warn">no photo yet</span>
                          )}
                        </span>
                      ) : null}
                      {i.cards.length > 0 ? (
                        <span className="num tiny">
                          {i.cards.map((c) => (
                            <span key={c.id} style={{ display: 'block', marginBottom: 4 }}>
                              {c.serial}{' '}
                              <span className={`pill ${c.status === 'ACTIVE' ? 'live' : 'warn'}`}>{c.status.toLowerCase()}</span>
                            </span>
                          ))}
                        </span>
                      ) : i.product?.kind === 'RENEWAL' ? (
                        <span className="muted tiny">n/a</span>
                      ) : (
                        <span className="pill warn">none yet</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 18, maxWidth: 320, marginLeft: 'auto' }}>
            <div className="sum-line"><span className="muted">Subtotal</span><span className="num">{rupees(order.subtotalMinor)}</span></div>
            {order.discountMinor > 0 ? (
              <div className="sum-line"><span className="muted">Discount {order.couponCode ?? ''}</span><span className="num">-{rupees(order.discountMinor)}</span></div>
            ) : null}
            <div className="sum-line"><span className="muted">Shipping</span><span className="num">{order.shippingMinor === 0 ? 'Free' : rupees(order.shippingMinor)}</span></div>
            <div className="sum-line total"><span>Total</span><span className="num">{rupees(order.totalMinor)}</span></div>
          </div>
        </div>

        {canUpdate ? (
          <OrderActions
            orderId={order.id}
            status={order.status}
            paid={Boolean(order.paidAt)}
            lines={order.items.map((i) => ({
              id: i.id,
              productName: i.productName,
              quantity: i.quantity,
              cardSerial: i.cards.map((c) => c.serial).join(', ') || null,
              needsCard: i.product?.kind !== 'RENEWAL',
            }))}
            shipment={
              order.shipment
                ? {
                    courier: order.shipment.courier ?? '',
                    awb: order.shipment.awb ?? '',
                    trackingUrl: order.shipment.trackingUrl ?? '',
                    status: order.shipment.status,
                    estimatedDelivery: order.shipment.estimatedDelivery
                      ? order.shipment.estimatedDelivery.toISOString().slice(0, 10)
                      : '',
                  }
                : null
            }
          />
        ) : null}
      </div>
    </>
  );
}
