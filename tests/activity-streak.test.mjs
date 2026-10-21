import assert from 'node:assert/strict';
import test from 'node:test';
import { updateActivityStreak } from '../src/shared/lib/activityStreak.js';
import { translate } from '../src/shared/i18n/index.js';
import { streakDayLabel } from '../src/shared/i18n/streak.js';
import { streakReferralUrl, streakShareCaption } from '../src/shared/lib/streakShare.js';

test('streak share URLs always include the personal referral code', () => {
  const url = streakReferralUrl(' ab123cd4 ', 'https://dayris.test');
  assert.equal(url, 'https://dayris.test/?install=1&ref=AB123CD4');
  const caption = streakShareCaption(translate('ru', 'streakShareText'), '5 дней', url);
  assert.equal(caption, `Я сохранил огонёк уже 5 дней 🔥\nПопробуй — ${url}`);
  for (const invalid of ['', null, undefined, 'bad code', 'abc', 'https://dayris.test']) {
    assert.throws(() => streakReferralUrl(invalid, 'https://dayris.test'), /STREAK_REFERRAL_UNAVAILABLE/);
  }
  assert.throws(() => streakShareCaption('caption', '5 days', 'https://dayris.test/'), /STREAK_REFERRAL_UNAVAILABLE/);
});

test('share captions include the real streak with correct Russian day forms', () => {
  for (const [days, label] of [[1, '1 день'], [2, '2 дня'], [5, '5 дней'], [21, '21 день']]) {
    assert.equal(translate('ru', 'streakShareText').replace('{0}', streakDayLabel(days, 'ru')),
      `Я сохранил огонёк уже ${label} 🔥\nПопробуй —`);
  }
});

test('starts and increments on consecutive calendar days', () => {
  const first = updateActivityStreak(null, '2026-10-10');
  assert.deepEqual(first, { currentStreak: 1, lastActiveDate: '2026-10-10', paused: false });
  assert.deepEqual(updateActivityStreak(first, '2026-10-11'), { currentStreak: 2, lastActiveDate: '2026-10-11', paused: false });
});

test('one missed day pauses the streak without resetting it', () => {
  const previous = { currentStreak: 4, lastActiveDate: '2026-10-10', paused: false };
  assert.deepEqual(updateActivityStreak(previous, '2026-10-12'), { currentStreak: 4, lastActiveDate: '2026-10-12', paused: true });
  assert.deepEqual(updateActivityStreak({ currentStreak: 4, lastActiveDate: '2026-10-12', paused: true }, '2026-10-13'), { currentStreak: 5, lastActiveDate: '2026-10-13', paused: false });
});

test('two missed days reset the streak on the next visit', () => {
  assert.deepEqual(updateActivityStreak({ currentStreak: 8, lastActiveDate: '2026-10-10', paused: false }, '2026-10-13'), { currentStreak: 1, lastActiveDate: '2026-10-13', paused: false });
});

test('returning on Wednesday rescues a Monday streak; Thursday after two full missed days restarts it', () => {
  const monday = { currentStreak: 5, lastActiveDate: '2026-10-19', paused: false };
  const wednesday = updateActivityStreak(monday, '2026-10-21');
  assert.equal(wednesday.currentStreak, 5);
  assert.equal(wednesday.paused, true);
  assert.deepEqual(updateActivityStreak(wednesday, '2026-10-21'), wednesday);
  assert.equal(updateActivityStreak(wednesday, '2026-10-22').currentStreak, 6);
  assert.equal(updateActivityStreak(monday, '2026-10-22').currentStreak, 1);
});
