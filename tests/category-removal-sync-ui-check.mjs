import {createRequire} from 'node:module';import path from 'node:path';import assert from 'node:assert/strict';
const owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
const bundle=await createRequire(path.resolve('package.json'))('esbuild').build({stdin:{resolveDir:process.cwd(),loader:'jsx',contents:`
import React,{useState} from 'react';import {createRoot} from 'react-dom/client';import {useTrades} from './src/features/trades-sync/hooks/useTrades.js';
function App(){const[user,setUser]=useState({id:'${owner}'});const trades=useTrades({user});window.store=trades;window.switchOwner=id=>setUser({id});return <output>{JSON.stringify(trades.manualTrades)}</output>;}
createRoot(document.getElementById('root')).render(<App/>);
`},plugins:[{name:'mock-cloud',setup(build){build.onResolve({filter:/supabaseClient$/},()=>({path:'mock-cloud',namespace:'mock'}));build.onLoad({filter:/.*/,namespace:'mock'},()=>({loader:'js',contents:`
export const supabase={channel(){return {on(){return this},subscribe(){return this}}},removeChannel(){},from(){
 const query={kind:'select',filters:{},select(){return this},order(){return this},range(){return this},eq(key,value){this.filters[key]=value;return this},update(updates){this.kind='update';this.updates=updates;return this},insert(trade){this.kind='insert';this.trade=trade;return this},single(){return this},
 then(resolve,reject){return (async()=>{
  if(this.kind==='update'){
   window.requests.push({updates:this.updates,filters:this.filters});
   if(window.pauseUpdates)await new Promise(done=>window.releaseUpdates.push(done));
   if(window.failUpdates)return {error:{message:'permission denied'}};
   window.backend=window.backend.map(row=>Object.entries(this.filters).every(([key,value])=>row[key]===value)?{...row,...this.updates}:row);
   return {error:null};
  }
  if(this.kind==='insert'){const row={...this.trade,id:'confirmed-temp'};window.backend.push(row);return {data:row,error:null};}
  return {data:window.backend.filter(row=>Object.entries(this.filters).every(([key,value])=>row[key]===value)),error:null};
 })().then(resolve,reject);}};return query;
}};
`}))}}],bundle:true,write:false,outfile:'sync.js',format:'iife'});
const browser=await createRequire(process.env.DAYRIS_PLAYWRIGHT_PACKAGE||import.meta.url)('playwright').chromium.launch({channel:'msedge',headless:true});
try{
 const context=await browser.newContext();
 await context.addInitScript(({owner,other})=>{
  Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>window.online||false});
  window.online=false;window.requests=[];window.releaseUpdates=[];
  window.backend=[{id:'a',user_id:owner,date_key:'2026-10-01',time:'10:00',instrument:'СОК',pnl:-80,currency:'MDL',platform:'Manual',direction:'SHORT',comment:'яблочный'},
   {id:'b',user_id:owner,date_key:'2026-10-01',instrument:'Сок',pnl:30,currency:'EUR',platform:'Manual',direction:'LONG',comment:''},
   {id:'c',user_id:owner,date_key:'2026-10-01',instrument:'Сок',pnl:500,currency:'USD',platform:'cTrader',direction:'LONG',comment:''},
   {id:'foreign',user_id:other,date_key:'2026-10-01',instrument:'Сок',pnl:-900,currency:'USD',platform:'Manual'}];
  const temp={id:'local-temp',time:'11:00',instrument:'Сок',pnl:-10,currency:'USD',platform:'Manual',direction:'SHORT',comment:'offline',pending:true};
  localStorage.setItem('money_calendar_trades_'+owner,JSON.stringify({'2026-10-01':[...window.backend.filter(row=>row.user_id===owner),temp]}));
  localStorage.setItem('atj_offline_queue',JSON.stringify([{action:'insert',user_id:owner,tempId:temp.id,date_key:'2026-10-01',trade:{user_id:owner,date_key:'2026-10-01',...temp}},
   {action:'update',user_id:other,tradeId:'foreign',date_key:'2026-10-01',updates:{instrument:'Чужой раздел'}}]));
 },{owner,other});
 const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.route('http://category-sync.test/**',route=>route.fulfill({contentType:'text/html',body:`<meta charset="UTF-8"><div id="root"></div><script>${bundle.outputFiles[0].text}</script>`}));
 await page.goto('http://category-sync.test');await page.waitForFunction(()=>window.store?.manualTrades['2026-10-01']?.length===4);
 const initial=await page.evaluate(()=>window.store.manualTrades);
 await page.evaluate(()=>store.detachMoneyCategory('сок',item=>item.platform==='Manual'));
 await page.waitForFunction(()=>store.manualTrades['2026-10-01'].filter(row=>row.instrument==='Другое').length===3);
 const local=await page.evaluate(()=>store.manualTrades);assert.deepEqual(local,{'2026-10-01':initial['2026-10-01'].map(row=>row.platform==='Manual'?{...row,instrument:'Другое'}:row)});
 const queue=await page.evaluate(()=>JSON.parse(localStorage.getItem('atj_offline_queue')));
 for(const item of queue.filter(item=>item.user_id===owner&&item.action==='update'))assert.deepEqual(item.updates,{instrument:'Другое'});
 assert.equal(queue.find(item=>item.tempId==='local-temp').trade.instrument,'Другое');assert.equal(queue.filter(item=>item.action==='delete').length,0);
 assert.deepEqual(queue.find(item=>item.user_id===other).updates,{instrument:'Чужой раздел'});
 // A cloud refresh during an unfinished label update preserves the label but
 // still accepts another device's latest amount.
 await page.evaluate(()=>{window.pauseUpdates=true;window.online=true;window.backend.find(row=>row.id==='a').pnl=-125;dispatchEvent(new Event('online'));});
 await page.waitForFunction(()=>window.requests.length>0);
 await page.evaluate(()=>store.refreshFromCloud());
 await page.waitForFunction(()=>store.manualTrades['2026-10-01'].some(row=>row.id==='a'&&row.pnl===-125&&row.instrument==='Другое'));
 await page.evaluate(()=>{window.pauseUpdates=false;for(const release of window.releaseUpdates)release();});
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('atj_offline_queue')).every(item=>item.user_id!== '11111111-1111-4111-8111-111111111111'));
 const backend=await page.evaluate(()=>window.backend),requests=await page.evaluate(()=>window.requests);
 assert.equal(backend.find(row=>row.id==='a').pnl,-125);assert.equal(backend.find(row=>row.id==='a').instrument,'Другое');
 assert.equal(backend.find(row=>row.id==='c').instrument,'Сок');assert.equal(backend.find(row=>row.id==='foreign').instrument,'Сок');
 assert.equal(backend.find(row=>row.id==='confirmed-temp').pnl,-10);
 for(const request of requests){assert.deepEqual(request.updates,{instrument:'Другое'});assert.equal(request.filters.user_id,owner);}
 await page.evaluate(()=>store.refreshFromCloud());assert.equal(await page.evaluate(()=>store.manualTrades['2026-10-01'].length),4);
 // A rejected cloud write remains retryable and never turns into a delete.
 await page.evaluate(()=>{window.backend.push({id:'retry',user_id:'11111111-1111-4111-8111-111111111111',date_key:'2026-10-01',instrument:'Монитор',pnl:-30000,currency:'MDL',platform:'Manual'});});
 await page.evaluate(()=>store.refreshFromCloud());await page.waitForFunction(()=>store.manualTrades['2026-10-01'].some(row=>row.id==='retry'));
 await page.evaluate(()=>{window.failUpdates=true;return store.detachMoneyCategory('Монитор',item=>item.platform==='Manual');});await page.waitForFunction(()=>store.failedSyncCount===1);
 assert.equal(await page.evaluate(()=>window.backend.find(row=>row.id==='retry').pnl),-30000);
 assert.equal(await page.evaluate(()=>window.backend.find(row=>row.id==='retry').instrument),'Монитор');
 await page.evaluate(()=>{window.failUpdates=false;return store.retryFailedSync();});await page.waitForFunction(()=>store.failedSyncCount===0);
 assert.equal(await page.evaluate(()=>window.backend.find(row=>row.id==='retry').instrument),'Другое');assert.equal(await page.evaluate(()=>window.backend.find(row=>row.id==='retry').pnl),-30000);
 // If the offline change cannot be stored, the caller receives an error and
 // the financial row is preserved intact.
 await page.evaluate(()=>{window.backend.push({id:'blocked',user_id:'11111111-1111-4111-8111-111111111111',date_key:'2026-10-01',instrument:'Велосипед',pnl:-999,currency:'EUR',platform:'Manual'});});
 await page.evaluate(()=>store.refreshFromCloud());await page.waitForFunction(()=>store.manualTrades['2026-10-01'].some(row=>row.id==='blocked'));
 const failed=await page.evaluate(async()=>{
  window.online=false;const original=Storage.prototype.setItem;
  Storage.prototype.setItem=function(key,value){if(key==='atj_offline_queue')throw new Error('Quota exceeded');return original.call(this,key,value);};
  try{await store.detachMoneyCategory('Велосипед',item=>item.platform==='Manual');return false;}catch{return true;}finally{Storage.prototype.setItem=original;}
 });assert.equal(failed,true);assert.equal(await page.evaluate(()=>store.manualTrades['2026-10-01'].find(row=>row.id==='blocked').instrument),'Велосипед');
 await page.evaluate(()=>{window.online=false;switchOwner('22222222-2222-4222-8222-222222222222');});await page.waitForFunction(()=>Object.values(store.manualTrades).flat().length===0);
 assert.deepEqual(errors,[]);console.log('PASS: actual trade/offline hooks, label-only cloud patches, offline inserts, concurrent amounts, cloud rejection/retry, storage failures, trading records and account isolation');
}finally{await browser.close();}
