import test from 'node:test';
import assert from 'node:assert/strict';
import { disconnect } from './disconnect.mjs';

test('disconnect touches only own account state and tokens, never trades or account identity', async () => {
  const calls = [];
  const db = { from(table) { return {
    update(values) { calls.push({ table, action: 'update', values }); return this; },
    delete() { calls.push({ table, action: 'delete' }); return this; },
    eq(column, value) { calls.at(-1).filter = [column, value]; return { error: null }; },
  }; } };
  assert.deepEqual(await disconnect(db, 'user-1'), { success: true });
  assert.deepEqual(calls, [
    { table: 'ctrader_accounts', action: 'update', values: { is_active: false }, filter: ['user_id', 'user-1'] },
    { table: 'ctrader_tokens', action: 'delete', filter: ['user_id', 'user-1'] },
  ]);
});

test('disconnect reports database failure and does not claim success', async () => {
  const db = { from() { return { update() { return this; }, eq() { return { error: new Error('private detail') }; } }; } };
  await assert.rejects(disconnect(db, 'user-1'), { message: 'DATABASE_ERROR' });
});

test('disconnect can be repeated when the token is already absent', async () => {
  const db = { from() { return { update() { return this; }, delete() { return this; }, eq() { return { data: [], error: null }; } }; } };
  assert.deepEqual(await disconnect(db, 'user-1'), { success: true });
  assert.deepEqual(await disconnect(db, 'user-1'), { success: true });
});
