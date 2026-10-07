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

for (let time=0;time<=LIFE_MOTION_END;time+=16) {
  const frame=lifeCalendarMotion(time);
  assert.ok(frame.amountsOpacity===0 || frame.questionOpacity===0);
  assert.equal(frame.planeTilt,0);
  if(frame.division>0) assert.ok(frame.zoom>.7,'Weeks become large before they divide into days');
  if(frame.contextExit>0) assert.ok(frame.division>.3,'The surrounding lattice remains until day subdivision is visible');
  if(frame.handoff>0) assert.ok(frame.zoom===1 && frame.division===1 && frame.month===1 && frame.skin===1 && frame.paperOpacity===0,'Handoff only after exact geometry, paint and lighting settle');
}
assert.equal(lifeCalendarMotion(9000).division,0,'At the first zoom, cells still represent whole weeks');
assert.ok(lifeCalendarMotion(9500).division>0,'Day boundaries unfold after weeks have enlarged');
const close=(a,b,label)=>assert.ok(Math.abs(a-b)<1e-6,label);
for(const width of [320,390,1145,1440]) for(const rowCount of [4,5,6]) for(const edge of [0,1]) {
  const unit=5, size=unit*.74, gap=8, nativeWidth=width-48, dayWidth=(nativeWidth-6*gap)/7, dayHeight=100;
  const targets=Array.from({length:rowCount*7},(_,i)=>({x:24+i%7*(dayWidth+gap),y:200+Math.floor(i/7)*(dayHeight+gap),width:dayWidth,height:dayHeight}));
  const cropCol=edge?40:0,cropRow=edge?25:0;
  const camera=lifeCameraFrame({gridLeft:100,gridTop:250});
  let previous;
  for(let time=8000;time<=11600;time+=16) {
    const motion=lifeCalendarMotion(time);
    const frame=lifeLatticeFrame({camera,unit,cropCol,cropRow,targets,initialFill:.74},motion);
    assert.ok(frame.width<=nativeWidth+.001 && frame.height<=dayHeight+.001,'No zoom overshoot');
    assert.ok(frame.pitchY>frame.height && frame.pitchX>frame.width,'Weeks never overlap their neighbors');
    close(frame.dayWidth*7+frame.gap*6,frame.width,'Seven days partition exactly one week');
    if(!motion.division) close(frame.width,frame.height,'Weeks stay square throughout the initial camera zoom');
    if(previous) {
      assert.ok(frame.width>=previous.width && frame.height>=previous.height,'The lattice enlarges continuously');
      assert.ok(frame.width-previous.width<nativeWidth*.026,'No one-frame horizontal jump');
    }
    previous=frame;
  }
  const settled=lifeLatticeFrame({camera,unit,cropCol,cropRow,targets,initialFill:.74},lifeCalendarMotion(11000));
  close(settled.x,targets[0].x);close(settled.y,targets[0].y);close(settled.dayWidth,dayWidth);close(settled.height,dayHeight);
  targets.forEach((target,i)=>{close(settled.x+i%7*settled.dayPitch,target.x);close(settled.y+Math.floor(i/7)*settled.pitchY,target.y);});
}
console.log('PASS: full-grid zoom, square weeks before seven-day subdivision, continuous geometry and exact calendar handoff.');
