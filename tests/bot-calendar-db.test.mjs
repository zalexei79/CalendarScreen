import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
const require = createRequire(process.env.DAYRIS_PGLITE_PACKAGE || path.resolve('android/app/build/widget-sql-test/package.json'));
const { PGlite } = require('@electric-sql/pglite');
const owner = '11111111-1111-4111-8111-111111111111';
const account = '22222222-2222-4222-8222-222222222222';
const other = '33333333-3333-4333-8333-333333333333';
const deal = { deal_id: '9223372036854775807', date_key: '2026-10-05', time: '12:00', instrument: 'XAUUSD', direction: 'LONG', pnl: '12.30', currency: 'USD' };

test('public bot snapshot: account pinning, cutoff, atomicity, leases, redaction and read-only roles', async () => {
  const db = new PGlite(); await db.waitReady;
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      grant usage on schema public to anon,authenticated,service_role;
      create table public.ctrader_accounts(id uuid primary key,user_id uuid,account_id text,is_live boolean);
      create table public.trades(user_id uuid,pnl numeric,comment text);
      insert into public.trades values('${owner}',-999,'private journal');
      alter table public.ctrader_accounts enable row level security;
      alter table public.trades enable row level security;`);
    await db.exec(await readFile('supabase/migrations/202610230001_bot_calendar.sql','utf8'));
    // No source exists yet: never invent successful results.
    let source = (await db.query("select public.claim_bot_calendar('bot') as value")).rows[0].value;
    assert.equal(source,null);
    let data = (await db.query("select public.get_bot_calendar('bot','2026-10-01') as value")).rows[0].value;
    assert.equal(data.status,'pending'); assert.deepEqual(data.days,[]);
    await db.query('insert into public.ctrader_accounts values($1,$2,$3,false),($4,$2,$3,true)',[account,owner,'47484897',other]);
    source = (await db.query("select public.claim_bot_calendar('bot') as value")).rows[0].value;
    assert.equal(source.source_account_id,account); assert.equal(source.user_id,owner);
    assert.equal(source.account_id,'47484897'); assert.equal(source.is_live,false);
    assert.equal((await db.query("select public.claim_bot_calendar('bot') as value")).rows[0].value,null,'a second worker cannot claim the same source');
    const publish = rows => db.query('select public.publish_bot_calendar($1,$2,$3,$4) as count',['bot',source.lease_token,'USD',JSON.stringify(rows)]);
    await assert.rejects(publish([{...deal,date_key:'2026-10-04'}]),/OUTSIDE_PUBLICATION/);
    await assert.rejects(publish([{...deal,currency:'EUR'}]),/OUTSIDE_PUBLICATION/);
    await publish([deal]);
    await assert.rejects(publish([]),/LEASE_EXPIRED/);
    data = (await db.query("select public.get_bot_calendar('bot','2026-10-01') as value")).rows[0].value;
    assert.equal(data.status,'ready'); assert.equal(data.days.length,1); assert.equal(Number(data.days[0].pnl),12.3);
    assert.equal(data.days[0].count,1);
    for (const privateKey of ['source_account_id','user_id','lease_token','last_error','access_token','balance']) assert.equal(privateKey in data,false);
    assert.equal((await db.query("select public.get_bot_calendar('missing','2026-10-01') as value")).rows[0].value,null);
    await assert.rejects(db.query("select public.get_bot_calendar('bot','2026-09-01')"),/MONTH_OUT_OF_RANGE/);
    await assert.rejects(db.query("select public.get_bot_calendar_day('bot','2026-10-04')"),/DAY_OUT_OF_RANGE/);
    await assert.rejects(db.query("select public.get_bot_calendar_day('bot','2026-10-05',-1)"),/DAY_OUT_OF_RANGE/);
    // Duplicate ID aborts the replacement; the original snapshot survives.
    source = (await db.query("select public.claim_bot_calendar('bot') as value")).rows[0].value;
    await assert.rejects(publish([deal,deal]),/duplicate key/);
    assert.equal((await db.query('select count(*)::int as n from public.bot_calendar_deals')).rows[0].n,1);
    await db.query('select public.fail_bot_calendar($1,$2,$3)',['bot',source.lease_token,'CTRADER_TIMEOUT']);
    assert.equal((await db.query("select public.get_bot_calendar('bot','2026-10-01') as value")).rows[0].value.status,'delayed');
    for (const role of ['anon','authenticated']) {
      await db.exec(`set role ${role}`);
      data = (await db.query("select public.get_bot_calendar_day('bot','2026-10-05') as value")).rows[0].value;
      assert.equal(data.total,1); assert.equal(data.trades[0].deal_id,deal.deal_id);
      assert.equal('comment' in data.trades[0],false);
      for (const sql of ['select * from public.bot_calendars','select * from public.bot_calendar_deals',
        'select * from public.ctrader_accounts','select * from public.trades',
        "select public.claim_bot_calendar('bot')",
        "select public.publish_bot_calendar('bot',gen_random_uuid(),'USD','[]')",
        "delete from public.bot_calendar_deals"]) await assert.rejects(db.query(sql),/permission denied/);
      await db.exec('reset role');
    }
    // Reruns replace the broker projection rather than duplicating it.
    source = (await db.query("select public.claim_bot_calendar('bot') as value")).rows[0].value;
    await publish([deal]);
    assert.equal((await db.query('select count(*)::int as n from public.bot_calendar_deals')).rows[0].n,1);
    assert.equal((await db.query('select comment from public.trades')).rows[0].comment,'private journal');
    // Fixed binding survives a duplicate account row; a new unbound publication fails closed.
    await db.query('insert into public.ctrader_accounts values(gen_random_uuid(),$1,$2,false)',[other,'47484897']);
    await db.exec("insert into public.bot_calendars(slug,title,broker_account_id,is_live,start_date) values('ambiguous','Test','47484897',false,'2026-10-05')");
    assert.equal((await db.query("select public.claim_bot_calendar('ambiguous') as value")).rows[0].value,null);
    assert.equal((await db.query("select public.claim_bot_calendar('bot') as value")).rows[0].value.source_account_id,account);
  } finally { await db.close(); }
});
