'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/client';

type Point = { date: string; views: number; taps: number; scans: number; clicks: number };

type Payload = {
  days: number;
  totals: { views: number; taps: number; scans: number; clicks: number; leads: number; uniqueVisitors: number };
  series: Point[];
  devices: Array<{ key: string; count: number }>;
  browsers: Array<{ key: string; count: number }>;
  sources: Array<{ key: string; count: number }>;
  byType: Array<{ type: string; count: number }>;
};

const RANGES = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
  { days: 365, label: '1 year' },
];

const SERIES = [
  { key: 'views' as const, label: 'Profile views', colour: 'var(--accent)' },
  { key: 'taps' as const, label: 'Card taps', colour: '#7C5CFF' },
  { key: 'scans' as const, label: 'QR scans', colour: '#4ADE80' },
  { key: 'clicks' as const, label: 'Button clicks', colour: '#D9B06A' },
];

const CLICK_LABELS: Record<string, string> = {
  PROFILE_VIEW: 'Profile views',
  NFC_TAP: 'Card taps',
  QR_SCAN: 'QR scans',
  CLICK_WHATSAPP: 'WhatsApp',
  CLICK_CALL: 'Call',
  CLICK_EMAIL: 'Email',
  CLICK_WEBSITE: 'Website',
  CLICK_SOCIAL: 'Social links',
  CLICK_MAPS: 'Directions',
  CLICK_PRODUCT: 'Products',
  CLICK_SERVICE: 'Services',
  CLICK_UPI: 'Pay by UPI',
  SAVE_CONTACT: 'Saved contact',
  LEAD_SUBMITTED: 'Enquiries',
  REVIEW_REDIRECT: 'Sent to Google review',
};

export default function AnalyticsClient({ hasProfile }: { hasProfile: boolean }) {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [visible, setVisible] = useState<Record<string, boolean>>({
    views: true, taps: true, scans: true, clicks: true,
  });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');

    void api<Payload>(`/api/analytics?days=${days}`).then((res) => {
      if (cancelled) return;
      setLoading(false);
      if (!res.ok) {
        setError(res.error.message);
        return;
      }
      setData(res.data);
    });

    return () => {
      cancelled = true;
    };
  }, [days]);

  const chart = useMemo(() => {
    if (!data?.series.length) return null;

    const W = 720;
    const H = 220;
    const padL = 34;
    const padB = 24;
    const padT = 10;

    const active = SERIES.filter((s) => visible[s.key]);
    const max = Math.max(1, ...data.series.flatMap((p) => active.map((s) => p[s.key])));
    const stepX = (W - padL - 8) / Math.max(1, data.series.length - 1);
    const scaleY = (v: number) => padT + (H - padT - padB) * (1 - v / max);

    const paths = active.map((s) => ({
      ...s,
      d: data.series
        .map((p, i) => `${i === 0 ? 'M' : 'L'} ${(padL + i * stepX).toFixed(1)} ${scaleY(p[s.key]).toFixed(1)}`)
        .join(' '),
    }));

    const ticks = [0, Math.round(max / 2), max].filter((v, i, a) => a.indexOf(v) === i);
    const labelEvery = Math.max(1, Math.ceil(data.series.length / 6));

    return { W, H, padL, padB, padT, paths, ticks, scaleY, stepX, labelEvery };
  }, [data, visible]);

  if (!hasProfile) {
    return (
      <div className="empty">
        <h3>Nothing to measure yet</h3>
        <p>Create and publish a profile, and every view, tap, scan and click starts showing up here.</p>
      </div>
    );
  }

  return (
    <>
      <div className="row" style={{ marginBottom: 20 }}>
        {RANGES.map((r) => (
          <button
            key={r.days}
            type="button"
            className={`btn btn-sm ${days === r.days ? 'btn-accent' : 'btn-quiet'}`}
            onClick={() => setDays(r.days)}
          >
            {r.label}
          </button>
        ))}
      </div>

      {error ? <p className="form-error" role="alert">{error}</p> : null}

      {loading && !data ? (
        <div className="stack">
          <div className="skeleton" style={{ height: 96 }} />
          <div className="skeleton" style={{ height: 280 }} />
        </div>
      ) : data ? (
        <div className="stack">
          <div className="stats">
            <div className="stat accent">
              <p className="stat-k">Profile views</p>
              <p className="stat-v num">{data.totals.views}</p>
              <p className="stat-sub">{data.totals.uniqueVisitors} different people</p>
            </div>
            <div className="stat">
              <p className="stat-k">Card taps</p>
              <p className="stat-v num">{data.totals.taps}</p>
            </div>
            <div className="stat">
              <p className="stat-k">QR scans</p>
              <p className="stat-v num">{data.totals.scans}</p>
            </div>
            <div className="stat">
              <p className="stat-k">Button clicks</p>
              <p className="stat-v num">{data.totals.clicks}</p>
            </div>
            <div className="stat">
              <p className="stat-k">Enquiries</p>
              <p className="stat-v num">{data.totals.leads}</p>
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <h2>Day by day</h2>
              <div className="row" style={{ gap: 8 }}>
                {SERIES.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setVisible((v) => ({ ...v, [s.key]: !v[s.key] }))}
                    aria-pressed={visible[s.key]}
                    className="btn btn-quiet btn-sm"
                    style={{ opacity: visible[s.key] ? 1 : 0.42 }}
                  >
                    <span style={{ width: 9, height: 9, borderRadius: 99, background: s.colour, display: 'inline-block' }} />
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {data.totals.views + data.totals.taps + data.totals.scans + data.totals.clicks === 0 ? (
              <p className="muted small">
                Nothing recorded in this window yet. Share your link or hand someone your card and the lines start
                moving.
              </p>
            ) : chart ? (
              <svg viewBox={`0 0 ${chart.W} ${chart.H}`} className="chart" role="img" aria-label="Daily activity">
                <g className="chart-grid">
                  {chart.ticks.map((t) => (
                    <line key={t} x1={chart.padL} x2={chart.W - 4} y1={chart.scaleY(t)} y2={chart.scaleY(t)} />
                  ))}
                </g>
                <g className="chart-axis">
                  {chart.ticks.map((t) => (
                    <text key={t} x={4} y={chart.scaleY(t) + 3}>
                      {t}
                    </text>
                  ))}
                  {data.series.map((p, i) =>
                    i % chart.labelEvery === 0 ? (
                      <text key={p.date} x={chart.padL + i * chart.stepX} y={chart.H - 6} textAnchor="middle">
                        {new Date(p.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </text>
                    ) : null,
                  )}
                </g>
                {chart.paths.map((p) => (
                  <path
                    key={p.key}
                    d={p.d}
                    fill="none"
                    stroke={p.colour}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ))}
              </svg>
            ) : null}
          </div>

          <div className="stats" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))' }}>
            <Bars title="What people tapped" rows={fold(data.byType.map((r) => ({ id: r.type, label: CLICK_LABELS[r.type] ?? r.type, count: r.count })))} />
            <Bars title="How they arrived" rows={fold(data.sources.map((r) => ({ id: r.key, label: SOURCE_LABELS[r.key] ?? r.key, count: r.count })))} />
            <Bars title="Device" rows={fold(data.devices.map((r) => ({ id: r.key, label: DEVICE_LABELS[r.key] ?? r.key, count: r.count })))} />
            <Bars title="Browser" rows={fold(data.browsers.map((r) => ({ id: r.key, label: r.key, count: r.count })))} />
          </div>

          <p className="muted tiny">
            We count what happened, not who did it. No IP address is stored, and a repeat visitor is a salted daily
            hash that stops meaning anything the next day.
          </p>
        </div>
      ) : null}
    </>
  );
}

const SOURCE_LABELS: Record<string, string> = {
  nfc: 'Card tap',
  qr: 'QR scan',
  link: 'A link somewhere',
  direct: 'Typed or saved',
  Direct: 'Typed or saved',
};

const DEVICE_LABELS: Record<string, string> = {
  mobile: 'Phone',
  tablet: 'Tablet',
  desktop: 'Computer',
};

type Row = { id: string; label: string; count: number };

/**
 * Several raw keys can share one human label. "direct" and a missing source
 * both read as "Typed or saved", which produced two rows with the same React
 * key and a duplicate-key warning. Folding them is also the honest answer: the
 * reader wants one number for one thing.
 */
function fold(rows: Row[]): Row[] {
  const byLabel = new Map<string, Row>();
  for (const r of rows) {
    const seen = byLabel.get(r.label);
    if (seen) seen.count += r.count;
    else byLabel.set(r.label, { ...r });
  }
  return [...byLabel.values()].sort((a, b) => b.count - a.count);
}

function Bars({ title, rows }: { title: string; rows: Row[] }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div className="card">
      <div className="card-head">
        <h2>{title}</h2>
      </div>
      {rows.length === 0 ? (
        <p className="muted small">Nothing yet.</p>
      ) : (
        <div className="bar-track">
          {rows.map((r) => (
            <div className="bar-row" key={r.id}>
              <span className="muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {r.label}
              </span>
              <span className="bar-bg">
                <span className="bar-fill" style={{ width: `${(r.count / max) * 100}%` }} />
              </span>
              <span className="num tiny">{r.count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
