import assert from 'node:assert/strict';
import { lifeWeeks, localDateValue, birthdayStorageKey, isOnboardingPreviewUser, lifeWeekRhythm, lifeMoneyEvents, lifeMoneyFlow, reserveLifePresent, calendarMoneyEvents } from '../src/features/onboarding/lifeStoryModel.js';
import { lifeCalendarMotion, lifeCameraFrame, lifeLatticeFrame, lifeCellMaterialization, LIFE_MOTION_END } from '../src/features/onboarding/lifeCalendarMotion.js';
import { lifeWeekHierarchy } from '../src/features/onboarding/lifeWeekHierarchy.js';

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
  assert.ok(flow.length >= 24 && flow.length <= 26 && new Set(flow.map(event => event.amount)).size === flow.length, 'A faster stream of 24–26 distinct amounts conveys passing money');
  assert.ok(flow.some(event => event.tone === 'income') && flow.some(event => event.tone === 'expense'));
  assert.ok(flow.every(event => event.currency === currency && event.start <= 5350 && event.duration > 0 && event.duration <= 85));
  assert.ok(flow.every((event, index) => !index || event.start - flow[index - 1].start >= event.duration), 'An amount completes its soft exchange before the next one arrives');
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
  assert.ok(frame.amountsOpacity === 0 || frame.questionOpacity === 0, 'The money stream and question never share a visible frame');
  if (time >= 6200) assert.equal(frame.amountsOpacity, 0, 'Amounts stay hidden through the rest of the story');
  if (frame.topAperture > 0) assert.equal(frame.copyOpacity, 0, 'The lattice can expand through the copy area only after the heading has left');
  if (frame.bottomAperture > 0) assert.equal(frame.moneyOpacity, 0, 'The bottom fills as soon as the money question has cleared');
  if (frame.month === 0) assert.equal(frame.skin, 0, 'Calendar paint starts as the shared lattice approaches its final layout');
  if (frame.contextExit > 0) assert.ok(frame.skin > 0, 'Dates are present before the surrounding history begins dissolving');
  if (frame.handoff > 0) assert.equal(frame.month, 1, 'Swap to the live calendar only after the shared grid has landed');
  if (time >= 16) {
    const previous = lifeCalendarMotion(time - 16);
    assert.ok(frame.contextExit - previous.contextExit < .014, 'The surrounding plane dissolves gradually, without a disappearing frame');
    assert.ok(frame.copyRetreat >= previous.copyRetreat && frame.copyRetreat - previous.copyRetreat < .03, 'The text recedes continuously as the calendar approaches');
    assert.ok(Math.abs(frame.copyOpacity - previous.copyOpacity) < .04, 'The story copy retires on the same smooth timeline as the camera');
    assert.ok(Math.abs(frame.paperOpacity - previous.paperOpacity) < .018, 'The application lighting changes by less than 1.8% per frame throughout the morph');
    assert.ok(Math.abs(frame.skin - previous.skin) < .014, 'Calendar paint never snaps onto neutral weeks');
  }
}
const overlappingMotion = lifeCalendarMotion(10000);
for (let time = 8200; time <= LIFE_MOTION_END; time += 16) {
  const frame = lifeCalendarMotion(time);
  const previous = lifeCalendarMotion(time - 16);
  assert.ok(frame.planeTilt >= 0 && frame.planeTilt <= 7 && Math.abs(frame.planeTilt - previous.planeTilt) < .16, 'The intact plane tilts continuously and never flips or shakes');
  if (time >= 12300) assert.ok(frame.planeTilt === 0 && frame.signalOpacity === 0 && frame.focus === 0 && frame.headerArrival === 1 && frame.dockArrival === 1, 'Every optical effect ends before the exact native handoff');
  for (const todayIndex of [0, 7, 34, 41]) for (let index = 0; index < 42; index++) {
    const content = lifeCellMaterialization(time, index, todayIndex);
    assert.ok(content >= lifeCellMaterialization(time - 16, index, todayIndex) && content >= 0 && content <= 1, 'Date contents materialize once without blinking or reversing');
    if (time >= 11600) assert.equal(content, 1, 'The whole month is readable before the camera has landed');
  }
}
const departingCopy = lifeCalendarMotion(9000);
assert.ok(departingCopy.reframe > .7 && departingCopy.zoom > .1 && departingCopy.bottomAperture > .2, 'The camera and both sides of the scene keep advancing while the copy leaves');
assert.ok(overlappingMotion.zoom > 0 && overlappingMotion.zoom < 1 && overlappingMotion.month > 0, 'The camera keeps moving as the calendar starts opening; there is no stop between phases');
assert.ok(lifeCalendarMotion(11000).zoom < lifeCalendarMotion(12000).zoom && lifeCalendarMotion(12000).zoom < 1, 'The camera keeps approaching throughout the interface reveal');
// The crop is now one column of consecutive weekly parents. Every parent owns
// the seven days in its row; it is no longer a crop of seven unrelated weeks.
const close = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-7, message);
for (const width of [320, 390, 1440]) for (const monthRows of [4, 5, 6]) for (const edge of ['first', 'last']) for (const compactAspect of [1, 1.8]) {
  const rows = 32;
  const totalWeeks = rows * 52;
  const dayCount = monthRows * 7;
  const todayIndex = edge === 'first' ? 0 : dayCount - 1;
  const currentWeek = edge === 'first' ? 0 : totalWeeks - 1;
  const hierarchy = lifeWeekHierarchy({ currentWeek, totalWeeks, rows, todayIndex, dayCount });
  const { col: cropCol, row: cropRow } = hierarchy.position(hierarchy.startWeek);
  assert.ok(cropRow >= 0 && cropRow + monthRows <= rows, 'Consecutive month parents never wrap into another column');
  assert.equal(hierarchy.selectedWeeks.size, monthRows, 'A month refines four, five or six weekly parents, not 28–42 weeks');
  assert.equal(hierarchy.sourceWeeks[todayIndex], currentWeek, 'Today remains a child of the current weekly parent');
  for (let index = 0; index < dayCount; index++) {
    const sourceWeek = hierarchy.sourceWeeks[index];
    assert.equal(sourceWeek, hierarchy.startWeek + Math.floor(index / 7), 'Every group of seven days shares one consecutive source week');
    assert.deepEqual(hierarchy.position(sourceWeek), { col: cropCol, row: cropRow + Math.floor(index / 7) }, 'The parents form one contiguous vertical lane even at the life-grid edges');
    assert.equal(hierarchy.weekAt(cropCol, cropRow + Math.floor(index / 7)), sourceWeek, 'The spatial parent mapping preserves its temporal identity');
  }

  const unit = Math.min((width - 84) / hierarchy.columns, 12);
  const gridLeft = (width - unit * hierarchy.columns) / 2;
  const nativeWidth = Math.min(width - 48, 820);
  const nativeGap = width < 760 ? 4 : 8;
  const nativeDayWidth = (nativeWidth - nativeGap * 6) / 7;
  const nativeDayHeight = nativeDayWidth * compactAspect;
  const targets = Array.from({ length: dayCount }, (_, index) => ({
    x: (width - nativeWidth) / 2 + index % 7 * (nativeDayWidth + nativeGap),
    y: 240 + Math.floor(index / 7) * (nativeDayHeight + nativeGap),
    width: nativeDayWidth,
    height: nativeDayHeight,
  }));
  const focusY = (targets[0].y + targets.at(-1).y + nativeDayHeight) / 2;
  const cameraConfig = { gridLeft, gridTop: 310, unit, cropCol, cropRow, monthRows, focusX: width / 2, focusY, compactPitch: nativeWidth * .9 / 7, compactAspect };
  const frameAt = time => {
    const motion = lifeCalendarMotion(time);
    const camera = lifeCameraFrame(cameraConfig, motion);
    return { motion, camera, lattice: lifeLatticeFrame({ camera, unit, cropCol, cropRow, targets, initialFill: width >= 760 ? .74 : .65 }, motion) };
  };
  let previous;
  for (let time = 8200; time <= 12550; time += 16) {
    const { motion, camera, lattice } = frameAt(time);
    const left = camera.originX + cropCol * unit * camera.scaleX;
    const right = left + unit * camera.scaleX;
    assert.ok(left >= 12 && right <= width - 12, 'The camera keeps the single expanding weekly parent inside the viewport at either edge');
    assert.ok(lattice.width < lattice.pitchX && lattice.height < lattice.pitchY, 'Weekly parents remain separated from adjacent parents throughout the refinement');
    assert.ok(lattice.gap >= 0 && lattice.dayWidth > 0 && lattice.dayWidth <= lattice.dayPitch, 'Daily children never overlap or acquire a negative gap');
    close(7 * lattice.dayWidth + 6 * lattice.gap, lattice.width, 'All seven daily children and their gaps exactly partition their weekly parent');
    close(6 * lattice.dayPitch + lattice.dayWidth, lattice.width, 'The last child ends on its parent boundary instead of drifting into the next week');
    if (motion.division === 1) close(lattice.pitchX - lattice.width, lattice.gap, 'Refined weeks share the ordinary daily gutter instead of separating into towers');
    if (motion.contextExit > .99) {
      assert.ok(right - left >= nativeWidth * .7, 'The life grid only leaves once the refined month has enough presence to fill the scene');
      close(camera.originX + (cropCol + .5) * unit * camera.scaleX, width / 2, 'The parent lane stays centered while becoming seven days wide');
      close(camera.originY + (cropRow + monthRows / 2) * unit * camera.scaleY, focusY - 16 * Math.sin(Math.PI * motion.month), 'The month follows the same continuous camera arc as its surroundings disappear');
      if (compactAspect > 1) assert.ok(camera.scaleY / camera.scale > 1.7, 'The daily children already have the taller calendar proportions as the life grid leaves');
    }
    if (previous) {
      // Bounds scale with the native row/card size so phone and desktop retain
      // the same strict visual speed budget: below 1.5% of their final extent.
      assert.ok(Math.abs(lattice.x - previous.x) < nativeWidth * .015 && Math.abs(lattice.y - previous.y) < nativeWidth * .015 && Math.abs(lattice.width - previous.width) < nativeWidth * .015, 'The parent lane follows a continuous camera without a replacement crop or a one-frame extent jump');
      assert.ok(Math.abs(lattice.dayWidth - previous.dayWidth) < nativeDayWidth * .015 && Math.abs(lattice.height - previous.height) < nativeDayHeight * .015, 'Daily children change size smoothly on every 16 ms frame');
      assert.ok(lattice.dayWidth >= previous.dayWidth && lattice.height >= previous.height, 'Daily children only grow; refining their weekly parent never creates a shrinking interval');
    }
    previous = lattice;
  }
  // Sample the exact end as well: a 16 ms traversal does not land on 12550 ms.
  for (const time of [12550, 12800, LIFE_MOTION_END]) {
    const { lattice } = frameAt(time);
    close(lattice.x, targets[0].x, 'The parent lane lands on the native calendar origin exactly');
    close(lattice.y, targets[0].y, 'The first weekly row lands on the native calendar origin exactly');
    close(lattice.width, nativeWidth, 'The final weekly parent equals the complete native seven-day row');
    close(lattice.dayWidth, nativeDayWidth, 'Refined daily children end at their native width');
    close(lattice.height, nativeDayHeight, 'Refined daily children end at their native height');
    close(lattice.gap, nativeGap, 'The partition ends with the native calendar gutter');
    targets.forEach((target, index) => {
      close(lattice.x + index % 7 * lattice.dayPitch, target.x, 'Every child lands on its native horizontal position');
      close(lattice.y + Math.floor(index / 7) * lattice.pitchY, target.y, 'Every child lands on its native vertical position');
    });
  }
}
console.log('Life story: dates, leap years, DST, account isolation and preview account passed.');
