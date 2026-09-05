import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { currentUser, isStaff } from '@/lib/auth';
import { rupees, splitInclusiveTax } from '@/lib/money';
import { env } from '@/lib/env';

export const runtime = 'nodejs';

type Address = { line1?: string; line2?: string; city?: string; state?: string; pincode?: string; country?: string };

const esc = (v: unknown) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const addr = (a: unknown) => {
  const x = (a ?? {}) as Address;
  return [x.line1, x.line2, x.city, x.state, x.pincode, x.country].filter(Boolean).map(esc).join('<br>');
};

/**
 * A printable invoice.
 *
 * Deliberately plain HTML with a print stylesheet rather than a PDF library:
 * every browser and every phone can already turn this into a PDF, and there is
 * no binary dependency to break on a deploy.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return new NextResponse('Please sign in.', { status: 401 });

  const { id } = await ctx.params;
  const order = await db.order.findUnique({
    where: { id },
    include: { items: true, invoice: true, payments: { where: { status: 'SUCCESSFUL' }, take: 1 } },
  });

  if (!order) return new NextResponse('Not found', { status: 404 });
  if (order.userId !== user.id && !isStaff(user.role)) return new NextResponse('Not found', { status: 404 });
  if (!order.invoice) {
    return new NextResponse('There is no invoice for this order yet. It is created when payment is received.', {
      status: 409,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }

  const rows = order.items
    .map((i) => {
      const { baseMinor, taxMinor } = splitInclusiveTax(i.totalMinor, 18);
      return `<tr>
        <td>${esc(i.productName)}<br><span class="dim">${esc(i.productSku)}</span></td>
        <td class="r">${i.quantity}</td>
        <td class="r">${rupees(Math.round(baseMinor / i.quantity))}</td>
        <td class="r">${rupees(baseMinor)}</td>
        <td class="r">${rupees(taxMinor)}</td>
        <td class="r">${rupees(i.totalMinor)}</td>
      </tr>`;
    })
    .join('');

  const { baseMinor, taxMinor } = splitInclusiveTax(order.totalMinor, 18);
  const paid = order.payments[0];

  const html = `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Invoice ${esc(order.invoice.invoiceNumber)}</title>
<style>
  *{box-sizing:border-box}
  body{font:14px/1.55 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#111;background:#f5f6f8;margin:0;padding:28px}
  .sheet{max-width:820px;margin:0 auto;background:#fff;padding:44px;border-radius:10px;box-shadow:0 2px 20px rgba(0,0,0,.08)}
  header{display:flex;justify-content:space-between;gap:24px;flex-wrap:wrap;align-items:flex-start;border-bottom:2px solid #111;padding-bottom:20px}
  .brand{font-size:24px;font-weight:700;letter-spacing:-.02em}
  .brand span{color:#0F9BAE}
  h1{font-size:19px;margin:0 0 4px;letter-spacing:-.01em}
  .dim{color:#666;font-size:12px}
  .cols{display:flex;gap:40px;flex-wrap:wrap;margin:26px 0}
  .cols>div{flex:1;min-width:210px}
  .lbl{font-size:11px;letter-spacing:.09em;text-transform:uppercase;color:#666;margin-bottom:6px}
  table{width:100%;border-collapse:collapse;margin-top:14px;font-size:13px}
  th{text-align:left;font-size:11px;letter-spacing:.07em;text-transform:uppercase;color:#666;border-bottom:1px solid #ddd;padding:9px 8px}
  td{padding:11px 8px;border-bottom:1px solid #eee;vertical-align:top}
  .r{text-align:right;white-space:nowrap}
  .totals{margin-left:auto;margin-top:18px;width:min(300px,100%)}
  .totals div{display:flex;justify-content:space-between;padding:6px 8px}
  .totals .grand{border-top:2px solid #111;margin-top:6px;padding-top:12px;font-size:17px;font-weight:700}
  .paid{display:inline-block;margin-top:16px;padding:5px 12px;border-radius:99px;font-size:12px;font-weight:600;
        background:#e6f7ea;color:#186b32;border:1px solid #b9e5c6}
  footer{margin-top:34px;padding-top:18px;border-top:1px solid #eee;color:#666;font-size:12px}
  .noprint{margin:0 auto 18px;max-width:820px;display:flex;gap:10px}
  button,a.btn{font:inherit;padding:9px 16px;border-radius:8px;border:1px solid #ccc;background:#fff;cursor:pointer;text-decoration:none;color:#111}
  @media print{body{background:#fff;padding:0}.sheet{box-shadow:none;border-radius:0;padding:0;max-width:none}.noprint{display:none}}
</style>
</head><body>
<div class="noprint">
  <button onclick="window.print()">Print or save as PDF</button>
  <a class="btn" href="/dashboard/orders/${esc(order.id)}">Back to the order</a>
</div>

<div class="sheet">
  <header>
    <div>
      <p class="brand">Con<span>tap</span></p>
      <p class="dim">Digital identity for people and businesses</p>
      <p class="dim">${esc(env.appUrl.replace(/^https?:\/\//, ''))}</p>
    </div>
    <div style="text-align:right">
      <h1>Tax invoice</h1>
      <p class="dim">${esc(order.invoice.invoiceNumber)}</p>
      <p class="dim">${order.invoice.issuedAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
      <p class="dim">Order ${esc(order.orderNumber)}</p>
    </div>
  </header>

  <div class="cols">
    <div>
      <p class="lbl">Billed to</p>
      <p><strong>${esc(order.customerName)}</strong></p>
      ${order.companyName ? `<p>${esc(order.companyName)}</p>` : ''}
      <p>${addr(order.billingAddress)}</p>
      <p class="dim">+91 ${esc(order.customerPhone)} · ${esc(order.customerEmail)}</p>
      ${order.gstNumber ? `<p class="dim">GSTIN ${esc(order.gstNumber)}</p>` : ''}
    </div>
    <div>
      <p class="lbl">Shipped to</p>
      <p>${addr(order.shippingAddress)}</p>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Item</th><th class="r">Qty</th><th class="r">Rate</th>
        <th class="r">Taxable</th><th class="r">GST 18%</th><th class="r">Amount</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="totals">
    <div><span>Taxable value</span><span>${rupees(baseMinor)}</span></div>
    <div><span>GST 18%</span><span>${rupees(taxMinor)}</span></div>
    ${order.discountMinor > 0 ? `<div><span>Discount${order.couponCode ? ` (${esc(order.couponCode)})` : ''}</span><span>-${rupees(order.discountMinor)}</span></div>` : ''}
    <div><span>Shipping</span><span>${order.shippingMinor === 0 ? 'Free' : rupees(order.shippingMinor)}</span></div>
    <div class="grand"><span>Total</span><span>${rupees(order.totalMinor)}</span></div>
  </div>

  ${paid ? `<p class="paid">Paid${paid.method ? ` by ${esc(paid.method)}` : ''}${paid.gatewayPaymentId ? ` · ${esc(paid.gatewayPaymentId)}` : ''}</p>` : ''}

  <footer>
    <p>Prices shown on our site include GST. This invoice splits it out.</p>
    <p>Thank you for your order. Questions about it go to ${esc(env.supportEmail)}.</p>
  </footer>
</div>
</body></html>`;

  return new NextResponse(html, {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
}
