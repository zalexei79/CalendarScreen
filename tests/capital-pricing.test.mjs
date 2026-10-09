import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveCurrentPrice } from '../src/features/capital/capitalPricing.js';
import { isGoldApiAsset, normalizeGoldApiQuote } from '../src/features/capital/metalQuotes.js';

test('a Binance asset has no current price until a real market quote arrives', () => {
  assert.equal(resolveCurrentPrice({ quote_source: 'binance', manual_price: '64000', averageCost: '64000' }, null), null);
  assert.equal(resolveCurrentPrice({ quote_source: 'binance', manual_price: '64000' }, { price: '67123.45000000' }), '67123.45000000');
  assert.equal(resolveCurrentPrice({ quote_source: 'binance' }, { price: 'waiting' }), null);
});

test('a manually valued asset uses its saved estimate', () => {
  assert.equal(resolveCurrentPrice({ quote_source: 'manual', manual_price: '2050.25' }, null), '2050.25');
  assert.equal(resolveCurrentPrice({ quote_source: 'manual', manual_price: null }, null), null);
});

test('USD spot metals use a validated Gold API quote and never fall back to a purchase estimate', () => {
  const gold = { category: 'metal', currency: 'USD', symbol: 'XAU', quote_source: 'manual', manual_price: '5' };
  const quote = normalizeGoldApiQuote({ symbol: 'XAU', currency: 'USD', price: 4195.5, updatedAt: '2026-10-09T20:59:44Z' }, 'XAU');
  assert.equal(isGoldApiAsset(gold), true);
  assert.equal(resolveCurrentPrice(gold, null), null);
  assert.equal(resolveCurrentPrice(gold, quote), '4195.5');
  assert.equal(resolveCurrentPrice({ ...gold, currency: 'EUR' }, quote), '5');
  assert.equal(resolveCurrentPrice({ ...gold, symbol: 'CUSTOM' }, quote), '5');
});

test('Gold API quote normalization rejects mismatched, non-USD, non-positive, or timestamp-free data', () => {
  const valid = { symbol: 'XAG', currency: 'USD', price: 60.95, updatedAt: '2026-10-09T20:59:44Z' };
  assert.deepEqual(normalizeGoldApiQuote(valid, 'XAG'), { price: '60.95', at: Date.parse(valid.updatedAt), transport: 'gold-api' });
  assert.equal(normalizeGoldApiQuote({ ...valid, symbol: 'XAU' }, 'XAG'), null);
  assert.equal(normalizeGoldApiQuote({ ...valid, currency: 'EUR' }, 'XAG'), null);
  assert.equal(normalizeGoldApiQuote({ ...valid, price: -1 }, 'XAG'), null);
  assert.equal(normalizeGoldApiQuote({ ...valid, updatedAt: '' }, 'XAG'), null);
});
