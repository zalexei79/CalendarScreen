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
  const [small, earning] = ({ USD: [36, 1800], EUR: [30, 1600], MDL: [550, 18000], RUB: [1800, 85000], CNY: [250, 12000] })[currency] || [36, 1800];
  return rhythm.flatMap((event, week) => {
    if (event.tone === 'neutral') return [];
    const maturity = Math.min(1, Math.max(.08, week / 52 / 22));
    const variation = .4 + ((week * 17) % 31) / 20;
    const childhood = week < 16 * 52;
    const income = childhood ? small * (1 + variation * 3) : earning * maturity * variation;
    const purchase = !childhood && week % 13 === 0 ? 8 + week % 29 : 1;
    const amount = Math.max(1, Math.round((event.tone === 'income' ? income : small * variation * (.5 + maturity) * purchase) * event.strength));
    return [{ week, tone: event.tone, amount, currency, source: 'illustration' }];
  });
}

// Two stable amounts follow weeks already counted. Keep each example readable
// before a gentle exchange; these are transactions, never a lifetime balance.
export function lifeMoneyFlow(events, elapsedWeeks, duration = 8000) {
  if (!events.length || !elapsedWeeks) return [];
  const first = events.find(event => event.week < elapsedWeeks);
  if (!first) return [];
  const ratio = (first.week + 1) / elapsedWeeks;
  const inverse = ratio < .5 ? Math.cbrt(ratio / 4) : 1 - Math.cbrt((1 - ratio) / 4);
  const result = [];
  const previous = new Map();
  for (let start = inverse * duration + 200; start < Math.min(5500, duration - 700); start += 1400) {
    const t = Math.min(1, start / duration);
    const filled = Math.floor(elapsedWeeks * (t < .5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2));
    for (const [lane, tone] of ['income', 'expense'].entries()) {
      const event = events.findLast(event => event.week < filled && event.tone === tone);
      if (!event || previous.get(tone) === event.week) continue;
      previous.set(tone, event.week);
      result.push({ ...event, start, duration: 700, lane });
    }
  }
  return result;
}

// The empty month is already part of the original lattice. Never repaint
// historical financial weeks when the camera reaches the present.
export function reserveLifePresent(rhythm, sources, current) {
  const reserved = new Set(sources);
  return rhythm.map((event, week) => reserved.has(week) || week >= current - 2 && week <= current ? { tone: 'neutral', strength: 0 } : event);
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
