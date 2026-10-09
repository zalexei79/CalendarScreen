import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveCurrentPrice } from '../src/features/capital/capitalPricing.js';

test('a Binance asset has no current price until a real market quote arrives', () => {
  assert.equal(resolveCurrentPrice({ quote_source: 'binance', manual_price: '64000', averageCost: '64000' }, null), null);
  assert.equal(resolveCurrentPrice({ quote_source: 'binance', manual_price: '64000' }, { price: '67123.45000000' }), '67123.45000000');
  assert.equal(resolveCurrentPrice({ quote_source: 'binance' }, { price: 'waiting' }), null);
});

test('a manually valued asset uses its saved estimate', () => {
  assert.equal(resolveCurrentPrice({ quote_source: 'manual', manual_price: '2050.25' }, null), '2050.25');
  assert.equal(resolveCurrentPrice({ quote_source: 'manual', manual_price: null }, null), null);
});
