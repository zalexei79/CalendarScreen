import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require=createRequire(process.env.DAYRIS_PLAYWRIGHT_PACKAGE || 'C:/Users/aveel/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const {chromium,webkit}=require('playwright');
const build=createRequire(path.resolve('package.json'))('esbuild').build;
const bundle=await build({stdin:{resolveDir:process.cwd(),loader:'jsx',contents:`
import React,{useState} from 'react';import {createRoot} from 'react-dom/client';
import {useTrades} from './src/features/trades-sync/hooks/useTrades.js';
import {useFinancePlans} from './src/features/reminders/useFinancePlans.js';
import {useLocalToday} from './src/shared/ui/useLocalToday.js';
import {useCalendarDayHistory} from './src/shared/ui/useCalendarDayHistory.js';
import PlanList from './src/features/reminders/FinancePlanList.jsx';
import Currency from './src/shared/ui/CalendarCurrencyPicker.jsx';
function App(){const [id,setOwner]=useState('22222222-2222-4222-8222-222222222222'),[day,setDay]=useState(null);
 const trades=useTrades({user:{id}}),plans=useFinancePlans({user:{id},language:'uk'}),today=useLocalToday();useCalendarDayHistory(day,setDay);
 window.app={trades,plans,today,day,id,setOwner,setDay};
 return <main><output id="day">{day||'closed'}</output><output id="today">{today.getDate()}</output><p role="alert">{plans.error}</p>
 <Currency language="uk" currency="USD" onChange={()=>{}}/><PlanList language="uk" plans={[{id:'visible',title:'Оренда',local_at:'2026-10-27 09:00:00',status:'active',outcome:'planned'}]} todayKey="2026-10-26" onEdit={()=>{}} onDelete={()=>{}}/></main>};createRoot(document.getElementById('root')).render(<App/>);`},bundle:true,write:false,outfile:'calendar.js',define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'mock-db',setup(b){b.onResolve({filter:/supabaseClient$/},()=>({path:'mock-db',namespace:'audit'}));b.onLoad({filter:/.*/,namespace:'audit'},()=>({loader:'js',contents:`
export const supabase={from:table=>{const request={table,action:'select',filters:{}};const q={select:()=>q,eq:(k,v)=>{request.filters[k]=v;return q},order:()=>q,range:(a,b)=>{request.range=[a,b];return q},update:updates=>{request.action='update';request.updates=updates;return q},delete:()=>{request.action='delete';return q},then:(resolve,reject)=>Promise.resolve().then(()=>window.mockRequest(request)).then(resolve,reject)};return q},channel:name=>{const c={on:(_,filter,callback)=>{window.channels[name]=callback;return c},subscribe:()=>c};return c},removeChannel:()=>{}};`}))}}]});
const js=bundle.outputFiles.find(f=>f.path.endsWith('.js')).text,css=bundle.outputFiles.find(f=>f.path.endsWith('.css'))?.text||'';
const browser=await (process.env.DAYRIS_TEST_WEBKIT?webkit.launch({headless:true}):chromium.launch({channel:'msedge',headless:true}));
try{
 const page=await browser.newPage({timezoneId:'Europe/Bucharest'});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  window.channels={};window.requests=[];window.holds=[];window.config={rejectWrites:true,failPlans:false,holdWrites:false,holdPlans:false};
  window.mockRequest=request=>{
   requests.push(request);
   const owner=request.filters.user_id,isA=owner==='22222222-2222-4222-8222-222222222222';
   const response=()=>{
    if(request.table==='reminders'){
     if(config.failPlans)return {error:{message:'network failure'}};
     const rows=Array.from({length:isA?1101:1},(_,i)=>({id:owner+'-plan-'+i,title:'Plan '+i,local_at:'2026-10-27 09:00:00',status:'active',outcome:'planned'}));
     return {data:rows.slice(request.range[0],request.range[1]+1)};
    }
    if(request.action!=='select')return config.networkFailure?{error:{message:'network failure'}}:config.rejectWrites?{error:{message:'permission denied',code:'42501'}}:{data:null,error:null};
    return {data:[{id:'server-row',date_key:'2026-10-26',pnl:isA?10:20,instrument:isA?'Original':'Second owner',currency:'USD',time:'12:00',platform:'Manual'}]};
   };
   if((config.holdWrites&&request.action!=='select')||(config.holdPlans&&request.table==='reminders'))return new Promise(resolve=>holds.push(()=>resolve(response())));
   return response();
  };
 });
 await page.route('http://calendar-hooks.test/**',r=>r.fulfill({contentType:'text/html',body:`<!doctype html><meta charset="utf-8"><style>${css}</style><div id="root"></div><script>${js}</script>`}));
 await page.clock.install({time:new Date('2026-10-26T21:59:00Z')});
 await page.goto('http://calendar-hooks.test');
 await page.waitForFunction(()=>window.app?.plans.plans.length===1101&&app.trades.manualTrades['2026-10-26']?.[0]?.pnl===10);
 const save=async(value)=>page.evaluate(async value=>{try{await app.trades.saveTrade({dateKey:'2026-10-26',isEditing:true,editingTradeId:'server-row',time:'12:00',instrument:'Changed',signedPnl:value,platform:'Manual',currency:'USD'});return null}catch(e){return e.message}},value);
 assert.equal(await save(999),'permission denied');
 await page.waitForFunction(()=>app.trades.manualTrades['2026-10-26'][0]?.pnl===10);
 assert.equal(await page.evaluate(()=>app.trades.pendingSyncCount),0);
 const removeError=await page.evaluate(async()=>{try{await app.trades.deleteTrade('2026-10-26','server-row')}catch(e){return e.message}});
 assert.equal(removeError,'permission denied');await page.waitForFunction(()=>app.trades.manualTrades['2026-10-26'].length===1);
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('money_calendar_trades_22222222-2222-4222-8222-222222222222'))['2026-10-26'][0].pnl),10);
 // A late refusal must not roll back a newer successful edit.
 await page.evaluate(()=>{config.holdWrites=true;window.firstSave=app.trades.saveTrade({dateKey:'2026-10-26',isEditing:true,editingTradeId:'server-row',instrument:'Older edit',signedPnl:999,currency:'USD'}).catch(()=>{})});
 await page.waitForFunction(()=>holds.length===1);
 await page.evaluate(()=>{config.holdWrites=false;config.rejectWrites=false});
 assert.equal(await save(25),null);await page.waitForFunction(()=>app.trades.manualTrades['2026-10-26'][0].pnl===25);
 await page.evaluate(async()=>{config.rejectWrites=true;holds.shift()();await firstSave});
 assert.equal(await page.evaluate(()=>app.trades.manualTrades['2026-10-26'][0].pnl),25);
 // Retryable network errors stay queued and retain the entered value.
 await page.evaluate(()=>{config.networkFailure=true});assert.equal(await save(77),null);
 await page.waitForFunction(()=>app.trades.pendingSyncCount===1);
 assert.equal(await page.evaluate(()=>app.trades.manualTrades['2026-10-26'][0].pnl),77);
 await page.evaluate(()=>{config.networkFailure=false;config.rejectWrites=false;window.dispatchEvent(new Event('online'))});
 await page.waitForFunction(()=>app.trades.pendingSyncCount===0);
 // A failed background refresh retains the last complete plan snapshot.
 await page.evaluate(()=>{config.failPlans=true;window.dispatchEvent(new Event('focus'))});
 await page.waitForFunction(()=>app.plans.error);
 assert.equal(await page.evaluate(()=>app.plans.plans.length),1101);
 assert.ok(await page.getByRole('alert').innerText());
 await page.evaluate(()=>{config.failPlans=false;window.dispatchEvent(new Event('online'))});
 await page.waitForFunction(()=>!app.plans.error&&!app.plans.loading);
 // Browser Back and manual close consume one day entry instead of growing history.
 const initialLength=await page.evaluate(()=>history.length);
 await page.evaluate(()=>app.setDay('2026-10-26'));await page.waitForFunction(()=>history.state?.calendarDay==='2026-10-26');
 await page.evaluate(()=>history.back());await page.waitForFunction(()=>app.day===null);
 for(let i=0;i<3;i++){
  await page.evaluate(()=>app.setDay('2026-10-26'));await page.waitForFunction(()=>history.state?.calendarDay==='2026-10-26');
  await page.evaluate(()=>app.setDay(null));await page.waitForFunction(()=>!history.state?.calendarDay);
 }
 assert.equal(await page.evaluate(()=>history.length),initialLength+1);
 // Local midnight runs without blur/focus, including the 25-hour DST day.
 await page.clock.fastForward(120000);await page.waitForFunction(()=>app.today.getDate()===27);
 await page.clock.setSystemTime(new Date('2026-10-24T20:59:00Z'));await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
 await page.clock.fastForward(120000);await page.waitForFunction(()=>app.today.getDate()===25);
 await page.clock.fastForward(25*60*60*1000);await page.waitForFunction(()=>app.today.getDate()===26);
 // In-flight responses from another account cannot change the new account.
 await page.evaluate(()=>{config.holdWrites=true;config.holdPlans=true;app.plans.refreshPlans().catch(()=>{});window.pendingSave=app.trades.saveTrade({dateKey:'2026-10-26',isEditing:true,editingTradeId:'server-row',instrument:'Old owner',signedPnl:999,currency:'USD'}).catch(()=>{})});
 await page.waitForFunction(()=>holds.length>=2);
 await page.evaluate(()=>{config.holdPlans=false;app.setOwner('33333333-3333-4333-8333-333333333333')});
 await page.waitForFunction(()=>app.trades.manualTrades['2026-10-26']?.[0]?.pnl===20&&app.plans.plans.length===1);
 await page.evaluate(async()=>{config.holdWrites=false;config.rejectWrites=false;for(const release of holds.splice(0))release();await pendingSave});
 await page.waitForTimeout(100);
 assert.equal(await page.evaluate(()=>app.trades.manualTrades['2026-10-26'][0].pnl),20);
 assert.equal(await page.evaluate(()=>app.plans.plans.length),1);
 assert.equal(await page.getByText('Плани на цей день',{exact:true}).count(),1);
 await page.getByRole('button',{name:'Валюта календаря: USD',exact:true}).click();
 assert.equal(await page.getByText('Інші валюти',{exact:true}).count(),1);
 assert.deepEqual(errors,[]);
 console.log('PASS: rejected edit/delete rollback, 1101 plans, refresh error/recovery, history close/back, local midnight and DST, stale account responses, Ukrainian plan/currency labels.');
} finally {await browser.close()}
