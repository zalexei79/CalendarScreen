import { useEffect, useRef, useState } from 'react';

const INTERACTIVE = 'button,a,input,textarea,select,label,[contenteditable]:not([contenteditable="false"]),[role="button"],[role="slider"],[data-wallet-gesture-ignore]';
const IDLE = { x: 0, y: 0, axis: null, ready: false };

function isAtTop(target) {
  for (let node = target; node; node = node.parentElement) {
    if (node.scrollTop > 1) return false;
  }
  return (document.scrollingElement?.scrollTop || 0) <= 1;
}

function canExit(gesture, elapsed, navigation) {
  if (gesture.axis === 'y') return gesture.dy >= 148 && gesture.dy > Math.abs(gesture.dx) * 1.7;
  if (navigation === 'calendar') return Math.abs(gesture.dx) >= 48 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5;
  return Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5 && (Math.abs(gesture.dx) >= 96 || (Math.abs(gesture.dx) >= 48 && elapsed <= 450 && Math.abs(gesture.dx) / Math.max(elapsed, 1) >= .55));
}

export function useWalletExitGesture({ onExit, disabled, navigation = 'wallet', onNextMonth, onPreviousMonth }) {
  const surfaceRef = useRef(null);
  const config = useRef({ onExit, disabled, onNextMonth, onPreviousMonth });
  config.current = { onExit, disabled, onNextMonth, onPreviousMonth };
  const [drag, setDrag] = useState(IDLE);

  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface || disabled || (!onExit && navigation !== 'calendar')) { setDrag(IDLE); return; }
    let gesture = null;
    let suppressClickUntil = 0;
    let exiting = false;
    const reset = () => { gesture = null; setDrag(IDLE); };

    function start(event) {
      reset();
      const target = event.target instanceof Element ? event.target : null;
      if (exiting || config.current.disabled || event.touches.length !== 1 || !target) return;
      const control = target.closest(INTERACTIVE);
      // Calendar cells remain tappable, but may also be the start of a swipe.
      if (control && !(navigation === 'calendar' && control.matches('.calendar-days-grid > button'))) return;
      if (window.getSelection()?.toString() || (window.visualViewport?.scale || 1) > 1.05) return;
      const touch = event.touches[0];
      // Leave the browser's own edge navigation gestures available.
      if (touch.clientX < 24 || touch.clientX > window.innerWidth - 24) return;
      gesture = { id: touch.identifier, x: touch.clientX, y: touch.clientY, dx: 0, dy: 0, atTop: isAtTop(target), axis: null, started: performance.now() };
    }

    function move(event) {
      if (!gesture) return;
      if (config.current.disabled || event.touches.length !== 1) { reset(); return; }
      const touch = event.touches[0];
      if (touch.identifier !== gesture.id) { reset(); return; }
      const dx = touch.clientX - gesture.x, dy = touch.clientY - gesture.y;
      if (!gesture.axis) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 12) return;
        if (Math.abs(dx) > Math.abs(dy) * 1.5) gesture.axis = 'x';
        else if (dy > Math.abs(dx) * 1.7 && gesture.atTop && config.current.onExit) gesture.axis = 'y';
        else { reset(); return; } // A scroll remains a scroll for this entire touch.
      }
      if (!event.cancelable) { reset(); return; }
      event.preventDefault();
      gesture.dx = dx; gesture.dy = dy;
      suppressClickUntil = performance.now() + 500;
      const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      setDrag({
        axis: gesture.axis,
        x: reduced || gesture.axis !== 'x' ? 0 : Math.sign(dx) * Math.min(Math.abs(dx) * .4, 70),
        y: reduced || gesture.axis !== 'y' ? 0 : Math.min(Math.max(dy, 0) * .35, 70),
        ready: canExit(gesture, performance.now() - gesture.started, navigation),
      });
    }

    function end(event) {
      if (!gesture) return;
      if (event.touches.length || !Array.from(event.changedTouches).some(touch => touch.identifier === gesture.id)) { reset(); return; }
      const shouldExit = gesture.axis && canExit(gesture, performance.now() - gesture.started, navigation);
      const axis = gesture.axis, dx = gesture.dx;
      reset();
      if (shouldExit && !config.current.disabled && !exiting) {
        exiting = true;
        if (navigation === 'calendar' && axis === 'x') {
          if (dx < 0) config.current.onNextMonth?.(); else config.current.onPreviousMonth?.();
        } else config.current.onExit?.();
      }
    }

    function preventGhostClick(event) {
      if (event.detail !== 0 && performance.now() < suppressClickUntil) { event.preventDefault(); event.stopPropagation(); }
    }
    surface.addEventListener('touchstart', start, { passive: true });
    surface.addEventListener('touchmove', move, { passive: false });
    surface.addEventListener('touchend', end, { passive: true });
    surface.addEventListener('touchcancel', reset, { passive: true });
    surface.addEventListener('click', preventGhostClick, true);
    return () => {
      surface.removeEventListener('touchstart', start);
      surface.removeEventListener('touchmove', move);
      surface.removeEventListener('touchend', end);
      surface.removeEventListener('touchcancel', reset);
      surface.removeEventListener('click', preventGhostClick, true);
    };
  }, [disabled, Boolean(onExit), navigation]);

  return { surfaceRef, drag };
}
