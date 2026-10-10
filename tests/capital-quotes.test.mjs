import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { isGoldApiQuoteFresh, GOLD_API_QUOTE_STALE_AFTER_MS, isQuoteFresh, QUOTE_STALE_AFTER_MS } from '../src/features/capital/quoteStatus.js';
import { isGoldApiAsset, normalizeGoldApiQuote } from '../src/features/capital/metalQuotes.js';

test('Binance quote freshness moves to stale after 15 seconds and rejects invalid timestamps', () => {
  const now = 1_800_000_000_000;
  assert.equal(isQuoteFresh({ price: '1.2', at: now }, now), true);
  assert.equal(isQuoteFresh({ price: '1.2', at: now - QUOTE_STALE_AFTER_MS + 1 }, now), true);
  assert.equal(isQuoteFresh({ price: '1.2', at: now - QUOTE_STALE_AFTER_MS }, now), false);
  assert.equal(isQuoteFresh({ price: '1.2', at: now + 4_000 }, now), true);
  assert.equal(isQuoteFresh({ price: '1.2', at: now + 6_000 }, now), false);
  assert.equal(isQuoteFresh({ price: '1.2', at: Number.NaN }, now), false);
  assert.equal(isQuoteFresh(null, now), false);
});

test('Gold API spot quote is fresh for five minutes and stale after that', () => {
  const now = 1_800_000_000_000;
  const quote = { transport: 'gold-api', price: '4195.5', at: now };
  assert.equal(isGoldApiQuoteFresh(quote, now), true);
  assert.equal(isGoldApiQuoteFresh({ ...quote, at: now - GOLD_API_QUOTE_STALE_AFTER_MS + 1 }, now), true);
  assert.equal(isGoldApiQuoteFresh({ ...quote, at: now - GOLD_API_QUOTE_STALE_AFTER_MS }, now), false);
  assert.equal(isGoldApiQuoteFresh({ ...quote, transport: 'rest' }, now), false);
});

test('Gold API copper spot quote is accepted only for a USD metal or commodity position', () => {
  const data = { symbol: 'HG', currency: 'USD', price: 4.25, updatedAt: '2026-10-10T08:00:00Z' };
  assert.deepEqual(normalizeGoldApiQuote(data, 'HG'), { price: '4.25', at: Date.parse(data.updatedAt), transport: 'gold-api' });
  assert.equal(isGoldApiAsset({ category: 'metal', symbol: 'HG', currency: 'USD' }), true);
  assert.equal(isGoldApiAsset({ category: 'commodity', symbol: 'HG', currency: 'USD' }), true);
  assert.equal(normalizeGoldApiQuote({ ...data, currency: 'EUR' }, 'HG'), null);
  assert.equal(normalizeGoldApiQuote(data, 'ALUMINUM'), null);
});

test('Binance connection recovers after closure or silence and reacts to network changes', async () => {
  const panel = await readFile(new URL('../src/features/capital/CapitalPanel.jsx', import.meta.url), 'utf8');
  const metalQuotes = await readFile(new URL('../src/features/capital/metalQuotes.js', import.meta.url), 'utf8');
  assert.match(panel, /socket\.onclose=[\s\S]*?setTimeout\(connect,Math\.min\(30000,1000\*2\*\*Math\.min\(attempt\+\+,5\)\)\)/);
  assert.match(panel, /const endpoints=\['wss:\/\/stream\.binance\.com:443','wss:\/\/stream\.binance\.com:9443','wss:\/\/data-stream\.binance\.vision:443'\]/);
  assert.match(panel, /endpointIndex=\(endpointIndex\+1\)%endpoints\.length/);
  assert.match(panel, /healthTimer=setInterval\([\s\S]*?Date\.now\(\)-lastMessageAt>20000\)socket\.close\(\)/);
  assert.match(panel, /addEventListener\('online',on\)/);
  assert.match(panel, /addEventListener\('offline',off\)/);
  assert.match(panel, /requestAnimationFrame\(\(\)=>\{frame=null;const batch=quoteBuffer\.current/);
  assert.match(panel, /data-api\.binance\.vision\/api\/v3\/ticker\/price\?symbols=/);
  assert.match(metalQuotes, /api\.gold-api\.com\/price/);
  assert.match(panel, /fetchGoldApiQuote\(symbol,controller\.signal\)/);
  assert.match(panel, /setInterval\(\(\)=>void refresh\(\),60_000\)/);
  assert.match(panel, /isGoldApiQuoteFresh\(quotes\[asset\.symbol\],now\)/);
});
