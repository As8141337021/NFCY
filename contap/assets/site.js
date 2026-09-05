/* ============================================================
   NFCY
   Plain vanilla JavaScript. No framework, no build step.
   ============================================================ */
(function () {
'use strict';

var WA = '918141337021';

var clamp = function (v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; };
var smoothstep = function (p, e0, e1) {
  var t = clamp((p - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};
var lerp = function (a, b, t) { return a + (b - a) * t; };
var easeOut = function (t) { return 1 - Math.pow(1 - t, 3); };
var easeInOut = function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };

/* seeded generator so every "random" offset is identical on every load */
function rng(seed) {
  var s = seed >>> 0;
  return function () { return (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; };
}

var $ = function (s, r) { return (r || document).querySelector(s); };
var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

document.addEventListener('DOMContentLoaded', function () {
  document.body.classList.add('lit');
});
window.addEventListener('load', function () { document.body.classList.add('lit'); });
setTimeout(function () { document.body.classList.add('lit'); }, 1200);

var yr = $('#yr');
if (yr) yr.textContent = String(new Date().getFullYear());

/* ============================================================
   1. SPLIT TEXT
   ============================================================ */
function splitWords(el, seed) {
  if (el.dataset.split !== 'word' || el.dataset.done === '1') return;
  var text = el.textContent.trim();
  var words = text.split(/\s+/);
  var r = rng(seed);
  var em = el.dataset.em === '1';

  var sr = document.createElement('span');
  sr.className = 'sr-only';
  sr.textContent = text;

  var vis = document.createElement('span');
  vis.setAttribute('aria-hidden', 'true');

  var spread = parseFloat(el.parentNode.dataset.spread || '0.46');
  words.forEach(function (w, i) {
    var span = document.createElement('span');
    span.className = 'w';
    if (em && /[.!?]$/.test(w)) span.className += ' em';
    var th = (words.length > 1 ? i / (words.length - 1) : 0) * spread + r() * 0.05;
    span.style.setProperty('--th', th.toFixed(4));
    span.textContent = w + (i < words.length - 1 ? ' ' : '');
    vis.appendChild(span);
  });

  el.textContent = '';
  el.appendChild(sr);
  el.appendChild(vis);
  el.dataset.done = '1';
}
$$('.split').forEach(function (el, i) { splitWords(el, 9001 + i * 137); });

/* ============================================================
   2. THE HERO
   ============================================================ */
var hero = $('.hero');
var stage = $('#stage');
var video = $('#hero-video');
var poster = $('#poster');
var ring = $('#ring');
var scene = $('#scene');
var cue = $('#cue');

/* The hero footage is not generated yet, so the drawn scene carries the journey.
   Flip HAS_VIDEO to true the moment assets/hero-scrub.mp4 and assets/hero-poster.jpg
   exist and the whole Blob path below takes over. Nothing else changes. */
var HAS_VIDEO = false;
var VIDEO_URL = 'assets/hero-scrub.mp4';
var POSTER_URL = 'assets/hero-poster.jpg';
var VIDEO_BYTES = 6800000;
var CROSS = 0.64;

var bands = $$('.band').map(function (el) {
  return {
    el: el,
    a: parseFloat(el.dataset.a),
    b: parseFloat(el.dataset.b),
    ramp: el.dataset.ramp ? parseFloat(el.dataset.ramp) : null,
    op: -1,
    k: -1,
    first: false,
    last: false
  };
});
if (bands.length) { bands[0].first = true; bands[bands.length - 1].last = true; }

function scrollRangePx() {
  if (!hero) return 1;
  return Math.max(1, hero.offsetHeight - window.innerHeight);
}
function heroProgress() {
  if (!hero) return 0;
  var top = hero.getBoundingClientRect().top + window.scrollY;
  return clamp((window.scrollY - top) / scrollRangePx(), 0, 1);
}
/* ramps authored in vh, converted to progress, so the feel holds at any hero height */
function rampFor(band) {
  if (band.ramp !== null) return band.ramp;
  var rangeVh = scrollRangePx() / (window.innerHeight / 100);
  return Math.min(20 / rangeVh, (band.b - band.a) / 3);
}

var loadK = 0;
var loadStart = 0;
var lastSceneP = -1;

function setVar(el, name, val) { el.style.setProperty(name, val); }

function drawScene(p) {
  if (!scene) return;
  if (Math.abs(p - lastSceneP) < 0.0015) return;
  lastSceneP = p;

  var y, sc, rx, rz;
  if (p <= CROSS) {
    var t = easeInOut(p / CROSS);
    y = lerp(-58, 10, t);
    sc = lerp(0.40, 1, t);
    rx = lerp(58, 10, t);
    rz = lerp(-16, 0, t);
  } else {
    var u = easeOut((p - CROSS) / (1 - CROSS));
    y = lerp(10, 13.5, u);
    sc = lerp(1, 1.08, u);
    rx = lerp(10, 5, u);
    rz = lerp(0, 2, u);
  }

  /* the boundary crossing: a beat of lens blur, the plane flaring, a ring of light */
  var bell = Math.exp(-Math.pow((p - CROSS) / 0.045, 2));
  var splashT = clamp((p - CROSS) / 0.17, 0, 1);

  setVar(scene, '--card-y', y.toFixed(2) + 'vh');
  setVar(scene, '--card-sc', sc.toFixed(4));
  setVar(scene, '--card-rx', rx.toFixed(2) + 'deg');
  setVar(scene, '--card-rz', rz.toFixed(2) + 'deg');
  setVar(scene, '--card-blur', (7 * bell).toFixed(2) + 'px');
  setVar(scene, '--plane-o', (0.42 + 0.58 * bell + 0.12 * smoothstep(p, CROSS, 1)).toFixed(3));
  setVar(scene, '--plane-sy', (1 + 4.5 * bell).toFixed(3));
  setVar(scene, '--splash-s', (0.05 + 1.75 * easeOut(splashT)).toFixed(3));
  setVar(scene, '--splash-o', (splashT > 0 && splashT < 1 ? Math.sin(splashT * Math.PI) * 0.75 : 0).toFixed(3));
  setVar(scene, '--bloom-o', (smoothstep(p, CROSS - 0.03, CROSS + 0.16) * 0.95).toFixed(3));
  setVar(scene, '--field-o', smoothstep(p, CROSS - 0.02, 0.92).toFixed(3));
}

function updateCaptions(p) {
  for (var i = 0; i < bands.length; i++) {
    var bd = bands[i];
    var f = rampFor(bd);
    var op = (bd.first ? 1 : smoothstep(p, bd.a, bd.a + f)) *
             (bd.last ? 1 : (1 - smoothstep(p, bd.b - f, bd.b)));
    if (Math.abs(op - bd.op) > 0.004) {
      bd.op = op;
      bd.el.style.opacity = op.toFixed(3);
      bd.el.style.visibility = op < 0.005 ? 'hidden' : 'visible';
    }
    var assembly = bd.ramp !== null ? bd.ramp : Math.min(0.025, (bd.b - bd.a) * 0.35);
    var k = clamp((p - bd.a) / assembly, 0, 1);
    if (bd.first) k = Math.max(k, loadK);
    if (Math.abs(k - bd.k) > 0.008 || k === 1 || k === 0) {
      bd.k = k;
      bd.el.style.setProperty('--k', k.toFixed(3));
    }
  }
  if (cue) {
    var co = 1 - smoothstep(p, 0.02, 0.14);
    if (Math.abs(co - (cue._o || -1)) > 0.01) { cue._o = co; cue.style.setProperty('--cue-o', co.toFixed(3)); }
  }
}

/* ---------- seek gating, deadlock safe ---------- */
var seekBusy = false;
var pendingTime = null;
function requestSeek(t) {
  if (!video || !video.duration || !isFinite(video.duration)) return;
  if (seekBusy) { pendingTime = t; return; }
  seekBusy = true;
  try { video.currentTime = t; } catch (e) { seekBusy = false; }
}
if (video) {
  video.addEventListener('seeked', function () {
    seekBusy = false;
    if (pendingTime !== null) { var t = pendingTime; pendingTime = null; requestSeek(t); }
  });
  video.addEventListener('error', function () { seekBusy = false; pendingTime = null; failVideo(); });
}

/* ---------- the lerped drive loop that rests ---------- */
var target = 0, shown = 0, rafId = null, lastTick = 0, heroOnScreen = true;

function tick(now) {
  var dt = Math.min(100, now - (lastTick || now));
  lastTick = now;
  var k = 0.16;
  shown += (target - shown) * (1 - Math.pow(1 - k, dt / 16.667));

  var converged = Math.abs(target - shown) < 0.0005;
  var loading = loadStart && loadK < 1;
  if (loading) {
    loadK = clamp((now - loadStart) / 900, 0, 1);
  }

  if (converged && !loading) {
    shown = target;
    rafId = null;
    lastTick = 0;
  } else {
    rafId = requestAnimationFrame(tick);
  }

  if (video && video.duration && isFinite(video.duration)) requestSeek(shown * video.duration);
  drawScene(shown);
  updateCaptions(shown);
}

function kick() {
  if (rafId === null && heroOnScreen && scrubOn) { lastTick = 0; rafId = requestAnimationFrame(tick); }
}
function onScroll() {
  target = heroProgress();
  kick();
}

if (hero && 'IntersectionObserver' in window) {
  new IntersectionObserver(function (es) {
    heroOnScreen = es[0].isIntersecting;
    if (heroOnScreen) kick();
  }, { rootMargin: '10% 0px' }).observe(hero);
}

/* ---------- the video, streamed behind an honest ring ---------- */
var heroInit = false;
function initHeroOnce() {
  if (heroInit) return;
  heroInit = true;
  loadStart = performance.now();
  if (!HAS_VIDEO) return;

  var posterImg = new Image();
  var started = false;
  function startBlobFetch() {
    if (started) return;
    started = true;
    loadHeroBlob().catch(failVideo);
  }
  posterImg.onload = function () {
    poster.style.backgroundImage = "url('" + POSTER_URL + "')";
    stage.classList.add('poster-in');
    startBlobFetch();
  };
  posterImg.onerror = startBlobFetch;
  posterImg.src = POSTER_URL;
  setTimeout(startBlobFetch, 4000);
}

function loadHeroBlob() {
  return new Promise(function (resolve, reject) {
    var ctrl = new AbortController();
    var watchdog = setTimeout(function () { ctrl.abort(); }, 20000);
    stage.classList.add('loading');

    fetch(VIDEO_URL, { signal: ctrl.signal }).then(function (res) {
      if (!res.ok || !res.body) { clearTimeout(watchdog); return reject(new Error('no video')); }
      var total = Number(res.headers.get('Content-Length')) || VIDEO_BYTES;
      var reader = res.body.getReader();
      var chunks = [], got = 0, lastRing = 0;
      (function pump() {
        reader.read().then(function (r) {
          if (r.done) {
            clearTimeout(watchdog);
            ring.style.setProperty('--ld', 0);
            stage.classList.remove('loading');
            video.src = URL.createObjectURL(new Blob(chunks, { type: 'video/mp4' }));
            video.load();
            video.addEventListener('canplay', function () {
              requestSeek(heroProgress() * video.duration);
              stage.classList.add('video-ready');
            }, { once: true });
            return resolve();
          }
          clearTimeout(watchdog);
          watchdog = setTimeout(function () { ctrl.abort(); }, 20000);
          chunks.push(r.value);
          got += r.value.length;
          var frac = Math.min(1, got / total);
          var now = performance.now();
          if (now - lastRing > 100 || frac === 1) {
            lastRing = now;
            ring.style.setProperty('--ld', Math.round(126 * (1 - frac)));
          }
          pump();
        }).catch(function (e) { clearTimeout(watchdog); reject(e); });
      })();
    }).catch(function (e) { clearTimeout(watchdog); reject(e); });
  });
}

function failVideo() {
  if (!stage) return;
  stage.classList.remove('loading');
  stage.classList.add('video-failed');
  if (ring) ring.style.display = 'none';
}

/* ---------- the five static-hero gates, decided live ---------- */
var GATES = [
  '(max-width: 720px)',
  '(orientation: portrait) and (max-width: 1024px)',
  '(orientation: portrait) and (pointer: coarse)',
  '(orientation: landscape) and (pointer: coarse) and (max-height: 560px)',
  '(prefers-reduced-motion: reduce)'
];
var scrubOn = false;

function enableScrub() {
  if (scrubOn || !hero) return;
  scrubOn = true;
  initHeroOnce();
  window.addEventListener('scroll', onScroll, { passive: true });
  bands.forEach(function (b) { b.op = -1; b.k = -1; });
  lastSceneP = -1;
  unpinFinalStates();
  onScroll();
  updateCaptions(heroProgress());
  drawScene(heroProgress());
}
function disableScrub() {
  if (!scrubOn) return;
  scrubOn = false;
  window.removeEventListener('scroll', onScroll);
  if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
}
function applyHeroMode() {
  var off = GATES.some(function (q) { return matchMedia(q).matches; });
  if (off) disableScrub(); else enableScrub();
}
var MQLS = GATES.map(function (q) { return matchMedia(q); });
MQLS.forEach(function (m) {
  if (m.addEventListener) m.addEventListener('change', applyHeroMode);
  else if (m.addListener) m.addListener(applyHeroMode);
});

window.addEventListener('resize', function () {
  lastSceneP = -1;
  bands.forEach(function (b) { b.op = -1; b.k = -1; });
  if (scrubOn) onScroll();
}, { passive: true });

/* ============================================================
   3. ENTRANCES BELOW THE FOLD
   ============================================================ */
var revealIO = null;
if ('IntersectionObserver' in window) {
  revealIO = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      e.target.classList.add('in');
      revealIO.unobserve(e.target);
      setTimeout(function () { e.target.classList.add('done'); }, 1200);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });
  $$('.reveal').forEach(function (el) { revealIO.observe(el); });
} else {
  $$('.reveal').forEach(function (el) { el.classList.add('in', 'done'); });
}

/* the self-drawing connector through the four steps */
var stepsPath = $('#steps-path');
var stepsWrap = $('#steps');
function drawSteps() {
  if (!stepsPath || !stepsWrap) return;
  var r = stepsWrap.getBoundingClientRect();
  var vh = window.innerHeight;
  var p = clamp((vh * 0.85 - r.top) / (r.height * 0.9), 0, 1);
  var v = Math.round(100 - 100 * p);
  if (v !== stepsPath._v) { stepsPath._v = v; stepsPath.setAttribute('stroke-dashoffset', v); }
}

/* ============================================================
   4. THE ONE INTERACTIVE MOMENT: press and hold
   ============================================================ */
var tapcard = $('#tapcard');
var demoStage = $('.demo-stage');
var claims = $$('#demo-claims li');
var demoDone = $('#demo-done');

if (tapcard && demoStage) {
  var hold = 0, holding = false, holdRaf = null, holdLast = 0, completed = false;

  function paintHold() {
    demoStage.style.setProperty('--hold', hold.toFixed(3));
    tapcard.style.setProperty('--hold', hold.toFixed(3));
  }
  function holdTick(now) {
    var dt = Math.min(80, now - (holdLast || now));
    holdLast = now;
    if (holding) hold = clamp(hold + dt / 1100, 0, 1);
    else hold = clamp(hold - dt / 900, 0, 1);
    paintHold();

    if (hold >= 1 && !completed) complete();
    if ((holding && hold < 1) || (!holding && hold > 0)) {
      holdRaf = requestAnimationFrame(holdTick);
    } else {
      holdRaf = null; holdLast = 0;
    }
  }
  function startHold(e) {
    if (completed) return;
    if (e && e.cancelable) e.preventDefault();
    holding = true;
    if (holdRaf === null) { holdLast = 0; holdRaf = requestAnimationFrame(holdTick); }
  }
  function endHold() {
    holding = false;
    if (holdRaf === null && hold > 0) { holdLast = 0; holdRaf = requestAnimationFrame(holdTick); }
  }
  function complete() {
    completed = true; holding = false; hold = 1; paintHold();
    demoStage.classList.add('done');
    claims.forEach(function (li, i) { setTimeout(function () { li.classList.add('on'); }, 260 + i * 220); });
    if (demoDone) setTimeout(function () { demoDone.classList.add('on'); }, 260 + claims.length * 220);
  }

  tapcard.addEventListener('pointerdown', startHold);
  tapcard.addEventListener('pointerup', endHold);
  tapcard.addEventListener('pointercancel', endHold);
  tapcard.addEventListener('pointerleave', endHold);
  tapcard.addEventListener('keydown', function (e) {
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); startHold(); }
  });
  tapcard.addEventListener('keyup', function (e) {
    if (e.key === ' ' || e.key === 'Enter') endHold();
  });
  tapcard.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  /* reduced motion gets the finished state, no hold required */
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) complete();

  window._contapCompleteDemo = complete;
}

/* ============================================================
   5. REDUCED MOTION, honoured live, in both directions
   ============================================================ */
function pinToFinalStates() {
  $$('.reveal').forEach(function (el) { el.classList.add('in', 'done'); });
  if (stepsPath) { stepsPath._v = 0; stepsPath.setAttribute('stroke-dashoffset', 0); }
  if (window._contapCompleteDemo) window._contapCompleteDemo();
  if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
  document.documentElement.classList.add('pinned');
}
function unpinFinalStates() {
  document.documentElement.classList.remove('pinned');
  if (stepsPath) { stepsPath._v = null; drawSteps(); }
}
var rmq = matchMedia('(prefers-reduced-motion: reduce)');
var onRM = function (e) {
  if (e.matches) pinToFinalStates();
  else applyHeroMode();
};
if (rmq.addEventListener) rmq.addEventListener('change', onRM);
else if (rmq.addListener) rmq.addListener(onRM);

/* ============================================================
   6. NAV, STICKY BAR, PAGE SCROLL WORK
   ============================================================ */
var nav = $('#nav');
var stickyBar = $('#sticky-bar');
var lastNav = null, lastSticky = null;

function pageScroll() {
  var y = window.scrollY;
  var solid = y > 40;
  if (solid !== lastNav) { lastNav = solid; nav.classList.toggle('solid', solid); }

  if (stickyBar) {
    var getRect = $('#get').getBoundingClientRect();
    var up = y > window.innerHeight * 0.6 && getRect.top > window.innerHeight * 0.4;
    if (up !== lastSticky) { lastSticky = up; stickyBar.classList.toggle('up', up); }
  }
  drawSteps();
}
window.addEventListener('scroll', pageScroll, { passive: true });
window.addEventListener('resize', pageScroll, { passive: true });

/* pause every animation while the tab is hidden */
document.addEventListener('visibilitychange', function () {
  document.body.classList.toggle('paused', document.hidden);
});

/* ============================================================
   7. THE ONE CALL TO ACTION
   ============================================================ */
var form = $('#get-form');
var cardSelect = $('#f-card');

$$('[data-card]').forEach(function (a) {
  a.addEventListener('click', function () {
    var want = a.getAttribute('data-card');
    if (!cardSelect) return;
    for (var i = 0; i < cardSelect.options.length; i++) {
      if (cardSelect.options[i].text === want) { cardSelect.selectedIndex = i; break; }
    }
  });
});

if (form) {
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var name = $('#f-name'), phone = $('#f-phone'), work = $('#f-work');
    var ok = true;

    var nameBad = name.value.trim().length < 2;
    name.parentNode.classList.toggle('bad', nameBad);
    $('#e-name').hidden = !nameBad;
    if (nameBad) ok = false;

    var digits = phone.value.replace(/\D/g, '');
    var phoneBad = !(digits.length === 10 || (digits.length === 12 && digits.indexOf('91') === 0));
    phone.parentNode.classList.toggle('bad', phoneBad);
    $('#e-phone').hidden = !phoneBad;
    if (phoneBad) ok = false;

    if (!ok) { (nameBad ? name : phone).focus(); return; }

    var msg = 'Hi NFCY. I am ' + name.value.trim() + '.' +
      (work.value.trim() ? ' I work as ' + work.value.trim() + '.' : '') +
      ' I want the ' + cardSelect.value + '.' +
      ' My WhatsApp number is ' + digits + '.';

    var okBox = $('#form-ok');
    okBox.hidden = false;
    window.open('https://wa.me/' + WA + '?text=' + encodeURIComponent(msg), '_blank', 'noopener');
  });
}

/* ============================================================
   8. GO
   ============================================================ */
applyHeroMode();
pageScroll();
if (rmq.matches) pinToFinalStates();

})();
