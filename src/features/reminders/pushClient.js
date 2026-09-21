import { supabase } from '../../supabaseClient';

const OWNER = 'dayris_push_owner';
const ENDPOINT = 'dayris_push_endpoint';
function stored(key) { try { return localStorage.getItem(key); } catch { return null; } }

export function pushAvailability() {
  if (!window.isSecureContext) return 'Нужен HTTPS.';
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
  if (ios && !standalone) return 'Добавь DAYRIS на экран «Домой» и открой с его иконки.';
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'Этот браузер не поддерживает Web Push.';
  if (!import.meta.env.VITE_VAPID_PUBLIC_KEY) return 'Не задан VITE_VAPID_PUBLIC_KEY. Нужна новая сборка.';
  return '';
}

function publicKeyBytes() {
  const value = import.meta.env.VITE_VAPID_PUBLIC_KEY;
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(base64 + '='.repeat((4 - base64.length % 4) % 4)), c => c.charCodeAt(0));
}

export async function disablePush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
  const registration = await navigator.serviceWorker.getRegistration('/');
  const sub = await registration?.pushManager?.getSubscription();
  const endpoint = sub?.endpoint || stored(ENDPOINT);
  if (sub && !await sub.unsubscribe()) throw new Error('Не удалось отключить push. Повтори выход при подключённом интернете.');
  if (endpoint) { try { await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint); } catch { /* endpoint already unsubscribed */ } }
  try { localStorage.removeItem(OWNER); localStorage.removeItem(ENDPOINT); } catch { /* unavailable storage */ }
  try { const notifications = await registration?.getNotifications?.(); notifications?.forEach(n => n.close()); } catch { /* optional API */ }
}

export async function reconcilePushOwner(userId) {
  const previous = stored(OWNER);
  if (previous && previous !== userId) await disablePush();
}

export async function enablePush(userId) {
  const unavailable = pushAvailability();
  if (unavailable) throw new Error(unavailable);
  if (!userId) throw new Error('Сначала войди в DAYRIS.');
  const permission = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
  if (permission !== 'granted') throw new Error(permission === 'denied' ? 'Уведомления запрещены. Разреши их в настройках iPhone/браузера.' : 'Разрешение пока не выдано.');
  await reconcilePushOwner(userId);
  const registration = await navigator.serviceWorker.getRegistration('/');
  if (!registration?.active) throw new Error('Service worker ещё не готов. Обнови DAYRIS и повтори.');
  const version = await new Promise((resolve) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => resolve(null), 2500);
    channel.port1.onmessage = e => { clearTimeout(timer); channel.port1.close(); resolve(e.data?.version); };
    registration.active.postMessage({ type: 'DAYRIS_PUSH_VERSION' }, [channel.port2]);
  });
  if (version !== 1) throw new Error('Обновление service worker ещё не применилось. Закрой и открой DAYRIS.');
  const key = publicKeyBytes();
  let sub = await registration.pushManager.getSubscription();
  if (sub) {
    const old = new Uint8Array(sub.options.applicationServerKey || []);
    if (old.length !== key.length || old.some((v,i) => v !== key[i])) throw new Error('VAPID-ключ изменён. Сначала нажми «Отключить», затем включи уведомления заново.');
  }
  if (!sub) sub = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  localStorage.setItem(OWNER, userId);
  localStorage.setItem(ENDPOINT, sub.endpoint);
  const json = sub.toJSON();
  const { error } = await supabase.rpc('dayris_register_push', { p_endpoint: sub.endpoint, p_p256dh: json.keys.p256dh, p_auth: json.keys.auth });
  if (error) throw new Error(`Подписка ещё не сохранена на сервере: ${error.message}. Повтори включение.`);
}
