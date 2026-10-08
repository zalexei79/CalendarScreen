// Real calendar UI, local auth/entitlement/storage fixtures; no external writes.
import {createRequire} from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire(path.resolve('package.json'));
const auth=`import {useState} from 'react';export function useAuth(){const [setupStep,setSetupStep]=useState(null);const [owner,setOwner]=useState('22222222-2222-4222-8222-222222222222');window.switchTestOwner=setOwner;return {user:{id:owner,email:'test@example.test',user_metadata:{nickname:'Test'}},validUserId:owner,authReady:true,setupStep,setSetupStep,handleGoogleLogin:()=>{},handleGoogleLogout:()=>{},handleTelegramLogin:()=>{}};}`;
const trades=`import {useState,useRef} from 'react';export function useTrades(){const [manualTrades,setManualTrades]=useState(()=>JSON.parse(localStorage.getItem('test_records')||'{}'));const manualTradesRef=useRef(manualTrades);manualTradesRef.current=manualTrades;return {manualTrades,setManualTrades,manualTradesRef,pendingSyncCount:0,failedSyncCount:0,cacheTradesLocally:()=>{},refreshFromCloud:async()=>{},retryFailedSync:()=>{},deleteTrade:async()=>{},detachMoneyCategory:async()=>{},mutateVoiceRecord:async()=>{},clearAllTrades:async()=>{},saveTrade:async entry=>{window.lastSaved=entry;setManualTrades(current=>{const next={...current,[entry.dateKey]:[...(current[entry.dateKey]||[]),{...entry,id:'saved',pnl:entry.signedPnl}]};localStorage.setItem('test_records',JSON.stringify(next));return next;});return entry;}};}`;
const bundle=await require('esbuild').build({stdin:{resolveDir:process.cwd(),loader:'jsx',contents:"import React from 'react';import {createRoot} from 'react-dom/client';import CalendarScreen from './CalendarScreen.jsx';createRoot(document.getElementById('root')).render(<CalendarScreen/>);"},bundle:true,write:false,outfile:'savings.js',format:'iife',define:{'import.meta.env.VITE_SUPABASE_URL':JSON.stringify('https://local-fixture.supabase.co'),'import.meta.env.VITE_SUPABASE_ANON_KEY':JSON.stringify('local-test-key'),'import.meta.env.VITE_CTRADER_CLIENT_ID':JSON.stringify(''),'import.meta.env.VITE_VAPID_PUBLIC_KEY':JSON.stringify('')},plugins:[{name:'local-fixtures',setup(build){build.onResolve({filter:/useProAccess\.js$/},()=>({path:'pro',namespace:'fixture'}));build.onResolve({filter:/\/useAuth$/},()=>({path:'auth',namespace:'fixture'}));build.onResolve({filter:/\/useTrades$/},()=>({path:'trades',namespace:'fixture'}));build.onLoad({filter:/.*/,namespace:'fixture'},({path:name})=>({resolveDir:process.cwd(),contents:name==='auth'?auth:name==='trades'?trades:"export const useProAccess=()=>({active:true,loading:false,until:null,refresh:async()=>true});"}));}}]});
const css=fs.readFileSync(path.join('dist/assets',fs.readdirSync('dist/assets').find(file=>file.endsWith('.css'))),'utf8');
const browser=await createRequire('C:/Users/aveel/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('playwright').chromium.launch({channel:'msedge',headless:true});
try{
 for(const [width,theme] of [[390,'purple'],[320,'dark'],[1280,'emerald'],[390,'light']]){
  const context=await browser.newContext({viewport:{width,height:844},serviceWorkers:'block'});
  await context.addInitScript(theme=>{
   for(const [key,value] of Object.entries({dayris_onboarding_v2_completed:'1',calendar_guide_completed:'1',atj_pro_view:'1',atj_trader_mode:'0',atj_currency:'USD',atj_entry_currency:'USD',atj_theme:theme}))localStorage.setItem(key,value);
   if(!localStorage.getItem('atj_language'))localStorage.setItem('atj_language','ru');
   if(!localStorage.getItem('test_records')){
    const d=new Date(),date=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    localStorage.setItem('test_records',JSON.stringify({[date]:[{id:'salary',instrument:'Зарплата',pnl:1000,currency:'USD',platform:'Manual',time:'09:00'},{id:'s1',instrument:'Подписки',pnl:-20,currency:'USD',platform:'Manual',time:'10:00'},{id:'s2',instrument:'Подписки',pnl:-20,currency:'USD',platform:'Manual',time:'11:00'},{id:'shopping',instrument:'Покупки',pnl:-200,currency:'USD',platform:'Manual',time:'12:00',comment:'Спонтанная покупка, потом пожалел'},{id:'home',instrument:'Жильё',pnl:-500,currency:'USD',platform:'Manual',time:'13:00'},{id:'trade',instrument:'XAUUSD',pnl:-900,currency:'USD',platform:'cTrader',time:'14:00'},{id:'mdl',instrument:'Кафе',pnl:-9000,currency:'MDL',platform:'Manual',time:'15:00'}]}));
   }
  },theme);
  const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',route=>new URL(route.request().url()).hostname==='savings.test'?route.fulfill({contentType:'text/html',body:`<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}${bundle.outputFiles.find(f=>f.path.endsWith('.css')).text}body{margin:0}</style><div id="root"></div><script>${bundle.outputFiles.find(f=>f.path.endsWith('.js')).text}</script>`}):route.abort());
  await page.goto('http://savings.test');
  await page.getByRole('button',{name:'История',exact:true}).click();
  await page.locator('.financial-history-dialog').getByRole('button',{name:'Все валюты',exact:true}).click();
  assert.ok(await page.getByRole('button',{name:'Разобрать мои расходы',exact:true}).isDisabled());
  await page.locator('.financial-history-dialog').getByRole('button',{name:'USD',exact:true}).click();
  await page.getByRole('button',{name:'Разобрать мои расходы',exact:true}).click();
  const review=page.locator('.savings-dialog');await review.waitFor();
  await review.getByText('В заметке есть упоминание спонтанной покупки',{exact:true}).waitFor();
  assert.match(await review.locator('.savings-overview').textContent(),/740/);
  assert.equal(await review.locator('.savings-findings article').count(),3);
  await page.waitForTimeout(450);await review.screenshot({path:`tests/savings-${width}-${theme}-review.png`});
  await review.getByRole('button',{name:'Выбрать, что сократить',exact:true}).click();
  assert.ok(await review.getByRole('button',{name:'Посмотреть план',exact:true}).isDisabled());
  await review.getByRole('group',{name:'Подписки',exact:true}).getByRole('button',{name:'На 1 покупку реже',exact:true}).click();
  await review.getByRole('group',{name:'Покупки',exact:true}).getByRole('button',{name:'Меньше на 25%',exact:true}).click();
  assert.equal(await review.locator('article[data-essential=true] button').count(),0);
  await review.getByRole('button',{name:'Посмотреть план',exact:true}).click();
  assert.equal(await review.locator('.savings-result strong').textContent(),'+$70');
  assert.match(await review.locator('.savings-comparison').textContent(),/740.*670/s);
  assert.ok(await review.evaluate(el=>el.scrollWidth<=el.clientWidth+1),'No horizontal overflow');
  await page.waitForTimeout(450);await review.screenshot({path:`tests/savings-${width}-${theme}-plan.png`});
  await review.getByRole('button',{name:'Сохранить план',exact:true}).click();
  await review.getByText('План с тобой.',{exact:true}).waitFor();
  const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('dayris_savings_plan:22222222-2222-4222-8222-222222222222')));
  assert.equal(stored.saving,70);assert.equal(stored.actions.length,2);assert.equal(stored.reminders,true);
  await review.getByRole('button',{name:'Готово',exact:true}).click();await review.waitFor({state:'detached'});
  await page.locator('.financial-history-dialog').getByRole('button',{name:'Закрыть',exact:true}).click();
  await page.getByRole('button',{name:'Добавить',exact:true}).click();
  await page.getByRole('button',{name:'Расходы',exact:true}).click();
  await page.getByRole('textbox',{name:'Сумма',exact:true}).fill('20');
  await page.getByRole('button',{name:'Категория',exact:true}).click();
  await page.getByRole('button',{name:'Подписки',exact:true}).click();
  await page.locator('.savings-nudge:not(.savings-toast)').getByText('Помнишь свой план?',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Сохранить запись',exact:true}).click();
  await page.locator('.savings-toast').waitFor();assert.equal((await page.evaluate(()=>window.lastSaved)).signedPnl,-20);
  await page.locator('.savings-toast').getByRole('button',{name:'Закрыть подсказку',exact:true}).click();
  await page.reload();
  await page.getByRole('button',{name:'История',exact:true}).click();await page.getByRole('button',{name:'Пересмотреть план',exact:true}).click();
  await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await review.evaluate(el=>getComputedStyle(el).animationName),'none');
  await page.keyboard.press('Escape');await review.waitFor({state:'detached'});
  if(width===390&&theme==='purple'){
   await page.evaluate(()=>window.switchTestOwner('33333333-3333-4333-8333-333333333333'));
   await page.getByRole('button',{name:'Разобрать мои расходы',exact:true}).waitFor();
   assert.equal(await page.locator('.savings-saved').count(),0,'Plans never leak to another account');
   await page.evaluate(()=>window.switchTestOwner('22222222-2222-4222-8222-222222222222'));
   await page.getByRole('button',{name:'Пересмотреть план',exact:true}).waitFor();
   for(const [language,history,action,next,result] of [['en','History','Review plan','Choose what to reduce','See my plan'],['md','Istoric','Revizuiește planul','Alege ce reduci','Vezi planul'],['zh-CN','历史','重新查看计划','选择要减少的支出','查看计划']]){
    await page.evaluate(language=>localStorage.setItem('atj_language',language),language);await page.reload();
    await page.getByRole('button',{name:history,exact:true}).click();await page.getByRole('button',{name:action,exact:true}).click();
    await review.getByRole('button',{name:next,exact:true}).click();await review.getByRole('button',{name:result,exact:true}).click();
    assert.equal(await review.locator('.savings-result strong').textContent(),'+$70');
    assert.ok(!/[А-Яа-яЁё]/.test(await review.innerText()),`${language}: no Russian UI strings`);
    assert.equal(await review.evaluate(el=>el.scrollWidth<=el.clientWidth+1),true);
    await page.keyboard.press('Escape');
   }
  }
  assert.deepEqual(errors,[]);await context.close();
 }
 console.log('PASS: real calendar savings review → choices → accurate plan → persistence → manual-entry reminder and save; 320/390/1280, 4 themes, reduced motion.');
}finally{await browser.close();}
