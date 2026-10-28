const KEY = 'dayris_glass_pointer_v1';
const listeners = new Set();
let enabled;

export function getGlassPointerEnabled() {
  if (enabled === undefined) {
    try { enabled = localStorage.getItem(KEY) !== 'off'; }
    catch { enabled = true; }
  }
  return enabled;
}

function storage(event) {
  if (event.key !== KEY && event.key !== null) return;
  enabled = undefined;
  listeners.forEach(listener => listener());
}

export function subscribeGlassPointer(listener) {
  if (!listeners.size) window.addEventListener('storage',storage);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (!listeners.size) window.removeEventListener('storage',storage);
  };
}

export function setGlassPointerEnabled(value) {
  enabled = Boolean(value);
  try { localStorage.setItem(KEY,enabled ? 'on' : 'off'); }
  catch { /* The current session still respects the user's choice. */ }
  listeners.forEach(listener => listener());
}
