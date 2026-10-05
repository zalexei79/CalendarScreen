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
