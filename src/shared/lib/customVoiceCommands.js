import { normalizeVoicePhrase } from './voicePhrase.js';
import { isVoiceHelpRequest } from './voiceCapabilities.js';

// Only existing, permission-checked app actions. No arbitrary JS or financial writes.
export const VOICE_ACTIONS = [
  { id: 'wallet', label: 'Открыть кошелёк', command: { type: 'wallet' } },
  { id: 'pro', label: 'Открыть режим PRO', command: { type: 'pro', enabled: true } },
  { id: 'free', label: 'Вернуться в FREE', command: { type: 'pro', enabled: false } },
  { id: 'next-month', label: 'Следующий месяц', command: { type: 'month', direction: 1 } },
  { id: 'previous-month', label: 'Предыдущий месяц', command: { type: 'month', direction: -1 } },
  { id: 'add-record', label: 'Открыть форму записи', command: { type: 'add', kind: 'record' } },
  { id: 'add-trade', label: 'Открыть форму сделки', command: { type: 'add', kind: 'trade' } },
  { id: 'help', label: 'Показать помощь по голосу', command: { type: 'voice-help' } },
  { id: 'summary', label: 'Итог текущего месяца', command: { type: 'question', metric: 'summary', period: 'current-month' } },
];
export const commandKey = phrase => normalizeVoicePhrase(String(phrase || '')).toLocaleLowerCase().replace(/ё/g, 'е').replace(/[.,!?«»"。，！？]/g, ' ').replace(/\s+/g, ' ').trim();
const RESERVED = /^(?:отмена|отмени|сохрани|сохранить|готово|да|нет|стоп|cancel|save|done|yes|no|stop|salvează|salveaza|gata|anulează|anuleaza|保存|取消|停止)$/u;
export function normalizeVoiceCommands(input) {
  const ids = new Set(), phrases = new Set();
  return (Array.isArray(input) ? input : []).slice(0, 30).flatMap(item => {
    if (!item || typeof item.phrase !== 'string' || !/^voice-[a-z0-9-]{1,48}$/.test(item.id) || ids.has(item.id) || !VOICE_ACTIONS.some(action => action.id === item.action)) return [];
    const phrase = item.phrase.trim().slice(0, 100), key = commandKey(phrase);
    if (key.length < 3 || RESERVED.test(key) || /[\x00-\x1f<>]/.test(phrase) || phrases.has(key) || (isVoiceHelpRequest(phrase) && item.action !== 'help') || (item.enabled !== undefined && typeof item.enabled !== 'boolean')) return [];
    ids.add(item.id); phrases.add(key);
    return [{ id: item.id, phrase, action: item.action, enabled: item.enabled !== false }];
  });
}
export function matchVoiceCommand(phrase, commands) {
  const key = commandKey(phrase);
  const rule = normalizeVoiceCommands(commands).find(rule => rule.enabled && commandKey(rule.phrase) === key);
  const action = rule && VOICE_ACTIONS.find(action => action.id === rule.action);
  return action ? { ...action.command } : null;
}
let current = [];
export function setRuntimeVoiceCommands(commands) { current = normalizeVoiceCommands(commands); }
export function getRuntimeVoiceCommands() { return current; }
