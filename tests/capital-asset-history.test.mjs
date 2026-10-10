import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAssetHistoryPath, buildAssetOperationHistory } from '../src/features/capital/assetHistory.js';
import { MONEY_SCALE, parseScaled, QUANTITY_SCALE } from '../src/features/capital/decimal.js';

const operation = (id, occurred_on, operation, quantity, unit_price, fee = '0') => ({
  id, occurred_on, operation, quantity, unit_price, fee, created_at: `${occurred_on}T12:00:00Z`,
});

test('asset position history reconstructs fractional quantity and remaining cost basis with buy fees', () => {
  const history = buildAssetOperationHistory([
    operation('2', '2026-10-09', 'sell', '4', '700', '2'),
    operation('1', '2026-10-01', 'buy', '10', '500', '10'),
  ]);
  assert.equal(history.length, 2);
  assert.equal(history[0].quantity, parseScaled('10', QUANTITY_SCALE));
  assert.equal(history[0].costBasis, parseScaled('5010', MONEY_SCALE));
  assert.equal(history[1].quantity, parseScaled('6', QUANTITY_SCALE));
  assert.equal(history[1].costBasis, parseScaled('3006', MONEY_SCALE));
});

test('asset history contains only recorded position transactions and supports two exact series', () => {
  const history = buildAssetOperationHistory([
    operation('3', '2026-10-12', 'dividend', '1', '25'),
    operation('2', '2026-10-10', 'sell', '1.5', '150'),
    operation('1', '2026-10-01', 'buy', '2', '100'),
  ]);
  assert.equal(history.length, 2);
  assert.deepEqual(history.map(row => row.date), ['2026-10-01', '2026-10-10']);
  assert.equal(history[1].quantity, parseScaled('0.5', QUANTITY_SCALE));
  assert.equal(history[1].costBasis, parseScaled('50', MONEY_SCALE));
  assert.match(buildAssetHistoryPath(history, 'quantity').path, /^M12\.0 .*L308\.0 /);
  assert.match(buildAssetHistoryPath(history, 'cost').area, /Z$/);
});

test('asset history chart shows a single real recorded position as one point', () => {
  const history = buildAssetOperationHistory([operation('1', '2026-10-01', 'buy', '0.08', '62000')]);
  const chart = buildAssetHistoryPath(history, 'quantity');
  assert.equal(chart.path, 'M160.0 100.0');
  assert.equal(chart.points.length, 1);
});
