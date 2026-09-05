'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/client';
import { useToast } from '@/components/Toast';
import { TextField, SelectField, TextArea } from '@/components/forms';

export type Line = { id: string; productName: string; quantity: number; cardSerial: string | null; needsCard: boolean };

const STATUSES = [
  'PAYMENT_PENDING', 'PAYMENT_RECEIVED', 'PROFILE_PENDING', 'PROFILE_COMPLETED',
  'DESIGN_PROCESSING', 'MANUFACTURING', 'DISPATCHED', 'DELIVERED', 'ACTIVATED', 'CANCELLED',
];

const LABELS: Record<string, string> = {
  PAYMENT_PENDING: 'Waiting for payment',
  PAYMENT_RECEIVED: 'Payment received',
  PROFILE_PENDING: 'Waiting on the profile',
  PROFILE_COMPLETED: 'Profile ready',
  DESIGN_PROCESSING: 'In design',
  MANUFACTURING: 'Being made',
  DISPATCHED: 'Dispatched',
  DELIVERED: 'Delivered',
  ACTIVATED: 'Activated',
  CANCELLED: 'Cancelled',
};

const PAY_METHODS = [
  ['cash', 'Cash'],
  ['upi', 'UPI'],
  ['bank_transfer', 'Bank transfer'],
  ['card_machine', 'Card machine'],
  ['cheque', 'Cheque'],
  ['other', 'Something else'],
] as const;

export default function OrderActions({
  orderId,
  status,
  paid,
  total,
  lines,
  shipment,
}: {
  orderId: string;
  status: string;
  paid: boolean;
  total: string;
  lines: Line[];
  shipment: { courier: string; awb: string; trackingUrl: string; status: string; estimatedDelivery: string } | null;
}) {
  const router = useRouter();
  const { toast } = useToast();

  const [next, setNext] = useState(status);
  const [payMethod, setPayMethod] = useState<string>('cash');
  const [payRef, setPayRef] = useState('');
  const [payBusy, setPayBusy] = useState(false);
  const [payError, setPayError] = useState('');
  const [actBusy, setActBusy] = useState(false);
  const [actError, setActError] = useState('');

  async function recordPayment() {
    if (!window.confirm(`Record ${total} received for this order? This creates the cards and the invoice.`)) return;
    setPayBusy(true);
    setPayError('');
    const res = await api(`/api/admin/orders/${orderId}/payment`, {
      json: { method: payMethod, reference: payRef || null },
    });
    setPayBusy(false);
    if (!res.ok) {
      setPayError(res.error.message);
      return;
    }
    toast('Payment recorded, cards created');
    router.refresh();
  }

  async function activateCards() {
    setActBusy(true);
    setActError('');
    const res = await api<{ activated: number; username: string }>(`/api/admin/orders/${orderId}/activate`, {
      json: {},
    });
    setActBusy(false);
    if (!res.ok) {
      setActError(res.error.message);
      return;
    }
    toast(`Activated on /${res.data.username}, profile is live`);
    router.refresh();
  }

  const [note, setNote] = useState('');
  const [statusBusy, setStatusBusy] = useState(false);
  const [statusError, setStatusError] = useState('');

  const [ship, setShip] = useState({
    courier: shipment?.courier ?? '',
    awb: shipment?.awb ?? '',
    trackingUrl: shipment?.trackingUrl ?? '',
    status: shipment?.status ?? 'DISPATCHED',
    estimatedDelivery: shipment?.estimatedDelivery ?? '',
  });
  const [shipBusy, setShipBusy] = useState(false);
  const [shipError, setShipError] = useState('');


  async function saveStatus() {
    setStatusBusy(true);
    setStatusError('');
    const res = await api(`/api/admin/orders/${orderId}/status`, { json: { status: next, note: note || null } });
    setStatusBusy(false);
    if (!res.ok) {
      setStatusError(res.error.message);
      return;
    }
    setNote('');
    toast('Status updated');
    router.refresh();
  }

  async function saveShipment() {
    setShipBusy(true);
    setShipError('');
    const res = await api(`/api/admin/orders/${orderId}/shipment`, {
      method: 'PUT',
      json: {
        ...ship,
        estimatedDelivery: ship.estimatedDelivery ? new Date(ship.estimatedDelivery).toISOString() : null,
      },
    });
    setShipBusy(false);
    if (!res.ok) {
      setShipError(res.error.message);
      return;
    }
    toast('Shipping saved and the customer has been told');
    router.refresh();
  }

  const needing = lines.filter((l) => l.needsCard && !l.cardSerial);

  return (
    <div className="stack">
      {needing.length > 0 && (
        <div className="card" style={{ borderColor: 'rgba(240,180,90,.4)' }}>
          <div className="card-head">
            <h2>Waiting on cards</h2>
            <span className="pill warn">{needing.length} line{needing.length === 1 ? '' : 's'}</span>
          </div>
          <p className="muted small">
            {paid
              ? 'Cards are created automatically when the payment lands. If a line is still empty here, the payment webhook has not been processed for it yet.'
              : 'Cards are created when the payment lands. Nothing is printed before that.'}
          </p>
        </div>
      )}

      {!paid && status !== 'CANCELLED' ? (
        <div className="card" style={{ borderColor: 'rgba(52,224,240,.45)' }}>
          <div className="card-head">
            <h2>Payment taken outside the gateway</h2>
            <span className="pill warn">unpaid</span>
          </div>
          <p className="muted small" style={{ marginBottom: 16 }}>
            Use this when the customer paid you directly: cash in the shop, UPI, a bank transfer. It marks the order
            paid for {total}, raises the invoice and creates the cards, exactly as an online payment would. Your name
            goes on the record.
          </p>
          {payError ? <p className="form-error" role="alert">{payError}</p> : null}
          <div className="form">
            <div className="form-grid-2">
              <SelectField label="How did they pay" value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                {PAY_METHODS.map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </SelectField>
              <TextField
                label="Reference"
                value={payRef}
                onChange={(e) => setPayRef(e.target.value)}
                placeholder="UPI id, cheque number, receipt number"
                hint="Optional, but worth having."
              />
            </div>
            <button type="button" className="btn btn-accent" onClick={() => void recordPayment()} disabled={payBusy}>
              {payBusy ? <span className="spinner" aria-hidden="true" /> : null}
              {payBusy ? 'Recording' : `Record ${total} received`}
            </button>
          </div>
        </div>
      ) : null}

      {paid && status !== 'ACTIVATED' && status !== 'CANCELLED' && lines.some((l) => l.needsCard) ? (
        <div className="card">
          <div className="card-head">
            <h2>Activate the card</h2>
          </div>
          <p className="muted small" style={{ marginBottom: 16 }}>
            The customer normally does this from their own dashboard. Do it here when they cannot: a card handed over
            the counter, or someone who would rather you did it. It points their cards at their profile and publishes
            the profile, so the card is never a dead link.
          </p>
          {actError ? <p className="form-error" role="alert">{actError}</p> : null}
          <button type="button" className="btn btn-accent" onClick={() => void activateCards()} disabled={actBusy}>
            {actBusy ? <span className="spinner" aria-hidden="true" /> : null}
            {actBusy ? 'Activating' : 'Activate and publish the profile'}
          </button>
        </div>
      ) : null}

      <div className="card">
        <div className="card-head">
          <h2>Move the order along</h2>
        </div>
        {statusError ? <p className="form-error" role="alert">{statusError}</p> : null}
        <div className="form">
          <SelectField label="Status" value={next} onChange={(e) => setNext(e.target.value)}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{LABELS[s] ?? s}</option>
            ))}
          </SelectField>
          <TextArea
            label="Note for the record"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional. Stored on the order history with your name."
          />
          <button type="button" className="btn btn-accent" onClick={() => void saveStatus()} disabled={statusBusy || next === status}>
            {statusBusy ? <span className="spinner" aria-hidden="true" /> : null}
            {statusBusy ? 'Saving' : 'Update status'}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Shipping</h2>
        </div>
        {shipError ? <p className="form-error" role="alert">{shipError}</p> : null}
        <div className="form">
          <div className="form-grid-2">
            <TextField label="Courier" value={ship.courier} onChange={(e) => setShip((s) => ({ ...s, courier: e.target.value }))} placeholder="Blue Dart" />
            <TextField label="Tracking number" value={ship.awb} onChange={(e) => setShip((s) => ({ ...s, awb: e.target.value }))} placeholder="AWB" />
          </div>
          <TextField label="Tracking link" value={ship.trackingUrl} onChange={(e) => setShip((s) => ({ ...s, trackingUrl: e.target.value }))} placeholder="https://" />
          <div className="form-grid-2">
            <SelectField label="Shipping status" value={ship.status} onChange={(e) => setShip((s) => ({ ...s, status: e.target.value }))}>
              <option value="PENDING">Not sent yet</option>
              <option value="DISPATCHED">Dispatched</option>
              <option value="IN_TRANSIT">In transit</option>
              <option value="DELIVERED">Delivered</option>
              <option value="RETURNED">Returned</option>
            </SelectField>
            <TextField
              label="Expected delivery"
              type="date"
              value={ship.estimatedDelivery ? ship.estimatedDelivery.slice(0, 10) : ''}
              onChange={(e) => setShip((s) => ({ ...s, estimatedDelivery: e.target.value }))}
            />
          </div>
          <p className="muted tiny">
            Saving this as Dispatched emails the customer their tracking number and moves the order on.
          </p>
          <button type="button" className="btn btn-accent" onClick={() => void saveShipment()} disabled={shipBusy}>
            {shipBusy ? <span className="spinner" aria-hidden="true" /> : null}
            {shipBusy ? 'Saving' : 'Save shipping'}
          </button>
        </div>
      </div>
    </div>
  );
}
