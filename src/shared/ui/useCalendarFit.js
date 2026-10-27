import { useLayoutEffect } from 'react';

// Fit the whole month between its real header and the floating controls.
// Measure layout coordinates so entrance animations and scrolling do not
// resize the calendar or make its rows chase the scroll position.
export function useCalendarFit(surfaceRef, cellCount) {
  useLayoutEffect(() => {
    const surface = surfaceRef.current;
    const grid = surface?.querySelector('.calendar-days-grid');
    if (!grid) return;
    const viewport = window.visualViewport;
    const mobile = window.matchMedia('(max-width: 639px)');
    let frame;
    const update = () => {
      // Glass themes have raised cells on desktop too: reserve the real dock
      // instead of letting a six-week month grow behind its floating glass.
      if ((!mobile.matches && !['gold','emerald'].includes(document.documentElement.dataset.dayrisTheme)) || viewport?.scale > 1.05) return;
      let top = 0;
      for (let node = grid; node; node = node.offsetParent) top += node.offsetTop;
      const dock = document.querySelector('.history-fab');
      const dockTop = dock ? parseFloat(getComputedStyle(dock).top) : NaN;
      const reservedSpace = parseFloat(getComputedStyle(surface).paddingBottom) || 88;
      const bottom = Number.isFinite(dockTop) ? dockTop : (viewport?.height || window.innerHeight) - reservedSpace + 12;
      const rows = Math.max(1, Math.ceil(cellCount / 7));
      const gap = parseFloat(getComputedStyle(grid).rowGap) || 0;
      // Leave room for the raised plane at its maximum rotation and shadow.
      const glass = ['gold','emerald'].includes(document.documentElement.dataset.dayrisTheme);
      const clearance = glass ? 44 : 12;
      const rowHeight = Math.max(56, (bottom - top - clearance - gap * (rows - 1)) / rows);
      const value = `${rowHeight}px`;
      if (surface.style.getPropertyValue('--calendar-row-height') !== value) surface.style.setProperty('--calendar-row-height', value);
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(update); };
    const observer = new ResizeObserver(schedule);
    for (const element of document.querySelectorAll('.dayris-header, .calendar-month-overview, .monthly-goal-bar, .history-fab, .premium-shell')) observer.observe(element);
    // New status strips, dock mounting, and goal details also change the space.
    const mutations = new MutationObserver(schedule);
    mutations.observe(document.body, { childList: true, subtree: true });
    // Viewport metrics and dock measurements are published on the root after
    // their own animation frame; follow those updates as well as resize events.
    mutations.observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'data-dayris-theme'] });
    viewport?.addEventListener('resize', schedule);
    window.addEventListener('resize', schedule);
    mobile.addEventListener('change', schedule);
    update();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect(); mutations.disconnect();
      viewport?.removeEventListener('resize', schedule);
      window.removeEventListener('resize', schedule);
      mobile.removeEventListener('change', schedule);
    };
  }, [surfaceRef, cellCount]);
}
