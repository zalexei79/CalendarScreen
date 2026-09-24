import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateWalletBalance, filterWalletTransactions } from '../src/features/wallet/lib/walletModel.mjs';

test('wallet balance is isolated by currency and income/expense kind', () => {
  const rows = [
    { amount: 100, kind: 'income', currency: 'USD' },
    { amount: 25.5, kind: 'expense', currency: 'USD' },
    { amount: 500, kind: 'income', currency: 'EUR' },
  ];
  assert.equal(calculateWalletBalance(rows, 'USD'), 74.5);
  assert.equal(calculateWalletBalance(rows, 'EUR'), 500);
  assert.equal(filterWalletTransactions(rows, 'USD').length, 2);
});
