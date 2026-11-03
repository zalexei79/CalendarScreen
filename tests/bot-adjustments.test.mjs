import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';
const {PGlite}=createRequire(path.resolve('android/app/build/widget-sql-test/package.json'))('@electric-sql/pglite');
test('owner correction preserves broker ledger, recomputes all public results, discloses range totals and survives reimport',async()=>{
  const db=new PGlite();await db.waitReady;
  try {
    await db.exec('create role anon;create role authenticated;create role service_role bypassrls;grant usage on schema public to anon,authenticated,service_role;create table public.ctrader_accounts(id uuid primary key,user_id uuid,account_id text,is_live boolean);');
    for(const file of ['202610230001_bot_calendar.sql','202610230002_bot_calendar_history.sql','202610240001_bot_calendar_analytics.sql','202610240002_bot_deal_timestamps.sql','202610290020_bot_calendar_stages.sql','202611030020_bot_calendar_adjustments.sql'])await db.exec(await readFile('supabase/migrations/'+file,'utf8'));
    const values=[-30.55,-20.20,-136.24,-17.25,-16.92,-29.88,32.24,-16.48];
    for(let i=0;i<values.length;i++)await db.query("insert into public.bot_calendar_deals(calendar_slug,deal_id,date_key,time,instrument,direction,pnl,currency) values('bot',$1,'2026-10-05','12:00','XAUUSD','LONG',$2,'USD')",[String(i+1),values[i]]);
    await db.exec("update public.bot_calendars set initial_budget=1000;insert into public.bot_calendar_adjustments(calendar_slug,deal_id,reason) values('bot','2','Корректировка владельца: ошибка настройки'),('bot','3','Корректировка владельца: ошибка настройки');");
    for(const role of ['anon','authenticated']){
      await db.exec(`set role ${role}`);
      const month=(await db.query("select public.get_bot_calendar('bot','2026-10-01') as d")).rows[0].d;
      assert.equal(month.days[0].pnl,-78.84);assert.equal(month.days[0].count,6);
      assert.equal(month.adjustments.original_pnl,-235.28);assert.equal(month.adjustments.excluded_pnl,-156.44);
      assert.equal(month.accounting.budget_with_result,921.16);
      const history=(await db.query("select public.get_bot_calendar_history('bot','2026-10-05','2026-10-05') as d")).rows[0].d;
      assert.equal(history.total,6);assert.equal(history.adjustments.original_count,8);assert.equal(history.adjustments.trades.length,2);
      assert.equal(history.pnl,-78.84);
      const analytics=(await db.query("select public.get_bot_calendar_analytics('bot','2026-10-05','2026-10-05') as d")).rows[0].d;
      assert.equal(analytics.stats.pnl,-78.84);assert.equal(analytics.stats.total,6);
      assert.equal(analytics.curve[0].total,-78.84);assert.equal(analytics.adjustments.original_pnl,-235.28);
      const empty=(await db.query("select public.get_bot_calendar_history('bot','2026-10-06','2026-10-06') as d")).rows[0].d;
      assert.equal(empty.adjustments.count,0);
      for(const sql of ['select * from public.bot_calendar_adjustments','select * from public.bot_calendar_performance_deals',"select public.bot_adjustment_summary('bot')"] )await assert.rejects(db.query(sql),/permission denied/);
      await db.exec('reset role');
    }
    assert.equal((await db.query("select count(*)::int as n from public.bot_calendar_deals")).rows[0].n,8);
    // A full snapshot replacement keeps corrections, as they are keyed separately.
    await db.exec("create temp table snapshot as select * from public.bot_calendar_deals;delete from public.bot_calendar_deals;insert into public.bot_calendar_deals select * from snapshot;");
    assert.equal((await db.query("select sum(pnl)::float as pnl from public.bot_calendar_performance_deals")).rows[0].pnl,-78.84);
  }finally{await db.close();}
});
