import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mapDeal } from '../supabase/functions/kalendar/core.mjs';

const bundle = await build({ entryPoints: ['src/features/trades-sync/lib/tradeMapper.js'], bundle: true, format: 'esm', platform: 'node', write: false });
const { fromSupabaseTradeRow } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const context = { userId: 'user-1', accountId: 'account-1', currency: 'EUR', symbols: new Map([['1', 'EURUSD']]), timeZone: 'UTC' };
function row(dealId, grossProfit) {
  return { ...mapDeal({ dealId, symbolId: 1, tradeSide: 2, dealStatus: 2, executionTimestamp: Date.UTC(2026, 8, 1, 12), closePositionDetail: { grossProfit, moneyDigits: 2 } }, context), id: `row-${dealId}` };
}

test('cloud rows and cache reload retain date, currency, source, ID and signed PnL', () => {
  const rows = [row('1', 5000), row('2', -3200), row('3', 700)];
  const manualTrades = {};
  for (const r of rows) (manualTrades[r.date_key] ||= []).push(fromSupabaseTradeRow(r));
  const reloaded = JSON.parse(JSON.stringify(manualTrades));
  const calendar = reloaded['2026-09-01'].filter(t => t.platform === 'cTrader' && t.currency === 'EUR');
  const history = Object.values(reloaded).flat().filter(t => t.platform === 'cTrader' && t.currency === 'EUR');
  assert.deepEqual(calendar, history);
  assert.equal(calendar.length, 3);
  assert.equal(calendar.reduce((sum, t) => sum + t.pnl, 0), 25);
  assert.deepEqual(calendar.map(t => t.ctrader_deal_id), ['1', '2', '3']);
  assert.ok(calendar.every(t => t.ctrader_account_id === 'account-1'));
});

test('same external deal IDs remain account-scoped; manual records still map', () => {
  const a = row('1', 5000);
  const b = { ...a, ctrader_account_id: 'account-2' };
  const identity = r => [r.user_id, r.ctrader_account_id, r.ctrader_deal_id].join(':');
  const stored = new Map();
  for (const r of [a, b, a, b]) if (!stored.has(identity(r))) stored.set(identity(r), r);
  assert.equal(stored.size, 2);
  assert.equal(fromSupabaseTradeRow({ id: 'manual', pnl: 10, platform: 'Manual', currency: 'USD' }).platform, 'Manual');
});
