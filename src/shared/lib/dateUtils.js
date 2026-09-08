/**
 * Pure date utility functions for Money Calendar.
 * Ensures consistent local date manipulation without UTC day-shifting.
 */

export function currentTimeHHMM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// yyyy-mm-dd key — used consistently for calendar cells, manual trade storage
// and the period date inputs so that string comparison ("2026-07-16" <= "2026-07-31")
// is enough to filter by period.
export function keyFromDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// dateKey ("yyyy-mm-dd") is always a LOCAL calendar date — parse it as local,
// never via `new Date(dateKey)` (that reads it as UTC and can shift by a day).
export function parseDateKeyLocal(dateKey) {
  const [y, m, day] = dateKey.split('-').map(Number);
  return new Date(y, m - 1, day);
}

export function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function startOfWeekMonday(d) {
  const day = (d.getDay() + 6) % 7; // Monday-start week
  return addDays(d, -day);
}

export function formatDateLabel(dateKey) {
  return parseDateKeyLocal(dateKey).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
  });
}

export function getPresetRange(preset, today) {
  const y = today.getFullYear();
  const m = today.getMonth();

  switch (preset) {
    case 'today':
    case 'Сегодня': {
      const k = keyFromDate(today);
      return { from: k, to: k };
    }
    case 'currentWeek':
    case 'Текущая неделя': {
      const start = startOfWeekMonday(today);
      const end = addDays(start, 6);
      return { from: keyFromDate(start), to: keyFromDate(end) };
    }
    case 'currentMonth':
    case 'Текущий месяц': {
      const start = new Date(y, m, 1);
      const end = new Date(y, m + 1, 0);
      return { from: keyFromDate(start), to: keyFromDate(end) };
    }
    case 'threeMonths':
    case '3 месяца': {
      const start = new Date(y, m - 2, 1);
      const end = new Date(y, m + 1, 0);
      return { from: keyFromDate(start), to: keyFromDate(end) };
    }
    case 'allHistory':
    case 'Вся история':
      return { from: '0000-01-01', to: '9999-12-31' };
    default:
      return { from: keyFromDate(today), to: keyFromDate(today) };
  }
}
