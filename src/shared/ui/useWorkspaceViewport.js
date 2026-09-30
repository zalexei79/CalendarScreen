import { useEffect } from 'react';
import './WorkspaceViewport.css';

// Fixed controls must stay inside the visual viewport when mobile browser UI
// or the keyboard reduces it. CSS safe-area insets alone can be zero on Android.
export function useWorkspaceViewport() {
  useEffect(() => {
    const root = document.documentElement;
    const viewport = window.visualViewport;
    let frame;
    let observedDock;
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(() => schedule()) : null;
    const update = () => {
      const inset = viewport && viewport.scale <= 1.05
        ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop) : 0;
      root.style.setProperty('--dayris-viewport-bottom', `${Math.ceil(inset)}px`);
      const unzoomed = !viewport || viewport.scale <= 1.05;
      if (unzoomed) {
        root.style.setProperty('--dayris-viewport-height', `${viewport?.height || window.innerHeight}px`);
        root.style.setProperty('--dayris-viewport-top', `${viewport?.offsetTop || 0}px`);
      }
      const dock = document.querySelector('.history-fab');
      if (dock && dock !== observedDock) { observer?.disconnect(); observer?.observe(dock); observedDock = dock; }
      if (dock) root.style.setProperty('--dayris-dock-height', `${Math.ceil(dock.getBoundingClientRect().height)}px`);
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(update); };
    update();
    viewport?.addEventListener('resize', schedule);
    viewport?.addEventListener('scroll', schedule);
    window.addEventListener('resize', schedule);
    window.addEventListener('orientationchange', schedule);
    return () => {
      cancelAnimationFrame(frame);
      viewport?.removeEventListener('resize', schedule);
      viewport?.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('orientationchange', schedule);
      observer?.disconnect();
      for (const key of ['bottom', 'height', 'top']) root.style.removeProperty(`--dayris-viewport-${key}`);
      root.style.removeProperty('--dayris-dock-height');
    };
  }, []);
}
