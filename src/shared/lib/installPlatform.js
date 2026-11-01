export function getInstallPlatform(nav = navigator) {
  const ua = nav.userAgent || '';
  const ios = /iPhone|iPad|iPod/i.test(ua) || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1);
  const android = !ios && /Android/i.test(ua);
  const embedded = /FBAN|FBAV|Instagram|Telegram|; wv\)/i.test(ua);
  const browser = /EdgiOS|Edg\//i.test(ua) ? 'Edge' : /CriOS|Chrome\//i.test(ua) ? 'Chrome' : ios && /Safari/i.test(ua) ? 'Safari' : '';
  return { ios, android, embedded, browser, name: ios ? 'iPhone / iPad' : android ? 'Android' : '' };
}
