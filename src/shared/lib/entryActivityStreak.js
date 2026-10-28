import { localDateKey } from './activityStreak.js';

export const ENTRY_SAVED_EVENT = 'dayris:streak-entry-saved';

export function notifyStreakEntrySaved(ownerId) {
  window.dispatchEvent(new CustomEvent(ENTRY_SAVED_EVENT, { detail: { ownerId: ownerId || 'guest' } }));
}

export function entryStreakState(previous, today = localDateKey(), saved = false) {
  const count = Math.max(0, Math.min(36500, Number(previous?.currentStreak) || 0));
  const last = previous?.lastActiveDate || today;
  const distance = Math.round((Date.parse(`${today}T12:00:00Z`) - Date.parse(`${last}T12:00:00Z`)) / 86400000);
  const expired = !Number.isFinite(distance) || distance >= 3;
  const completed = previous?.entryDate === today;
  if (!saved || completed) return { ...previous, currentStreak: expired ? 0 : count,
    lastActiveDate: last, completedToday: completed, paused: !completed, rule: 'daily-entry' };
  return { currentStreak: !count || expired ? 1 : distance === 1 ? Math.min(36500, count + 1) : count,
    lastActiveDate: today, entryDate: today, completedToday: true, paused: false, rule: 'daily-entry' };
}
