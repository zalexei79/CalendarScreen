import test from 'node:test';
import assert from 'node:assert/strict';
import { pnlCurve } from '../src/features/trades-sync/lib/pnlCurve.mjs';
const rows = values => values.map((pnl, i) => ({ dateKey: `2026-09-${String(i + 1).padStart(2, '0')}`, pnl }));
test('maximum drawdown and peak-to-recovery duration', () => {
  const result = pnlCurve(rows([50, -32, 7, 25]));
  assert.equal(result.total, 50);
  assert.equal(result.maxDrawdown, 32);
  assert.equal(result.recoveryDays, 3);
});
test('unrecovered losses start from zero', () => {
  const result = pnlCurve(rows([-20, 5, -10]));
  assert.equal(result.maxDrawdown, 25);
  assert.equal(result.recoveryDays, null);
});
test('daily aggregation and sorting; empty and profitable series', () => {
  assert.equal(pnlCurve([]).maxDrawdown, 0);
  assert.equal(pnlCurve(rows([1, 2, 3])).maxDrawdown, 0);
  const r = pnlCurve([...rows([50, -20]).reverse(), { dateKey: '2026-09-02', pnl: 20 }]);
  assert.equal(r.maxDrawdown, 0);
  assert.deepEqual(r.points.map(p => p.total), [50, 50]);
});
test('tracks recovery for deepest episode, not a later smaller drawdown', () => {
  const result = pnlCurve(rows([50, -30, 30, -10]));
  assert.equal(result.maxDrawdown, 30);
  assert.equal(result.recoveryDays, 2);
});
