import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { isQuoteFresh, QUOTE_STALE_AFTER_MS } from '../src/features/capital/quoteStatus.js';

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

test('Binance connection recovers after closure or silence and reacts to network changes', async () => {
  const panel = await readFile(new URL('../src/features/capital/CapitalPanel.jsx', import.meta.url), 'utf8');
  assert.match(panel, /socket\.onclose=[\s\S]*?setTimeout\(connect,Math\.min\(30000,1000\*2\*\*Math\.min\(attempt\+\+,5\)\)\)/);
  assert.match(panel, /const endpoints=\['wss:\/\/stream\.binance\.com:443','wss:\/\/stream\.binance\.com:9443','wss:\/\/data-stream\.binance\.vision:443'\]/);
  assert.match(panel, /endpointIndex=\(endpointIndex\+1\)%endpoints\.length/);
  assert.match(panel, /healthTimer=setInterval\([\s\S]*?Date\.now\(\)-lastMessageAt>20000\)socket\.close\(\)/);
  assert.match(panel, /addEventListener\('online',on\)/);
  assert.match(panel, /addEventListener\('offline',off\)/);
  assert.match(panel, /requestAnimationFrame\(\(\)=>\{frame=null;const batch=quoteBuffer\.current/);
  assert.match(panel, /data-api\.binance\.vision\/api\/v3\/ticker\/price\?symbols=/);
});
