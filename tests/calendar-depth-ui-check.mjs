// Real calendar UI, local auth/entitlement/storage fixtures; no external writes.
import {createRequire} from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire(path.resolve('package.json'));
const auth=`import {useState} from 'react';export function useAuth(){const [setupStep,setSetupStep]=useState(null);const [owner,setOwner]=useState('22222222-2222-4222-8222-222222222222');window.switchTestOwner=setOwner;return {user:{id:owner,email:'test@example.test',user_metadata:{nickname:'Test'}},validUserId:owner,authReady:true,setupStep,setSetupStep,handleGoogleLogin:()=>{},handleGoogleLogout:()=>{},handleTelegramLogin:()=>{}};}`;
const trades=`import {useState,useRef} from 'react';export function useTrades(){const [manualTrades,setManualTrades]=useState(()=>JSON.parse(localStorage.getItem('test_records')||'{}'));const manualTradesRef=useRef(manualTrades);manualTradesRef.current=manualTrades;return {manualTrades,setManualTrades,manualTradesRef,pendingSyncCount:0,failedSyncCount:0,cacheTradesLocally:()=>{},refreshFromCloud:async()=>{},retryFailedSync:()=>{},deleteTrade:async()=>{},detachMoneyCategory:async()=>{},mutateVoiceRecord:async()=>{},clearAllTrades:async()=>{},saveTrade:async entry=>{window.lastSaved=entry;setManualTrades(current=>{const next={...current,[entry.dateKey]:[...(current[entry.dateKey]||[]),{...entry,id:'saved',pnl:entry.signedPnl}]};localStorage.setItem('test_records',JSON.stringify(next));return next;});return entry;}};}`;
const bundle=await require('esbuild').build({stdin:{resolveDir:process.cwd(),loader:'jsx',contents:"import React from 'react';import {createRoot} from 'react-dom/client';import CalendarScreen from './CalendarScreen.jsx';createRoot(document.getElementById('root')).render(<CalendarScreen/>);"},bundle:true,write:false,outfile:'savings.js',format:'iife',define:{'import.meta.env.VITE_SUPABASE_URL':JSON.stringify('https://local-fixture.supabase.co'),'import.meta.env.VITE_SUPABASE_ANON_KEY':JSON.stringify('local-test-key'),'import.meta.env.VITE_CTRADER_CLIENT_ID':JSON.stringify(''),'import.meta.env.VITE_VAPID_PUBLIC_KEY':JSON.stringify('')},plugins:[{name:'local-fixtures',setup(build){build.onResolve({filter:/useProAccess\.js$/},()=>({path:'pro',namespace:'fixture'}));build.onResolve({filter:/\/useAuth$/},()=>({path:'auth',namespace:'fixture'}));build.onResolve({filter:/\/useTrades$/},()=>({path:'trades',namespace:'fixture'}));build.onLoad({filter:/.*/,namespace:'fixture'},({path:name})=>({resolveDir:process.cwd(),contents:name==='auth'?auth:name==='trades'?trades:"export const useProAccess=()=>({active:true,loading:false,until:null,refresh:async()=>true});"}));}}]});
const css=fs.readFileSync(path.join('dist/assets',fs.readdirSync('dist/assets').find(file=>file.startsWith('index-')&&file.endsWith('.css'))),'utf8');
const browser=await createRequire('C:/Users/aveel/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('playwright').chromium.launch({channel:'msedge',headless:true});
try{
 for(const [width,theme,language] of [[390,'dark','ru'],[320,'purple','ru'],[390,'emerald','en'],[390,'light','md'],[1280,'dark','zh-CN']]){
  const context=await browser.newContext({viewport:{width,height:844},serviceWorkers:'block'});
  await context.addInitScript(({theme,language})=>{
   Object.entries({dayris_onboarding_v2_completed:'1',calendar_guide_completed:'1',atj_language:language,atj_pro_view:'1',atj_trader_mode:'0',atj_currency:'USD',atj_theme:theme}).forEach(([key,value])=>localStorage.setItem(key,value));
   const date=new Date().toLocaleDateString('en-CA'),month=date.slice(0,7);
   localStorage.setItem(`pro_month_goal_v1:22222222-2222-4222-8222-222222222222:${month}:USD`,'500');
   localStorage.setItem('test_records',JSON.stringify({[date]:[{id:'1',instrument:'Зарплата',pnl:750,currency:'USD',platform:'Manual',time:'10:00'},{id:'2',instrument:'Покупки',pnl:-314.07,currency:'USD',platform:'Manual',time:'11:00'}]}));
  },{theme,language});
  const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',route=>new URL(route.request().url()).pathname==='/brand-mark-192.png'?route.fulfill({contentType:'image/png',body:fs.readFileSync('public/brand-mark-192.png')}):new URL(route.request().url()).hostname==='depth.test'?route.fulfill({contentType:'text/html',body:`<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}${bundle.outputFiles.find(f=>f.path.endsWith('.css')).text}body{margin:0}</style><div id="root"></div><script>${bundle.outputFiles.find(f=>f.path.endsWith('.js')).text}</script>`}):route.abort());
  await page.goto('http://depth.test');await page.locator('.month-depth-trigger').waitFor();await page.waitForTimeout(1000);
  await page.screenshot({path:`tests/depth-${width}-${theme}-closed.png`});
  assert.ok(await page.locator('.month-depth-track i').evaluate(node=>parseFloat(node.style.width)>87),'Saved goal remains visible as a quiet progress line');
  assert.deepEqual(errors,[]);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal overflow');
  const before=await page.locator('.calendar-section:not(.calendar-month-preview) > .calendar-days-grid').boundingBox();
  await page.locator('.month-depth-trigger').click();await page.waitForTimeout(650);
  assert.ok(await page.locator('.month-depth[data-open=true]').isVisible());
  assert.equal(await page.locator('.calendar-section[inert]').count(),1);
  assert.deepEqual(await page.locator('.calendar-section:not(.calendar-month-preview) > .calendar-days-grid').boundingBox(),before,'Inspecting a month never moves the days');
  assert.match(await page.locator('.month-depth-stats').textContent(),/750/);
  await page.screenshot({path:`tests/depth-${width}-${theme}-open.png`});
  await page.keyboard.press('Escape');await page.waitForTimeout(500);assert.equal(await page.locator('.month-depth[data-open=true]').count(),0);
  await page.locator('.header-tools-trigger').click();await page.locator('.header-tools-panel').waitFor();
  const tools=await page.locator('.header-tools-panel').boundingBox();assert.ok(tools.x>=0&&tools.x+tools.width<=width,'Tools fit inside the viewport');
  const nav=await page.locator('.dayris-workspace-nav').boundingBox();
  const scrollBefore=await page.evaluate(()=>scrollY);
  await page.locator('.header-tools-panel .pro-control-trader').click();
  await page.waitForTimeout(500);const navAfter=await page.locator('.dayris-workspace-nav').boundingBox(),scrollAfter=await page.evaluate(()=>scrollY);
  assert.deepEqual({...navAfter,y:navAfter.y+scrollAfter},{...nav,y:nav.y+scrollBefore},'Wallet and investments never move when enabling trading');
  assert.ok(await page.locator('.header-tools-panel .pro-control-platform').first().isVisible());
  await page.screenshot({path:`tests/depth-${width}-${theme}-tools.png`});
  await page.keyboard.press('Escape');
  await page.locator('.dayris-date-navigation>button').first().click();await page.waitForTimeout(500);
  assert.equal(await page.locator('.month-depth[data-empty=true]').count(),1,'New month has its own result');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Previous-month controls remain within viewport');
  await page.locator('.dayris-date-navigation>button').nth(1).click();await page.waitForTimeout(500);
  await page.emulateMedia({reducedMotion:'reduce'});await page.locator('.month-depth-trigger').click();
  assert.equal(await page.locator('.month-depth-hero').evaluate(node=>getComputedStyle(node).transitionDuration),'0s');
  assert.deepEqual(errors,[]);await context.close();
 }
 console.log('PASS: depth summary, exact grid geometry, fixed navigation, tools, currencies/themes/locales and reduced motion at 320/390/1280.');
}finally{await browser.close();}
