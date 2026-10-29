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
    await db.exec(await readFile('supabase/migrations/202610230002_bot_calendar_history.sql','utf8'));
    await db.exec(await readFile('supabase/migrations/202610240001_bot_calendar_analytics.sql','utf8'));
    await db.exec(await readFile('supabase/migrations/202610240002_bot_deal_timestamps.sql','utf8'));
    await db.exec(await readFile('supabase/migrations/202610290020_bot_calendar_stages.sql','utf8'));
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
    for (const privateKey of ['source_account_id','user_id','lease_token','last_error','access_token','balance','account_number','is_live','broker','broker_account_id']) assert.equal(privateKey in data,false);
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
    source=(await db.query("select public.claim_bot_calendar('bot') as value")).rows[0].value;
    assert.equal(source.source_account_id,account);
    await publish(Array.from({length:105},(_,i)=>({...deal,deal_id:String(i+1),date_key:i<55?'2026-10-05':'2026-10-06',pnl:i<55?'1':'2'})));
    await db.exec("insert into public.bot_calendar_deals(calendar_slug,deal_id,date_key,time,instrument,direction,pnl,currency) values('ambiguous','999','2026-10-06','12:00','PRIVATE','LONG',9999,'USD')");
    for(const role of ['anon','authenticated']) {
      await db.exec(`set role ${role}`);
      const query=(from=null,to=null,offset=0)=>db.query('select public.get_bot_calendar_history($1,$2,$3,$4) as value',['bot',from,to,offset]);
      const all=(await query()).rows[0].value;
      assert.equal(all.total,105);assert.equal(all.all_total,105);assert.equal(Number(all.pnl),155);assert.equal(all.trades.length,100);
      assert.equal(all.from,'2026-10-05');assert.equal(all.trades[0].date_key,'2026-10-06');
      const next=(await query(null,null,100)).rows[0].value;
      assert.equal(next.trades.length,5);assert.equal(next.total,105);assert.equal(Number(next.pnl),155);
      assert.equal(new Set([...all.trades,...next.trades].map(t=>t.deal_id)).size,105);
      const filtered=(await query('2026-10-06','2026-10-06')).rows[0].value;
      assert.equal(filtered.total,50);assert.equal(filtered.all_total,105);assert.equal(Number(filtered.pnl),100);
      assert.ok(filtered.trades.every(t=>t.date_key==='2026-10-06'&&t.instrument!=='PRIVATE'));
      for(const [from,to,offset] of [['2026-10-04','2026-10-06',0],['2026-10-06','2026-10-05',0],['2026-10-05','2099-01-01',0],[null,null,-1],[null,null,null]]) await assert.rejects(query(from,to,offset),/PERIOD_OUT_OF_RANGE/);
      const empty=(await query('2026-10-07','2026-10-07')).rows[0].value;
      assert.equal(empty.total,0);assert.equal(empty.pnl,0);assert.deepEqual(empty.trades,[]);
      for(const forbidden of ['account_number','user_id','is_live','broker','source_account_id','access_token']) assert.equal(forbidden in all,false);
      await db.exec('reset role');
    }
    // Analytics must use every closing deal, including intraday peaks, rather
    // than the first page or only the end-of-day curve.
    source=(await db.query("select public.claim_bot_calendar('bot') as value")).rows[0].value;
    if(!source) {
      await db.exec("update public.bot_calendars set lease_until=now()-interval '1 second' where slug='bot'");
      source=(await db.query("select public.claim_bot_calendar('bot') as value")).rows[0].value;
    }
    await publish([
      {...deal,deal_id:'1001',date_key:'2026-10-05',time:'10:00',pnl:'100'},
      {...deal,deal_id:'1002',date_key:'2026-10-05',time:'11:00',pnl:'-60'},
      {...deal,deal_id:'1003',date_key:'2026-10-06',time:'10:00',pnl:'-50'},
      {...deal,deal_id:'1004',date_key:'2026-10-06',time:'11:00',pnl:'30'},
    ]);
    for(const role of ['anon','authenticated']) {
      await db.exec(`set role ${role}`);
      const analytics=async(from=null,to=null)=>(await db.query('select public.get_bot_calendar_analytics($1,$2,$3) as value',['bot',from,to])).rows[0].value;
      const a=await analytics('2026-10-05','2026-10-07');
      assert.equal(a.stats.total,4);assert.equal(a.stats.wins,2);assert.equal(a.stats.losses,2);
      assert.equal(a.stats.pnl,20);assert.equal(a.stats.max_drawdown,110);assert.equal(a.stats.win_rate,50);
      assert.equal(a.stats.gross_profit,130);assert.equal(a.stats.gross_loss,110);assert.equal(a.stats.avg_trade,5);
      assert.ok(Math.abs(Number(a.stats.profit_factor)-130/110)<1e-10);
      assert.equal(a.stats.active_days,2);assert.equal(a.stats.positive_days,1);
      assert.deepEqual(a.curve.map(p=>p.total),[40,20,20]);
      assert.deepEqual(a.curve.map(p=>p.drawdown),[60,110,80]);
      assert.equal(a.curve[2].trades,0,'inactive calendar days are flat, not fabricated trades');
      const filtered=await analytics('2026-10-06','2026-10-06');
      assert.equal(filtered.stats.total,2);assert.equal(filtered.stats.pnl,-20);assert.equal(filtered.stats.max_drawdown,50,'selected period starts at zero');
      const empty=await analytics('2026-10-07','2026-10-07');
      assert.equal(empty.stats.total,0);assert.equal(empty.stats.win_rate,null);assert.equal(empty.stats.profit_factor,null);assert.equal(empty.curve[0].total,0);
      await assert.rejects(analytics('2026-10-04','2026-10-06'),/PERIOD_OUT_OF_RANGE/);
      await assert.rejects(analytics('2026-10-06','2026-10-05'),/PERIOD_OUT_OF_RANGE/);
      for(const forbidden of ['user_id','account_id','account_number','is_live','parameters','Label','RiskPercent'])assert.equal(JSON.stringify(a).includes(`"${forbidden}"`),false);
      await db.exec('reset role');
    }
    source=(await db.query("select public.claim_bot_calendar('bot') as value")).rows[0].value;
    await publish([['9000','100','100'],['10','-60','200'],['8000','-50','300'],['20','30','400']].map(([deal_id,pnl,ms])=>({...deal,deal_id,pnl,time:'13:00',executed_at:`2026-10-05T10:00:00.${ms}Z`})));
    const exact=(await db.query("select public.get_bot_calendar_analytics('bot','2026-10-05','2026-10-05') as value")).rows[0].value;
    assert.equal(exact.timestamp_precision,'execution');assert.equal(exact.stats.max_drawdown,110,'broker instants must override lexicographic and numeric deal-ID order within a minute');
    assert.equal(exact.stats.pnl,20);
    // A budget basis is not a deposit: real money and all prior-stage results
    // remain untouched, while percentages explicitly refer to the risk budget.
    await db.exec("update public.bot_calendars set initial_budget=1000 where slug='bot'");
    const budget=(await db.query("select public.get_bot_calendar_analytics('bot','2026-10-05','2026-10-05') as value")).rows[0].value;
    assert.equal(budget.stats.pnl,20);assert.equal(budget.accounting.basis,'risk_budget');
    assert.equal(budget.accounting.initial_budget,1000);assert.equal(budget.accounting.budget_with_result,1020);
    assert.equal(budget.period_return_percent,2);assert.equal(budget.accounting.return_percent,2);
    await db.exec("update public.bot_calendars set end_date='2026-10-06' where slug='bot'");
    assert.equal((await db.query("select public.claim_bot_calendar('bot') as value")).rows[0].value,null);
    const archived=(await db.query("select public.get_bot_calendar_history('bot') as value")).rows[0].value;
    assert.equal(archived.to,'2026-10-06');assert.equal(archived.total,4);
    await assert.rejects(db.query("select public.get_bot_calendar_history('bot',null,'2026-10-07')"),/PERIOD_OUT_OF_RANGE/);
    await assert.rejects(publish([]),/ARCHIVED_STAGE/);
    await db.exec("update public.bot_calendars set end_date=null,lease_until=null,starts_at='2026-10-05T10:00:00.200Z' where slug='bot'");
    source=(await db.query("select public.claim_bot_calendar('bot') as value")).rows[0].value;
    assert.equal(source.starts_at,'2026-10-05T10:00:00.2+00:00');
    await assert.rejects(publish([{...deal,executed_at:'2026-10-05T10:00:00.100Z'}]),/OUTSIDE_PUBLICATION/);
    for(const role of ['anon','authenticated']) {
      await db.exec(`set role ${role}`);
      for(const sql of ["select public.bot_calendar_raw('bot','2026-10-01')", "select public.bot_stage_context('bot')", "select public.claim_bot_calendar_raw('bot')", "select public.publish_bot_calendar_raw('bot',gen_random_uuid(),'USD','[]')"])
        await assert.rejects(db.query(sql),/permission denied/);
      await db.exec('reset role');
    }
    // Run the actual transition script: copy the whole verified snapshot before
    // clearing the canonical stage, pin the unique admin Live source, rerun safely.
    await db.exec(`create table public.site_admins(user_id uuid);
      create table public.ctrader_tokens(user_id uuid);
      alter table public.ctrader_accounts add column is_active boolean default false;
      insert into public.site_admins values('${owner}');insert into public.ctrader_tokens values('${owner}');
      insert into public.ctrader_accounts values('44444444-4444-4444-8444-444444444444','${owner}','49362144',true,true);
      update public.bot_calendars set lease_until=null where slug='bot';`);
    const rotate=await readFile('supabase/bot-calendar-pipfarm-stage.sql','utf8');
    await db.exec(rotate);await db.exec(rotate);
    const rotation=(await db.query("select calendar_slug,count(*)::int as count,sum(pnl)::float as pnl from public.bot_calendar_deals where calendar_slug in ('bot','bot-stage-1') group by calendar_slug")).rows;
    assert.deepEqual(rotation,[{calendar_slug:'bot-stage-1',count:4,pnl:20}]);
    const newStage=(await db.query("select public.get_bot_calendar('bot','2026-10-01') as value")).rows[0].value;
    assert.equal(newStage.start_date,'2026-10-30');assert.equal(newStage.accounting.initial_budget,1000);
    assert.equal(newStage.accounting.budget_with_result,1000);assert.ok(newStage.periods.some(p=>p.slug==='bot-stage-1'));
    assert.equal(newStage.accounting.return_percent,0);assert.deepEqual(newStage.days,[]);
    assert.equal(JSON.stringify(newStage).includes('49362144'),false);
    const newSource=(await db.query("select public.claim_bot_calendar('bot') as value")).rows[0].value;
    assert.equal(newSource.account_id,'49362144');assert.equal(newSource.is_live,true);
    assert.equal((await db.query("select public.claim_bot_calendar('bot-stage-1') as value")).rows[0].value,null);
  } finally { await db.close(); }
});
