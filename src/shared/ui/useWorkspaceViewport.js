import { useEffect } from 'react';
import './WorkspaceViewport.css';

// Fixed controls must stay inside the visual viewport when mobile browser UI
// or the keyboard reduces it. CSS safe-area insets alone can be zero on Android.
export function useWorkspaceViewport() {
  useEffect(() => {
    const root = document.documentElement;
    const viewport = window.visualViewport;
    let frame;
    const update = () => {
      const inset = viewport && viewport.scale <= 1.05
        ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop) : 0;
      root.style.setProperty('--dayris-viewport-bottom', `${Math.ceil(inset)}px`);
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(update); };
    update();
    viewport?.addEventListener('resize', schedule);
    viewport?.addEventListener('scroll', schedule);
    window.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(frame);
      viewport?.removeEventListener('resize', schedule);
      viewport?.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      root.style.removeProperty('--dayris-viewport-bottom');
    };
  }, []);
}
