import test from 'node:test';
import assert from 'node:assert/strict';
import { balanceSnapshot, accountBalances } from './balances.mjs';
test('balance scale, zero, currency and int64 precision', () => {
  const assets = [{ assetId: '1', name: 'USD' }];
  assert.equal(balanceSnapshot({ balance: 0, depositAssetId: 1 }, assets).balance, '0.00');
  assert.equal(balanceSnapshot({ balance: '10053099944', moneyDigits: 8, depositAssetId: 1 }, assets).balance, '100.53099944');
  assert.equal(balanceSnapshot({ balance: '9007199254740993', moneyDigits: 2, depositAssetId: 1 }, assets).balance, '90071992547409.93');
  assert.equal(balanceSnapshot({ balance: '-123', depositAssetId: 1 }, assets).balance, '-1.23');
  assert.equal(balanceSnapshot({ balance: 10 }, assets), null);
});
test('unavailable account does not block another account, uses correct environment', async () => {
  const environments = [];
  const result = await accountBalances([{ account_id: '1', is_live: true }, { account_id: '2', is_live: false }], async live => {
    environments.push(live);
    return { close() {}, async request(type) {
      if (live) throw Error('private upstream message');
      if (type === 2121) return { trader: { balance: 12300, depositAssetId: 1 } };
      if (type === 2112) return { asset: [{ assetId: 1, name: 'EUR' }] };
      return {};
    } };
  }, 'not-a-real-token');
  assert.deepEqual(environments, [true, false]);
  assert.equal(result[0].balance, null);
  assert.equal(result[1].balance, '123.00');
  assert.equal(result[1].currency, 'EUR');
});
test('timeout returns unavailable and closes a late connection', async () => {
  let closed = false;
  const result = await accountBalances([{ account_id: '1' }], async () => {
    await new Promise(resolve => setTimeout(resolve, 30));
    return { close() { closed = true; }, request() { throw Error('must not request'); } };
  }, 'not-a-real-token', 5);
  assert.equal(result[0].balance, null);
  await new Promise(resolve => setTimeout(resolve, 40));
  assert.equal(closed, true);
});
