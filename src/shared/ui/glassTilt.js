const KEY = 'dayris_glass_tilt_v1';
const subscribers = new Set();
let state;

export function supportsGlassTilt() {
  return typeof window !== 'undefined' && window.isSecureContext && typeof window.DeviceOrientationEvent === 'function';
}
function remembered() { try { return localStorage.getItem(KEY) === 'on'; } catch { return false; } }
function save(enabled) { try { localStorage.setItem(KEY, enabled ? 'on' : 'off'); } catch { /* Private browsing can refuse preferences. */ } }
export function getGlassTiltState() {
  if (!state) {
    // Safari permission must be requested again from an actual user gesture;
    // saved intent alone is never evidence that this session has permission.
    const resume = supportsGlassTilt() && remembered() && typeof window.DeviceOrientationEvent.requestPermission !== 'function';
    state = { enabled:resume, status:resume ? 'waiting' : remembered() ? 'resume' : 'off' };
  }
  return state;
}
export function subscribeGlassTilt(listener) { subscribers.add(listener); return () => subscribers.delete(listener); }
function update(next) { state = next; subscribers.forEach(listener => listener()); }
export function reportGlassTilt(status) {
  const current = getGlassTiltState();
  if (current.enabled && current.status !== status) update({ enabled:true, status });
}
export function disableGlassTilt() { save(false); update({ enabled:false, status:'off' }); }
export async function enableGlassTilt() {
  if (getGlassTiltState().status === 'asking') return;
  if (!supportsGlassTilt()) { update({ enabled:false, status:'unavailable' }); return; }
  if (!['gold','emerald'].includes(document.documentElement.dataset.dayrisTheme)) return;
  update({ enabled:false, status:'asking' });
  try {
    const api = window.DeviceOrientationEvent;
    // Call directly in the click's activation, before any unrelated await.
    const permission = typeof api.requestPermission === 'function' ? await api.requestPermission() : 'granted';
    if (!['gold','emerald'].includes(document.documentElement.dataset.dayrisTheme)) { update({ enabled:false, status:'off' }); return; }
    const granted = permission === 'granted';
    save(granted);
    update({ enabled:granted, status:granted ? 'waiting' : 'denied' });
  } catch {
    save(false); update({ enabled:false, status:'denied' });
  }
}

// Relative to the user's comfortable holding angle, not an assumed flat phone.
// No compass/magnetometer data is needed or retained.
export function glassTiltVector(reading, neutral, angle = 0) {
  if (![reading?.beta,reading?.gamma,neutral?.beta,neutral?.gamma,angle].every(Number.isFinite)) return null;
  const delta = (a,b) => ((a - b + 540) % 360) - 180;
  const beta = delta(reading.beta,neutral.beta), gamma = delta(reading.gamma,neutral.gamma);
  const radians = angle * Math.PI / 180;
  const limit = value => Math.max(-1,Math.min(1,value / 18));
  return { x:-limit(gamma * Math.cos(radians) + beta * Math.sin(radians)) * 10,
    y:-limit(beta * Math.cos(radians) - gamma * Math.sin(radians)) * 8 };
}
