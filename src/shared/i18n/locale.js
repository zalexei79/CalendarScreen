// Internal copy bundles use short keys; browser APIs use complete BCP 47 tags.
export function localeKey(language) {
  const code = String(language || '').toLowerCase().replace(/_/g, '-');
  if (code.startsWith('zh')) return 'zh';
  if (code === 'md' || code === 'ro' || code.startsWith('ro-')) return 'ro';
  if (code === 'en' || code.startsWith('en-')) return 'en';
  return 'ru';
}

export function intlLocale(language) {
  return { zh: 'zh-CN', ro: 'ro-RO', en: 'en-US', ru: 'ru-RU' }[localeKey(language)];
}

export function browserLanguage() {
  try { return globalThis.localStorage?.getItem('atj_language') || globalThis.navigator?.language || 'ru'; }
  catch { return globalThis.navigator?.language || 'ru'; }
}
