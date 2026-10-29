export const DISPLAY_PREFERENCES_EVENT = 'dayris:display-preferences';
const STORAGE_KEY = 'dayris_display_preferences_v1';
const DEFAULTS = { interfaceScale:100, textScale:100 };
let preferences = { ...DEFAULTS };
let hydrated = false;

function normalize(value = {}) {
  const scale = (number, maximum) => Number.isFinite(Number(number))
    ? Math.min(maximum, Math.max(90, Math.round(Number(number) / 5) * 5)) : 100;
  return { interfaceScale:scale(value.interfaceScale,115), textScale:scale(value.textScale,130) };
}

export function readDisplayPreferences() {
  if (hydrated) return { ...preferences };
  hydrated = true;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) preferences = normalize(JSON.parse(stored) || {});
  } catch { /* Keep the current choice when storage is unavailable. */ }
  return { ...preferences };
}

function applyPreferences() {
  const root = document.documentElement;
  root.style.setProperty('--dayris-interface-scale', String(preferences.interfaceScale / 100));
  root.style.setProperty('--dayris-text-scale', String(preferences.textScale / 100));
}

export function setDisplayPreferences(patch) {
  preferences = normalize({ ...readDisplayPreferences(), ...patch });
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences)); } catch { /* The choice still works for this session. */ }
  applyPreferences();
  window.dispatchEvent(new Event(DISPLAY_PREFERENCES_EVENT));
  window.dispatchEvent(new Event('resize'));
  return { ...preferences };
}

// Installed before React so saved sizes apply to the first rendered frame.
export function installDisplayPreferences() {
  readDisplayPreferences();
  applyPreferences();
  const inCamera = target => target instanceof Element && Boolean(target.closest('.receipt-viewfinder'));
  const prevent = event => { if (event.cancelable) event.preventDefault(); };
  const touch = event => {
    if (event.touches.length < 2) return;
    // The viewfinder owns its pinch gesture and crops the captured image too.
    const camera = inCamera(event.target) && [...event.touches].every(item => inCamera(item.target));
    if (!camera) prevent(event);
  };
  const gesture = event => { if (!inCamera(event.target)) prevent(event); };
  const wheel = event => { if (event.ctrlKey || event.metaKey) prevent(event); };
  const keyboard = event => {
    if ((event.ctrlKey || event.metaKey) && ['+','=','-','0','Add','Subtract'].includes(event.key)) prevent(event);
  };
  const storage = event => {
    if (event.key !== STORAGE_KEY && event.key !== null) return;
    preferences = { ...DEFAULTS };
    hydrated = false;
    readDisplayPreferences();applyPreferences();
    window.dispatchEvent(new Event(DISPLAY_PREFERENCES_EVENT));
    window.dispatchEvent(new Event('resize'));
  };
  const listeners = [['touchstart',touch],['touchmove',touch],['gesturestart',gesture],['gesturechange',gesture],['gestureend',gesture],['wheel',wheel],['keydown',keyboard]];
  listeners.forEach(([name,listener]) => document.addEventListener(name,listener,{ passive:false, capture:true }));
  window.addEventListener('storage',storage);
  return () => {
    listeners.forEach(([name,listener]) => document.removeEventListener(name,listener,true));
    window.removeEventListener('storage',storage);
  };
}
