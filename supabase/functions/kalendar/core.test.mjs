import test from 'node:test';
import assert from 'node:assert/strict';
import { id, mapDeal, parseMessage, readDeals } from './core.mjs';

const context = { userId: 'user', accountId: 'account', currency: 'EUR',
  symbols: new Map([['12', 'EURUSD']]), timeZone: 'UTC' };
const deal = { dealId: '9223372036854775800', symbolId: 12, tradeSide: 2, dealStatus: 2,
  executionTimestamp: Date.UTC(2026, 0, 2, 3, 4),
  closePositionDetail: { grossProfit: 12345, swap: -100, commission: -200, pnlConversionFee: 5, moneyDigits: 2 } };

test('large protocol IDs remain exact; quoted strings are untouched', () => {
  assert.deepEqual(parseMessage('{"dealId":9223372036854775800,"name":"12345678901234567","n":2}'),
    { dealId: '9223372036854775800', name: '12345678901234567', n: 2 });
  assert.throws(() => id(9223372036854775800));
});
test('closed deal maps to existing schema with exact money and account currency', () => {
  assert.deepEqual(mapDeal(deal, context), {
    user_id: 'user', ctrader_account_id: 'account', ctrader_deal_id: deal.dealId,
    date_key: '2026-01-02', time: '03:04', instrument: 'EURUSD', direction: 'LONG',
    pnl: '120.40', currency: 'EUR', platform: 'cTrader', comment: '',
  });
});
test('partial closing BUY maps to SHORT; opening and rejected deals are excluded', () => {
  assert.equal(mapDeal({ ...deal, dealStatus: 3, tradeSide: 1 }, context).direction, 'SHORT');
  assert.equal(mapDeal({ ...deal, closePositionDetail: undefined }, context), null);
  assert.equal(mapDeal({ ...deal, dealStatus: 4 }, context), null);
});
test('timezone date boundary is explicit and money is not rounded to cents', () => {
  const row = mapDeal({ ...deal, executionTimestamp: Date.UTC(2026, 0, 2, 23, 30),
    closePositionDetail: { grossProfit: '-123456789', moneyDigits: 8 } },
  { ...context, timeZone: 'Europe/Bucharest' });
  assert.equal(row.date_key, '2026-01-03');
  assert.equal(row.time, '01:30');
  assert.equal(row.pnl, '-1.23456789');
});
test('missing currency and malformed money cannot silently become USD or NaN', () => {
  assert.throws(() => mapDeal(deal, { ...context, currency: null }));
  assert.throws(() => mapDeal({ ...deal, closePositionDetail: { grossProfit: 'bad' } }, context));
});
test('truncated history is recursively split without dropping boundaries', async () => {
  const ranges = [];
  const result = await readDeals(async (from, to) => {
    ranges.push([from, to]);
    return { hasMore: from !== to, deal: [from] };
  }, 0, 3);
  assert.deepEqual(result, [0, 1, 2, 3]);
  assert.deepEqual(ranges[0], [0, 3]);
});
test('unresolvable truncation and request budget are explicit failures', async () => {
  await assert.rejects(readDeals(async () => ({ hasMore: true }), 1, 1), /HISTORY_TRUNCATED/);
  await assert.rejects(readDeals(async () => ({ hasMore: true }), 0, 10, { remaining: 1 }), /HISTORY_TOO_LARGE/);
});
