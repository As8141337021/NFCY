'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * The one designed interactive moment.
 *
 * The visitor holds a drawn card against a drawn phone. Progress builds while
 * they hold, eases back down if they let go early, and completing it assembles
 * the profile on screen. Reduced motion gets the finished state with no hold.
 */
export default function DemoHold() {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const cardRef = useRef<HTMLButtonElement | null>(null);
  const [done, setDone] = useState(false);
  const [lit, setLit] = useState(0);

  useEffect(() => {
    const stage = stageRef.current;
    const card = cardRef.current;
    if (!stage || !card) return;

    let hold = 0;
    let holding = false;
    let raf: number | null = null;
    let last = 0;
    let finished = false;

    function paint() {
      stage!.style.setProperty('--hold', hold.toFixed(3));
      card!.style.setProperty('--hold', hold.toFixed(3));
    }

    function complete() {
      if (finished) return;
      finished = true;
      holding = false;
      hold = 1;
      paint();
      setDone(true);
      [1, 2, 3].forEach((n) => setTimeout(() => setLit(n), 260 + (n - 1) * 220));
    }

    function step(now: number) {
      const dt = Math.min(80, now - (last || now));
      last = now;
      hold = holding ? Math.min(1, hold + dt / 1100) : Math.max(0, hold - dt / 900);
      paint();

      if (hold >= 1 && !finished) complete();

      if ((holding && hold < 1) || (!holding && hold > 0)) {
        raf = requestAnimationFrame(step);
      } else {
        raf = null;
        last = 0;
      }
    }

    // Somebody who has asked their system to stop animations gets the finished
    // state straight away, with nothing to hold.
    //
    // This used to sit at the top of the effect, where it called complete()
    // before `finished` had been declared. Function declarations are hoisted
    // but `let` is not, so it threw on the first line of complete() and took
    // the whole page down for every visitor with reduced motion switched on.
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      complete();
      return;
    }

    const start = (e: Event) => {
      if (finished) return;
      if (e.cancelable) e.preventDefault();
      holding = true;
      if (raf === null) {
        last = 0;
        raf = requestAnimationFrame(step);
      }
    };
    const end = () => {
      holding = false;
      if (raf === null && hold > 0) {
        last = 0;
        raf = requestAnimationFrame(step);
      }
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (e.type === 'keydown') start(e);
        else end();
      }
    };
    const noMenu = (e: Event) => e.preventDefault();

    card.addEventListener('pointerdown', start);
    card.addEventListener('pointerup', end);
    card.addEventListener('pointercancel', end);
    card.addEventListener('pointerleave', end);
    card.addEventListener('keydown', key);
    card.addEventListener('keyup', key);
    card.addEventListener('contextmenu', noMenu);

    return () => {
      if (raf !== null) cancelAnimationFrame(raf);
      card.removeEventListener('pointerdown', start);
      card.removeEventListener('pointerup', end);
      card.removeEventListener('pointercancel', end);
      card.removeEventListener('pointerleave', end);
      card.removeEventListener('keydown', key);
      card.removeEventListener('keyup', key);
      card.removeEventListener('contextmenu', noMenu);
    };
  }, []);

  const claims = [
    'Their phone opens your profile in its browser.',
    'Nothing gets installed, on either side.',
    'You change what they see whenever you want.',
  ];

  return (
    <section className="sec demo" id="demo">
      <div className="wrap demo-wrap">
        <div className="demo-copy">
          <p className="kicker">Try it</p>
          <h2 className="h2">Press and hold the card.</h2>
          <p className="lede">This is the whole interaction, at the speed it actually happens.</p>

          <ol className="demo-claims">
            {claims.map((c, i) => (
              <li key={c} className={lit > i ? 'on' : ''}>
                <span className="dot" aria-hidden="true" />
                {c}
              </li>
            ))}
          </ol>

          <p className={`demo-done${done ? ' on' : ''}`}>
            That is what your customer sees. You wrote it. You can change it in ten seconds.
          </p>
        </div>

        <div className={`demo-stage${done ? ' done' : ''}`} ref={stageRef}>
          <div className="phone" aria-hidden="true">
            <div className="phone-screen">
              <div className="pf">
                <div className="pf-cover" />
                <div className="pf-avatar" />
                <div className="pf-name" />
                <div className="pf-role" />
                <div className="pf-btns">
                  <i />
                  <i />
                  <i />
                </div>
                <div className="pf-row" />
                <div className="pf-row short" />
                <div className="pf-tiles">
                  <i />
                  <i />
                  <i />
                  <i />
                </div>
                <div className="pf-row" />
                <div className="pf-row short" />
              </div>
              <div className="pf-idle">Ready to tap</div>
            </div>
          </div>

          <button className="tapcard" ref={cardRef} type="button" aria-describedby="tap-help">
            <span className="sr-only">Press and hold to tap the card against the phone</span>
            <svg viewBox="0 0 340 214" className="card-svg" aria-hidden="true">
              <rect x="2" y="2" width="336" height="210" rx="18" fill="url(#heroFace)" />
              <rect x="2.75" y="2.75" width="334.5" height="208.5" rx="17.5" fill="none" stroke="#34E0F0" strokeOpacity=".4" strokeWidth="1.5" />
              <g transform="translate(250,150)" fill="none" stroke="#34E0F0" strokeWidth="3" strokeLinecap="round">
                <path d="M0 -14a13 13 0 0 1 0 28" />
                <path d="M9 -24a23 23 0 0 1 0 48" />
              </g>
              <circle cx="243" cy="150" r="3.6" fill="#34E0F0" />
              <text x="34" y="47" fontFamily="var(--display)" fontSize="22" fontWeight="700" letterSpacing="-.7" fill="#EAF0F6" fillOpacity=".92">
                NFCY
              </text>
            </svg>
            <svg className="tapring" viewBox="0 0 64 64" aria-hidden="true">
              <circle cx="32" cy="32" r="28" fill="none" stroke="var(--line)" strokeWidth="3" />
              <circle
                cx="32" cy="32" r="28" fill="none" stroke="var(--accent)" strokeWidth="3"
                strokeLinecap="round" strokeDasharray="176"
                style={{ strokeDashoffset: 'calc(176 - 176 * var(--hold,0))' }}
                transform="rotate(-90 32 32)"
              />
            </svg>
          </button>
          <p className="tap-help" id="tap-help">
            Hold the card, do not click it.
          </p>
        </div>
      </div>
    </section>
  );
}
