export const BOT_START_DATE = '2026-10-05';
export const BOT_TIME_ZONE = 'Europe/Bucharest';
export const BOT_CALENDAR_URL = '/?calendar=bot';

export function dateKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: BOT_TIME_ZONE,
    year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}
export function shiftMonth(month, offset) {
  const [year, number] = month.split('-').map(Number);
  const d = new Date(Date.UTC(year, number - 1 + offset, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`;
}
export function monthCells(month) {
  const [year, number] = month.split('-').map(Number);
  const first = new Date(Date.UTC(year, number - 1, 1));
  const start = 1 - (first.getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(year, number, 0)).getUTCDate();
  return Array.from({ length: Math.ceil((days + 1 - start) / 7) * 7 }, (_, i) => {
    const day = start + i;
    return day < 1 || day > days ? null : `${month.slice(0, 7)}-${String(day).padStart(2, '0')}`;
  });
}
export function money(value, currency = 'USD', signed = false) {
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency,
    maximumFractionDigits: 2, signDisplay: signed ? 'exceptZero' : 'auto' }).format(Number(value));
}
export function dateLabel(key, options = { day: 'numeric', month: 'long', year: 'numeric' }) {
  return new Intl.DateTimeFormat('ru-RU', { ...options, timeZone: 'UTC' }).format(new Date(`${key}T12:00:00Z`));
}

export function calendarCells(month, today) {
  const [year, number] = month.split('-').map(Number);
  const offset = (new Date(year, number - 1, 1).getDay() + 6) % 7;
  return monthCells(month).map((_, i) => {
    const date = new Date(year, number - 1, i + 1 - offset, 12);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return { key, date, inMonth: key.slice(0, 7) === month.slice(0, 7), isToday: key === today };
  });
}

export function tradeCount(count) {
  const n = Number(count), two = n % 100;
  const unit = two >= 11 && two <= 14 ? 'сделок' : n % 10 === 1 ? 'сделка' : n % 10 >= 2 && n % 10 <= 4 ? 'сделки' : 'сделок';
  return `${n} ${unit}`;
}

export function publicCalendarUrl(origin = window.location.origin) {
  return new URL(BOT_CALENDAR_URL, origin).href;
}
