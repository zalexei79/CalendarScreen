import { useEffect, useLayoutEffect, useRef, useState } from 'react';

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const targets = panel => [...panel.querySelectorAll('.calendar-day-date, .calendar-day-overview, .calendar-day-scroll')];
const settled = animations => Promise.all(animations.map(animation => animation.finished.catch(() => {})));

export default function useDayPanelMotion({ panelRef, dateKey, onNavigate }) {
  const latest = useRef(null);
  latest.current = { dateKey, onNavigate };
  const active = useRef(null);
  const queued = useRef(0);
  const mounted = useRef(true);
  const navigateRef = useRef(null);
  const [busy, setBusy] = useState(false);

  function finish(motion) {
    if (!mounted.current || active.current !== motion) return;
    active.current = null;
    motion.animations.forEach(animation => animation.cancel());
    if (panelRef.current) panelRef.current.style.height = '';
    setBusy(false);
    const step = queued.current;
    queued.current = 0;
    if (step) navigateRef.current(step);
  }

  function navigate(step) {
    if (!latest.current.onNavigate) return;
    if (active.current) { queued.current += step; return; }
    const panel = panelRef.current;
    if (!panel?.animate || reducedMotion()) { latest.current.onNavigate(step); return; }
    const sign = step > 0 ? 1 : -1;
    const distance = Math.min(96, panel.clientWidth * .21);
    const motion = { phase: 'leaving', dateKey: latest.current.dateKey, sign, distance, height: panel.offsetHeight, animations: [] };
    active.current = motion;
    setBusy(true);
    motion.animations = targets(panel).map(element => element.animate([
      { opacity: 1, transform: 'translate3d(0,0,0)' },
      { opacity: 0, transform: `translate3d(${-sign * distance * .75}px,0,0)` },
    ], { duration: 145, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' }));
    void settled(motion.animations).then(() => {
      if (!mounted.current || active.current !== motion) return;
      motion.phase = 'waiting';
      latest.current.onNavigate(step);
    });
  }
  navigateRef.current = navigate;

  useLayoutEffect(() => {
    const motion = active.current, panel = panelRef.current;
    if (!motion || !panel || dateKey === motion.dateKey) return;
    // Commit the new day's data between exit and entrance, before the browser
    // paints it. Animate the sheet's natural height too, including empty days.
    motion.animations.forEach(animation => animation.cancel());
    if (reducedMotion()) { finish(motion); return; }
    motion.phase = 'entering';
    const nextHeight = panel.offsetHeight;
    panel.style.height = `${nextHeight}px`;
    motion.animations = targets(panel).map(element => element.animate([
      { opacity: 0, transform: `translate3d(${motion.sign * motion.distance}px,0,0)` },
      { opacity: 1, transform: 'translate3d(0,0,0)' },
    ], { duration: 335, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'both' }));
    motion.animations.push(panel.animate([
      { height: `${motion.height}px` }, { height: `${nextHeight}px` },
    ], { duration: 335, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'both' }));
    void settled(motion.animations).then(() => finish(motion));
  }, [dateKey]);

  useEffect(() => {
    mounted.current = true;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const settleImmediately = () => {
      if (media.matches) active.current?.animations.forEach(animation => animation.finish());
    };
    media.addEventListener('change', settleImmediately);
    return () => {
      mounted.current = false;
      active.current?.animations.forEach(animation => animation.cancel());
      active.current = null;
      queued.current = 0;
      if (panelRef.current) panelRef.current.style.height = '';
      media.removeEventListener('change', settleImmediately);
    };
  }, []);

  return { busy, navigate };
}
