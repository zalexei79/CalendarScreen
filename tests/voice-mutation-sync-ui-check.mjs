import {createRequire} from 'node:module';import path from 'node:path';import assert from 'node:assert/strict';
const owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
const bundle=await createRequire(path.resolve('package.json'))('esbuild').build({stdin:{resolveDir:process.cwd(),loader:'jsx',contents:`
import React,{useState} from 'react';import {createRoot} from 'react-dom/client';import {useTrades} from './src/features/trades-sync/hooks/useTrades.js';
function App(){const[user,setUser]=useState({id:'${owner}'});window.store=useTrades({user});window.switchOwner=id=>setUser({id});return <output>{JSON.stringify(window.store.manualTrades)}</output>;}createRoot(document.getElementById('root')).render(<App/>);
`},plugins:[{name:'mock-cloud',setup(build){build.onResolve({filter:/supabaseClient$/},()=>({path:'cloud',namespace:'fixture'}));build.onLoad({filter:/.*/,namespace:'fixture'},()=>({loader:'js',contents:`
export const supabase={channel(){return {on(){return this},subscribe(){return this}}},removeChannel(){},from(){return {kind:'select',filters:{},select(){return this},order(){return this},range(){return this},single(){return this},maybeSingle(){this.one=true;return this},eq(key,value){this.filters[key]=value;return this},update(updates){this.kind='update';this.updates=updates;return this},delete(){this.kind='delete';return this},then(resolve,reject){return (async()=>{
 if(this.kind!=='select'){window.requests.push({kind:this.kind,updates:this.updates,filters:this.filters});if(window.pause)await new Promise(done=>window.releases.push(done));if(window.fail)return {error:{message:'write failed'}};}
 const matches=row=>Object.entries(this.filters).every(([key,value])=>row[key]===value),rows=window.backend.filter(matches);
 if(this.kind==='update')window.backend=window.backend.map(row=>matches(row)?{...row,...this.updates}:row);
 if(this.kind==='delete')window.backend=window.backend.filter(row=>!matches(row));
 return {data:this.one?(rows[0]||null):rows,error:null};})().then(resolve,reject);}}}};
`}))}}],bundle:true,write:false,outfile:'sync.js',format:'iife'});
const browser=await createRequire(process.env.DAYRIS_PLAYWRIGHT_PACKAGE||import.meta.url)('playwright').chromium.launch({channel:'msedge',headless:true});
try{
 const context=await browser.newContext();await context.addInitScript(({owner,other})=>{
  window.online=false;Object.defineProperty(navigator,'onLine',{get:()=>window.online,configurable:true});window.requests=[];window.releases=[];
  window.backend=[{id:'a',user_id:owner,date_key:'2026-10-02',time:'18:00',instrument:'Такси',pnl:-80,currency:'MDL',platform:'Manual',comment:'keep',direction:'SHORT'},{id:'foreign',user_id:other,date_key:'2026-10-02',time:'18:00',instrument:'Такси',pnl:-500,currency:'MDL',platform:'Manual'}];
  localStorage.setItem('money_calendar_trades_'+owner,JSON.stringify({'2026-10-02':[window.backend[0]]}));
 },{owner,other});const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.route('http://voice-sync.test/**',route=>route.fulfill({contentType:'text/html',body:`<meta charset="UTF-8"><div id="root"></div><script>${bundle.outputFiles[0].text}</script>`}));await page.goto('http://voice-sync.test');await page.waitForFunction(()=>store.manualTrades['2026-10-02']?.length===1);
 const row=()=>page.evaluate(()=>({...store.manualTrades['2026-10-02'][0],dateKey:'2026-10-02'}));const original=await row();
 await page.evaluate(snapshot=>store.mutateVoiceRecord({snapshot,amount:-100}),original);await page.waitForFunction(()=>store.manualTrades['2026-10-02'][0].pnl===-100);
 const queue=await page.evaluate(()=>JSON.parse(localStorage.getItem('atj_offline_queue')));assert.deepEqual(queue[0].updates,{pnl:-100});assert.equal(queue[0].user_id,owner);
 await page.evaluate(()=>{window.pause=true;window.online=true;dispatchEvent(new Event('online'));});await page.waitForFunction(()=>requests.length===1);await page.evaluate(()=>store.refreshFromCloud());assert.equal((await row()).pnl,-100,'pending amount survives stale cloud refresh');
 await page.evaluate(()=>{window.pause=false;window.releases.forEach(fn=>fn());});await page.waitForFunction(()=>JSON.parse(localStorage.getItem('atj_offline_queue')).length===0);assert.equal(await page.evaluate(()=>backend.find(row=>row.id==='a').pnl),-100);
 await assert.rejects(()=>page.evaluate(snapshot=>store.mutateVoiceRecord({snapshot,amount:-200}),original),/изменилась/);
 const updated=await row();await page.evaluate(()=>{window.fail=true;});await assert.rejects(()=>page.evaluate(snapshot=>store.mutateVoiceRecord({snapshot,amount:-200}),updated),/write failed/);assert.equal((await row()).pnl,-100);
 await page.evaluate(()=>{window.fail=false;window.backend.find(row=>row.id==='a').pnl=-150;});await assert.rejects(()=>page.evaluate(snapshot=>store.mutateVoiceRecord({snapshot,amount:-200}),updated),/другом устройстве/);assert.equal(await page.evaluate(()=>backend.find(row=>row.id==='a').pnl),-150,'conditional write protects changed cloud amount');
 await page.evaluate(()=>store.refreshFromCloud());await page.waitForFunction(()=>store.manualTrades['2026-10-02'][0].pnl===-150);const latest=await row();await page.evaluate(snapshot=>store.mutateVoiceRecord({snapshot,amount:-200}),latest);await page.waitForFunction(()=>store.manualTrades['2026-10-02'][0].pnl===-200);assert.equal((await row()).comment,'keep');assert.deepEqual(await page.evaluate(()=>requests.at(-1).updates),{pnl:-200});assert.equal(await page.evaluate(()=>backend.find(row=>row.id==='foreign').pnl),-500);
 const removable=await row();await page.evaluate(()=>{window.online=false;});await page.evaluate(snapshot=>store.mutateVoiceRecord({snapshot,remove:true}),removable);await page.waitForFunction(()=>store.manualTrades['2026-10-02'].length===0);await page.evaluate(()=>{window.pause=true;window.online=true;dispatchEvent(new Event('online'));});await page.evaluate(()=>store.refreshFromCloud());assert.equal(await page.evaluate(()=>store.manualTrades['2026-10-02'].length),0,'pending removal cannot resurrect during refresh');
 await page.evaluate(()=>{window.pause=false;window.releases.forEach(fn=>fn());});await page.waitForFunction(()=>JSON.parse(localStorage.getItem('atj_offline_queue')).length===0);assert.equal(await page.evaluate(()=>backend.some(row=>row.id==='a')),false);
 await page.evaluate(id=>switchOwner(id),other);await page.waitForFunction(()=>store.manualTrades['2026-10-02']?.[0]?.id==='foreign');await assert.rejects(()=>page.evaluate(snapshot=>store.mutateVoiceRecord({snapshot,amount:-400}),removable),/изменилась|загрузки/);
 assert.deepEqual(errors,[]);console.log('PASS: exact amount-only cloud updates, offline preservation, no resurrection, stale snapshot/remote change/failure rejection and owner isolation.');
}finally{await browser.close();}
