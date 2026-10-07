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
  for (const [name, value] of Object.entries(frame)) {
    if (typeof value === 'number') assert.ok(Number.isFinite(value) && value >= 0 && value <= 1, `${name} stays finite and within its visual range`);
  }
  assert.ok(frame.amountsOpacity === 0 || frame.questionOpacity === 0, 'The money stream and question never share a visible frame');
  if (time >= 6200) assert.equal(frame.amountsOpacity, 0, 'Amounts stay hidden through the rest of the story');
  if (frame.topAperture > 0) assert.equal(frame.copyOpacity, 0, 'The calendar enters the heading area only after its copy has retired');
  if (frame.bottomAperture > 0) assert.equal(frame.moneyOpacity, 0, 'The money question clears before the calendar expands into its space');
  if (frame.month === 0) assert.equal(frame.skin, 0, 'Calendar paint never appears on the untouched life grid');
  if (frame.contextExit === 1) {
    assert.ok(frame.month > .65 && frame.skin > .25 && frame.paperOpacity < 1, 'History only disappears after a substantial, painted calendar and its interface are already emerging');
  }
  if (frame.handoff > 0) {
    assert.equal(frame.month, 1, 'The live calendar takes over only after the moving cells reach its geometry');
    assert.equal(frame.skin, 1, 'The live calendar takes over only after the moving cells reach its paint');
    assert.equal(frame.paperOpacity, 0, 'There is no overlay lighting change during the live handoff');
  }
  assert.equal(frame.planeTilt, 0, 'The calendar stays legible on a flat plane');
  if (time >= 10200) {
    assert.ok(frame.signalOpacity === 0 && frame.focus === 0 && frame.headerArrival === 1 && frame.dockArrival === 1, 'Decorative motion and interface arrival finish before the live handoff');
  }
  if (time >= 16) {
    const previous = lifeCalendarMotion(time - 16);
    for (const name of ['month', 'contextExit', 'skin', 'headerArrival', 'dockArrival', 'handoff']) {
      assert.ok(frame[name] >= previous[name], `${name} never reverses or blinks`);
    }
    assert.ok(frame.contextExit - previous.contextExit < .04, 'History fades by less than 4% per frame while the calendar grows');
    assert.ok(frame.copyRetreat >= previous.copyRetreat && frame.copyRetreat - previous.copyRetreat < .05, 'The text retreats without a positional jump');
    assert.ok(Math.abs(frame.copyOpacity - previous.copyOpacity) < .08, 'The heading retires smoothly before the expanding calendar reaches it');
    assert.ok(Math.abs(frame.paperOpacity - previous.paperOpacity) < .02, 'The application lighting changes by less than 2% per frame');
    assert.ok(Math.abs(frame.skin - previous.skin) < .023, 'Calendar paint never snaps onto the weekly cells');
  }
}
const midTransition = lifeCalendarMotion(9000);
assert.ok(midTransition.month >= .6 && midTransition.month < 1, 'At the reported failure moment, the calendar has grown beyond 60% of its final extent');
assert.ok(midTransition.contextExit > 0 && midTransition.contextExit < 1, 'The source context still accompanies the expanding calendar at the reported failure moment');
assert.ok(midTransition.skin > 0 && midTransition.paperOpacity < 1 && midTransition.headerArrival > 0, 'Dates, calendar paint and surrounding interface emerge during the same movement');
assert.ok(lifeCalendarMotion(9600).month < lifeCalendarMotion(10000).month && lifeCalendarMotion(10000).month < 1, 'The final approach keeps moving and settles gradually');
assert.equal(lifeCalendarMotion(10600).settled, true, 'The live interface is settled when the handoff completes');
assert.ok(LIFE_MOTION_END > 10600 && LIFE_MOTION_END <= 11000, 'There is a brief stable landing before the story overlay unmounts');
for (let time = 8000; time <= 10200; time += 16) {
  for (const todayIndex of [0, 7, 34, 41]) for (let index = 0; index < 42; index++) {
    const content = lifeCellMaterialization(time, index, todayIndex);
    assert.ok(content >= lifeCellMaterialization(time - 16, index, todayIndex) && content >= 0 && content <= 1, 'Date contents materialize once without blinking or reversing');
    if (time >= 9800) assert.equal(content, 1, 'The full month is readable before its geometry lands');
  }
}
// Every group of seven days comes from its real weekly parent. Exercise small
// and wide screens, every month height, and current weeks at either grid edge.
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
  assert.equal(hierarchy.selectedWeeks.size, monthRows, 'A month refines four, five or six weekly parents, not 28-42 weeks');
  assert.equal(hierarchy.sourceWeeks[todayIndex], currentWeek, 'Today remains a child of the current weekly parent');
  for (let index = 0; index < dayCount; index++) {
    const sourceWeek = hierarchy.sourceWeeks[index];
    assert.equal(sourceWeek, hierarchy.startWeek + Math.floor(index / 7), 'Every group of seven days shares one consecutive source week');
    assert.deepEqual(hierarchy.position(sourceWeek), { col: cropCol, row: cropRow + Math.floor(index / 7) }, 'The source parents stay contiguous even at the life-grid edges');
    assert.equal(hierarchy.weekAt(cropCol, cropRow + Math.floor(index / 7)), sourceWeek, 'The spatial parent mapping preserves its temporal identity');
  }

  const unit = Math.min((width - 84) / hierarchy.columns, 12);
  const gridLeft = (width - unit * hierarchy.columns) / 2;
  const gridTop = 310;
  const nativeWidth = Math.min(width - 48, 820);
  const nativeGap = width < 760 ? 4 : 8;
  const nativeDayWidth = (nativeWidth - nativeGap * 6) / 7;
  const nativeDayHeight = nativeDayWidth * compactAspect;
  const initialFill = width >= 760 ? .74 : .65;
  const sourceSize = unit * initialFill;
  const sourceX = gridLeft + cropCol * unit + (unit - sourceSize) / 2;
  const sourceY = gridTop + cropRow * unit + (unit - sourceSize) / 2;
  const targets = Array.from({ length: dayCount }, (_, index) => ({
    x: (width - nativeWidth) / 2 + index % 7 * (nativeDayWidth + nativeGap),
    y: 240 + Math.floor(index / 7) * (nativeDayHeight + nativeGap),
    width: nativeDayWidth,
    height: nativeDayHeight,
  }));
  const frameAt = time => {
    const motion = lifeCalendarMotion(time);
    const camera = lifeCameraFrame({ gridLeft, gridTop }, motion);
    return { motion, camera, lattice: lifeLatticeFrame({ camera, unit, cropCol, cropRow, targets, initialFill }, motion) };
  };
  const source = frameAt(8000).lattice;
  close(source.x, sourceX, 'The moving month starts at the exact source weekly parent');
  close(source.y, sourceY, 'The moving month starts at the exact source row');
  close(source.width, sourceSize, 'Seven children initially fill one original weekly square');
  close(source.height, sourceSize, 'The source parent retains its original height');
  close(source.pitchY, unit, 'The source weeks retain their original vertical spacing');
  assert.equal(source.gap, 0, 'A weekly parent has no premature internal gaps');

  let previous;
  for (let time = 8000; time <= LIFE_MOTION_END; time += 16) {
    const { motion, camera, lattice } = frameAt(time);
    assert.deepEqual(camera, { originX: gridLeft, originY: gridTop }, 'Surrounding history stays in place instead of magnifying into a wall of cells');
    assert.ok(lattice.x >= 12 && lattice.x + lattice.width <= width - 12, 'The growing month remains inside the viewport even when its source is at a grid edge');
    assert.ok(lattice.x >= Math.min(sourceX, targets[0].x) - 1e-7 && lattice.x <= Math.max(sourceX, targets[0].x) + 1e-7, 'The month follows a bounded horizontal path without overshoot');
    assert.ok(lattice.y >= Math.min(sourceY, targets[0].y) - 1e-7 && lattice.y <= Math.max(sourceY, targets[0].y) + 1e-7, 'The month follows a bounded vertical path without overshoot');
    assert.ok(lattice.width < lattice.pitchX && lattice.height < lattice.pitchY, 'Weekly rows remain separated throughout the expansion');
    assert.ok(lattice.gap >= 0 && lattice.dayWidth > 0 && lattice.dayWidth <= lattice.dayPitch, 'Daily children never overlap or acquire a negative gap');
    close(7 * lattice.dayWidth + 6 * lattice.gap, lattice.width, 'The seven daily children exactly partition their weekly parent');
    close(6 * lattice.dayPitch + lattice.dayWidth, lattice.width, 'The last child ends on its parent boundary');
    if (motion.contextExit === 1) assert.ok(lattice.width > nativeWidth * .65, 'History cannot leave a miniature calendar isolated on an empty screen');
    if (previous) {
      assert.ok(Math.abs(lattice.x - previous.x) < nativeWidth * .015 && Math.abs(lattice.y - previous.y) < nativeWidth * .015 && Math.abs(lattice.width - previous.width) < nativeWidth * .015, 'The month moves and expands by less than 1.5% of its final extent per frame');
      assert.ok(Math.abs(lattice.dayWidth - previous.dayWidth) < nativeDayWidth * .015 && Math.abs(lattice.height - previous.height) < nativeDayHeight * .015, 'Individual day dimensions change smoothly on every 16 ms frame');
      assert.ok(lattice.dayWidth >= previous.dayWidth && lattice.height >= previous.height, 'Daily cells grow continuously with no shrinking interval');
    }
    previous = lattice;
  }
  assert.ok(frameAt(9000).lattice.width >= nativeWidth * .6, 'The screenshot regression moment contains a substantial calendar on every screen size');
  assert.ok(frameAt(8016).lattice.width - source.width < nativeWidth * .001, 'The source cells begin expanding with gentle acceleration');
  assert.ok(nativeWidth - frameAt(10184).lattice.width < nativeWidth * .0001, 'The month decelerates into its native geometry before handoff');
  for (const time of [10200, 10400, 10600, LIFE_MOTION_END]) {
    const { lattice } = frameAt(time);
    close(lattice.x, targets[0].x, 'The month lands on the native calendar origin exactly');
    close(lattice.y, targets[0].y, 'The first row lands on the native calendar origin exactly');
    close(lattice.width, nativeWidth, 'The final weekly parent equals the native seven-day row');
    close(lattice.dayWidth, nativeDayWidth, 'Every day ends at its native width');
    close(lattice.height, nativeDayHeight, 'Every day ends at its native height');
    close(lattice.gap, nativeGap, 'The final partition uses the native calendar gutter');
    targets.forEach((target, index) => {
      close(lattice.x + index % 7 * lattice.dayPitch, target.x, 'Every child lands on its native horizontal position');
      close(lattice.y + Math.floor(index / 7) * lattice.pitchY, target.y, 'Every child lands on its native vertical position');
    });
  }
}
console.log('Life story: dates, history, source continuity, no miniature-grid gap and exact calendar handoff passed.');
