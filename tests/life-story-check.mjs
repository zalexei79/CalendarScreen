import assert from 'node:assert/strict';
import { lifeWeeks, localDateValue, birthdayStorageKey, isOnboardingPreviewUser, lifeWeekRhythm, lifeMoneyEvents, lifeMoneyFlow, reserveLifePresent, calendarMoneyEvents } from '../src/features/onboarding/lifeStoryModel.js';
import { lifeCalendarMotion, lifeCameraFrame, LIFE_MOTION_END } from '../src/features/onboarding/lifeCalendarMotion.js';

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
  const events = lifeMoneyEvents(rhythm, currency);
  assert.ok(events.every(event => event.currency === currency && event.amount > 0));
  const flow = lifeMoneyFlow(events, 1490);
  assert.ok(flow.length >= 4 && flow.length <= 8 && new Set(flow.map(event => event.amount)).size >= 4, 'A few varied examples remain readable rather than flashing through the story');
  assert.ok(flow.every(event => event.currency === currency && event.start < 5500 && event.duration === 700));
  for (const tone of ['income', 'expense']) {
    const changes = flow.filter(event => event.tone === tone);
    assert.ok(changes.every((event, index) => !index || event.start - changes[index - 1].start >= 1399.99), 'Each fixed column has a reading pause between soft exchanges');
  }
  for (const event of flow) {
    const t = event.start / 8000;
    const filled = Math.floor(1490 * (t < .5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2));
    assert.ok(event.week < filled, 'A financial pulse never belongs to a future week');
    assert.equal(event.tone, rhythm[event.week].tone);
  }
}
const sources = [1144, 1145, 1196, 1197, 1248, 1249];
const reserved = reserveLifePresent(rhythm, sources, 1250);
assert.ok(sources.every(week => reserved[week].tone === 'neutral'), 'The approaching days are empty from the beginning, not painted over at today');
assert.ok(reserved.slice(1248, 1251).every(event => event.tone === 'neutral'));
assert.ok(reserved.every((event, week) => sources.includes(week) || week >= 1248 && week <= 1250 || event === rhythm[week]), 'All surrounding historical financial weeks remain untouched');
assert.deepEqual(rhythm, lifeWeekRhythm(rhythm.length, '1998-03-14'), 'Reserving the present never mutates the underlying history');
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
  }
  if (frame.handoff > 0) assert.equal(frame.month, 1, 'Swap to the live calendar only after the shared grid has landed');
  if (time >= 16) {
    const previous = lifeCalendarMotion(time - 16);
    assert.ok(Math.abs(frame.paperOpacity - previous.paperOpacity) < .013, 'The application lighting changes gradually throughout the morph');
    assert.ok(Math.abs(frame.skin - previous.skin) < .013, 'Calendar paint never snaps onto neutral weeks');
  }
}
const overlappingMotion = lifeCalendarMotion(10900);
assert.ok(overlappingMotion.zoom > 0 && overlappingMotion.zoom < 1 && overlappingMotion.month > 0, 'The camera keeps moving as the calendar starts opening; there is no stop between phases');
for (const width of [320, 390, 1440]) for (const cropCol of [0, 45]) {
  const unit = Math.min((width - 84) / 52, 12);
  const gridLeft = (width - unit * 52) / 2;
  const compactPitch = (Math.min(width - 48, 820) * .9) / 7;
  for (let time = 8650; time <= 11250; time += 16) {
    const motion = lifeCalendarMotion(time);
    const frame = lifeCameraFrame({ gridLeft, gridTop: 310, unit, cropCol, cropRow: 27, monthRows: 5, focusX: width / 2, focusY: 430, compactPitch }, motion);
    const left = frame.originX + cropCol * unit * frame.scale;
    const right = left + unit * 7 * frame.scale;
    assert.ok(left >= 12 && right <= width - 12, 'The camera keeps the month inside the viewport even when the present begins at either edge');
    if (motion.lifeOpacity < .01) {
      assert.ok(right - left >= Math.min(width - 48, 820) * .7, 'The life grid only leaves once the calendar has enough presence to fill the scene');
      const center = frame.originY + (27 + 2.5) * unit * frame.scale;
      assert.ok(Math.abs(center - 430) < 1, 'The month is already centered when its surroundings disappear');
    }
  }
}
console.log('Life story: dates, leap years, DST, account isolation and preview account passed.');
