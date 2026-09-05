'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, rupees } from '@/lib/client';
import { useToast } from '@/components/Toast';

type RazorpayOptions = {
  key: string; amount: number; currency: string; name: string; description: string; order_id: string;
  prefill: { name: string; email: string; contact: string }; theme: { color: string };
  handler: (r: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => void;
  modal: { ondismiss: () => void };
};
type RazorpayInstance = { open: () => void; on: (e: string, cb: (x: unknown) => void) => void };
declare global {
  interface Window { Razorpay?: new (o: RazorpayOptions) => RazorpayInstance }
}

export default function RenewButton({
  priceMinor,
  customer,
  label,
}: {
  priceMinor: number;
  customer: { name: string; email: string; phone: string };
  label?: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // one key per attempt, so a double click cannot buy two years
  const key = useRef<string>('');
  if (!key.current) {
    key.current =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}${Math.random()}`;
  }

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

  async function renew() {
    setBusy(true);
    setError('');

    const res = await api<{
      orderId: string; orderNumber: string; amountMinor: number;
      gatewayOrderId: string | null; keyId: string | null; paymentsDisabled?: boolean;
    }>('/api/renewal', { json: { idempotencyKey: key.current } });

    if (!res.ok) {
      setBusy(false);
      setError(res.error.message);
      return;
    }

    if (res.data.paymentsDisabled || !res.data.gatewayOrderId || !res.data.keyId) {
      setBusy(false);
      toast('Your renewal is recorded. We will message you to collect payment.');
      router.push(`/dashboard/orders/${res.data.orderId}?state=unpaid`);
      return;
    }

    if (!(await loadRazorpay())) {
      setBusy(false);
      setError('We could not open the payment window. Check your connection and try again.');
      return;
    }

    const rz = new window.Razorpay!({
      key: res.data.keyId,
      amount: res.data.amountMinor,
      currency: 'INR',
      name: 'NFCY',
      description: 'Profile renewal, one year',
      order_id: res.data.gatewayOrderId,
      prefill: { name: customer.name, email: customer.email, contact: customer.phone },
      theme: { color: '#34E0F0' },
      handler: async (r) => {
        const verify = await api<{ paid: boolean }>('/api/payment/verify', { json: r });
        setBusy(false);
        if (!verify.ok) {
          toast('Payment taken. We are confirming it now.');
          router.push(`/dashboard/orders/${res.data.orderId}?state=confirming`);
          return;
        }
        toast('Renewed for another year');
        router.refresh();
      },
      modal: {
        ondismiss: () => {
          setBusy(false);
          toast('Payment window closed. Nothing was charged.', 'err');
        },
      },
    });

    rz.on('payment.failed', () => {
      setBusy(false);
      setError('That payment did not go through. Nothing was charged. You can try again.');
    });

    rz.open();
  }

  return (
    <div className="stack-sm">
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <button type="button" className="btn btn-accent" onClick={() => void renew()} disabled={busy}>
        {busy ? <span className="spinner" aria-hidden="true" /> : null}
        {busy ? 'Opening payment' : (label ?? `Renew for ${rupees(priceMinor)}`)}
      </button>
    </div>
  );
}
