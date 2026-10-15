const DAY_MS = 24 * 60 * 60 * 1000;

export function localDateKey(date = new Date()) {
  const value = new Date(date);
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dayDistance(fromKey, toKey) {
  const from = Date.parse(`${fromKey}T00:00:00`);
  const to = Date.parse(`${toKey}T00:00:00`);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return Infinity;
  return Math.round((to - from) / DAY_MS);
}

export function updateActivityStreak(previous, todayKey = localDateKey()) {
  const current = Number.isFinite(Number(previous?.currentStreak))
    ? Math.max(1, Number(previous.currentStreak))
    : 0;
  const lastActive = typeof previous?.lastActiveDate === 'string' ? previous.lastActiveDate : '';

  if (!lastActive) return { currentStreak: 1, lastActiveDate: todayKey, paused: false };
  const distance = dayDistance(lastActive, todayKey);
  if (distance <= 0) return { currentStreak: Math.max(1, current), lastActiveDate: lastActive, paused: Boolean(previous?.paused) };
  if (distance === 1) return { currentStreak: Math.max(1, current) + 1, lastActiveDate: todayKey, paused: false };
  if (distance === 2) return { currentStreak: Math.max(1, current), lastActiveDate: todayKey, paused: true };
  return { currentStreak: 1, lastActiveDate: todayKey, paused: false };
}

export function readAndUpdateActivityStreak(storage, storageKey, todayKey = localDateKey()) {
  let previous = null;
  try { previous = JSON.parse(storage.getItem(storageKey) || 'null'); } catch { /* ignore malformed local state */ }
  const next = updateActivityStreak(previous, todayKey);
  try { storage.setItem(storageKey, JSON.stringify(next)); } catch { /* private mode/storage limits */ }
  return next;
}
