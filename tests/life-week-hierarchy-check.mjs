import assert from 'node:assert/strict';
import { calendarWeekOffset, lifeWeekHierarchy } from '../src/features/onboarding/lifeWeekHierarchy.js';

for (const rows of [32, 35, 52]) {
  for (const currentWeek of [0, 1, rows - 1, rows, rows + 1, 1240, 1617]) {
    for (const dayCount of [31, 35, 42]) {
      for (const todayIndex of [0, 6, 7, Math.floor(dayCount / 2), dayCount - 1]) {
        const totalWeeks = Math.max(rows * 52, currentWeek + 520);
        const hierarchy = lifeWeekHierarchy({ currentWeek, totalWeeks, rows, todayIndex, dayCount });
        const parents = [...hierarchy.selectedWeeks];
        const positions = parents.map(hierarchy.position);
        assert.equal(hierarchy.sourceWeeks.length, dayCount);
        assert.equal(hierarchy.sourceWeeks[todayIndex], currentWeek, 'Today belongs to the current weekly parent');
        assert.equal(parents.length, Math.ceil(dayCount / 7), 'A calendar month comes from five or six weeks, never 35 or 42 weeks');
        assert.ok(hierarchy.sourceWeeks.every((week, index) => week === hierarchy.startWeek + Math.floor(index / 7)), 'All seven children of a row share one weekly source');
        assert.ok(parents.every((week, index) => week === hierarchy.startWeek + index), 'The parents are consecutive in time');
        assert.ok(positions.every(({ col, row }, index) => col === positions[0].col && row === positions[0].row + index && row >= 0 && row < rows), 'The month never crosses a column boundary while unfolding');
        assert.equal(hierarchy.columns, Math.ceil((totalWeeks + hierarchy.laneOffset) / rows));
        assert.ok(hierarchy.columns * rows - hierarchy.laneOffset >= totalWeeks, 'Future history remains covered after the lane shift');
        assert.ok(hierarchy.position(totalWeeks - 1).col < hierarchy.columns);
        assert.ok(positions[0].col >= 0, 'Virtual pre-birth parents still have a visible grid position');
        for (const week of [hierarchy.startWeek, 0, currentWeek, totalWeeks - 1]) {
          const { col, row } = hierarchy.position(week);
          assert.equal(hierarchy.weekAt(col, row), week, 'The visible grid and chronological weekly index are reversible');
        }
      }
    }
  }
}

const newborn = lifeWeekHierarchy({ currentWeek: 0, totalWeeks: 1664, rows: 32, todayIndex: 34, dayCount: 42 });
assert.equal(newborn.startWeek, -4);
assert.deepEqual([...newborn.selectedWeeks], [-4, -3, -2, -1, 0, 1], 'Pre-birth rows stay distinct neutral virtual parents');
assert.equal(newborn.sourceWeeks[34], 0);

const monday = new Date(2026, 9, 5, 23, 59);
assert.equal(calendarWeekOffset('2026-10-04', monday), -1, 'Sunday belongs to the previous calendar row');
assert.equal(calendarWeekOffset('2026-10-05', monday), 0);
assert.equal(calendarWeekOffset('2026-10-11', monday), 0);
assert.equal(calendarWeekOffset('2026-10-12', monday), 1);
assert.equal(calendarWeekOffset('2026-09-28', monday), -1, 'Month boundaries do not break Monday-based mapping');
assert.equal(calendarWeekOffset(new Date(2026, 9, 3, 12), monday), -1, 'Date objects use their local calendar date');
assert.equal(calendarWeekOffset('2026-03-29', '2026-03-23'), 0);
assert.equal(calendarWeekOffset('2026-03-30', '2026-03-23'), 1, 'Spring DST does not change the week distance');
assert.equal(calendarWeekOffset('2026-10-25', '2026-10-19'), 0);
assert.equal(calendarWeekOffset('2026-10-26', '2026-10-19'), 1, 'Autumn DST does not change the week distance');
assert.equal(calendarWeekOffset('2027-01-03', '2026-12-31'), 0);
assert.equal(calendarWeekOffset('2027-01-04', '2026-12-31'), 1, 'A week can span two years');
assert.equal(calendarWeekOffset('2026-12-27', '2026-12-31'), -1);
assert.equal(calendarWeekOffset('2024-02-29', '2024-03-01'), 0, 'Leap day stays in its calendar week');
assert.equal(calendarWeekOffset('2026-02-30', monday), null);
assert.equal(calendarWeekOffset('not a date', monday), null);
assert.equal(calendarWeekOffset(new Date(NaN), monday), null);
assert.equal(calendarWeekOffset('2026-10-05', new Date(NaN)), null);

console.log('Life week hierarchy: seven days per parent, continuous month lanes and calendar date alignment passed.');
