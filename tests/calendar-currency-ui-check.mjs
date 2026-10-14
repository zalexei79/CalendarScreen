import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { installStoryAccount, storyUserId } from './life-story-auth-fixture.mjs';
const require = createRequire('C:/Users/aveel/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const browser = await require('playwright').chromium.launch({ channel:'msedge', headless:true });
const saved = { '2026-10-05': [
  { id:'usd-record', time:'10:00', pnl:100, currency:'USD', instrument:'Зарплата', platform:'Manual' },
  { id:'eur-record', time:'11:00', pnl:200, currency:'EUR', instrument:'Зарплата', platform:'Manual' },
], '2026-10-04': [{id:'other-currency-record',time:'09:00',pnl:50,currency:'EUR',instrument:'Зарплата',platform:'Manual'}] };
try {
  const context = await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
  await context.addInitScript(({saved,id,pro})=>{
    localStorage.setItem('atj_pro_view',pro ? '1' : '0');
    localStorage.setItem('atj_trader_mode','0');
    localStorage.setItem('atj_language','ru'); localStorage.setItem('atj_theme','emerald');
    localStorage.setItem('atj_currency','USD'); localStorage.setItem('atj_entry_currency','USD');
    localStorage.setItem('dayris_onboarding_v2_completed','1'); localStorage.setItem('calendar_guide_completed','1');
    localStorage.setItem(`money_calendar_trades_${id}`,JSON.stringify(saved));
    localStorage.setItem(`pro_month_goal_v1:${id}:2026-10:USD`,'55');
    localStorage.setItem(`goal_celebrated_2026-10_USD:${id}`,'55');
  },{saved,id:storyUserId,pro:process.env.DAYRIS_TEST_PRO === '1'});
  await context.route('**/*',route=>{
    const url=new URL(route.request().url());
    if(url.origin!=='http://calendar.test')return route.abort();
    const name=path.resolve('dist',url.pathname==='/'?'index.html':'.'+url.pathname);
    if(!name.startsWith(path.resolve('dist')+path.sep)||!fs.existsSync(name))return route.fulfill({status:404,body:''});
    return route.fulfill({contentType:name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':name.endsWith('.png')?'image/png':'text/html',body:fs.readFileSync(name)});
  });
  await installStoryAccount(context);
  await context.route('**/rest/v1/rpc/get_my_pro_status',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({active:process.env.DAYRIS_TEST_PRO === '1'})}));
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.clock.install({time:new Date('2026-10-05T12:00:00')});
  await page.goto('http://calendar.test/');await page.clock.pauseAt(new Date('2026-10-05T13:00:00'));
  await page.locator(process.env.DAYRIS_TEST_PRO==='1'?'.calendar-days-grid .pro-calendar-day':'.calendar-days-grid').first().waitFor();
  assert.equal(await page.locator('.calendar-days-grid .pro-calendar-day').count()>0,process.env.DAYRIS_TEST_PRO==='1','Exercise the intended FREE or PRO calendar');
  assert.equal(await page.locator('.calendar-currency-caption, .calendar-other-currencies').count(),0,'Calendar has no duplicate currency labels');
  const today=page.locator('.calendar-days-grid [data-today-cell=true]');
  assert.equal(await page.locator('.dayris-brand-row .workspace-mode-toggle').count(),1,'Mode lives in the top row');
  assert.equal(await page.locator('.workspace-mode-panel .workspace-selector').count(),0,'No duplicate mode control');
  const nav=await page.locator('.dayris-date-navigation').boundingBox();
  const currencyTrigger=await page.getByRole('button',{name:'Валюта календаря: USD',exact:true}).boundingBox();
  assert.ok(currencyTrigger.y>=nav.y && currencyTrigger.y+currencyTrigger.height<=nav.y+nav.height+1,'Currency stays next to the month');
  if(process.env.DAYRIS_TEST_PRO==='1'){
    const goal=page.locator('.monthly-goal-bar');
    assert.ok((await goal.boundingBox()).height<=45,'Goal is a compact strip');
    assert.match(await goal.innerText(),/Цель достигнута/);
    await page.screenshot({path:'tests/header-compact-390.png',animations:'disabled'});
    await goal.getByRole('button',{name:/^Цель месяца/}).click();await page.clock.runFor(400);
    assert.match(await goal.innerText(),/100.*55.*USD/s,'Exact amounts are available in details');
    assert.equal(await goal.getByRole('button',{name:'Изменить цель',exact:true}).isVisible(),true);
    await goal.getByRole('button',{name:/^Цель месяца/}).click();await page.clock.runFor(400);
    assert.equal(await goal.getByRole('button',{name:'Изменить цель',exact:true}).count(),0);
  }
  assert.match(await today.innerText(),/100/);
  const assertAmountFits=async()=>assert.equal(await today.locator('.day-amount').evaluate(el=>{
    const a=el.getBoundingClientRect(),b=el.closest('button').getBoundingClientRect();
    return a.width>0 && a.height>0 && a.left>=b.left && a.right<=b.right && a.bottom<=b.bottom;
  }),true,'Amount stays inside its calendar cell');
  await assertAmountFits();
  await page.getByRole('button',{name:'Валюта календаря: USD',exact:true}).click();
  assert.deepEqual(await page.locator('.calendar-currency-option').allTextContents(),['$USD','€EUR','LMDL','₽RUB','¥CNY']);
  await page.locator('.calendar-currency-option').filter({hasText:'EUR'}).click();await page.clock.runFor(400);
  assert.equal(await page.evaluate(()=>localStorage.getItem('atj_currency')),'EUR');
  assert.equal(await page.evaluate(()=>localStorage.getItem('atj_entry_currency')),'USD');
  assert.match(await page.locator('.calendar-days-grid [data-today-cell=true]').innerText(),/200/);
  assert.doesNotMatch(await page.locator('.calendar-days-grid [data-today-cell=true]').innerText(),/100/);
  assert.deepEqual(await page.evaluate(id=>JSON.parse(localStorage.getItem(`money_calendar_trades_${id}`)),storyUserId),saved);
  await page.getByRole('button',{name:'Настройки',exact:true}).click();await page.clock.runFor(400);
  await page.getByRole('button',{name:'Валюта новых записей USD'}).click();
  await page.getByRole('button',{name:'MDL — Молдавский лей'}).click();
  assert.equal(await page.evaluate(()=>localStorage.getItem('atj_entry_currency')),'MDL');
  assert.equal(await page.evaluate(()=>localStorage.getItem('atj_currency')),'EUR');
  await page.getByRole('button',{name:'Закрыть настройки',exact:true}).click();await page.clock.runFor(400);
  await page.getByRole('button',{name:'Добавить',exact:true}).click();await page.clock.runFor(400);
  assert.equal(await page.getByRole('button',{name:/MDL$/,pressed:true}).count(),1,'New entry uses its own default currency');
  await page.keyboard.press('Escape');await page.clock.runFor(400);
  for(const width of [320,390,768,1440]){
    await page.setViewportSize({width,height:900});await page.clock.runFor(32);
    await assertAmountFits();
    if(width>=1280 && process.env.DAYRIS_TEST_PRO==='1'){
      await today.hover();await page.clock.runFor(300);
      assert.equal(await today.locator('.day-amount-full').isVisible(),true,'PRO without trader mode keeps amount visible on hover');
      await page.mouse.move(0,0);
    }
    const trigger=page.getByRole('button',{name:'Валюта календаря: EUR',exact:true});await trigger.click();await page.clock.runFor(300);
    const box=await page.locator('.calendar-currency-menu').boundingBox();
    assert.ok(box.x>=0 && box.x+box.width<=width,'Menu fits viewport');
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.screenshot({path:`tests/currency-${width}.png`,animations:'disabled'});
    await page.keyboard.press('Escape');await page.clock.runFor(200);
    assert.equal(await trigger.evaluate(el=>el===document.activeElement),true);
  }
  assert.deepEqual(errors,[]);
  console.log('PASS: ordered currency picker, view filtering, independent new-entry default, records unchanged, keyboard/focus and viewport fit.');
} finally { await browser.close(); }
