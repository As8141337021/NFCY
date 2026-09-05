'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';

/**
 * The scroll driven hero.
 *
 * Ported from the standalone site with the same engineering: a lerped drive
 * loop that rests when it converges, delta gated DOM writes, band pacing in
 * scroll distance rather than seconds, and the five static hero gates matched
 * character for character between the CSS and this file.
 *
 * The journey is drawn in SVG and CSS. When hero footage exists, set HAS_VIDEO
 * and drop the files into /public: the same progress value drives the video and
 * nothing else changes.
 */

const HAS_VIDEO = false;
const VIDEO_URL = '/hero-scrub.mp4';
const POSTER_URL = '/hero-poster.jpg';
const CROSS = 0.64;

const GATES = [
  '(max-width: 720px)',
  '(orientation: portrait) and (max-width: 1024px)',
  '(orientation: portrait) and (pointer: coarse)',
  '(orientation: landscape) and (pointer: coarse) and (max-height: 560px)',
  '(prefers-reduced-motion: reduce)',
];

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const smoothstep = (p: number, e0: number, e1: number) => {
  const t = clamp((p - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Seeded, so the "random" jitter is identical on every load. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}

type BandDef = {
  a: number;
  b: number;
  entrance: 'drift' | 'depth' | 'punch' | 'rise';
  headline: string;
  sub?: string;
  em?: boolean;
  cta?: boolean;
};

const BANDS: BandDef[] = [
  { a: 0, b: 0.25, entrance: 'drift', headline: 'A paper card is you from the day it was printed.' },
  {
    a: 0.27, b: 0.52, entrance: 'depth',
    headline: 'This one changes when you do.',
    sub: 'Edit your profile from your phone. Every card you ever handed out updates at once.',
  },
  {
    a: 0.54, b: 0.77, entrance: 'punch', em: true,
    headline: 'One tap. No app.',
    sub: 'They tap, your profile opens. Nothing to install, on either side.',
  },
  {
    a: 0.79, b: 1, entrance: 'rise', cta: true,
    headline: 'Your digital identity. One tap away.',
    sub: 'Contact, business, socials, products and location. Shared in one second. Changed in ten.',
  },
];

export default function HeroScrub() {
  const heroRef = useRef<HTMLElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cueRef = useRef<HTMLDivElement | null>(null);
  const bandRefs = useRef<Array<HTMLDivElement | null>>([]);

  useEffect(() => {
    const heroEl = heroRef.current;
    const stageEl = stageRef.current;
    const sceneEl = sceneRef.current;
    if (!heroEl || !stageEl || !sceneEl) return;

    const hero: HTMLElement = heroEl;
    const stage: HTMLDivElement = stageEl;
    const scene: HTMLDivElement = sceneEl;

    // ---- split the headlines into words, once ----
    bandRefs.current.forEach((el, i) => {
      if (!el) return;
      const h = el.querySelector<HTMLElement>('.band-h');
      if (!h || h.dataset.split === 'done') return;

      const text = h.textContent?.trim() ?? '';
      const words = text.split(/\s+/);
      const r = rng(9001 + i * 137);
      const em = BANDS[i].em === true;

      const sr = document.createElement('span');
      sr.className = 'sr-only';
      sr.textContent = text;

      const vis = document.createElement('span');
      vis.setAttribute('aria-hidden', 'true');

      words.forEach((w, wi) => {
        const span = document.createElement('span');
        span.className = 'w' + (em && /[.!?]$/.test(w) ? ' em' : '');
        const th = (words.length > 1 ? wi / (words.length - 1) : 0) * 0.46 + r() * 0.05;
        span.style.setProperty('--th', th.toFixed(4));
        span.textContent = w + (wi < words.length - 1 ? ' ' : '');
        vis.appendChild(span);
      });

      h.textContent = '';
      h.append(sr, vis);
      h.dataset.split = 'done';
    });

    const bands = bandRefs.current.map((el, i) => ({
      el,
      ...BANDS[i],
      op: -1,
      k: -1,
      first: i === 0,
      last: i === BANDS.length - 1,
    }));

    const scrollRangePx = () => Math.max(1, hero.offsetHeight - window.innerHeight);
    const heroProgress = () => {
      const top = hero.getBoundingClientRect().top + window.scrollY;
      return clamp((window.scrollY - top) / scrollRangePx(), 0, 1);
    };

    /** Ramps authored in vh and converted, so the feel holds at any hero height. */
    const rampFor = (b: { a: number; b: number }) => {
      const rangeVh = scrollRangePx() / (window.innerHeight / 100);
      return Math.min(20 / rangeVh, (b.b - b.a) / 3);
    };

    let lastSceneP = -1;
    const setVar = (name: string, val: string) => scene.style.setProperty(name, val);

    function drawScene(p: number) {
      if (Math.abs(p - lastSceneP) < 0.0015) return;
      lastSceneP = p;

      let y: number, sc: number, rx: number, rz: number;
      if (p <= CROSS) {
        const t = easeInOut(p / CROSS);
        y = lerp(-58, 10, t);
        sc = lerp(0.4, 1, t);
        rx = lerp(58, 10, t);
        rz = lerp(-16, 0, t);
      } else {
        const u = easeOut((p - CROSS) / (1 - CROSS));
        y = lerp(10, 13.5, u);
        sc = lerp(1, 1.08, u);
        rx = lerp(10, 5, u);
        rz = lerp(0, 2, u);
      }

      const bell = Math.exp(-Math.pow((p - CROSS) / 0.045, 2));
      const splashT = clamp((p - CROSS) / 0.17, 0, 1);

      setVar('--card-y', y.toFixed(2) + 'vh');
      setVar('--card-sc', sc.toFixed(4));
      setVar('--card-rx', rx.toFixed(2) + 'deg');
      setVar('--card-rz', rz.toFixed(2) + 'deg');
      setVar('--card-blur', (7 * bell).toFixed(2) + 'px');
      setVar('--plane-o', (0.42 + 0.58 * bell + 0.12 * smoothstep(p, CROSS, 1)).toFixed(3));
      setVar('--plane-sy', (1 + 4.5 * bell).toFixed(3));
      setVar('--splash-s', (0.05 + 1.75 * easeOut(splashT)).toFixed(3));
      setVar('--splash-o', (splashT > 0 && splashT < 1 ? Math.sin(splashT * Math.PI) * 0.75 : 0).toFixed(3));
      setVar('--bloom-o', (smoothstep(p, CROSS - 0.03, CROSS + 0.16) * 0.95).toFixed(3));
      setVar('--field-o', smoothstep(p, CROSS - 0.02, 0.92).toFixed(3));
    }

    let loadK = 0;
    let loadStart = 0;

    function updateCaptions(p: number) {
      for (const bd of bands) {
        if (!bd.el) continue;
        const f = rampFor(bd);
        const op =
          (bd.first ? 1 : smoothstep(p, bd.a, bd.a + f)) *
          (bd.last ? 1 : 1 - smoothstep(p, bd.b - f, bd.b));

        if (Math.abs(op - bd.op) > 0.004) {
          bd.op = op;
          bd.el.style.opacity = op.toFixed(3);
          bd.el.style.visibility = op < 0.005 ? 'hidden' : 'visible';
        }

        const assembly = Math.min(0.025, (bd.b - bd.a) * 0.35);
        let k = clamp((p - bd.a) / assembly, 0, 1);
        if (bd.first) k = Math.max(k, loadK);
        if (Math.abs(k - bd.k) > 0.008 || k === 1 || k === 0) {
          bd.k = k;
          bd.el.style.setProperty('--k', k.toFixed(3));
        }
      }
      const cue = cueRef.current;
      if (cue) {
        const co = 1 - smoothstep(p, 0.02, 0.14);
        const prev = Number(cue.dataset.o ?? '-1');
        if (Math.abs(co - prev) > 0.01) {
          cue.dataset.o = String(co);
          cue.style.setProperty('--cue-o', co.toFixed(3));
        }
      }
    }

    // ---- seek gating, deadlock safe ----
    let seekBusy = false;
    let pendingTime: number | null = null;
    const video = videoRef.current;

    function requestSeek(t: number) {
      if (!video || !video.duration || !isFinite(video.duration)) return;
      if (seekBusy) {
        pendingTime = t;
        return;
      }
      seekBusy = true;
      try {
        video.currentTime = t;
      } catch {
        seekBusy = false;
      }
    }

    const onSeeked = () => {
      seekBusy = false;
      if (pendingTime !== null) {
        const t = pendingTime;
        pendingTime = null;
        requestSeek(t);
      }
    };
    const onVideoError = () => {
      seekBusy = false;
      pendingTime = null;
      stage.classList.add('video-failed');
    };
    video?.addEventListener('seeked', onSeeked);
    video?.addEventListener('error', onVideoError);

    // ---- the drive loop that rests ----
    let target = 0;
    let shown = 0;
    let rafId: number | null = null;
    let lastTick = 0;
    let heroOnScreen = true;
    let scrubOn = false;

    function tick(now: number) {
      const dt = Math.min(100, now - (lastTick || now));
      lastTick = now;
      shown += (target - shown) * (1 - Math.pow(1 - 0.16, dt / 16.667));

      const converged = Math.abs(target - shown) < 0.0005;
      const loading = loadStart > 0 && loadK < 1;
      if (loading) loadK = clamp((now - loadStart) / 900, 0, 1);

      if (converged && !loading) {
        shown = target;
        rafId = null;
        lastTick = 0;
      } else {
        rafId = requestAnimationFrame(tick);
      }

      if (video?.duration && isFinite(video.duration)) requestSeek(shown * video.duration);
      drawScene(shown);
      updateCaptions(shown);
    }

    const kick = () => {
      if (rafId === null && heroOnScreen && scrubOn) {
        lastTick = 0;
        rafId = requestAnimationFrame(tick);
      }
    };
    const onScroll = () => {
      target = heroProgress();
      kick();
    };

    const io = new IntersectionObserver(
      (es) => {
        heroOnScreen = es[0].isIntersecting;
        if (heroOnScreen) kick();
      },
      { rootMargin: '10% 0px' },
    );
    io.observe(hero);

    // ---- the video, when there is one ----
    let heroInit = false;
    function initHeroOnce() {
      if (heroInit) return;
      heroInit = true;
      loadStart = performance.now();
      if (!HAS_VIDEO || !video) return;

      const poster = stage.querySelector<HTMLElement>('.poster');
      const img = new Image();
      img.onload = () => {
        if (poster) poster.style.backgroundImage = `url('${POSTER_URL}')`;
        stage.classList.add('poster-in');
        void loadBlob();
      };
      img.onerror = () => void loadBlob();
      img.src = POSTER_URL;
    }

    async function loadBlob() {
      if (!video) return;
      try {
        const ctrl = new AbortController();
        const watchdog = setTimeout(() => ctrl.abort(), 20000);
        const res = await fetch(VIDEO_URL, { signal: ctrl.signal });
        clearTimeout(watchdog);
        if (!res.ok) throw new Error('no video');
        video.src = URL.createObjectURL(await res.blob());
        video.load();
        video.addEventListener(
          'canplay',
          () => {
            requestSeek(heroProgress() * (video.duration || 0));
            stage.classList.add('video-ready');
          },
          { once: true },
        );
      } catch {
        stage.classList.add('video-failed');
      }
    }

    // ---- the five gates, decided live ----
    const mqls = GATES.map((q) => matchMedia(q));

    function enableScrub() {
      if (scrubOn) return;
      scrubOn = true;
      initHeroOnce();
      window.addEventListener('scroll', onScroll, { passive: true });
      bands.forEach((b) => {
        b.op = -1;
        b.k = -1;
      });
      lastSceneP = -1;
      onScroll();
      updateCaptions(heroProgress());
      drawScene(heroProgress());
    }
    function disableScrub() {
      if (!scrubOn) return;
      scrubOn = false;
      window.removeEventListener('scroll', onScroll);
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    }
    const applyHeroMode = () => {
      if (mqls.some((m) => m.matches)) disableScrub();
      else enableScrub();
    };

    mqls.forEach((m) => m.addEventListener('change', applyHeroMode));

    const onResize = () => {
      lastSceneP = -1;
      bands.forEach((b) => {
        b.op = -1;
        b.k = -1;
      });
      if (scrubOn) onScroll();
    };
    window.addEventListener('resize', onResize, { passive: true });

    applyHeroMode();

    return () => {
      io.disconnect();
      disableScrub();
      mqls.forEach((m) => m.removeEventListener('change', applyHeroMode));
      window.removeEventListener('resize', onResize);
      video?.removeEventListener('seeked', onSeeked);
      video?.removeEventListener('error', onVideoError);
    };
  }, []);

  return (
    <section className="hero" id="top" ref={heroRef as React.RefObject<HTMLElement>}>
      <div className="stage" ref={stageRef}>
        <div className="scene" ref={sceneRef} aria-hidden="true">
          <div className="scene-field" />
          <div className="scene-plane" />
          <div className="scene-bloom" />
          <div className="scene-splash" />
          <div className="scene-card">
            <HeroCard />
          </div>
          <div className="scene-dust">
            <i style={{ ['--x' as string]: '12%', ['--y' as string]: '22%', ['--d' as string]: '-3s' }} />
            <i style={{ ['--x' as string]: '78%', ['--y' as string]: '16%', ['--d' as string]: '-9s' }} />
            <i style={{ ['--x' as string]: '31%', ['--y' as string]: '71%', ['--d' as string]: '-14s' }} />
            <i style={{ ['--x' as string]: '88%', ['--y' as string]: '64%', ['--d' as string]: '-6s' }} />
            <i style={{ ['--x' as string]: '57%', ['--y' as string]: '38%', ['--d' as string]: '-11s' }} />
            <i style={{ ['--x' as string]: '20%', ['--y' as string]: '52%', ['--d' as string]: '-17s' }} />
          </div>
        </div>

        <video ref={videoRef} id="hero-video" preload="none" muted playsInline aria-hidden="true" tabIndex={-1} />
        <div className="poster" aria-hidden="true" />
        <div className="scrim" aria-hidden="true" />

        <div className="bands">
          {BANDS.map((b, i) => (
            <div
              key={b.headline}
              className={`band band-${i + 1}`}
              data-entrance={b.entrance}
              ref={(el) => {
                bandRefs.current[i] = el;
              }}
            >
              {i === 3 ? <h1 className="band-h split">{b.headline}</h1> : <p className="band-h split">{b.headline}</p>}
              {b.sub ? <p className="band-s">{b.sub}</p> : null}
              {b.cta ? (
                <div className="band-cta">
                  <Link className="btn btn-accent" href="/cards">
                    See the cards
                  </Link>
                  <a className="btn btn-ghost" href="#how">
                    How it works
                  </a>
                </div>
              ) : null}
            </div>
          ))}
        </div>

        <div className="cue" ref={cueRef} aria-hidden="true">
          <span />
        </div>
      </div>

      {/* the composed still hero for phones, portrait tablets and reduced motion */}
      <div className="static-hero">
        <div className="static-art" aria-hidden="true">
          <div className="static-plane" />
          <div className="static-card">
            <HeroCard />
          </div>
        </div>
        <div className="static-copy">
          <h1>Your digital identity. One tap away.</h1>
          <p>One NFC card. Your whole profile behind it. Change it any time, from your phone.</p>
          <div className="band-cta">
            <Link className="btn btn-accent" href="/cards">
              See the cards
            </Link>
            <a className="btn btn-ghost" href="#how">
              How it works
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

function HeroCard() {
  return (
    <svg viewBox="0 0 340 214" className="card-svg">
      <rect x="2" y="2" width="336" height="210" rx="18" fill="url(#heroFace)" />
      <rect x="2" y="2" width="336" height="210" rx="18" fill="url(#heroSheen)" />
      <rect x="2.75" y="2.75" width="334.5" height="208.5" rx="17.5" fill="none" stroke="#34E0F0" strokeOpacity=".34" strokeWidth="1.5" />
      <g transform="translate(250,150)" fill="none" stroke="#34E0F0" strokeOpacity=".85" strokeWidth="3" strokeLinecap="round">
        <path d="M0 -14a13 13 0 0 1 0 28" />
        <path d="M9 -24a23 23 0 0 1 0 48" />
      </g>
      <circle cx="243" cy="150" r="3.6" fill="#34E0F0" />
      <text x="34" y="47" fontFamily="var(--display)" fontSize="22" fontWeight="700" letterSpacing="-.7" fill="#EAF0F6" fillOpacity=".92">
        NFCY
      </text>
      <rect x="36" y="152" width="92" height="6" rx="3" fill="#EAF0F6" fillOpacity=".10" />
      <rect x="36" y="166" width="62" height="6" rx="3" fill="#EAF0F6" fillOpacity=".07" />
    </svg>
  );
}
