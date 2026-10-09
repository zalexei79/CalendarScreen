import test from 'node:test';
import assert from 'node:assert/strict';
import { isTiingoEodAsset, normalizeTiingoEodQuote, toTiingoSymbol, TIINGO_EOD_REFRESH_MS, readTiingoToken, writeTiingoToken, readTiingoQuoteCache, writeTiingoQuoteCache } from '../src/features/capital/tiingoQuotes.js';
import { isTiingoEodQuoteFresh } from '../src/features/capital/quoteStatus.js';
import { resolveCurrentPrice } from '../src/features/capital/capitalPricing.js';
import { readFile } from 'node:fs/promises';

test('Tiingo EOD eligibility is limited to USD stocks and supported ETFs', () => {
  assert.equal(isTiingoEodAsset({ category: 'stock', symbol: 'AAPL', currency: 'USD' }), true);
  assert.equal(isTiingoEodAsset({ category: 'etf', symbol: 'SPY', currency: 'USD' }), true);
  assert.equal(isTiingoEodAsset({ category: 'stock', symbol: 'BRK.B', currency: 'USD' }), true);
  assert.equal(isTiingoEodAsset({ category: 'etf', symbol: 'CSPX', currency: 'USD' }), false);
  assert.equal(isTiingoEodAsset({ category: 'stock', symbol: 'AAPL', currency: 'EUR' }), false);
  assert.equal(isTiingoEodAsset({ category: 'crypto', symbol: 'BTCUSDT', currency: 'USDT' }), false);
});

test('Tiingo symbol and daily quote normalization select the newest valid closing price', () => {
  assert.equal(toTiingoSymbol('BRK.B'), 'BRK-B');
  const quote = normalizeTiingoEodQuote([
    { date: '2026-10-08T00:00:00.000Z', close: 250.125 },
    { date: '2026-10-09T00:00:00.000Z', close: '252.50' },
  ], 'AAPL');
  assert.deepEqual(quote, {
    symbol: 'AAPL', price: '252.50', date: '2026-10-09',
    at: Date.parse('2026-10-09T23:59:59Z'), transport: 'tiingo-eod',
  });
  assert.equal(normalizeTiingoEodQuote([{ date: '2026-10-09', close: '-1' }], 'AAPL'), null);
  assert.equal(normalizeTiingoEodQuote([], 'AAPL'), null);
});

test('EOD prices show a date-based freshness window and resolve as the position price', () => {
  const now = Date.parse('2026-10-10T12:00:00Z');
  const quote = { symbol: 'AAPL', price: '252.50', at: Date.parse('2026-10-09T23:59:59Z'), transport: 'tiingo-eod' };
  assert.equal(isTiingoEodQuoteFresh(quote, now), true);
  assert.equal(isTiingoEodQuoteFresh({ ...quote, at: now - 7 * 24 * 60 * 60_000 }, now), false);
  assert.equal(resolveCurrentPrice({ category: 'stock', symbol: 'AAPL', currency: 'USD', manual_price: '200', quote_source: 'manual' }, quote), '252.50');
  assert.equal(resolveCurrentPrice({ category: 'stock', symbol: 'AAPL', currency: 'USD', manual_price: '200', quote_source: 'manual' }, null), '200');
  assert.equal(TIINGO_EOD_REFRESH_MS, 6 * 60 * 60_000);
});

test('Tiingo token and quote cache are scoped by user and survive only as opaque browser data', () => {
  const storage = {
    values: new Map(),
    getItem(key) { return this.values.get(key) ?? null; },
    setItem(key, value) { this.values.set(key, value); },
    removeItem(key) { this.values.delete(key); },
  };
  writeTiingoToken('user-a', 'token-a', storage);
  assert.equal(readTiingoToken('user-a', storage), 'token-a');
  assert.equal(readTiingoToken('user-b', storage), '');
  writeTiingoQuoteCache('user-a', { quotes: { AAPL: { price: '252.50' } }, attemptedAt: {} }, storage);
  assert.deepEqual(readTiingoQuoteCache('user-a', storage).quotes.AAPL, { price: '252.50' });
  assert.deepEqual(readTiingoQuoteCache('user-b', storage), { quotes: {}, attemptedAt: {}, requestTimes: [], symbolsByMonth: {} });
});

test('Supabase quote function requires a verified user and active PRO before contacting Tiingo', async () => {
  const fn = await readFile(new URL('../supabase/functions/capital-quotes/index.ts', import.meta.url), 'utf8');
  assert.match(fn, /auth\.getUser\(authorization\.slice\(7\)\)/);
  assert.match(fn, /from\('pro_entitlements'\)/);
  assert.match(fn, /if\s*\(!entitlement\).*PRO_REQUIRED/s);
  assert.match(fn, /Authorization: `Token \$\{token\}`/);
  assert.doesNotMatch(fn, /console\.(?:log|info|error)\([^\n]*token/i);
  assert.match(fn, /Cache-Control': 'no-store'/);
});
