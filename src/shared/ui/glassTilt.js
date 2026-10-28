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
// Relative orientation only; no absolute compass permission or persisted pose.
export function glassDepthProfile(theme, input = 'pointer') {
  if (input === 'sensor') return theme === 'emerald'
    ? { x:64,y:50,plane:12,rotation:11.5 }
    : { x:60,y:46,plane:10,rotation:10 };
  return theme === 'emerald' ? { x:44,y:32,plane:7,rotation:2.8 } : { x:32,y:24,plane:5,rotation:2.2 };
}

// W3C intrinsic Z-X'-Y'' rotations. Comparing complete screen frames avoids
// Euler-axis coupling when the phone is held upright or passes through beta=90.
// https://www.w3.org/TR/orientation-event/#model
function screenFrame(reading, heading) {
  const radians = Math.PI / 180;
  const a = heading ? reading.alpha * radians : 0;
  const b = reading.beta * radians, g = reading.gamma * radians;
  const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b), cg = Math.cos(g), sg = Math.sin(g);
  return {
    right:[ca*cg-sa*sb*sg,sa*cg+ca*sb*sg,-cb*sg],
    up:[-sa*cb,ca*cb,sb],
    normal:[ca*sg+sa*sb*cg,sa*sg-ca*sb*cg,cb*cg],
  };
}

export function glassTiltVector(reading, neutral, angle = 0, theme = 'gold') {
  if (![reading?.beta,reading?.gamma,neutral?.beta,neutral?.gamma,angle].every(Number.isFinite)) return null;
  const heading = Number.isFinite(reading.alpha) && Number.isFinite(neutral.alpha);
  const origin = screenFrame(neutral,heading), current = screenFrame(reading,heading);
  const dot = axis => axis.reduce((sum,value,index) => sum + value * current.normal[index],0);
  const nx = dot(origin.right), ny = dot(origin.up), nz = dot(origin.normal);
  const degrees = 180 / Math.PI;
  const gamma = Math.atan2(nx,nz) * degrees;
  const beta = Math.atan2(-ny,Math.hypot(nx,nz)) * degrees;
  const radians = angle * Math.PI / 180;
  // Strong response near neutral, with useful travel beyond the old 12-degree
  // hard stop. Large turns approach the safe visual limit gradually.
  const limit = value => Math.abs(value) < 1e-8 ? 0 : Math.tanh(value / 24);
  const depth = glassDepthProfile(theme,'sensor');
  return { x:-limit(gamma * Math.cos(radians) + beta * Math.sin(radians)) * depth.x,
    y:-limit(beta * Math.cos(radians) - gamma * Math.sin(radians)) * depth.y };
}
