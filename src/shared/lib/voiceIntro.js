export const VOICE_INTRO_VERSION = 'dayris_voice_intro_v1';
export const voiceIntroKey = userId => userId ? `${VOICE_INTRO_VERSION}:${userId}` : null;
export function needsVoiceIntro(userId, language, storage) {
  const key = voiceIntroKey(userId);
  if (!key || !String(language).toLowerCase().startsWith('ru')) return false;
  try { return (storage || globalThis.localStorage)?.getItem(key) !== 'seen'; } catch { return false; }
}
export function rememberVoiceIntro(key, storage) {
  if (!key) return;
  try { (storage || globalThis.localStorage)?.setItem(key, 'seen'); } catch { /* In-memory owner tracking still prevents repeats. */ }
}
