import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
const { PGlite } = createRequire(process.env.DAYRIS_PGLITE_PACKAGE || path.resolve('android/app/build/widget-sql-test/package.json'))('@electric-sql/pglite');
const owner = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';

test('only committed new entries advance the account streak; reads, edits, imports and deletion cannot farm days', async () => {
  const db = new PGlite(); await db.waitReady;
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema public,auth to authenticated,anon;
      insert into auth.users values('${owner}'),('${other}');
      create table public.trades(id bigint generated always as identity primary key,user_id uuid references auth.users(id),date_key text,platform text,comment text);
      create table public.wallet_transactions(id bigint generated always as identity primary key,user_id uuid references auth.users(id),date_key text);
      grant select,insert,update,delete on public.trades,public.wallet_transactions to authenticated;
      grant usage on all sequences in schema public to authenticated;
      alter table public.trades enable row level security;
      create policy own_records on public.trades to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());`);
    await db.exec(await readFile('supabase/migrations/202610260001_account_activity_streaks.sql', 'utf8'));
    // Existing eight-day login streak survives the migration without a bonus.
    await db.exec(`insert into public.account_activity_streaks(user_id,current_streak,last_active_date) values('${owner}',8,(now() at time zone 'UTC')::date);`);
    await db.exec(await readFile('supabase/migrations/202610280001_entry_activity_streaks.sql', 'utf8'));
    const today = (await db.query("select (now() at time zone 'UTC')::date::text as day")).rows[0].day;
    const relative = n => new Date(Date.parse(`${today}T12:00:00Z`) + n * 86400000).toISOString().slice(0,10);
    await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${owner}',false);`);
    const sync = async (...args) => (await db.query('select public.sync_activity_streak($1,$2,$3,$4,false) as state',
      args.length ? args : ['UTC',null,null,null])).rows[0].state;
    const insert = async (platform = 'Manual', date = '2001-01-01') => db.query('insert into public.trades(user_id,platform,date_key) values($1,$2,$3)',[owner,platform,date]);
    let state = await sync();
    assert.equal(state.currentStreak,8); assert.equal(state.paused,true); assert.equal(Boolean(state.completedToday),false);
    for(let i=0;i<3;i++) assert.equal((await sync()).currentStreak,8,'opening does not earn a day');
    assert.equal((await sync('UTC','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',999,today)).currentStreak,8,'old clients cannot import login counters');
    await insert('cTrader'); await insert('MT5'); await insert('MT4');
    assert.equal((await sync()).entryDate,null,'automatic imports do not count');
    await db.exec('begin'); await insert(); await db.exec('rollback');
    assert.equal((await sync()).entryDate,null,'rolled-back saves do not count');
    await insert(); state=await sync();
    assert.equal(state.currentStreak,8,'migration day already credited before release');
    assert.equal(state.entryDate,today,'creation day counts, not a backdated entry date');
    assert.equal(state.completedToday,true); assert.equal(state.paused,false);
    await Promise.all([insert(),insert()]);
    await db.exec("update public.trades set comment='edited'; delete from public.trades;"); await insert();
    assert.equal((await sync()).currentStreak,8,'same-day inserts and delete/recreate cannot duplicate credit');
    for(const [distance,expected] of [[1,9],[2,8],[3,1],[20,1]]){
      await db.exec('reset role');
      await db.query('update public.account_activity_streaks set current_streak=8,last_active_date=$1,last_entry_date=$1 where user_id=$2',[relative(-distance),owner]);
      await db.exec('set role authenticated');
      const before=await sync();
      assert.equal(before.currentStreak,distance>=3?0:8); assert.equal(before.paused,true);
      assert.equal(before.lastActiveDate,relative(-distance),'reads never move the grace period');
      await insert(); state=await sync();
      assert.equal(state.currentStreak,expected); assert.equal(state.paused,false);
      assert.deepEqual(await sync(),state);
    }
    await assert.rejects(db.query('update public.account_activity_streaks set current_streak=999'),/permission denied/);
    await assert.rejects(db.query('select public.continue_streak_after_entry()'),/permission denied/);
    await assert.rejects(db.query('insert into public.trades(user_id) values($1)',[other]),/row-level security/);
    await db.exec(`select set_config('request.jwt.claim.sub','${other}',false)`);
    state=await sync('Pacific/Kiritimati',null,null,null);
    assert.equal(state.currentStreak,0,'new account starts at zero until its first record');
    assert.equal(state.timeZone,'Pacific/Kiritimati');
    await db.query('insert into public.wallet_transactions(user_id,date_key) values($1,$2)',[other,'2030-01-01']);
    state=await sync(); assert.equal(state.currentStreak,1); assert.equal(state.completedToday,true);
    assert.equal(state.entryDate,state.serverDate,'timezone belongs to the account');
    assert.equal(state.timeZone,'Pacific/Kiritimati');
    assert.equal((await db.query('select count(*)::int as n from public.account_activity_streaks')).rows[0].n,1,'RLS isolates account state');
    await db.exec('reset role; set role anon'); await assert.rejects(sync(),/permission denied/);
  } finally { await db.close(); }
});
