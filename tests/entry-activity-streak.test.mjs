import test from 'node:test';
import assert from 'node:assert/strict';
import { entryStreakState } from '../src/shared/lib/entryActivityStreak.js';
import { streakCopy } from '../src/shared/i18n/streak.js';
import { streakReminderDay } from '../src/shared/lib/useStreakPauseReminder.js';

test('pause reminders follow the account day across devices and timezone boundaries',()=>{
  const midnight = new Date('2026-10-28T23:30:00Z');
  assert.equal(streakReminderDay({serverDate:'2026-10-28',timeZone:'Pacific/Kiritimati'},midnight),'2026-10-28','confirmed server date wins');
  assert.equal(streakReminderDay({timeZone:'Pacific/Kiritimati'},midnight),'2026-10-29');
  assert.equal(streakReminderDay({timeZone:'Pacific/Honolulu'},midnight),'2026-10-28');
});

test('guest reads never count; one entry per day; pause, rescue and reset match the server',()=>{
  const first=entryStreakState(null,'2026-10-20');
  assert.equal(first.currentStreak,0); assert.equal(first.paused,true);
  const monday=entryStreakState(first,'2026-10-20',true);
  assert.equal(monday.currentStreak,1); assert.equal(monday.paused,false);
  assert.deepEqual(entryStreakState(monday,'2026-10-20',true),monday);
  const tuesday=entryStreakState(monday,'2026-10-21');
  assert.equal(tuesday.currentStreak,1); assert.equal(tuesday.paused,true);
  assert.equal(tuesday.lastActiveDate,'2026-10-20');
  assert.equal(entryStreakState(tuesday,'2026-10-21',true).currentStreak,2);
  const rescue=entryStreakState(monday,'2026-10-22',true);
  assert.equal(rescue.currentStreak,1); assert.equal(rescue.completedToday,true);
  assert.equal(entryStreakState(rescue,'2026-10-23',true).currentStreak,2);
  const expired=entryStreakState(monday,'2026-10-23');
  assert.equal(expired.currentStreak,0); assert.equal(expired.lastActiveDate,'2026-10-20');
  assert.equal(entryStreakState(expired,'2026-10-23',true).currentStreak,1);
});
test('all locales expose matching daily-entry rules and feedback keys',()=>{
  const keys=Object.keys(streakCopy.ru).sort();
  for(const labels of Object.values(streakCopy)){
    assert.deepEqual(Object.keys(labels).sort(),keys);
    assert.ok(labels.streakStarted && labels.streakContinued && labels.streakEmpty);
  }
  assert.match(streakCopy.ru.streakRulesIntro,/Редактирование|редактирование/);
  assert.doesNotMatch(streakCopy.ru.streakProudLine,/Захожу/);
});
