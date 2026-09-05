'use client';

import { useEffect } from 'react';

/**
 * Scroll entrances for everything below the hero, plus the self drawing line
 * through the four steps. Kept in one place so the page itself stays markup.
 *
 * Reduced motion is honoured live and in both directions: flipping it on pins
 * everything to its finished state, flipping it back off hands control back to
 * the scroll drives.
 */
export default function Reveals() {
  useEffect(() => {
    const reveals = Array.from(document.querySelectorAll<HTMLElement>('.reveal'));
    const rmq = matchMedia('(prefers-reduced-motion: reduce)');
    const stepsPath = document.getElementById('steps-path');
    const stepsWrap = document.getElementById('steps');

    let io: IntersectionObserver | null = null;

    function showAll() {
      reveals.forEach((el) => el.classList.add('in', 'done'));
      if (stepsPath) stepsPath.setAttribute('stroke-dashoffset', '0');
    }

    function arm() {
      io?.disconnect();
      io = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (!e.isIntersecting) return;
            e.target.classList.add('in');
            io?.unobserve(e.target);
            // retiring the stagger, so later siblings do not hover late forever
            setTimeout(() => e.target.classList.add('done'), 1200);
          });
        },
        { rootMargin: '0px 0px -8% 0px', threshold: 0.06 },
      );
      reveals.forEach((el) => io?.observe(el));
    }

    let lastLine = -1;
    function drawSteps() {
      if (!stepsPath || !stepsWrap) return;
      const r = stepsWrap.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, (window.innerHeight * 0.85 - r.top) / (r.height * 0.9)));
      const v = Math.round(100 - 100 * p);
      if (v !== lastLine) {
        lastLine = v;
        stepsPath.setAttribute('stroke-dashoffset', String(v));
      }
    }

    function onScroll() {
      drawSteps();
      document.querySelector('.nav')?.classList.toggle('solid', window.scrollY > 40);
    }

    if (rmq.matches) {
      showAll();
    } else {
      arm();
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    }

    const onPref = (e: MediaQueryListEvent) => {
      if (e.matches) {
        showAll();
        window.removeEventListener('scroll', onScroll);
      } else {
        lastLine = -1;
        arm();
        window.addEventListener('scroll', onScroll, { passive: true });
        onScroll();
      }
    };
    rmq.addEventListener('change', onPref);

    // whisper level animations must not run on a hidden tab
    const onVis = () => document.body.classList.toggle('paused', document.hidden);
    document.addEventListener('visibilitychange', onVis);

    return () => {
      io?.disconnect();
      window.removeEventListener('scroll', onScroll);
      rmq.removeEventListener('change', onPref);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  return null;
}
