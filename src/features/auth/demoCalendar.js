import { getEntryCopy } from './entryCopy.js';

// Display-only examples. Never seed caches, sync queues or database rows.
export function createDemoCalendar({ today = new Date(), currency = 'USD', language = 'ru' } = {}) {
  const copy = getEntryCopy(language);
  const examples = [
    [777, 'Зарплата', 'salary', '09:00', 5],
    [-69, 'Продукты', 'groceries', '18:20', 4],
    [67, 'Фриланс', 'freelance', '12:30', 3],
    [-7, 'Кафе', 'coffee', '10:15', 0],
    [-12, 'Подписки', 'subscription', '08:00', 2],
    [-240, 'Жильё', 'housing', '16:00', 1],
    [-7, 'Транспорт', 'transport', '19:10', 0],
  ];
  const grouped = {};
  examples.forEach(([pnl, instrument, note, time, offset], index) => {
    // Stay in the current month, including its first day, and never use future dates.
    const day = Math.max(1, today.getDate() - offset);
    const dateKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    (grouped[dateKey] ||= []).push({
      id: `demo-${index}`, time, instrument, direction: pnl < 0 ? 'SHORT' : 'LONG',
      pnl, currency, comment: `${copy.sample} · ${copy[note]}`, platform: 'Manual', demo: true,
    });
  });
  return grouped;
}

export const DEMO_SESSION_KEY = 'dayris_demo_session_v1';
export const ENTRY_INTENT_KEY = 'dayris_entry_intent_v1';

export function readEntryIntent(storage) {
  try {
    const value = JSON.parse(storage.getItem(ENTRY_INTENT_KEY) || 'null');
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value.dateKey)) return null;
    const date = new Date(`${value.dateKey}T12:00:00`);
    if (!Number.isFinite(date.getTime()) || date.getFullYear() !== Number(value.dateKey.slice(0, 4)) || date.getMonth() + 1 !== Number(value.dateKey.slice(5, 7)) || date.getDate() !== Number(value.dateKey.slice(8))) return null;
    return value.dateKey;
  } catch { return null; }
}
