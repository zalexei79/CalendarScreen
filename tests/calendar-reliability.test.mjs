import test from 'node:test';
import assert from 'node:assert/strict';
import { projectPlansForDay, loadFinancePlans } from '../src/features/reminders/financePlanModel.js';
import { selectCalendarExport, calendarExportRows } from '../src/features/trades-sync/lib/calendarExport.js';
import { previousPeriod } from '../src/features/trades-sync/lib/periodComparison.mjs';
import { formatDateLabel } from '../src/shared/lib/dateUtils.js';
import { calendarActions } from '../src/shared/i18n/calendarActions.js';

const series = { id:'plan', local_at:'2026-10-01 09:00:00', status:'active', outcome:'planned', repeat_rule:'monthly', repeat_total:2, repeat_index:1 };
test('finite repeats stop at the final payment and retain the server payment index', () => {
  assert.equal(projectPlansForDay([series],'2026-10-01')[0],series);
  assert.equal(projectPlansForDay([series],'2026-11-01')[0].repeat_index,2);
  assert.deepEqual(projectPlansForDay([series],'2026-12-01'),[]);
  assert.deepEqual(projectPlansForDay([series],'2027-10-01'),[]);
  const advanced={...series,repeat_index:4,repeat_total:5};
  assert.equal(projectPlansForDay([advanced],'2026-11-01')[0].repeat_index,5);
  assert.deepEqual(projectPlansForDay([advanced],'2026-12-01'),[]);
});
test('weekly/monthly/yearly projections respect dates, end dates and resolved events', () => {
  const monthly={...series,local_at:'2026-01-31 09:00:00',repeat_total:null};
  assert.equal(projectPlansForDay([monthly],'2026-02-28').length,1);
  assert.equal(projectPlansForDay([monthly],'2026-03-31').length,1);
  assert.equal(projectPlansForDay([{...series,repeat_rule:'weekly'}],'2026-10-08')[0].repeat_index,2);
  assert.deepEqual(projectPlansForDay([{...series,repeat_rule:'weekly'}],'2026-10-09'),[]);
  assert.equal(projectPlansForDay([{...series,local_at:'2024-02-29 09:00:00',repeat_rule:'yearly'}],'2025-02-28')[0].repeat_index,2);
  assert.deepEqual(projectPlansForDay([{...series,repeat_until:'2026-10-31'}],'2026-11-01'),[]);
  assert.deepEqual(projectPlansForDay([{...series,outcome:'completed'}],'2026-11-01'),[]);
});
test('plan loading traverses every page with deterministic ordering, and rejects partial snapshots', async () => {
  const all=Array.from({length:1101},(_,i)=>({id:String(i)})),ranges=[],orders=[];
  let fail=false;
  const client={from:()=>{
    const q={select:()=>q,eq:(_,id)=>{assert.equal(id,'owner');return q},order:(key)=>{orders.push(key);return q},
      range:async(a,b)=>{ranges.push([a,b]);return fail&&a>0?{error:new Error('offline')}:{data:all.slice(a,b+1)};}};
    return q;
  }};
  assert.equal((await loadFinancePlans(client,'owner')).length,1101);
  assert.deepEqual(ranges,[[0,499],[500,999],[1000,1499]]);
  assert.deepEqual(orders,['local_at','id','local_at','id','local_at','id']);
  fail=true;await assert.rejects(loadFinancePlans(client,'owner'),/offline/);
});
test('CSV selection retains every history filter; full export is explicit and dates/currencies remain lossless', () => {
  const a={id:'food',dateKey:'2025-10-01',pnl:-12.34,currency:'USD',instrument:'Food'};
  const b={id:'trade',dateKey:'2026-10-01',pnl:23.45,currency:'EUR',instrument:'EURUSD'};
  const records={'2025-10-01':[a],'2026-10-01':[b]};
  const args={records,filteredRecords:[a],from:'2025-01-01',to:'2026-12-31'};
  assert.deepEqual(selectCalendarExport({...args,scope:'selection'}),[a]);
  assert.deepEqual(selectCalendarExport({...args,scope:'all'}).map(t=>t.id),['trade','food']);
  const rows=calendarExportRows([a,b],{type:t=>t.pnl<0?'expense':'income',fallbackCategory:'Other'});
  assert.deepEqual(rows.map(row=>[row[0],row[4],row[5]]),[['2025-10-01','-12.34','USD'],['2026-10-01','23.45','EUR']]);
});
test('period comparison uses equal calendar-day ranges across both DST boundaries', () => {
  assert.deepEqual(previousPeriod('2026-04-01','2026-04-30'),{from:'2026-03-02',to:'2026-03-31'});
  assert.deepEqual(previousPeriod('2026-11-01','2026-11-30'),{from:'2026-10-02',to:'2026-10-31'});
});
test('calendar dates and action copy follow every supported locale', () => {
  for(const language of ['ru','en','ro','md','uk','zh-CN']) {
    assert.equal(typeof calendarActions(language).retry,'string');
    assert.ok(formatDateLabel('2026-10-01',language).length>0);
  }
  assert.match(formatDateLabel('2026-10-01','en'),/Oct/);
  assert.match(formatDateLabel('2026-10-01','uk'),/жовт/);
  assert.deepEqual(calendarActions('md'),calendarActions('ro'));
});
