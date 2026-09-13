import test from 'node:test';
import assert from 'node:assert/strict';
import { previousPeriod, comparePeriod } from '../src/features/trades-sync/lib/periodComparison.mjs';
import { pnlCurve } from '../src/features/trades-sync/lib/pnlCurve.mjs';

test('equal-length inclusive periods across a leap day and a year boundary', () => {
  assert.deepEqual(previousPeriod('2024-03-01', '2024-03-02'), { from: '2024-02-28', to: '2024-02-29' });
  assert.deepEqual(previousPeriod('2026-01-01', '2026-01-01'), { from: '2025-12-31', to: '2025-12-31' });
});
test('all history, invalid dates and reversed periods do not produce comparisons', () => {
  for (const [from, to] of [[null, '2026-09-13'], ['0000-01-01', '9999-12-31'], ['2026-02-30', '2026-03-02'], ['2026-09-13', '2026-09-01']]) assert.equal(previousPeriod(from, to), null);
});
test('comparison isolates accounts/currencies and uses both date boundaries', () => {
  const trade = (dateKey, pnl, account = 'a', currency = 'USD') => ({ dateKey, pnl, ctrader_account_id: account, currency });
  const history = [trade('2026-09-01', 100), trade('2026-09-02', -30), trade('2026-09-01', 999, 'b'), trade('2026-09-01', 999, 'a', 'EUR'), trade('2026-08-31', 999)];
  const current = pnlCurve([trade('2026-09-03', 100), trade('2026-09-04', -10)]);
  assert.deepEqual(comparePeriod(history, 'a|USD', { from: '2026-09-01', to: '2026-09-02' }, current), { count: 2, pnlDelta: 20, drawdownDelta: -20 });
  assert.equal(comparePeriod([], 'a|USD', { from: '2026-09-01', to: '2026-09-02' }, current), null);
});
