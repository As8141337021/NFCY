'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, rupees } from '@/lib/client';
import { useCart } from '@/lib/cart';
import { useToast } from '@/components/Toast';
import { TextField, TextArea, Check } from '@/components/forms';

type Priced = {
  lines: Array<{ productId: string; productName: string; unitMinor: number; quantity: number; totalMinor: number }>;
  subtotalMinor: number;
  discountMinor: number;
  shippingMinor: number;
  taxMinor: number;
  totalMinor: number;
  coupon: { id: string; code: string } | null;
  couponMessage?: string;
};

type RazorpayOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  prefill: { name: string; email: string; contact: string };
  theme: { color: string };
  handler: (r: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => void;
  modal: { ondismiss: () => void };
};
type RazorpayInstance = { open: () => void; on: (e: string, cb: (x: unknown) => void) => void };

declare global {
  interface Window {
    Razorpay?: new (o: RazorpayOptions) => RazorpayInstance;
  }
}

const emptyAddress = { line1: '', line2: '', city: '', state: '', pincode: '', country: 'India' };


type Address = typeof emptyAddress;

/**
 * Defined at module level on purpose.
 *
 * When this lived inside CheckoutClient, every keystroke produced a NEW
 * component type, so React threw the inputs away and rebuilt them. The field
 * lost focus after a single character and the address was impossible to type.
 */
function AddressFields({
  which,
  value,
  onChange,
  fields,
}: {
  which: 'billing' | 'shipping';
  value: Address;
  onChange: React.Dispatch<React.SetStateAction<Address>>;
  fields: Record<string, string>;
}) {
  const set = (k: keyof Address) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    onChange((a) => ({ ...a, [k]: v }));
  };

  return (
    <>
      <TextField
        label="Address"
        value={value.line1}
        onChange={set('line1')}
        placeholder="Flat, building, street"
        autoComplete={which === 'billing' ? 'billing address-line1' : 'shipping address-line1'}
        error={fields[`${which}Address.line1`]}
        required
      />
      <TextField
        label="Area"
        value={value.line2}
        onChange={set('line2')}
        placeholder="Landmark or area"
        autoComplete={which === 'billing' ? 'billing address-line2' : 'shipping address-line2'}
        error={fields[`${which}Address.line2`]}
      />
      <div className="form-grid-2">
        <TextField
          label="City"
          value={value.city}
          onChange={set('city')}
          placeholder="Ahmedabad"
          autoComplete={which === 'billing' ? 'billing address-level2' : 'shipping address-level2'}
          error={fields[`${which}Address.city`]}
          required
        />
        <TextField
          label="State"
          value={value.state}
          onChange={set('state')}
          placeholder="Gujarat"
          autoComplete={which === 'billing' ? 'billing address-level1' : 'shipping address-level1'}
          error={fields[`${which}Address.state`]}
          required
        />
      </div>
      <TextField
        label="Pincode"
        value={value.pincode}
        onChange={set('pincode')}
        inputMode="numeric"
        maxLength={6}
        placeholder="380009"
        autoComplete={which === 'billing' ? 'billing postal-code' : 'shipping postal-code'}
        error={fields[`${which}Address.pincode`]}
        required
      />
    </>
  );
}

export default function CheckoutClient({
  signedIn,
  prefill,
  renewalPriceMinor,
}: {
  signedIn: boolean;
  prefill: { name: string; email: string; phone: string };
  renewalPriceMinor: number | null;
}) {
  const { items, setQuantity, remove, clear, ready } = useCart();
  const { toast } = useToast();
  const router = useRouter();

  const [priced, setPriced] = useState<Priced | null>(null);
  const [pricing, setPricing] = useState(false);
  const [priceError, setPriceError] = useState('');

  const [coupon, setCoupon] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState('');
  const [couponNote, setCouponNote] = useState('');

  const [form, setForm] = useState({
    customerName: prefill.name,
    customerEmail: prefill.email,
    customerPhone: prefill.phone,
    companyName: '',
    gstNumber: '',
    notes: '',
  });
  const [billing, setBilling] = useState(emptyAddress);
  const [shipping, setShipping] = useState(emptyAddress);
  const [sameAddress, setSameAddress] = useState(true);

  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [paymentsOff, setPaymentsOff] = useState(false);

  /**
   * One key per attempt at this cart. Reusing it means a double click, a
   * refresh mid payment, or a retried request all land on the SAME order.
   */
  const idempotencyKey = useRef<string>('');
  if (!idempotencyKey.current) {
    idempotencyKey.current =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`.replace(/\./g, '');
  }

  const cartKey = useMemo(
    () => items.map((i) => `${i.productId}:${i.quantity}`).join('|') + `#${appliedCoupon}`,
    [items, appliedCoupon],
  );

  const price = useCallback(async () => {
    if (!items.length) {
      setPriced(null);
      return;
    }
    setPricing(true);
    setPriceError('');

    const res = await api<Priced>('/api/cart/price', {
      json: {
        items: items.map((i) => ({ productId: i.productId, quantity: i.quantity, customization: i.customization ?? null })),
        couponCode: appliedCoupon || null,
      },
    });
    setPricing(false);

    if (!res.ok) {
      setPriceError(res.error.message);
      setPriced(null);
      return;
    }
    setPriced(res.data);
    setCouponNote(res.data.couponMessage ?? '');
    if (res.data.couponMessage) setAppliedCoupon('');
  }, [items, appliedCoupon]);

  useEffect(() => {
    if (!ready) return;
    void price();
    // cartKey is what actually changes the price
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartKey, ready]);

  useEffect(() => {
    if (sameAddress) setShipping(billing);
  }, [sameAddress, billing]);

  function loadRazorpay(): Promise<boolean> {
    return new Promise((resolve) => {
      if (window.Razorpay) return resolve(true);
      const s = document.createElement('script');
      s.src = 'https://checkout.razorpay.com/v1/checkout.js';
      s.onload = () => resolve(true);
      s.onerror = () => resolve(false);
      document.body.appendChild(s);
    });
  }

  async function placeOrder(e: React.FormEvent) {
    e.preventDefault();
    if (!items.length) return;

    setPlacing(true);
    setError('');
    setFields({});

    const res = await api<{
      orderId: string;
      orderNumber: string;
      amountMinor: number;
      gatewayOrderId: string | null;
      keyId: string | null;
      paymentsDisabled?: boolean;
    }>('/api/orders', {
      json: {
        items: items.map((i) => ({ productId: i.productId, quantity: i.quantity, customization: i.customization ?? null })),
        ...form,
        gstNumber: form.gstNumber || '',
        billingAddress: billing,
        shippingAddress: sameAddress ? billing : shipping,
        couponCode: appliedCoupon || null,
        idempotencyKey: idempotencyKey.current,
      },
    });

    if (!res.ok) {
      setPlacing(false);
      setError(res.error.message);
      setFields(res.error.fields ?? {});
      return;
    }

    if (res.data.paymentsDisabled || !res.data.gatewayOrderId || !res.data.keyId) {
      setPlacing(false);
      setPaymentsOff(true);
      clear();
      router.push(`/dashboard/orders/${res.data.orderId}?state=unpaid`);
      return;
    }

    const loaded = await loadRazorpay();
    if (!loaded) {
      setPlacing(false);
      setError('We could not open the payment window. Check your connection and try again.');
      return;
    }

    const rz = new window.Razorpay!({
      key: res.data.keyId,
      amount: res.data.amountMinor,
      currency: 'INR',
      name: 'NFCY',
      description: `Order ${res.data.orderNumber}`,
      order_id: res.data.gatewayOrderId,
      prefill: { name: form.customerName, email: form.customerEmail, contact: form.customerPhone },
      theme: { color: '#34E0F0' },
      handler: async (r) => {
        const verify = await api<{ paid: boolean; orderId: string }>('/api/payment/verify', {
          json: r,
        });
        setPlacing(false);
        if (!verify.ok) {
          // the webhook is the authority, so this is never a lost payment
          toast('Payment taken. We are confirming it now.', 'ok');
          router.push(`/dashboard/orders/${res.data.orderId}?state=confirming`);
          return;
        }
        clear();
        router.push(`/dashboard/orders/${verify.data.orderId}?state=paid`);
      },
      modal: {
        ondismiss: () => {
          setPlacing(false);
          toast('Payment window closed. Your order is saved and still unpaid.', 'err');
          router.push(`/dashboard/orders/${res.data.orderId}?state=unpaid`);
        },
      },
    });

    rz.on('payment.failed', () => {
      setPlacing(false);
      setError('That payment did not go through. Nothing was charged. You can try again.');
    });

    rz.open();
  }

  if (!ready) {
    return <div className="skeleton" style={{ height: 320, borderRadius: 16 }} />;
  }

  if (!items.length) {
    return (
      <div className="empty">
        <h3>Your cart is empty</h3>
        <p>Pick a card and it will show up here. Nothing is charged until you say so.</p>
        <Link href="/cards" className="btn btn-accent">
          See the cards
        </Link>
      </div>
    );
  }

  const setF = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="checkout">
      <form className="form" onSubmit={placeOrder} noValidate>
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        {paymentsOff ? (
          <p className="form-good">
            Your order is saved. Card payments are not switched on yet, so we will message you to collect payment.
          </p>
        ) : null}

        <div className="card">
          <div className="card-head">
            <h2>Who is this for</h2>
          </div>
          <div className="form">
            <TextField label="Full name" value={form.customerName} onChange={setF('customerName')} autoComplete="name" error={fields.customerName} required />
            <div className="form-grid-2">
              <TextField label="Email" type="email" value={form.customerEmail} onChange={setF('customerEmail')} autoComplete="email" error={fields.customerEmail} required />
              <TextField label="Mobile" prefix="+91" inputMode="numeric" value={form.customerPhone} onChange={setF('customerPhone')} autoComplete="tel" error={fields.customerPhone} required />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h2>Where should it go</h2>
          </div>
          <div className="form">
            <AddressFields which="billing" value={billing} onChange={setBilling} fields={fields} />
            <Check label="Ship to this same address" checked={sameAddress} onChange={(e) => setSameAddress(e.target.checked)} />
            {!sameAddress ? (
              <>
                <div className="divider" />
                <p className="mono-label">Shipping address</p>
                <AddressFields which="shipping" value={shipping} onChange={setShipping} fields={fields} />
              </>
            ) : null}
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h2>Business details</h2>
            <span className="muted small">Optional</span>
          </div>
          <div className="form">
            <div className="form-grid-2">
              <TextField label="Company name" value={form.companyName} onChange={setF('companyName')} error={fields.companyName} />
              <TextField label="GST number" value={form.gstNumber} onChange={setF('gstNumber')} placeholder="24AAACC1234A1Z5" error={fields.gstNumber} hint="For a GST invoice." />
            </div>
            <TextArea label="Anything we should know" value={form.notes} onChange={setF('notes')} placeholder="Delivery instructions, name to print, and so on." error={fields.notes} />
          </div>
        </div>

        <button type="submit" className="btn btn-accent full" disabled={placing || pricing || !priced}>
          {placing ? <span className="spinner" aria-hidden="true" /> : null}
          {placing ? 'Opening payment' : priced ? `Pay ${rupees(priced.totalMinor)}` : 'Loading'}
        </button>

        {!signedIn ? (
          <p className="muted tiny" style={{ textAlign: 'center' }}>
            You can order without an account, but you will need one to build your profile.{' '}
            <Link href="/login?next=/checkout" style={{ color: 'var(--accent)' }}>Sign in</Link> to keep everything together.
          </p>
        ) : null}
      </form>

      <aside className="card summary">
        <div className="card-head">
          <h2>Your order</h2>
        </div>

        {items.map((i) => {
          const line = priced?.lines.find((l) => l.productId === i.productId);
          return (
            <div className="sum-item" key={i.productId}>
              <span className="grow" style={{ flex: 1, minWidth: 0 }}>
                <b style={{ display: 'block', fontWeight: 600 }}>{line?.productName ?? i.name}</b>
                <span className="muted tiny">
                  {rupees(line?.unitMinor ?? i.priceMinor)} each
                  {i.customization?.finish ? ` · ${i.customization.finish.toLowerCase()}` : ''}
                </span>
              </span>
              <span className="qty">
                <button type="button" onClick={() => setQuantity(i.productId, i.quantity - 1)} aria-label={`One fewer ${i.name}`}>
                  −
                </button>
                <span>{i.quantity}</span>
                <button type="button" onClick={() => setQuantity(i.productId, i.quantity + 1)} aria-label={`One more ${i.name}`}>
                  +
                </button>
              </span>
              <button type="button" className="btn btn-quiet btn-sm" onClick={() => remove(i.productId)} aria-label={`Remove ${i.name}`}>
                Remove
              </button>
            </div>
          );
        })}

        <div style={{ marginTop: 18 }}>
          <div className="row" style={{ gap: 8 }}>
            <input
              value={coupon}
              onChange={(e) => setCoupon(e.target.value.toUpperCase())}
              placeholder="Coupon code"
              aria-label="Coupon code"
              style={{
                flex: 1, minWidth: 0, padding: '11px 13px', borderRadius: 10,
                background: 'rgba(6,8,12,.7)', border: '1px solid var(--line-strong)',
                color: 'var(--text-primary)', fontFamily: 'var(--mono)', fontSize: '.86rem',
              }}
            />
            <button
              type="button"
              className="btn btn-quiet btn-sm"
              onClick={() => {
                setCouponNote('');
                setAppliedCoupon(coupon.trim());
              }}
              disabled={!coupon.trim() || pricing}
            >
              Apply
            </button>
          </div>
          {priced?.coupon ? (
            <p className="okmsg" style={{ marginTop: 8 }}>
              {priced.coupon.code} applied, {rupees(priced.discountMinor)} off.
            </p>
          ) : couponNote ? (
            <p className="err" style={{ marginTop: 8 }}>{couponNote}</p>
          ) : null}
        </div>

        <div className="divider" />

        {priceError ? (
          <p className="form-error">{priceError}</p>
        ) : priced ? (
          <>
            <div className="sum-line">
              <span className="muted">Subtotal</span>
              <span className="num">{rupees(priced.subtotalMinor)}</span>
            </div>
            {priced.discountMinor > 0 ? (
              <div className="sum-line">
                <span className="muted">Discount</span>
                <span className="num" style={{ color: 'var(--accent)' }}>-{rupees(priced.discountMinor)}</span>
              </div>
            ) : null}
            <div className="sum-line">
              <span className="muted">Shipping</span>
              <span className="num">{priced.shippingMinor === 0 ? 'Free' : rupees(priced.shippingMinor)}</span>
            </div>
            <div className="sum-line total">
              <span>Total</span>
              <span className="num">{rupees(priced.totalMinor)}</span>
            </div>
            <p className="muted tiny" style={{ marginTop: 6 }}>
              Includes {rupees(priced.taxMinor)} GST.
            </p>
            {renewalPriceMinor ? (
              <p className="muted tiny" style={{ marginTop: 10 }}>
                After the first year, keeping your profile online is {rupees(renewalPriceMinor)} a year. We will remind
                you well before it is due, and your card is never bricked.
              </p>
            ) : null}
          </>
        ) : (
          <div className="skeleton" style={{ height: 120 }} />
        )}
      </aside>
    </div>
  );
}
