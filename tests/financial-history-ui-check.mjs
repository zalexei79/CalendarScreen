// Real CalendarScreen with a local entitlement stub; no live accounts or writes.
import {createRequire} from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const require = createRequire(path.resolve('package.json'));
const auth=`import {useState} from 'react';export function useAuth(){const [setupStep,setSetupStep]=useState(null);const [owner,setOwner]=useState('22222222-2222-4222-8222-222222222222');window.switchTestOwner=setOwner;return {user:{id:owner,email:'test@example.test',user_metadata:{nickname:'Test'}},validUserId:owner,authReady:true,setupStep,setSetupStep,handleGoogleLogin:()=>{},handleGoogleLogout:()=>{},handleTelegramLogin:()=>{}};}`;
const bundle = await require('esbuild').build({stdin:{resolveDir:process.cwd(),loader:'jsx',contents:"import React from 'react';import {createRoot} from 'react-dom/client';import CalendarScreen from './CalendarScreen.jsx';createRoot(document.getElementById('root')).render(<CalendarScreen/>);"},bundle:true,write:false,outfile:'financial.js',format:'iife',define:{'import.meta.env.VITE_SUPABASE_URL':JSON.stringify('https://local-fixture.supabase.co'),'import.meta.env.VITE_SUPABASE_ANON_KEY':JSON.stringify('local-test-key'),'import.meta.env.VITE_CTRADER_CLIENT_ID':JSON.stringify(''),'import.meta.env.VITE_VAPID_PUBLIC_KEY':JSON.stringify('')},plugins:[{name:'local-pro',setup(build){build.onResolve({filter:/\/useAuth$/},()=>({path:'auth',namespace:'fixture'}));build.onResolve({filter:/useProAccess\.js$/},()=>({path:'pro',namespace:'fixture'}));build.onLoad({filter:/.*/,namespace:'fixture'},({path:name})=>({resolveDir:process.cwd(),contents:name==='auth'?auth:"export const useProAccess=()=>({active:true,loading:false,until:null,refresh:async()=>true});"}));}}]});
const css = fs.readFileSync(path.join('dist/assets',fs.readdirSync('dist/assets').find(file=>file.endsWith('.css'))),'utf8');
const browser = await createRequire(process.env.DAYRIS_PLAYWRIGHT_PACKAGE || import.meta.url)('playwright').chromium.launch({channel:'msedge',headless:true});
try {
 for (const [width, light] of [[1280,false],[390,false],[320,false],[390,true],[1280,true]]) {
  const context=await browser.newContext({viewport:{width,height:960},isMobile:width<640,hasTouch:width<640});
  await context.addInitScript(({light})=>{
   for(const [key,value] of Object.entries({dayris_onboarding_v2_completed:'1',calendar_guide_completed:'1',atj_language:'ru',atj_pro_view:'1',atj_trader_mode:'0',atj_currency:'USD',atj_theme:light?'light':'dark'}))localStorage.setItem(key,value);
   const d=new Date(), key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
   const prev=new Date(d);prev.setDate(d.getDate()-1);const prevKey=`${prev.getFullYear()}-${String(prev.getMonth()+1).padStart(2,'0')}-${String(prev.getDate()).padStart(2,'0')}`;
   localStorage.setItem('dayris_money_categories:22222222-2222-4222-8222-222222222222',JSON.stringify(['Дизайн и работа над очень длинным названием раздела']));
   localStorage.setItem('money_calendar_trades_22222222-2222-4222-8222-222222222222',JSON.stringify({[key]:[
    {id:'salary',time:'09:00',instrument:'Зарплата',pnl:2400,currency:'USD',platform:'Manual'},
    {id:'food',time:'10:00',instrument:'Продукты',pnl:-450,currency:'USD',platform:'Manual'},
    {id:'trade',time:'11:00',instrument:'XAUUSD',pnl:-120,currency:'USD',platform:'cTrader'},
    {id:'long',time:'12:00',instrument:'Дизайн и работа над очень длинным названием раздела',pnl:-350,currency:'USD',platform:'Manual'},
    {id:'mdl',time:'13:00',instrument:'Продукты',pnl:-9999,currency:'MDL',platform:'Manual'}
   ],[prevKey]:[{id:'home',time:'18:00',instrument:'Дом',pnl:-200,currency:'USD',platform:'Manual'}]}));
  },{light});
  const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',route=>new URL(route.request().url()).hostname==='financial.test'?route.fulfill({contentType:'text/html',body:`<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}${bundle.outputFiles.find(f=>f.path.endsWith('.css')).text}body{margin:0}</style><div id="root"></div><script>${bundle.outputFiles.find(f=>f.path.endsWith('.js')).text}</script>`}):route.abort());
  await page.goto('http://financial.test');
  await page.getByRole('button',{name:'История',exact:true}).click();
  const dialog=page.locator('.financial-history-dialog');await dialog.waitFor();
  assert.match(await dialog.locator('.financial-amount').textContent(),/1[\s,]?280/);
  assert.equal(await dialog.locator('.financial-record-row').count(),5);
  assert.equal(await dialog.locator('.financial-record-date').count(),2);
  assert.equal(await dialog.locator('.financial-category').count(),3);
  assert.equal(await dialog.locator('.financial-trading-note').count(),1);
  assert.ok(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1),'dialog fits viewport');
  assert.ok(await dialog.locator('.financial-hero').evaluate(el=>[...el.children].every(child=>child.getBoundingClientRect().right<=el.getBoundingClientRect().right+1)),'hero content fits viewport');
  await dialog.screenshot({path:`tests/financial-history-${width}-${light?'light':'dark'}.png`,animations:'disabled'});
  await dialog.getByRole('button',{name:'Поступления',exact:true}).click();assert.equal(await dialog.locator('.financial-category').count(),1);
  await dialog.getByRole('button',{name:'Все валюты',exact:true}).click();assert.equal(await dialog.locator('.financial-amount').textContent(),'—');assert.equal(await dialog.locator('.financial-distribution').count(),0);
  await dialog.getByRole('button',{name:'MDL',exact:true}).click();assert.equal(await dialog.locator('.financial-record-row').count(),1);assert.match(await dialog.locator('.financial-amount').textContent(),/9[\s,]?999/);
  await dialog.getByRole('button',{name:'USD',exact:true}).click();
  await dialog.getByRole('button',{name:'Разобрать мои расходы',exact:true}).click();await page.locator('.savings-dialog').waitFor();assert.equal(await page.locator('.savings-findings article').count(),3);
  await page.locator('.savings-dialog').getByRole('button',{name:'Закрыть',exact:true}).click();await page.locator('.savings-dialog').waitFor({state:'detached'});
  await dialog.getByRole('button',{name:'Списания',exact:true}).click();
  await dialog.locator('.financial-category').first().click();assert.equal(await dialog.locator('.financial-record-row').count(),1);assert.match(await dialog.locator('.financial-record-row').textContent(),/Продукты/);
  await dialog.getByRole('button',{name:'Сбросить раздел',exact:true}).click();assert.equal(await dialog.locator('.financial-record-row').count(),5);
  await dialog.getByRole('button',{name:'Доходы',exact:true}).click();assert.equal(await dialog.locator('.financial-category').count(),1);assert.equal(await dialog.getByRole('button',{name:'Поступления',exact:true}).getAttribute('aria-pressed'),'true');
  await dialog.getByRole('button',{name:'Все',exact:true}).click();
  await dialog.getByRole('button',{name:'CNY',exact:true}).click();assert.equal(await dialog.locator('.financial-record-row').count(),0);assert.equal(await dialog.locator('.financial-distribution').count(),0);assert.match(await dialog.locator('.financial-amount').textContent(),/0/);
  await dialog.getByRole('button',{name:'USD',exact:true}).click();
  await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await dialog.locator('.financial-amount').evaluate(el=>getComputedStyle(el).animationName),'none');
  assert.deepEqual(errors,[]);await context.close();
 }
 console.log('PASS: actual PRO history at 320/390/1280, dark/light, totals, dates, mixed currencies, category filtering, plan and reduced motion.');
} finally {await browser.close();}
