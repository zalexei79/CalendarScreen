import test from 'node:test';
import assert from 'node:assert/strict';
import { initialDraft, planPayload, reminderPreview, validateDraft } from '../src/features/reminders/plannerModel.js';
import { PLANNER_COPY, plannerLanguage } from '../src/features/reminders/plannerCopy.js';

const now = new Date('2026-09-22T12:00:00');
const base = { ...initialDraft('2026-10-24', null, 'MDL'), title: 'Loan' };

test('simple reminder needs only a title; amount remains optional', () => {
  assert.equal(validateDraft(base, now), null);
  assert.equal(planPayload(base, 'new').amount, '');
  assert.equal(planPayload(base, 'new').repeatTotal, null);
  for (const amount of ['0', '.5', '1.']) assert.equal(validateDraft({ ...base, amount }, now), null);
});
test('editing restores every saved setting, including more than 120 events', () => {
  const draft = initialDraft('2026-10-24', { title: 'Loan', amount: 0, kind: 'income', currency: 'EUR', local_at: '2026-10-24 14:45:00', repeat_rule: 'yearly', remind_offset: '1_week', repeat_total: 240, repeat_until: '2030-10-24' }, 'USD');
  assert.deepEqual(draft, { title: 'Loan', amount: '0', kind: 'income', currency: 'EUR', dateKey: '2026-10-24', time: '14:45', repeatRule: 'yearly', remindOffset: '1_week', repeatTotal: '240', repeatUntil: '2030-10-24' });
});
test('quick save preserves details; one-time save excludes stale limits', () => {
  const draft = { ...base, repeatRule: 'monthly', remindOffset: '1_day', repeatTotal: '12', repeatUntil: '2027-09-24', amount: ' 1400,50 ' };
  assert.deepEqual(planPayload(draft, 'plan'), { ...draft, id: 'plan', amount: '1400.50' });
  assert.equal(planPayload({ ...draft, repeatRule: 'none' }, 'plan').repeatTotal, null);
  assert.equal(planPayload({ ...draft, repeatRule: 'none' }, 'plan').repeatUntil, null);
});
test('validation returns the step to repair and accepts 1..600 events', () => {
  assert.equal(validateDraft({ ...base, title: ' ' }, now).step, 0);
  for (const amount of ['-1', '1.2.3', 'NaN']) assert.equal(validateDraft({ ...base, amount }, now).field, 'amount');
  for (const repeatTotal of ['1', '600']) assert.equal(validateDraft({ ...base, repeatRule: 'monthly', repeatTotal }, now), null);
  for (const repeatTotal of ['0', '601', '1.5']) assert.equal(validateDraft({ ...base, repeatRule: 'monthly', repeatTotal }, now).field, 'repeatTotal');
  assert.equal(validateDraft({ ...base, repeatRule: 'monthly', repeatUntil: '2026-10-23' }, now).field, 'repeatUntil');
});
test('past days, missing time and impossible calendar dates cannot submit', () => {
  for (const change of [{ dateKey: '2026-09-22' }, { time: '' }, { time: '29:99' }, { dateKey: '2027-02-30' }]) {
    assert.equal(validateDraft({ ...base, ...change }, now).message, 'future');
  }
});
test('reminder preview uses selected offset and explains elapsed first reminder', () => {
  const early = reminderPreview({ ...base, remindOffset: '3_days' }, now);
  assert.equal(early.date.getDate(), 21);
  assert.equal(early.date.getHours(), 9);
  assert.equal(early.late, false);
  const late = reminderPreview({ ...base, dateKey: '2026-09-23', remindOffset: '1_week' }, now);
  assert.equal(late.date.getDate(), 23);
  assert.equal(late.late, true);
});
test('locales have matching strings and support regional language codes', () => {
  for (const code of ['en', 'ro']) assert.deepEqual(Object.keys(PLANNER_COPY[code]).sort(), Object.keys(PLANNER_COPY.ru).sort());
  assert.equal(plannerLanguage('en-US'), 'en');
  assert.equal(plannerLanguage('ro-RO'), 'ro');
  assert.equal(plannerLanguage('md'), 'ro');
});
