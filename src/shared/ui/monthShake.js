const KEY = 'dayris_month_shake_v1';
const subscribers = new Set();
let state, request = 0;
export function supportsMonthShake() {
  return typeof window !== 'undefined' && window.isSecureContext && typeof window.DeviceMotionEvent === 'function'
    && (navigator.maxTouchPoints > 0 || matchMedia('(pointer: coarse)').matches);
}
function remembered() { try { return localStorage.getItem(KEY) === 'on'; } catch { return false; } }
function save(enabled) { try { localStorage.setItem(KEY,enabled?'on':'off'); } catch { /* Optional device preference. */ } }
export function getMonthShakeState() {
  if (!state) {
    const resume = supportsMonthShake() && remembered() && typeof window.DeviceMotionEvent.requestPermission !== 'function';
    state = {enabled:resume,status:resume?'waiting':remembered()?'resume':'off'};
  }
  return state;
}
export function subscribeMonthShake(listener) { subscribers.add(listener); return () => subscribers.delete(listener); }
function update(next) { state = next; subscribers.forEach(listener => listener()); }
export function reportMonthShake(status) {
  if (getMonthShakeState().enabled && state.status !== status) update({enabled:true,status});
}
export function disableMonthShake() { request++; save(false); update({enabled:false,status:'off'}); }
export async function enableMonthShake() {
  if (getMonthShakeState().status === 'asking') return;
  if (!supportsMonthShake()) { update({enabled:false,status:'unavailable'}); return; }
  const currentRequest = ++request;
  update({enabled:false,status:'asking'});
  try {
    // Must be called directly from the switch's user activation on iPhone.
    const api = window.DeviceMotionEvent;
    const result = typeof api.requestPermission === 'function' ? await api.requestPermission() : 'granted';
    if (currentRequest !== request) return;
    const enabled = result === 'granted'; save(enabled);
    update({enabled,status:enabled?'waiting':'denied'});
  } catch {
    if (currentRequest !== request) return;
    save(false); update({enabled:false,status:'denied'});
  }
}
