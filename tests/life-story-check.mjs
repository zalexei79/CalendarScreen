import assert from 'node:assert/strict';
import { lifeWeeks, localDateValue, birthdayStorageKey, isOnboardingPreviewUser, lifeWeekRhythm, lifeMoneyEvents, lifeMoneyBeat, calendarMoneyEvents } from '../src/features/onboarding/lifeStoryModel.js';
import { lifeCalendarMotion, LIFE_MOTION_END } from '../src/features/onboarding/lifeCalendarMotion.js';

const today = new Date(2026, 9, 4);
assert.equal(lifeWeeks('2026-10-04', today).weeks, 0);
assert.equal(lifeWeeks('2026-09-27', today).weeks, 1);
assert.equal(lifeWeeks('2026-10-05', today), null);
assert.equal(lifeWeeks('2026-02-30', today), null);
assert.equal(lifeWeeks('2025-02-29', today), null);
assert.equal(lifeWeeks('not-a-date', today), null);
assert.equal(lifeWeeks('', today), null);
assert.equal(lifeWeeks('2024-02-29', new Date(2024, 2, 7)).weeks, 1);
assert.equal(lifeWeeks('2026-03-27', new Date(2026, 3, 3)).weeks, 1, 'DST does not change calendar-week arithmetic');
assert.equal(lifeWeeks('1800-01-01', today), null);
assert.equal(localDateValue(today), '2026-10-04');
assert.notEqual(birthdayStorageKey('account-a'), birthdayStorageKey('account-b'));
assert.equal(isOnboardingPreviewUser({ email: ' AVEEL2000@gmail.com ' }), true);
assert.equal(isOnboardingPreviewUser({ email: 'another@gmail.com' }), false);
assert.equal(isOnboardingPreviewUser(null), false);
const rhythm = lifeWeekRhythm(52 * 35, '1998-03-14');
assert.deepEqual(rhythm, lifeWeekRhythm(rhythm.length, '1998-03-14'), 'Replaying a story does not reshuffle it');
assert.notDeepEqual(rhythm, lifeWeekRhythm(rhythm.length, '2000-06-12'), 'Different birthdays get different stories');
assert.ok(rhythm.slice(0, 4 * 52).every(event => event.tone === 'neutral'));
const childhood = rhythm.slice(5 * 52, 14 * 52);
assert.ok(childhood.some(event => event.tone === 'income'));
assert.ok(childhood.some((event, index) => event.tone === 'income' && childhood.slice(index + 1, index + 5).some(next => next.tone === 'expense')), 'A childhood gift can fund several following weeks');
assert.ok(childhood.filter(event => event.tone === 'neutral').length > childhood.length * .65);
const adulthood = rhythm.slice(22 * 52);
const events = lifeMoneyEvents(rhythm, 'MDL');
assert.ok(events.every(event => event.tone === rhythm[event.week].tone && event.amount > 0 && event.currency === 'MDL'));
assert.ok(events.some(event => event.tone === 'income') && events.some(event => event.tone === 'expense'));
for (const currency of ['USD', 'EUR', 'MDL', 'RUB', 'CNY']) {
  const stream = Array.from({ length: 13 }, (_, beat) => lifeMoneyBeat(lifeMoneyEvents(rhythm, currency), 1200, beat + 30));
  assert.ok(stream.every(event => event.currency === currency && event.week < 1200));
  assert.ok(new Set(stream.map(event => event.amount)).size >= 10, 'A fast stream has varied amounts rather than a repeated number');
  assert.equal(new Set(stream.map(event => event.tone)).size, 2);
  assert.ok(Math.max(...stream.map(event => event.amount)) > Math.min(...stream.map(event => event.amount)) * 50, 'Small and large transactions share the same stream');
}
assert.equal(lifeMoneyBeat(events, 4 * 52, 3), null, 'The money stream waits for the first financial week');
const realEvents = calendarMoneyEvents([
  { id: 'expense', dateKey: '2026-10-03', pnl: -37.5, currency: 'EUR' },
  { id: 'income', dateKey: '2026-10-04', pnl: 280, currency: 'MDL' },
  { dateKey: '2026-10-05', pnl: 800, currency: 'USD' },
  { dateKey: '2026-02-30', pnl: 50 },
  { dateKey: '1900-01-01', pnl: 99 },
  { dateKey: '2026-10-04', pnl: 'not money' },
], '1998-03-14', today);
assert.deepEqual(realEvents.map(event => [event.id, event.tone, event.amount, event.currency]), [['expense', 'expense', 37.5, 'EUR'], ['income', 'income', 280, 'MDL']], 'Use exact existing amounts and currencies; exclude future/invalid/pre-birthday dates');
assert.ok(adulthood.filter(event => event.tone === 'expense').length > adulthood.length * .4);
const incomeWeeks = adulthood.flatMap((event, index) => event.tone === 'income' ? [index] : []);
assert.ok(new Set(incomeWeeks.slice(1).map((week, index) => week - incomeWeeks[index])).size > 4, 'Income is not a fixed every-four-weeks stripe');
for (let time = 0; time <= LIFE_MOTION_END; time += 16) {
  const frame = lifeCalendarMotion(time);
  if (frame.lifeOpacity > .001) {
    assert.equal(frame.paperOpacity, 1, 'Keep the app covered while the dense life grid is visible');
    assert.equal(frame.skin, 0, 'Calendar labels cannot overlap the dense life grid');
    assert.equal(frame.month, 0, 'Focus the complete crop before spreading calendar days');
  }
  if (frame.handoff > 0) assert.equal(frame.month, 1, 'Swap to the live calendar only after the shared grid has landed');
  if (time >= 16) {
    const previous = lifeCalendarMotion(time - 16);
    assert.ok(Math.abs(frame.paperOpacity - previous.paperOpacity) < .01, 'The application lighting changes gradually throughout the morph');
    assert.ok(Math.abs(frame.skin - previous.skin) < .01, 'Calendar paint never snaps onto neutral weeks');
  }
}
const overlappingMotion = lifeCalendarMotion(8450);
assert.ok(overlappingMotion.zoom > 0 && overlappingMotion.zoom < 1 && overlappingMotion.month > 0, 'The camera keeps moving as the calendar starts opening; there is no stop between phases');
console.log('Life story: dates, leap years, DST, account isolation and preview account passed.');
