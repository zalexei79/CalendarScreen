// One short pulse per deliberate action. Unsupported devices quietly skip it.
export function installInteractionHaptics(doc = document, nav = navigator) {
  if (typeof nav.vibrate !== 'function') return () => {};
  let lastPulse = -Infinity;
  const onClick = event => {
    if (!event.isTrusted || doc.visibilityState === 'hidden') return;
    const control = event.target?.closest?.('button, a[href], summary, [role="button"], [role="tab"], input[type="checkbox"], input[type="radio"]');
    if (!control || control.matches(':disabled') || control.closest('[inert], [aria-disabled="true"], [data-haptics="off"]')) return;
    if (doc.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const now = performance.now();
    if (now - lastPulse < 60) return;
    lastPulse = now;
    try { nav.vibrate(10); } catch { /* Haptics must never interrupt an action. */ }
  };
  // Capture while the target is still mounted, including controls in portals.
  doc.addEventListener('click', onClick, true);
  return () => doc.removeEventListener('click', onClick, true);
}
