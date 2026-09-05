'use client';

import { useState } from 'react';
import CopyLink from '@/components/CopyLink';
import { IconDownload, IconExternal } from '@/components/icons';

/**
 * The QR code is generated automatically for every profile and always encodes
 * the profile URL, so it never has to be regenerated when the content changes.
 * This is just where a customer can get hold of it.
 */
export default function QrPanel({
  profileId,
  username,
  appUrl,
  card,
  published,
}: {
  profileId: string;
  username: string;
  appUrl: string;
  card: { serial: string; code: string; status: string } | null;
  published: boolean;
}) {
  const [size, setSize] = useState(1024);
  // one code, not two: when there is a card, this is the card's own link, the
  // same one the chip holds and the same one printed on the card
  // The QR carries the card's own link. The link people paste into WhatsApp
  // stays the readable one; both open the same profile.
  const url = card ? `${appUrl}/c/${card.code}` : `${appUrl}/${username}`;
  const profileLink = `${appUrl}/${username}`;

  return (
    <div className="stack">
      <div className="card card-tight">
        <div className="qr-panel">
          <img src={`/api/profile/${profileId}/qr`} alt={`QR code for ${url}`} />
          <div className="grow">
            <h3 style={{ fontSize: '1.05rem' }}>Your QR code</h3>
            <p className="muted small" style={{ marginTop: 8 }}>
              {card ? (
                <>
                  This is the code printed on card <b className="num">{card.serial}</b>. Exactly the same code, so a
                  scan and a tap land in the same place. It points at your link rather than your content, so it keeps
                  working however often you change your profile, and never has to be reprinted.
                </>
              ) : (
                <>
                  Made the moment your profile existed. It points at your link, not at your content, so it keeps
                  working forever. Print it on anything: a menu, a poster, a shop window.
                </>
              )}
            </p>
            <div className="row" style={{ marginTop: 16 }}>
              <CopyLink url={profileLink} />
              {published ? (
                <a href={profileLink} target="_blank" rel="noopener" className="btn btn-quiet btn-sm">
                  <IconExternal /> Open it
                </a>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="card card-tight">
        <div className="card-head">
          <h3>Download it</h3>
        </div>

        <div className="field" style={{ marginBottom: 16 }}>
          <label htmlFor="qr-size">PNG size</label>
          <select id="qr-size" value={size} onChange={(e) => setSize(Number(e.target.value))}>
            <option value={512}>512 pixels, for the web</option>
            <option value={1024}>1024 pixels, good for most printing</option>
            <option value={2048}>2048 pixels, for a large poster</option>
          </select>
        </div>

        <div className="row">
          <a className="btn btn-accent" href={`/api/profile/${profileId}/qr?download=1&size=${size}`} download>
            <IconDownload /> Download PNG
          </a>
          <a className="btn btn-ghost" href={`/api/profile/${profileId}/qr?format=svg&download=1`} download>
            <IconDownload /> Download SVG
          </a>
        </div>

        <p className="muted tiny" style={{ marginTop: 14 }}>
          Use the SVG for anything a printer is producing. It stays sharp at any size.
        </p>
      </div>

      {!published ? (
        <p className="form-error">
          Your profile is still a draft, so this QR opens a page saying it is not live yet. Publish it and the same
          code starts working. You will never need a different one.
        </p>
      ) : null}
    </div>
  );
}
