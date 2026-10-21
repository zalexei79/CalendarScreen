// Production build + local account/entitlement fixtures. No real account writes.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import {installStoryAccount,storyUserId} from './life-story-auth-fixture.mjs';
const {chromium}=createRequire('C:/Users/aveel/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('playwright');
const browser=await chromium.launch({channel:'msedge',headless:true});
try {
 const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
 await context.addInitScript(id=>{
  for(const [key,value] of Object.entries({atj_theme:'gold',atj_pro_view:'1',atj_trader_mode:'0',atj_language:'ru',atj_currency:'MDL',dayris_onboarding_v2_completed:'1',calendar_guide_completed:'1',dayris_wallet_onboarding_v2:'1'})) if(key!=='atj_theme'||!localStorage.getItem(key))localStorage.setItem(key,value);
  localStorage.setItem(`money_calendar_trades_${id}`,JSON.stringify({
   '2026-10-15':[{id:'gold-income',time:'09:00',pnl:2400,currency:'MDL',instrument:'Зарплата',platform:'Manual'}],
   '2026-10-14':[{id:'gold-expense',time:'10:00',pnl:-650,currency:'MDL',instrument:'Продукты',platform:'Manual'}],
  }));
 },storyUserId);
 await context.route('**/*',route=>{
  const url=new URL(route.request().url());
  if(url.origin!=='http://gold.test') {
   return route.abort();
  }
  const root=path.resolve('dist'),file=path.resolve(root,url.pathname==='/'?'index.html':'.'+url.pathname);
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile())return route.fulfill({status:404,body:''});
  return route.fulfill({contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':file.endsWith('.svg')?'image/svg+xml':'text/html',body:fs.readFileSync(file)});
 });
 await installStoryAccount(context);
 let active=true,releaseInitial,initialCalled;
 const initialRequest=new Promise(resolve=>{initialCalled=resolve;});
 let calls=0;
 await context.route('**/rest/v1/rpc/get_my_pro_status',async route=>{
  if(++calls===1) {initialCalled();await new Promise(resolve=>{releaseInitial=resolve;});}
  await route.fulfill({contentType:'application/json',body:JSON.stringify({active})});
 });
 const page=await context.newPage(),errors=[];page.setDefaultTimeout(10000);page.on('pageerror',error=>errors.push(error.message));
 await page.clock.install({time:new Date('2026-10-15T12:00:00')});
 await page.goto('http://gold.test');await initialRequest;
 await page.waitForFunction(()=>document.documentElement.dataset.dayrisTheme==='dark');
 assert.equal(await page.evaluate(()=>localStorage.getItem('atj_theme')),'gold','Pending access retains the preference without applying gold');
 releaseInitial();
 await page.waitForFunction(()=>document.documentElement.dataset.dayrisTheme==='gold');
 await page.clock.pauseAt(new Date('2026-10-15T13:00:00'));
 assert.equal(await page.locator('meta[name="theme-color"]').getAttribute('content'),'#0b0b0d');
 for(const width of [320,390,1280]) {
  await page.setViewportSize({width,height:width<640?844:950});await page.clock.runFor(600);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  const amounts=await page.locator('.pro-calendar-day .day-amount').evaluateAll(elements=>elements.map(el=>{
   const r=el.getBoundingClientRect(),cell=el.closest('button').getBoundingClientRect();
   return {width:r.width,height:r.height,inside:r.left>=cell.left&&r.right<=cell.right&&r.top>=cell.top&&r.bottom<=cell.bottom};
  }));
  assert.equal(amounts.length,2);assert.ok(amounts.every(a=>a.width>=24&&a.height>0&&a.inside),'PRO amounts remain visible inside gold cells');
  await page.screenshot({path:`tests/gold-calendar-${width}.png`,animations:'disabled'});
 }
 await page.setViewportSize({width:390,height:844});
 await page.getByRole('button',{name:'Настройки',exact:true}).click();await page.clock.runFor(400);
 const settings=page.locator('[data-dayris-settings]');
 const gold=settings.getByRole('button',{name:'Золото',exact:true});
 const emerald=settings.getByRole('button',{name:'Изумрудное',exact:true});
 assert.equal(await settings.locator('.theme-basics [data-theme-option="emerald"]').count(),0,'Emerald belongs only to the PRO collection');
 assert.equal(await settings.locator('.theme-premium-card').count(),2);
 assert.equal(await gold.getAttribute('aria-pressed'),'true');
 await gold.scrollIntoViewIfNeeded();await page.screenshot({path:'tests/gold-settings-390.png',animations:'disabled'});
 await settings.getByRole('button',{name:'Светлое',exact:true}).click();await page.clock.runFor(600);
 assert.equal(await page.locator('html').getAttribute('data-dayris-theme'),'light');
 await gold.click();await page.clock.runFor(600);
 assert.equal(await page.locator('html').getAttribute('data-dayris-theme'),'gold');
 await emerald.click();await page.clock.runFor(600);
 assert.equal(await page.locator('html').getAttribute('data-dayris-theme'),'emerald');
 await emerald.scrollIntoViewIfNeeded();await page.screenshot({path:'tests/pro-theme-collection-390.png',animations:'disabled'});
 await gold.click();await page.clock.runFor(600);
 await settings.getByRole('button',{name:'Закрыть настройки',exact:true}).click();await page.clock.runFor(400);
 // Same PRO account may select Gold even with the FREE workspace view.
 await page.locator('.workspace-mode-toggle').click();await page.clock.runFor(500);
 assert.equal(await page.locator('html').getAttribute('data-dayris-theme'),'gold');
 await page.locator('.workspace-mode-toggle').click();await page.clock.runFor(500);
 await page.getByRole('button',{name:'История',exact:true}).click();await page.clock.runFor(500);
 const history=page.locator('.financial-history-dialog');await history.waitFor();
 assert.equal(await history.evaluate(el=>getComputedStyle(el).getPropertyValue('--fh-gold').trim()),'#ead2a0');
 await page.screenshot({path:'tests/gold-history-390.png',animations:'disabled'});
 await history.getByRole('button',{name:'Закрыть',exact:true}).click();await page.clock.runFor(500);
 // Confirmed revocation must immediately remove the paid palette.
 active=false;await page.clock.runFor(120100);
 await page.waitForFunction(()=>document.documentElement.dataset.dayrisTheme==='dark');
 await page.getByRole('button',{name:'Настройки',exact:true}).click();await page.clock.runFor(400);
 assert.equal(await gold.getAttribute('aria-pressed'),'false');
 await emerald.click();await page.clock.runFor(300);
 const preview=page.locator('.theme-preview-dialog');await preview.waitFor();
 assert.equal(await preview.getAttribute('data-material'),'emerald');
 assert.equal(await page.locator('html').getAttribute('data-dayris-theme'),'dark','An Emerald preview never applies the paid theme');
 await page.keyboard.press('Escape');await page.clock.runFor(300);
 assert.equal(await preview.count(),0);assert.equal(await settings.count(),1,'Escape closes only the preview');
 await gold.click();await page.clock.runFor(600);
 await preview.getByRole('button',{name:'Открыть PRO',exact:true}).click();await page.clock.runFor(500);
 await page.locator('.pro-dialog').waitFor();
 assert.equal(await page.locator('html').getAttribute('data-dayris-theme'),'dark','Locked Gold opens PRO without changing the palette');
 // A stored Emerald preference is also locked and restores only after confirmation.
 await page.evaluate(()=>localStorage.setItem('atj_theme','emerald'));
 await page.reload();await page.waitForFunction(()=>document.documentElement.dataset.dayrisTheme==='dark');
 assert.equal(await page.evaluate(()=>localStorage.getItem('atj_theme')),'emerald');
 active=true;await page.clock.runFor(120100);
 await page.waitForFunction(()=>document.documentElement.dataset.dayrisTheme==='emerald');
 const cdp=await context.newCDPSession(page);
 await cdp.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-transparency',value:'reduce'}]});
 assert.equal(await page.locator('.dayris-header').evaluate(el=>getComputedStyle(el).backdropFilter),'none');
 await page.emulateMedia({reducedMotion:'reduce'});
 assert.equal(await page.locator('.calendar-day-surface').first().evaluate(el=>getComputedStyle(el).transitionDuration),'0s');
 assert.deepEqual(errors,[]);
 console.log('PASS: Gold and Emerald PRO gates, no loading flash, 320/390/1280, amounts, collection selection, FREE workspace, history, revocation, locked previews, upsell, restoration, reduced transparency/motion.');
} finally {await browser.close();}
