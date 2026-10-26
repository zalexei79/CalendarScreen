import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
const { PGlite } = createRequire(process.env.DAYRIS_PGLITE_PACKAGE || path.resolve('android/app/build/widget-sql-test/package.json'))('@electric-sql/pglite');
const owner = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const devices = ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'];

test('account streak RPC: migration 4→8, daily idempotency, rescue/reset, server time and account isolation', async () => {
  const db = new PGlite(); await db.waitReady;
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema public,auth to authenticated,anon;
      insert into auth.users values('${owner}'),('${other}');`);
    await db.exec(await readFile('supabase/migrations/202610260001_account_activity_streaks.sql', 'utf8'));
    const today = (await db.query("select (now() at time zone 'UTC')::date::text as day")).rows[0].day;
    const relative = offset => new Date(Date.parse(`${today}T12:00:00Z`) + offset * 86400000).toISOString().slice(0, 10);
    await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${owner}',false);`);
    const sync = async (device = null, count = null, date = null, zone = 'UTC') => (await db.query(
      'select public.sync_activity_streak($1,$2,$3,$4,false) as state', [zone, device, count, date])).rows[0].state;
    let state = await sync(devices[0], 4, today);
    assert.equal(state.accountId, owner); assert.equal(state.currentStreak, 4);
    state = await sync(devices[1], 8, today);
    assert.equal(state.currentStreak, 8, 'phone restores 8, not 4+8');
    const parallel = await Promise.all([sync(), sync(), sync()]);
    assert.ok(parallel.every(result => result.currentStreak === 8), 'same-day calls never add extra days');
    assert.equal((await sync(devices[0], 99, today)).currentStreak, 8, 'each device may import only once');
    assert.equal((await sync(devices[2], 100, relative(-3))).currentStreak, 8, 'expired local streak cannot resurrect');
    for (const [distance, count, paused] of [[1, 13, false], [2, 12, true], [3, 1, false]]) {
      await db.exec('reset role');
      await db.query('update public.account_activity_streaks set current_streak=12, last_active_date=$1, paused=false where user_id=$2', [relative(-distance), owner]);
      await db.exec('set role authenticated');
      state = await sync();
      assert.equal(state.currentStreak, count); assert.equal(state.paused, paused);
      assert.deepEqual(await sync(), state, 'repeat on the same day is unchanged');
    }
    assert.equal((await sync(null, null, null, 'Pacific/Honolulu')).timeZone, 'UTC', 'second device cannot change account day boundary');
    await db.exec('reset role');
    await db.query("update public.account_activity_streaks set legacy_import_until=now()-interval '1 day' where user_id=$1", [owner]);
    await db.exec('set role authenticated');
    assert.equal((await sync('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 999, today)).currentStreak, 1, 'migration window is bounded');
    await assert.rejects(db.query('update public.account_activity_streaks set current_streak=999'), /permission denied/);
    await assert.rejects(db.query('delete from public.account_activity_streaks'), /permission denied/);
    await assert.rejects(db.query('select * from public.activity_streak_legacy_imports'), /permission denied/);
    await db.exec(`select set_config('request.jwt.claim.sub','${other}',false)`);
    assert.deepEqual((await db.query('select * from public.account_activity_streaks')).rows, [], 'RLS hides other accounts');
    state = await sync(null, null, null, 'Pacific/Kiritimati');
    assert.equal(state.currentStreak, 1); assert.equal(state.accountId, other);
    assert.equal((await sync(null, null, null, 'Pacific/Honolulu')).timeZone, 'Pacific/Kiritimati');
    assert.equal((await db.query('select count(*)::int as count from public.account_activity_streaks')).rows[0].count, 1);
    await db.exec("select set_config('request.jwt.claim.sub','',false)");
    await assert.rejects(sync(), /AUTH_REQUIRED/);
    await db.exec('reset role; set role anon');
    await assert.rejects(sync(), /permission denied/);
  } finally { await db.close(); }
});
