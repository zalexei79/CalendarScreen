import assert from 'node:assert/strict';
import { createDemoCalendar, readEntryIntent, ENTRY_INTENT_KEY } from '../src/features/auth/demoCalendar.js';

for (const today of [new Date(2026, 9, 1), new Date(2026, 9, 6), new Date(2028, 1, 29)]) {
  for (const currency of ['USD', 'EUR', 'MDL']) {
    const calendar = createDemoCalendar({ today, currency, language: 'ru' });
    const entries = Object.values(calendar).flat();
    assert.equal(entries.length, 7);
    for (const amount of [7, 67, 69, 777]) assert.ok(entries.some(item => Math.abs(item.pnl) === amount));
    assert.ok(entries.every(item => item.currency === currency && item.demo && item.comment.includes('Пример')));
    for (const key of Object.keys(calendar)) {
      const date = new Date(`${key}T00:00:00`);
      assert.equal(date.getMonth(), today.getMonth());
      assert.ok(date <= today);
    }
    assert.equal(entries.reduce((sum, item) => sum + item.pnl, 0), 509);
  }
}
const storage = value => ({ getItem: key => key === ENTRY_INTENT_KEY ? value : null });
assert.equal(readEntryIntent(storage('{"dateKey":"2026-10-06"}')), '2026-10-06');
for (const value of ['null', '{', '{"dateKey":"2026-02-30"}', '{"dateKey":"wrong"}']) assert.equal(readEntryIntent(storage(value)), null);
assert.equal(readEntryIntent({getItem() { throw new Error('Storage unavailable'); }}), null);
console.log('Demo amounts, currencies, month boundaries and login continuation dates passed.');
