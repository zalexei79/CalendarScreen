import assert from 'node:assert/strict';
import test from 'node:test';
import { updateActivityStreak } from '../src/shared/lib/activityStreak.js';

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
