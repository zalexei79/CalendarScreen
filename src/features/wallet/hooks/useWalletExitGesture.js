import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';

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
    let releaseTimer;
    let motionFrame;
    const light = navigation === 'calendar' ? surface.parentElement.querySelector('.calendar-motion-light') : null;
    const updateDrag = (value) => {
      // Horizontal tracking is a compositor update, not a rerender of three
      // calendars for every touch sample. React handles gesture boundaries.
      if (navigation === 'calendar' && value.axis === 'x' && !value.settling) {
        setDrag(previous => previous.axis === 'x' && !previous.settling ? previous : value);
        cancelAnimationFrame(motionFrame);
        motionFrame = requestAnimationFrame(() => {
          surface.style.transform = `translate3d(${value.x}px,0,0)`;
          // A shallow light drift follows the hand, returning to the same
          // resting position before the page swap. Only compositor properties.
          if (light) {
            light.style.transition = 'none';
            light.style.transform = `translate3d(${Math.sin(value.x / surface.clientWidth * Math.PI) * 38}px,0,0)`;
            light.style.opacity = String(.82 + Math.abs(Math.sin(value.x / surface.clientWidth * Math.PI)) * .18);
          }
        });
      } else {
        cancelAnimationFrame(motionFrame);
        if (light) {
          light.style.transition = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'none' : 'transform 320ms cubic-bezier(.22,.68,0,1), opacity 320ms ease';
          light.style.transform = 'translate3d(0,0,0)';
          light.style.opacity = '.82';
        }
        setDrag(value);
      }
      if (navigation === 'calendar') window.dispatchEvent(new CustomEvent('dayris-calendar-pull', { detail: value.axis === 'y' ? value : IDLE }));
    };
    const reset = () => { gesture = null; updateDrag(IDLE); };
    const acceptsTarget = (target) => {
      if (!(target instanceof Element)) return false;
      const control = target.closest(INTERACTIVE);
      return !control || (navigation === 'calendar' && control.matches('.calendar-days-grid > button'));
    };
    const canMiddleNavigate = (event) => event.button === 1 && !exiting && !config.current.disabled && config.current.onExit && acceptsTarget(event.target);
    function middleDown(event) {
      // Prevent the browser's middle-button autoscroll before it starts.
      if (canMiddleNavigate(event)) event.preventDefault();
    }
    function middleClick(event) {
      if (!canMiddleNavigate(event)) return;
      event.preventDefault();
      exiting = true;
      reset();
      config.current.onExit();
    }

    function start(event) {
      if (exiting) return;
      reset();
      const target = event.target instanceof Element ? event.target : null;
      if (exiting || config.current.disabled || event.touches.length !== 1 || !target) return;
      // Calendar cells remain tappable, but may also be the start of a swipe.
      if (!acceptsTarget(target)) return;
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
        // Claim a downward pull at the top before Android's native scroll slop
        // takes ownership. The full release threshold still prevents accidental entry.
        if (dy >= 4 && dy > Math.abs(dx) * 1.7 && gesture.atTop && config.current.onExit) gesture.axis = 'y';
        else if (Math.max(Math.abs(dx), Math.abs(dy)) < 12) return;
        else if (Math.abs(dx) > Math.abs(dy) * 1.5) gesture.axis = 'x';
        else { reset(); return; } // A scroll remains a scroll for this entire touch.
      }
      if (!event.cancelable) { reset(); return; }
      event.preventDefault();
      gesture.dx = dx; gesture.dy = dy;
      suppressClickUntil = performance.now() + 500;
      const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      updateDrag({
        axis: gesture.axis,
        x: reduced || gesture.axis !== 'x' ? 0 : Math.sign(dx) * Math.min(Math.abs(dx) * (navigation === 'calendar' ? .85 : .4), navigation === 'calendar' ? surface.clientWidth * .8 : 70),
        y: reduced || gesture.axis !== 'y' ? 0 : Math.min(Math.max(dy, 0) * .35, 70),
        ready: canExit(gesture, performance.now() - gesture.started, navigation),
      });
    }

    function end(event) {
      if (!gesture) return;
      if (event.touches.length || !Array.from(event.changedTouches).some(touch => touch.identifier === gesture.id)) { reset(); return; }
      const shouldExit = gesture.axis && canExit(gesture, performance.now() - gesture.started, navigation);
      const axis = gesture.axis, dx = gesture.dx;
      if (shouldExit && navigation === 'calendar' && axis === 'x' && !config.current.disabled && !exiting) {
        exiting = true;
        gesture = null;
        const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        updateDrag({ x: reduced ? 0 : Math.sign(dx) * surface.clientWidth, y: 0, axis: 'x', settling: true, ready: true });
        releaseTimer = setTimeout(() => {
          if (!config.current.disabled) {
            document.documentElement.setAttribute('data-calendar-swipe-arrival', '');
            // Commit the new page and its fitted geometry before removing the
            // completed swipe. No intermediate frame may snap the old page back.
            flushSync(() => {
              if (dx < 0) config.current.onNextMonth?.(); else config.current.onPreviousMonth?.();
            });
            requestAnimationFrame(() => document.documentElement.removeAttribute('data-calendar-swipe-arrival'));
          }
          reset();
          exiting = false;
        }, reduced ? 0 : 330);
        return;
      }
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
    surface.addEventListener('mousedown', middleDown);
    surface.addEventListener('auxclick', middleClick);
    return () => {
      clearTimeout(releaseTimer);
      cancelAnimationFrame(motionFrame);
      if (navigation === 'calendar') window.dispatchEvent(new CustomEvent('dayris-calendar-pull', { detail: IDLE }));
      surface.removeEventListener('touchstart', start);
      surface.removeEventListener('touchmove', move);
      surface.removeEventListener('touchend', end);
      surface.removeEventListener('touchcancel', reset);
      surface.removeEventListener('click', preventGhostClick, true);
      surface.removeEventListener('mousedown', middleDown);
      surface.removeEventListener('auxclick', middleClick);
    };
  }, [disabled, Boolean(onExit), navigation]);

  return { surfaceRef, drag };
}
