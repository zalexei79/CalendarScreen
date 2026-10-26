import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {installStoryAccount,storyUserId} from './life-story-auth-fixture.mjs';
const {chromium,webkit}=createRequire(process.env.DAYRIS_PLAYWRIGHT_PACKAGE||'C:/Users/aveel/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('playwright');
const engine=process.env.DAYRIS_TEST_WEBKIT?'webkit':'edge';
const browser=await(engine==='webkit'?webkit.launch({headless:true}):chromium.launch({channel:'msedge',headless:true}));
const output='artifacts/calendar-fixes';fs.mkdirSync(output,{recursive:true});
const records={'2026-10-26':[
 {id:'usd',time:'12:00',pnl:-123.45,currency:'USD',instrument:'Продукты',platform:'Manual'},
 {id:'eur',time:'11:00',pnl:230.25,currency:'EUR',instrument:'Зарплата',platform:'Manual'},
]};
try{for(const theme of ['dark','light','gold','emerald','purple']){
 const context=await browser.newContext({viewport:{width:390,height:844},timezoneId:'Europe/Bucharest',serviceWorkers:'block',isMobile:true,hasTouch:true});
 await context.addInitScript(({id,theme,records})=>{
  for(const [k,v]of Object.entries({atj_language:'uk',atj_theme:theme,atj_currency:'USD',atj_pro_view:theme==='dark'||theme==='light'?'0':'1',atj_trader_mode:'0',dayris_onboarding_v2_completed:'1',calendar_guide_completed:'1'}))localStorage.setItem(k,v);
  localStorage.setItem(`money_calendar_trades_${id}`,JSON.stringify(records));
  const original=URL.createObjectURL;URL.createObjectURL=function(blob){if(blob.type.startsWith('text/csv'))window.csvBlob=blob;return original.call(this,blob)};
 },{id:storyUserId,theme,records});
 await context.route('**/*',route=>{
  const url=new URL(route.request().url());
  if(url.origin!=='http://calendar.test')return route.abort();
  const file=path.resolve('dist',url.pathname==='/'?'index.html':'.'+url.pathname);
  if(!file.startsWith(path.resolve('dist')+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:''});
  return route.fulfill({body:fs.readFileSync(file),contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':'text/html'});
 });
 await installStoryAccount(context);
 await context.route('**/rest/v1/rpc/get_my_pro_status',r=>r.fulfill({contentType:'application/json',body:'{"active":true}'}));
 let failPlans=theme==='dark';
 await context.route('**/rest/v1/reminders?*',r=>r.fulfill({status:failPlans?503:200,contentType:'application/json',body:failPlans?'{"message":"temporary failure"}':JSON.stringify([{id:'plan',title:'Оренда',kind:'expense',amount:50,currency:'USD',local_at:'2026-10-27 09:00:00',status:'active',outcome:'planned',repeat_rule:'monthly',repeat_total:2,repeat_index:1}])}));
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.clock.install({time:new Date('2026-10-26T21:59:00Z')});
 await page.goto('http://calendar.test');await page.locator('.calendar-days-grid').waitFor();await page.clock.runFor(500);
 if(failPlans){
  const status=page.locator('[data-calendar-plans-status][role=alert]');await status.waitFor();
  failPlans=false;await status.getByRole('button',{name:'Повторити',exact:true}).click();
  await page.waitForFunction(()=>!document.querySelector('[data-calendar-plans-status]'));
 }
 const today=page.locator('.calendar-days-grid [data-today-cell=true]');
 assert.match(await today.innerText(),/123/);
 await today.click();await page.locator('[data-sheet-entrance=true]').waitFor();
 assert.match(await page.locator('[data-sheet-entrance=true]').innerText(),/123[.,]45/);
 await page.evaluate(()=>history.back());await page.waitForFunction(()=>!document.querySelector('[data-sheet-entrance=true]'));
 await page.clock.fastForward(120000);
 assert.equal(await page.locator('.calendar-days-grid [data-today-cell=true]').locator('span').filter({hasText:/^27$/}).count(),1);
 for(const width of [320,390,1440]){
  await page.setViewportSize({width,height:900});await page.clock.runFor(400);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${theme} fits ${width}`);
  await page.screenshot({path:`${output}/${engine}-${theme}-${width}.png`,animations:'disabled'});
 }
 // The report starts with the same currency-filtered selection as history.
 if(theme==='dark'){
  await page.getByRole('button',{name:'Історія',exact:true}).click();await page.clock.runFor(400);
  await page.getByRole('button',{name:'Завантажити звіт',exact:true}).click();await page.clock.runFor(200);
  await page.getByRole('button',{name:'Завантажити грошовий звіт',exact:true}).click();
  await page.waitForFunction(()=>window.csvBlob);
  const selected=await page.evaluate(()=>csvBlob.text());
  assert.match(selected,/'?2026-10-26/);assert.match(selected,/"-123.45","USD"/);assert.doesNotMatch(selected,/"230.25","EUR"/);
  await page.getByRole('button',{name:'Завантажити звіт',exact:true}).click();await page.clock.runFor(200);
  await page.getByRole('button',{name:'Усі записи',exact:true}).click();
  await page.evaluate(()=>window.csvBlob=null);
  await page.getByRole('button',{name:'Завантажити грошовий звіт',exact:true}).click();await page.waitForFunction(()=>window.csvBlob);
  const all=await page.evaluate(()=>csvBlob.text());assert.match(all,/"230.25","EUR"/);assert.match(all,/"-123.45","USD"/);
 }
 assert.deepEqual(errors,[]);console.log(`PASS ${engine} ${theme}: production day Back, midnight, amounts, 320/390/1440 fit${theme==='dark'?', plan retry and CSV selection/full export':''}.`);
 await context.close();
}}finally{await browser.close()}
