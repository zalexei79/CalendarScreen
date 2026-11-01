import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { installStoryAccount } from './life-story-auth-fixture.mjs';
const require = createRequire('C:/Users/aveel/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const bundle = await build({
  stdin: { resolveDir: process.cwd(), loader: 'jsx', contents: `
    import React, {useState} from 'react';
    import {createRoot} from 'react-dom/client';
    import {useProAccess} from './src/features/pro/useProAccess.js';
    window.requests=[];
    window.answer=(data,error=null)=>window.requests.shift()({data,error});
    function Graph(){const [zoom,setZoom]=useState('');return <input aria-label="Graph zoom" value={zoom} onChange={e=>setZoom(e.target.value)}/>}
    function App(){
      const [user,setUser]=useState({id:'22222222-2222-4222-8222-222222222222'});
      window.setUser=setUser;
      const access=useProAccess({user});window.access=access;
      return <><output>{JSON.stringify({active:access.active,loading:access.loading})}</output>
        {access.active&&!access.loading?<Graph/>:null}</>;
    }
    createRoot(document.getElementById('root')).render(<App/>);
  ` }, bundle: true, write: false, format: 'iife', plugins: [{
    name: 'mock-pro-server', setup(b) {
      b.onResolve({filter:/supabaseClient$/},()=>({path:'mock',namespace:'pro'}));
      b.onLoad({filter:/.*/,namespace:'pro'},()=>({contents:'export const supabase={rpc:()=>new Promise(resolve=>window.requests.push(resolve))};'}));
    },
  }],
});
const browser=await require('playwright').chromium.launch({channel:'msedge',headless:true});
let currentApp;
try {
  const page=await browser.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.clock.install({time:new Date('2026-10-14T12:00:00Z')});
  await page.setContent('<div id="root"></div>');
  await page.addScriptTag({content:bundle.outputFiles[0].text});
  const pending=()=>page.waitForFunction(()=>window.requests.length===1);
  const answer=async data=>{await pending();await page.evaluate(data=>window.answer(data),data);};
  const state=async(active,loading=false)=>{
    await page.waitForFunction(({active,loading})=>window.access.active===active&&window.access.loading===loading,{active,loading});
  };
  await state(false,true);
  await answer({active:true,until:'2026-10-14T13:00:00Z'});await state(true);
  const graph=page.getByRole('textbox',{name:'Graph zoom'});
  await graph.fill('zoom 4 / historical candles');
  await page.evaluate(()=>window.originalGraph=document.querySelector('input'));
  const retained=async()=>{
    await state(true);
    assert.equal(await graph.inputValue(),'zoom 4 / historical candles');
    assert.equal(await page.evaluate(()=>window.originalGraph===document.querySelector('input')),true);
  };
  // Reproduce the actual two-minute timer and slow network, repeatedly.
  for(let i=0;i<3;i++){
    await page.clock.runFor(120000);await pending();await retained();
    await page.evaluate(()=>{window.dispatchEvent(new Event('focus'));window.dispatchEvent(new Event('online'));document.dispatchEvent(new Event('visibilitychange'));});
    assert.equal(await page.evaluate(()=>window.requests.length),1,'Concurrent triggers share one request');
    await page.clock.runFor(5000);await retained();
    if(i===1) await page.evaluate(()=>window.answer(null,{message:'Network unavailable'}));
    else await answer({active:true,until:'2026-10-14T13:00:00Z'});
    await retained();
  }
  // Refreshing the token may replace the user object, but keeps the same owner.
  await page.evaluate(()=>window.setUser({id:'22222222-2222-4222-8222-222222222222',token:'new'}));await retained();
  await page.evaluate(()=>{void window.access.refresh();});
  await answer({active:false});await state(false);
  assert.equal(await graph.count(),0,'Confirmed revocation closes access');
  await page.evaluate(()=>{void window.access.refresh();});
  await answer({active:true,until:'2026-10-14T12:07:00Z'});await state(true);
  await page.clock.runFor(65000);await state(false);
  assert.equal(await graph.count(),0,'Known expiration closes access without a successful refresh');
  // Late results from a different account must never grant access.
  await page.evaluate(()=>{void window.access.refresh();});await pending();
  await page.evaluate(()=>window.setUser({id:'33333333-3333-4333-8333-333333333333'}));await state(false,true);
  await page.waitForFunction(()=>window.requests.length===2);
  await page.evaluate(()=>window.answer({active:true,until:null}));await state(false,true);
  await answer({active:false});await state(false);
  await page.evaluate(()=>{void window.access.refresh();});await pending();
  await page.evaluate(()=>window.setUser(null));await state(false);
  await page.evaluate(()=>window.answer({active:true,until:null}));await state(false);
  assert.deepEqual(errors,[]);
  console.log('PASS: 3 periodic refresh cycles, slow responses, network failure/recovery, focus/online deduplication, token refresh, graph state retained, revocation, expiry, account switch and logout.');

  // Check the real CalendarScreen/Capital integration in the production build.
  const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
  await context.addInitScript(()=>{
    for(const [key,value] of Object.entries({atj_pro_view:'0',atj_trader_mode:'0',atj_language:'ru',atj_currency:'USD',dayris_onboarding_v2_completed:'1',calendar_guide_completed:'1'}))localStorage.setItem(key,value);
  });
  await context.route('**/*',route=>{
    const url=new URL(route.request().url());
    if(url.origin!=='http://stability.test'){
      if(url.pathname.startsWith('/rest/v1/'))return route.fulfill({contentType:'application/json',body:url.pathname.endsWith('/creator_latest_gift')?'null':'[]'});
      return route.abort();
    }
    const root=path.resolve('dist'),file=path.resolve(root,url.pathname==='/'?'index.html':'.'+url.pathname);
    if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:''});
    return route.fulfill({contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':'text/html',body:fs.readFileSync(file)});
  });
  await installStoryAccount(context);
  let calls=0,release,revoked=false;
  await context.route('**/rest/v1/rpc/get_my_pro_status',async route=>{
    calls++;
    if(calls>1&&!revoked)await new Promise(resolve=>{release=resolve;});
    await route.fulfill({contentType:'application/json',body:JSON.stringify(revoked?{active:false}:calls===3?{message:'Temporary network error'}:{active:true,until:'2026-10-15T12:00:00Z'}),status:!revoked&&calls===3?503:200});
  });
  const app=await context.newPage();currentApp=app;app.on('pageerror',e=>errors.push(e.message));app.setDefaultTimeout(10000);
  await app.clock.install({time:new Date('2026-10-14T12:00:00Z')});
  await app.emulateMedia({reducedMotion:'reduce'});
  await app.goto('http://stability.test/');
  await app.locator('.receipt-launch').waitFor();
  assert.equal(await app.locator('.workspace-pass-label').textContent(),'PRO','paid account ignores the old FREE preference');
  assert.equal(await app.locator('.workspace-mode-toggle').getAttribute('role'),null,'membership is not a switch');
  await app.locator('.workspace-mode-toggle').click();await app.locator('.pro-offer').waitFor();
  await app.locator('.pro-dialog-close').click();
  assert.equal(await app.locator('.workspace-pass-label').textContent(),'PRO','membership click opens details without downgrading');
  for(const width of [390,1280]){
    await app.setViewportSize({width,height:844});
    await app.locator('.pro-control-trader').click();await app.waitForFunction(()=>document.querySelector('.pro-control-trader').getAttribute('aria-checked')==='true');
    assert.equal(await app.locator('.receipt-launch').isVisible(),true,'camera stays visible with platforms enabled');
    assert.equal(await app.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'dock stays within viewport');
    if(width===390){await app.locator('.receipt-launch').click();await app.locator('.receipt-dialog').waitFor();await app.getByRole('button',{name:'Закрыть чек',exact:true}).click();}
    await app.locator('.pro-control-trader').click();
    assert.equal(await app.locator('.receipt-launch').isVisible(),true,'camera remains visible with trader off');
  }
  await app.setViewportSize({width:390,height:844});
  await app.locator('.workspace-capital-entry').click();
  await app.getByRole('button',{name:'Добавить актив',exact:true}).click();
  await app.locator('.capital-sheet').waitFor();
  await app.evaluate(()=>window.originalSheet=document.querySelector('.capital-sheet'));
  for(let i=0;i<2;i++){
    await app.clock.runFor(120000);
    await app.waitForTimeout(100);
    assert.equal(calls,i+2,'Real app performs the periodic entitlement check');
    assert.equal(await app.evaluate(()=>window.originalSheet===document.querySelector('.capital-sheet')),true,'Pending refresh keeps the open sheet mounted');
    release();
    await app.waitForTimeout(100);
    assert.equal(await app.evaluate(()=>window.originalSheet===document.querySelector('.capital-sheet')),true,'Success and network error keep Capital mounted');
    assert.equal(await app.evaluate(()=>localStorage.getItem('dayris_account_mode')),'capital');
  }
  revoked=true;await app.evaluate(()=>{localStorage.setItem('atj_pro_view','1');window.dispatchEvent(new Event('dayris:pro-refresh'));});
  await app.waitForFunction(()=>document.querySelector('.workspace-pass-label')?.textContent==='FREE');
  assert.equal(await app.locator('.receipt-launch').count(),0,'revocation removes receipt access');
  assert.equal(await app.locator('.capital-sheet').count(),0,'revocation leaves the protected workspace');
  await app.locator('.workspace-mode-toggle').click();await app.locator('.pro-offer').waitFor();
  assert.equal(await app.locator('.workspace-pass-label').textContent(),'FREE','free account cannot activate PRO by clicking the badge');
  assert.deepEqual(errors,[]);
  await context.close();
  console.log('PASS: subscription-owned tier, stale preferences ignored, badge opens details, receipt available with trader on/off at 390/1280px, stable periodic refresh, free gating and revocation.');
} catch(error){if(currentApp){console.log('APP DIAGNOSTIC',JSON.stringify({url:currentApp.url(),body:(await currentApp.locator('body').innerText()).slice(0,3600),account:await currentApp.evaluate(()=>localStorage.getItem('dayris_account_mode'))}));await currentApp.screenshot({path:'artifacts/subscription-tier-failed.png'});}throw error;} finally {await browser.close();}
