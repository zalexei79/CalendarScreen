import test from 'node:test';
import assert from 'node:assert/strict';
import { readAccountStreakCache, syncAccountActivityStreak } from '../src/shared/lib/accountActivityStreak.js';
const owner = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const key = `dayris_activity_streak:${owner}`;
function storage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}
function client({ sessionOwner = owner, responseOwner = owner, error = null, beforeResponse = () => {} } = {}) {
  const calls = [];
  return { calls, auth: { getSession: async () => ({ data: { session: { user: { id: sessionOwner }, access_token: `token-${sessionOwner}` } } }) },
    rpc(name, params) {
      const call = { name, params, headers: {} }; calls.push(call);
      const builder = { setHeader(name, value) { call.headers[name] = value; return builder; }, abortSignal(signal) { call.signal = signal; return builder; },
        then(resolve, reject) { return Promise.resolve().then(beforeResponse).then(() => ({ error, data: { accountId: responseOwner,
          currentStreak: 8, lastActiveDate: '2026-10-26', paused: false, timeZone: 'Europe/Bucharest' } })).then(resolve, reject); } };
      return builder;
    } };
}
test('raw local series is imported once, and only confirmed account state is cached', async () => {
  const pc = storage({ [key]: JSON.stringify({ currentStreak: 4, lastActiveDate: '2026-10-26', paused: false }) });
  const api = client();
  assert.equal(readAccountStreakCache(pc, owner), null, 'unconfirmed local days are not presented as synced');
  const sync = () => syncAccountActivityStreak({ client: api, storage: pc, ownerId: owner,
    timeZone: 'Europe/Bucharest', createDeviceId: () => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' });
  assert.equal((await sync()).currentStreak, 8);
  assert.equal(api.calls[0].params.p_legacy_count, 4);
  assert.equal(api.calls[0].params.p_legacy_date, '2026-10-26');
  assert.equal(api.calls[0].headers.Authorization, `Bearer token-${owner}`);
  assert.equal(readAccountStreakCache(pc, owner).currentStreak, 8);
  await sync();
  assert.equal('p_legacy_count' in api.calls[1].params, false);
  assert.equal('user_id' in api.calls[1].params, false);
  assert.equal(readAccountStreakCache(pc, other), null);
});
test('network failures and aborted or mismatched-account replies never overwrite a local series', async () => {
  const original = JSON.stringify({ currentStreak: 8, lastActiveDate: '2026-10-26' });
  for (const options of [{ error: { message: 'offline' } }, { responseOwner: other }, { sessionOwner: other }]) {
    const local = storage({ [key]: original });
    await assert.rejects(syncAccountActivityStreak({ client: client(options), storage: local, ownerId: owner }));
    assert.equal(local.getItem(key), original);
  }
  const abort = new AbortController();
  const local = storage({ [key]: original });
  await assert.rejects(syncAccountActivityStreak({ client: client({ beforeResponse: () => abort.abort() }), storage: local,
    ownerId: owner, signal: abort.signal }), /Aborted/);
  assert.equal(local.getItem(key), original);
});
test('malformed local date is ignored and cannot break the server RPC', async () => {
  const api = client();
  await syncAccountActivityStreak({ client: api, ownerId: owner,
    storage: storage({ [key]: JSON.stringify({ currentStreak: 8, lastActiveDate: '2026-02-31' }) }) });
  assert.equal('p_legacy_date' in api.calls[0].params, false);
});
