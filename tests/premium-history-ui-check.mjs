// Actual CalendarScreen, local ownership/entitlement fixtures, no live reads or writes.
import {createRequire} from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {translate} from '../src/shared/i18n/index.js';
import {premiumHistoryCopy} from '../src/features/history/premiumHistoryCopy.js';
import {intlLocale} from '../src/shared/i18n/locale.js';
const require=createRequire(path.resolve('package.json'));
const runtime=createRequire(process.env.DAYRIS_PLAYWRIGHT_PACKAGE || 'C:/Users/aveel/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const bundle=await require('esbuild').build({stdin:{resolveDir:process.cwd(),loader:'jsx',contents:"import React from 'react';import {createRoot} from 'react-dom/client';import CalendarScreen from './CalendarScreen.jsx';createRoot(document.getElementById('root')).render(<CalendarScreen/>);"},bundle:true,write:false,outfile:'premium-history.js',format:'iife',loader:{'.svg':'file','.mp4':'file','.webp':'file'},define:{'import.meta.env.VITE_SUPABASE_URL':JSON.stringify('https://local-fixture.supabase.co'),'import.meta.env.VITE_SUPABASE_ANON_KEY':JSON.stringify('local-test-key'),'import.meta.env.VITE_CTRADER_CLIENT_ID':JSON.stringify(''),'import.meta.env.VITE_VAPID_PUBLIC_KEY':JSON.stringify(''),'import.meta.env.DEV':'false'},plugins:[{name:'local-pro',setup(build){build.onResolve({filter:/\/useAuth$/},()=>({path:'auth',namespace:'fixture'}));build.onResolve({filter:/useProAccess\.js$/},()=>({path:'pro',namespace:'fixture'}));build.onLoad({filter:/.*/,namespace:'fixture'},({path:name})=>({resolveDir:process.cwd(),contents:name==='auth'?"export function useAuth(){return {user:{id:'22222222-2222-4222-8222-222222222222',email:'test@example.test',user_metadata:{nickname:'Test'}},validUserId:'22222222-2222-4222-8222-222222222222',authReady:true,setupStep:null,setSetupStep:()=>{},handleGoogleLogin:()=>{},handleGoogleLogout:()=>{},handleTelegramLogin:()=>{}};}":"export const useProAccess=()=>({active:true,loading:false,until:null,refresh:async()=>true});"}));}}]});
const css=fs.readFileSync(path.join('dist/assets',fs.readdirSync('dist/assets').find(f=>/^main-.*\.css$/.test(f))),'utf8')+bundle.outputFiles.find(f=>f.path.endsWith('.css')).text;
const script=bundle.outputFiles.find(f=>f.path.endsWith('.js')).text;
const webkit=process.env.DAYRIS_TEST_WEBKIT==='1';
const browser=await runtime('playwright')[webkit?'webkit':'chromium'].launch(webkit?{}:{channel:'msedge',headless:true});
const compact=s=>s.replace(/[\s\u00a0\u202f]/g,'');
const cases=[[320,'dark','ru',false],[390,'light','ru',false],[1280,'light','en',false],[390,'dark','uk',false],[390,'dark','md',false],[390,'light','zh-CN',false],[320,'dark','ru',true],[390,'light','ru',true],[1280,'dark','en',true],[390,'gold','ru',true],[390,'emerald','ru',false]];
const scenarios=(process.env.DAYRIS_HISTORY_SMOKE==='1'?cases.filter(([width,theme,language,trader])=>language==='ru'&&['dark','light'].includes(theme)||width===1280):cases).filter(item=>process.env.DAYRIS_HISTORY_TRADER_ONLY!=='1'||item[3]).filter(item=>!process.env.DAYRIS_HISTORY_MIN_WIDTH||item[0]>=Number(process.env.DAYRIS_HISTORY_MIN_WIDTH));
fs.mkdirSync('artifacts',{recursive:true});
try{for(const [width,theme,language,trader]of scenarios){
 const copy=premiumHistoryCopy(language),display=n=>compact(`${n<0?'−':n>0?'+':''}${new Intl.NumberFormat(intlLocale(language),{minimumFractionDigits:2,maximumFractionDigits:2}).format(Math.abs(n))}`),context=await browser.newContext({viewport:{width,height:960},isMobile:width<640,hasTouch:width<640});
 await context.addInitScript(({theme,language,trader})=>{
  for(const [key,value]of Object.entries({dayris_onboarding_v2_completed:'1',calendar_guide_completed:'1',atj_language:language,atj_pro_view:'1',atj_trader_mode:trader?'1':'0',atj_currency:'USD',atj_theme:theme}))localStorage.setItem(key,value);
  const now=new Date(),key=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`,prev=new Date(now);prev.setDate(now.getDate()-1);
  localStorage.setItem('dayris_money_categories:22222222-2222-4222-8222-222222222222',JSON.stringify(['Дизайн и работа над очень длинным названием раздела']));
  const row=(id,instrument,pnl,time,extra={})=>({id,instrument,pnl,time,currency:'USD',platform:'Manual',...extra,traderMode:extra.traderMode??['cTrader','MT4','MT5'].includes(extra.platform)});
  localStorage.setItem('money_calendar_trades_22222222-2222-4222-8222-222222222222',JSON.stringify({[key(now)]:[
   row('salary','Зарплата',2400,'09:00'),row('food','Продукты',-450,'10:00'),
   row('trade-a','XAUUSD',-120,'11:00',{platform:'cTrader',direction:'LONG',ctrader_account_id:'fixture-123',ctrader_deal_id:'789',stop_loss:2650,take_profit:2750}),
   row('long','Дизайн и работа над очень длинным названием раздела',-350,'12:00'),row('mdl','Продукты',-9999,'13:00',{currency:'MDL'}),
   row('trade-b','EURUSD',220,'12:15',{platform:'cTrader',direction:'SHORT',ctrader_account_id:'fixture-123'}),
   row('trade-c','XAUUSD',-90,'13:10',{platform:'MT5',direction:'LONG',comment:'[DAYRIS:MT5:Demo:555:333] Test note'}),
   row('trade-d','EURUSD',0,'14:00',{traderMode:true,direction:'LONG'}),
  ],[key(prev)]:[row('home','Дом',-200,'18:00')]}));
 },{theme,language,trader});
 const page=await context.newPage(),errors=[];page.setDefaultTimeout(webkit?30000:10000);page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>{
  const url=new URL(route.request().url());
  if(url.hostname==='local-fixture.supabase.co'&&url.pathname==='/rest/v1/trading_day_notes'){
   const now=new Date(),date_key=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
   const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET, OPTIONS'};
   return route.fulfill({status:route.request().method()==='OPTIONS'?204:200,headers,contentType:'application/json',body:route.request().method()==='OPTIONS'?'':JSON.stringify([{date_key,note:'Fixture: followed the plan',tags:['plan']}])});
  }
  return url.hostname==='premium.test'?route.fulfill({contentType:'text/html',body:`<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}body{margin:0}</style><div id="root"></div><script>${script}</script>`}):route.abort();
 });
 try{
  await page.goto('http://premium.test');await page.getByRole('button',{name:new RegExp('^'+translate(language,'history'))}).first().click();
  const dialog=page.locator('.premium-history-dialog'),workspace=dialog.locator('.premium-history-workspace');await dialog.waitFor();
  await page.waitForTimeout(400);
  const amount=dialog.locator('.premium-history-amount');
  await dialog.screenshot({path:`artifacts/premium-history-opening-${width}-${theme}-${language}-${trader?'trader':'pro'}.png`,animations:'disabled'});
  if(trader){
   // Current trading period is retained; finance always remains reachable inside trader mode.
   assert.equal(compact(await amount.innerText()),display(10));
   assert.equal(await workspace.locator('.premium-history-trade').count(),3);
   assert.match(await workspace.locator('.premium-history-metrics').innerText(),/25%/);
   assert.equal(await workspace.locator('[data-analytics="scorecard"]').count(),1,'full scorecard stays in the overview');
   assert.equal(await workspace.locator('[data-analytics="curve"]').count(),1,'account curve and recovery remain in the overview');
   assert.match(await workspace.locator('[data-analytics="trade-average"]').innerText(),/2[.,]50/);
   const scorecard=workspace.locator('[data-analytics="scorecard"]');
   assert(await scorecard.getByText('42',{exact:true}).isVisible(),'existing score formula is preserved');
   for(const key of ['payoff','avgWin','avgLoss','bestDay','worstDay','topInstrument','statsObservation'])assert((await scorecard.innerText()).toLocaleLowerCase().includes(translate(language,key).toLocaleLowerCase()),key+' is preserved');
   await workspace.locator('[data-analytics="instruments-toggle"]').click();assert.equal(await workspace.locator('[data-analytics="instruments-toggle"]').getAttribute('aria-expanded'),'true');
   assert.match(await workspace.locator('#history-instrument-breakdown').innerText(),/XAUUSD/);
   await workspace.locator('.premium-history-trade').first().click();await workspace.locator('.premium-history-ticket').waitFor();
   assert.match(await workspace.locator('.premium-history-prices').innerText(),/—/,'unknown prices must not be fabricated');
   await workspace.locator('.premium-history-back').click();
   await workspace.getByRole('button',{name:copy.trades,exact:true}).click();assert.equal(await workspace.locator('.premium-history-trade').count(),4);
   await workspace.getByRole('button',{name:copy.positive,exact:true}).click();assert.equal(await workspace.locator('.premium-history-trade').count(),1,'breakeven is not a profitable trade');
   await workspace.getByRole('button',{name:copy.negative,exact:true}).click();assert.equal(await workspace.locator('.premium-history-trade').count(),2);assert.equal(compact(await amount.innerText()),display(10),'list filter must not replace overall result');
   await workspace.locator('.premium-history-trade').first().click();assert.match(await workspace.locator('.premium-history-ticket').innerText(),/555/);assert(!await workspace.locator('.premium-history-ticket').innerText().then(t=>t.includes('[DAYRIS:')));
   await workspace.getByRole('button',{name:copy.back,exact:true}).click();await workspace.getByRole('button',{name:copy.all,exact:true}).click();
   await workspace.getByLabel(copy.platform,{exact:true}).selectOption('cTrader');assert.equal(compact(await amount.innerText()),display(100));
   await workspace.getByLabel(copy.platform,{exact:true}).selectOption('ALL');
   await workspace.getByRole('button',{name:copy.dynamics,exact:true}).click();assert(await workspace.locator('.premium-history-panel').innerText().then(t=>t.length>0));
   await workspace.getByRole('button',{name:copy.advanced,exact:true}).click();await dialog.locator('.premium-history-advanced').waitFor();
   assert.equal(await workspace.locator('[data-analytics="scorecard"]').count(),1,'analytics renders one complete copy');
   assert.equal(await workspace.locator('[data-analytics="notes"]').count(),1);assert.equal(await workspace.locator('[data-analytics="period-dynamics"]').count(),1);
   assert((await workspace.locator('[data-analytics="financial-picture"]').innerText()).toLocaleLowerCase().includes(translate(language,'financialRadar').toLocaleLowerCase()),'financial radar remains available');
   await workspace.locator('[data-analytics="notes"] summary').first().waitFor();await workspace.locator('[data-analytics="notes"] summary').first().click();assert((await workspace.locator('[data-analytics="notes"]').innerText()).includes('Fixture: followed the plan'));
   const scoreSurface=workspace.locator('[data-analytics="scorecard"] .premium-analytics-card').first();await scoreSurface.scrollIntoViewIfNeeded();await scoreSurface.screenshot({path:`artifacts/history-restored-scorecard-${width}-${theme}-${language}.png`,animations:'disabled'});
   await workspace.getByRole('button',{name:copy.finance,exact:true}).click();assert.equal(await workspace.getAttribute('data-context'),'finance');assert.equal(compact(await amount.innerText()),display(1400));
  }else assert.equal(compact(await amount.innerText()),display(1410));
  const baseAmount=await amount.innerText();
  assert.equal(await dialog.locator('.free-history-card').count(),0);
  assert.equal(await workspace.locator('.financial-record-row').count(),3);
  await workspace.locator('.premium-history-more').filter({hasText:copy.more}).click();
  assert.equal(await workspace.locator('.financial-record-row').count(),trader?4:8);
  await workspace.getByRole('button',{name:copy.income,exact:true}).click();assert.equal(await workspace.locator('.financial-record-row').count(),trader?1:3);assert.equal(await amount.innerText(),baseAmount);
  await workspace.getByRole('button',{name:copy.all,exact:true}).click();
  await workspace.getByRole('button',{name:copy.analysis,exact:true}).click();
  assert.equal(await workspace.locator('.financial-category').count(),trader?3:4,'all categories are available');assert.equal(await workspace.locator('.premium-history-row').count(),0);
  assert.equal(await workspace.locator('[data-analytics="financial-picture"]').count(),1);assert.equal(await workspace.locator('[data-analytics="period-dynamics"]').count(),1);
  for(const key of ['financialRadar','periodPower','activity','frequentIncome','expensePattern'])assert((await workspace.innerText()).toLocaleLowerCase().includes(translate(language,key).toLocaleLowerCase()),key+' is preserved');
  const materials=await workspace.locator('.premium-analytics-card').evaluateAll(nodes=>nodes.filter(node=>!node.parentElement.closest('.premium-analytics-card')).map(node=>({radius:getComputedStyle(node).borderRadius,background:getComputedStyle(node).backgroundImage})));
  assert(materials.length>3);assert(materials.every(item=>item.radius==='23px'));assert.equal(new Set(materials.map(item=>item.background)).size,1,'all analytical cards share the same glass material');
  if(!trader)assert.equal(await workspace.locator('.financial-trading-note').count(),1);
  await workspace.locator('.premium-history-plan summary').click();await workspace.locator('.wealth-entry-footer button').click();await page.locator('.savings-dialog').waitFor();
  await page.locator('.savings-dialog button.savings-icon').click();await page.locator('.savings-dialog').waitFor({state:'detached'});
  await workspace.locator('.financial-category').first().click();assert(await workspace.locator('.premium-history-category-filter').isVisible());
  assert.equal(await amount.innerText(),baseAmount);await workspace.getByLabel(copy.clearCategory,{exact:true}).click();
  await workspace.getByLabel(copy.currency,{exact:true}).selectOption('ALL');assert.equal(await amount.innerText(),'—');
  await workspace.getByLabel(copy.currency,{exact:true}).selectOption('MDL');assert.equal(await workspace.locator('.financial-record-row').count(),1);assert.equal(compact(await amount.innerText()),display(-9999));
  await workspace.getByLabel(copy.currency,{exact:true}).selectOption('CNY');assert.equal(await workspace.locator('.financial-record-row').count(),0);assert.match(await amount.innerText(),/0/);
  await workspace.getByLabel(copy.currency,{exact:true}).selectOption('USD');
  await workspace.getByLabel(copy.period,{exact:true}).selectOption('custom');await workspace.getByLabel(copy.dateFrom,{exact:true}).fill('2000-01-01');await workspace.getByLabel(copy.dateTo,{exact:true}).fill('2000-01-02');assert.equal(await workspace.locator('.financial-record-row').count(),0);assert.match(await amount.innerText(),/0/);
  await workspace.getByLabel(copy.period,{exact:true}).selectOption('Вся история');
  await workspace.getByRole('button',{name:copy.analysis,exact:true}).click();
  assert(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1),'dialog fits viewport');assert(await workspace.locator('.premium-history-balance').evaluate(el=>el.scrollWidth<=el.clientWidth+1),'semantic amount fits');
  const settings=await dialog.evaluate(el=>{const s=getComputedStyle(el);return ['--premium-result-size','--premium-radius','--premium-depth','--premium-row-padding'].map(k=>s.getPropertyValue(k).trim());});assert.deepEqual(settings,['34px','27px','35px','14px']);
  await dialog.screenshot({path:`artifacts/premium-history-${width}-${theme}-${language}-${trader?'trader-finance':'pro'}.png`,animations:'disabled'});
  await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await workspace.locator('.premium-history-panel').evaluate(el=>getComputedStyle(el).animationName),'none');
  assert.deepEqual(errors,[]);console.log('PASS',width,theme,language,trader?'trader + inherited PRO':'PRO');
 }catch(error){await page.screenshot({path:`artifacts/premium-history-failure-${width}-${theme}-${language}-${trader}.png`,fullPage:true});throw error;}finally{await context.close();}
}}finally{await browser.close();}
