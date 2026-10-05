export const ONBOARDING_PREVIEW_EMAIL = 'aveel2000@gmail.com';

export function isOnboardingPreviewUser(user) {
  return user?.email?.trim().toLowerCase() === ONBOARDING_PREVIEW_EMAIL;
}

export function birthdayStorageKey(profileKey = 'guest') {
  return `dayris_birthday_v1_${profileKey}`;
}

// Calendar dates use UTC only for arithmetic, so a DST change never adds a day.
export function lifeWeeks(birthday, today = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthday || '')) return null;
  const [year, month, day] = birthday.split('-').map(Number);
  const birth = new Date(Date.UTC(year, month - 1, day));
  const now = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  if (birth.getUTCFullYear() !== year || birth.getUTCMonth() !== month - 1 || birth.getUTCDate() !== day) return null;
  const days = Math.floor((now - birth.getTime()) / 86400000);
  if (days < 0 || days > 130 * 366) return null;
  return { days, weeks: Math.floor(days / 7) };
}

export function localDateValue(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// A stable illustration, rather than a reconstructed transaction history.
// Gifts lead to small runs of spending; adulthood gradually grows more varied.
export function lifeWeekRhythm(count, seed = '') {
  let state = 2166136261;
  for (const letter of seed) state = Math.imul(state ^ letter.charCodeAt(0), 16777619);
  const random = () => {
    state += 0x6D2B79F5;
    let value = Math.imul(state ^ state >>> 15, 1 | state);
    value ^= value + Math.imul(value ^ value >>> 7, 61 | value);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
  let spending = 0;
  let nextIncome = Infinity;
  let birthdayGift = 0;
  let holidayGift = 0;
  let quiet = 0;
  return Array.from({ length: count }, (_, week) => {
    const age = week / 52;
    const yearWeek = week % 52;
    if (yearWeek === 0) {
      birthdayGift = Math.floor(random() * 5);
      holidayGift = 34 + Math.floor(random() * 17);
    }
    const adult = Math.max(0, Math.min(1, (age - 14) / 8));
    let tone = 'neutral';
    if (age >= 4 && (yearWeek === birthdayGift || yearWeek === holidayGift || random() < .007 + adult * .015)) {
      tone = 'income';
      spending = 1 + Math.floor(random() * (age < 12 ? 3 : 6));
    } else if (age >= 16 && week >= nextIncome) {
      tone = 'income';
      nextIncome = week + 2 + Math.floor(random() * 6);
      spending = 2 + Math.floor(random() * 5);
    } else if (spending > 0) {
      spending--;
      if (random() < .74) tone = 'expense';
    } else if (age >= 5 && random() < .025 + adult * .62) {
      tone = 'expense';
    }
    if (age >= 16 && nextIncome === Infinity) nextIncome = week + Math.floor(random() * 8);
    // Occasional quieter stretches break up any weekly salary pattern.
    if (age >= 18 && random() < .009) quiet = 2 + Math.floor(random() * 7);
    if (quiet > 0) { quiet--; if (tone !== 'income' && random() < .65) tone = 'neutral'; }
    return { tone, strength: tone === 'neutral' ? 0 : .48 + random() * .52 };
  });
}

// These are illustrative amounts, tied to the very same weeks as the colors.
export function lifeMoneyEvents(rhythm, currency = 'USD') {
  const [small, earning] = ({ USD: [12, 240], EUR: [10, 210], MDL: [80, 3200], RUB: [400, 18000], CNY: [30, 1800] })[currency] || [12, 240];
  return rhythm.flatMap((event, week) => {
    if (event.tone === 'neutral') return [];
    const maturity = Math.min(1, Math.max(.08, week / 52 / 22));
    const variation = .4 + ((week * 17) % 31) / 20;
    const amount = Math.max(1, Math.round((event.tone === 'income' ? earning * maturity : small * variation * (.5 + maturity)) * event.strength));
    return [{ week, tone: event.tone, amount, currency, source: 'illustration' }];
  });
}

// A fast illustrative stream samples only weeks already visited by the camera.
// It never invents saved records or converts an existing record's currency.
export function lifeMoneyBeat(events, filled, beat) {
  const end = events.findLastIndex(event => event.week < filled);
  if (end < 0) return null;
  const recent = events.slice(Math.max(0, end - 15), end + 1);
  const hash = (Math.imul(beat + 1, 1597334677) ^ Math.imul(end + 1, 3812015801)) >>> 0;
  const tone = hash % 7 < 3 ? 'income' : 'expense';
  const event = recent.findLast(event => event.tone === tone) || recent.at(-1);
  const sizes = event.tone === 'income' ? [.12, .4, .8, 1.2, 2.5, 6] : [.12, .35, .8, 1.5, 8, 64];
  const amount = Math.max(1, Math.round(event.amount * sizes[(hash >>> 5) % sizes.length] * (.8 + (hash >>> 12) % 9 / 10)));
  return { ...event, amount, id: `illustration-${beat}` };
}

export function calendarMoneyEvents(records, birthday, today = new Date()) {
  const now = localDateValue(today);
  const elapsed = lifeWeeks(birthday, today)?.weeks ?? 0;
  return records.flatMap(record => {
    const date = record.dateKey;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || date > now) return [];
    const [year, month, day] = date.split('-').map(Number);
    const checked = new Date(year, month - 1, day);
    if (localDateValue(checked) !== date) return [];
    const signed = Number(record.pnl);
    if (!Number.isFinite(signed) || signed === 0) return [];
    const week = lifeWeeks(birthday, checked)?.weeks;
    if (birthday && week == null) return [];
    return [{ week: Math.min(week ?? elapsed, elapsed), tone: signed > 0 ? 'income' : 'expense', amount: Math.abs(signed), currency: record.currency || 'USD', source: 'calendar', date, time: record.time || '', id: record.id }];
  }).sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
}
