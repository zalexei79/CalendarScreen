import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeFreeHistory } from '../src/features/history/freeHistoryModel.js';

test('history card totals reconcile cents and count income, expenses and zero entries', () => {
  const records = [{ pnl: .1, currency: 'MDL' }, { pnl: .2, currency: 'MDL' }, { pnl: -.12, currency: 'MDL' }, { pnl: 0, currency: 'MDL' }];
  assert.deepEqual(summarizeFreeHistory(records, 'MDL'), { mixed: false, currency: 'MDL', count: 4, income: .3, expense: .12, total: .18 });
});
test('currencies are isolated and a mixed view never exposes a fabricated total', () => {
  const records = [{ pnl: 100, currency: 'MDL' }, { pnl: -20, currency: 'MDL' }, { pnl: 30, currency: 'USD' }];
  assert.equal(summarizeFreeHistory(records, 'MDL').total, 80);
  assert.equal(summarizeFreeHistory(records, 'USD').total, 30);
  assert.deepEqual(summarizeFreeHistory(records, 'ALL'), { mixed: true, currency: 'ALL', count: 3, income: null, expense: null, total: null });
  assert.equal(summarizeFreeHistory(records.slice(0, 2), 'ALL').currency, 'MDL');
});
test('legacy sub-cent PnL is aggregated before display rounding', () => {
  assert.equal(summarizeFreeHistory([{ pnl: .004 }, { pnl: .004 }, { pnl: .004 }], 'USD').total, .01);
  assert.equal(summarizeFreeHistory([{ pnl: -.005 }], 'USD').total, -.01);
});
test('empty, negative and legacy missing-currency records have defined display totals', () => {
  assert.equal(summarizeFreeHistory([], 'CNY').total, 0);
  assert.equal(summarizeFreeHistory([{ pnl: -450 }], 'USD').total, -450);
  assert.equal(summarizeFreeHistory([{ pnl: Infinity, currency: 'MDL' }], 'MDL').total, 0);
});
