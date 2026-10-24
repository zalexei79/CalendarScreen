import { useEffect } from 'react';

const SURFACES = '.calendar-day-surface,.dayris-header button,.calendar-dock-morph,.wallet-balance-card,.capital-asset,.theme-premium-card,.dayris-settings-panel,.financial-history-dialog,.plan-dialog,.voice-workspace';
const SCENES = '.dayris-swipe-sheet,.financial-history-dialog,.plan-dialog,.pro-dialog,.savings-dialog,.lot-calculator,.category-picker-sheet,.entry-login-dialog,.first-run-shell,.wallet-balance-card,.capital-overview,.voice-workspace,.premium-shell [role="dialog"]';
const REVEALS = `${SCENES},.calendar-motion-light`;
const EASE = 'cubic-bezier(.22,1,.36,1)';

// Decorative enhancement only. One pointer surface and one scheduled frame;
// no React updates, gesture interception, perpetual RAF, or device sensors.
export default function useGoldMotion(theme) {
  useEffect(() => {
    if (theme !== 'gold') return undefined;
    const root = document.documentElement;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const animations = new Set();
    const releases = new Map();
    const touched = new Set();
    const seen = new WeakSet();
    const pending = new Set();
    let pointerFrame = 0, revealFrame = 0, hovered = null, rect = null, point = null, press = null;

    function animate(node, keyframes, duration, delay = 0) {
      if (reduced.matches || document.hidden || !node.isConnected || typeof node.animate !== 'function') return;
      try {
        const animation = node.animate(keyframes, { duration, delay, easing: EASE });
        animation.id = 'dayris-gold-motion';
        animations.add(animation);
        const forget = () => animations.delete(animation);
        animation.onfinish = forget;
        animation.oncancel = forget;
      } catch { /* A missing animation capability must never prevent app startup. */ }
    }

    function clear(node) {
      window.clearTimeout(releases.get(node));
      releases.delete(node);
      node.removeAttribute('data-gold-lit');
      node.style.removeProperty('--gold-pointer-x');
      node.style.removeProperty('--gold-pointer-y');
      touched.delete(node);
    }

    function release(node) {
      if (!node) return;
      window.clearTimeout(releases.get(node));
      // Keep the light through release, then let CSS settle it gently.
      releases.set(node, window.setTimeout(() => clear(node), 240));
    }

    function surface(target) {
      return target instanceof Element ? target.closest(SURFACES) : null;
    }

    function light(node, x, y) {
      if (!node || reduced.matches || document.hidden) return;
      window.clearTimeout(releases.get(node));
      releases.delete(node);
      touched.add(node);
      const box = node === hovered && rect ? rect : node.getBoundingClientRect();
      node.style.setProperty('--gold-pointer-x', `${Math.max(0, Math.min(100, (x - box.left) / Math.max(box.width, 1) * 100)).toFixed(1)}%`);
      node.style.setProperty('--gold-pointer-y', `${Math.max(0, Math.min(100, (y - box.top) / Math.max(box.height, 1) * 100)).toFixed(1)}%`);
      node.setAttribute('data-gold-lit', '');
    }

    function move(event) {
      if (event.pointerType !== 'mouse' || reduced.matches || document.hidden) return;
      const node = surface(event.target);
      if (node !== hovered) {
        release(hovered);
        hovered = node;
        rect = node?.getBoundingClientRect() || null;
      }
      point = { x: event.clientX, y: event.clientY };
      if (!node || pointerFrame) return;
      pointerFrame = requestAnimationFrame(() => {
        pointerFrame = 0;
        if (hovered && point) light(hovered, point.x, point.y);
      });
    }

    function down(event) {
      if (event.isPrimary === false || (event.pointerType === 'mouse' && event.button !== 0)) return;
      const node = surface(event.target);
      if (!node || reduced.matches) return;
      const scene = event.target.closest(SCENES);
      animations.forEach(animation => { if (animation.effect?.target === scene) animation.cancel(); });
      light(node, event.clientX, event.clientY);
      const button = event.target.closest('button:not(:disabled)');
      press = { node, button, x: event.clientX, y: event.clientY, id: event.pointerId };
    }

    function up(event) {
      const current = press;
      press = null;
      if (!current) return;
      release(current.node);
      if (event.type === 'pointercancel' || event.pointerId !== current.id || Math.hypot(event.clientX - current.x, event.clientY - current.y) > 10) return;
      if (current.button) animate(current.button, [{ scale: '.992' }, { scale: '1' }], 260);
      const optics = current.node.querySelector('.calendar-glass-optics');
      if (optics) animate(optics, [{ opacity: .3, transform: 'translateX(-8%)' }, { opacity: .9, offset: .3 }, { opacity: .28, transform: 'translateX(6%)' }], 720);
    }

    function keyboard(event) {
      if (event.repeat || !['Enter', ' '].includes(event.key)) return;
      if (!(event.target instanceof Element) || !event.target.closest('button,[role="button"]')) return;
      const node = surface(event.target);
      if (!node) return;
      const box = node.getBoundingClientRect();
      light(node, box.left + box.width / 2, box.top + box.height / 2);
      release(node);
    }

    function reveal() {
      revealFrame = 0;
      const nodes = [...pending].filter(node => node.isConnected);
      pending.clear();
      for (const node of nodes) {
        if (seen.has(node)) continue;
        seen.add(node);
        // Animate a scene once, not every child when values/ASR text update.
        if (nodes.some(parent => parent !== node && parent.contains(node))) continue;
        if (node.matches('.calendar-motion-light')) {
          animate(node, [{ opacity: .1, transform: 'translate3d(-8%,0,0)' }, { opacity: .85, offset: .4 }, { opacity: .32, transform: 'translate3d(8%,0,0)' }], 1800);
        } else {
          animate(node, [{ opacity: .72, translate: '0 12px' }, { opacity: 1, translate: '0 0' }], 400);
        }
      }
    }

    function queue(node) {
      if (!(node instanceof Element) || reduced.matches) return;
      if (node.matches(REVEALS)) pending.add(node);
      node.querySelectorAll(REVEALS).forEach(child => pending.add(child));
      if (pending.size && !revealFrame) revealFrame = requestAnimationFrame(reveal);
    }

    function stop() {
      cancelAnimationFrame(pointerFrame);
      cancelAnimationFrame(revealFrame);
      pointerFrame = revealFrame = 0;
      hovered = rect = point = press = null;
      pending.clear();
      animations.forEach(animation => animation.cancel());
      animations.clear();
      [...touched].forEach(clear);
    }

    function preference() {
      if (reduced.matches) stop();
      root.toggleAttribute('data-gold-motion', !reduced.matches);
    }
    function leave() { release(hovered); hovered = rect = null; }
    function visibility() { if (document.hidden) stop(); }
    const observer = new MutationObserver(records => {
      for (const record of records) record.addedNodes.forEach(queue);
      // A navigating user can remove a hovered card before pointerup fires.
      [...touched].filter(node => !node.isConnected).forEach(clear);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    preference();
    queue(document.body);
    document.addEventListener('pointermove', move, { passive: true });
    document.addEventListener('pointerdown', down, { passive: true });
    document.addEventListener('pointerup', up, { passive: true });
    document.addEventListener('pointercancel', up, { passive: true });
    document.addEventListener('keydown', keyboard);
    document.addEventListener('scroll', leave, { passive: true, capture: true });
    document.addEventListener('visibilitychange', visibility);
    document.documentElement.addEventListener('pointerleave', leave);
    reduced.addEventListener('change', preference);
    return () => {
      observer.disconnect();
      stop();
      root.removeAttribute('data-gold-motion');
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerdown', down);
      document.removeEventListener('pointerup', up);
      document.removeEventListener('pointercancel', up);
      document.removeEventListener('keydown', keyboard);
      document.removeEventListener('scroll', leave, true);
      document.removeEventListener('visibilitychange', visibility);
      document.documentElement.removeEventListener('pointerleave', leave);
      reduced.removeEventListener('change', preference);
    };
  }, [theme]);
}
