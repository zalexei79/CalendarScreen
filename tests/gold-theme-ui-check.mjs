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
   '2026-09-29':[{id:'gold-adjacent-income',time:'09:00',pnl:8000,currency:'MDL',instrument:'Зарплата',platform:'Manual'}],
   '2026-09-30':[{id:'gold-adjacent-expense',time:'10:00',pnl:-120,currency:'MDL',instrument:'Продукты',platform:'Manual'}],
   ...Object.fromEntries([[1,-3500],[2,-530],[3,-120],[4,-130],[5,-767],[7,-600],[8,-50],[9,-5000],[17,-500],[19,-249],[20,-264]].map(([day,pnl])=>[`2026-10-${String(day).padStart(2,'0')}`,[{id:`gold-expense-${day}`,time:'10:00',pnl,currency:'MDL',instrument:'Расход',platform:'Manual'}]])),
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
 assert.equal(await page.locator('html').getAttribute('data-gold-motion'),'');
 assert.equal(await page.locator('meta[name="theme-color"]').getAttribute('content'),'#0b0b0d');
 for(const width of [320,390,1280]) {
  await page.setViewportSize({width,height:width<640?844:950});await page.clock.runFor(600);
  // The virtual clock controls app timers, not the browser's CSS compositor.
  // Finish entrance transitions before asserting the resting material.
  await page.screenshot({path:`tests/gold-calendar-${width}.png`,animations:'disabled'});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  const amounts=await page.locator('.pro-calendar-day .day-amount').evaluateAll(elements=>elements.map(el=>{
   const r=el.getBoundingClientRect(),cell=el.closest('button').getBoundingClientRect();
   return {width:r.width,height:r.height,inside:r.left>=cell.left&&r.right<=cell.right&&r.top>=cell.top&&r.bottom<=cell.bottom};
  }));
  assert.equal(amounts.length,15);assert.ok(amounts.every(a=>a.width>=24&&a.height>0&&a.inside),'PRO amounts remain visible inside gold cells');
  const material=await page.locator('.calendar-section:not(.calendar-month-preview)').evaluate(section=>{
   const grid=section.querySelector('.calendar-days-grid'),cell=grid.querySelector('button'),dock=document.querySelector('.history-fab');
   const environment=document.querySelector('html[data-glass-parallax] .dayris-glass-parallax')||document.querySelector('.premium-shell');
   return {bottom:grid.getBoundingClientRect().bottom,dockTop:dock.getBoundingClientRect().top,shadow:getComputedStyle(cell).boxShadow,background:getComputedStyle(environment).backgroundImage};
  });
  assert.ok(material.bottom+9<=material.dockTop,'Raised calendar edges clear the floating dock');
  assert.match(material.shadow,/inset/);assert.match(material.shadow,/0px 4px 1px/,'A visible lower edge gives the glass real depth');
  assert.match(material.background,/url\(/,'One shared gold environment shines through the glass');
  // A previous gold override erased the semantic fill on adjacent-month days.
  for(const tone of ['profit','loss']) {
   const fills=await page.locator(`.calendar-day-surface[data-pnl-tone="${tone}"]`).evaluateAll(cells=>cells.map(el=>getComputedStyle(el).backgroundImage));
   assert.ok(fills.length>=2);assert.ok(fills.every(fill=>fill===fills[0]),`${tone} remains recognizable outside the current month`);
  }
 }
 // Six-week months must also clear the dock, including their raised lower edge.
 for(const width of [390,1280]) {
  await page.setViewportSize({width,height:width<640?844:950});await page.clock.runFor(600);
  await page.getByRole('button',{name:'Следующий месяц',exact:true}).click();await page.clock.runFor(700);
  const month=page.locator('.calendar-section:not(.calendar-month-preview) .calendar-days-grid');
  assert.equal(await month.locator('button').count(),42);
  assert.ok(await month.evaluate(grid=>grid.getBoundingClientRect().bottom+9<=document.querySelector('.history-fab').getBoundingClientRect().top),'All six rows and their shadows fit above the dock');
  await page.screenshot({path:`tests/gold-six-weeks-${width}.png`,animations:'disabled'});
  await page.getByRole('button',{name:'Предыдущий месяц',exact:true}).click();await page.clock.runFor(700);
 }
 // Real pointer activation lowers only the pressed glass; cancelling it does
 // not select a day or mutate the account's calendar data.
 const depthCell=page.locator('.calendar-section:not(.calendar-month-preview) .calendar-day-surface[data-pnl-tone="loss"]').first();
 await depthCell.hover(); // Wait for the month slide to settle before hit testing.
 const depthBox=await depthCell.boundingBox();
 await page.mouse.move(depthBox.x+15,depthBox.y+20);await page.mouse.down();await page.clock.runFor(150);
 await page.screenshot({path:'tests/gold-button-pressed-1280.png',animations:'disabled'});
 assert.equal(await depthCell.evaluate(el=>getComputedStyle(el).translate),'0px 2px');
 await page.mouse.move(5,5);await page.mouse.up();await page.clock.runFor(350);
 await page.screenshot({path:'tests/gold-button-released-1280.png',animations:'disabled'});
 assert.equal(await depthCell.evaluate(el=>getComputedStyle(el).translate),'none');
 // A touch lights the local material without capturing gestures or changing data.
 const touchCell=page.locator('.calendar-section:not(.calendar-month-preview) .calendar-day-surface[data-pnl-tone="loss"]').first();
 const touchBox=await touchCell.boundingBox();
 await touchCell.dispatchEvent('pointerdown',{pointerId:71,pointerType:'touch',isPrimary:true,clientX:touchBox.x+12,clientY:touchBox.y+18});
 assert.equal(await touchCell.getAttribute('data-gold-lit'),'');
 assert.match(await touchCell.evaluate(el=>el.style.getPropertyValue('--gold-pointer-x')),/%$/);
 await touchCell.dispatchEvent('pointercancel',{pointerId:71,pointerType:'touch',isPrimary:true});
 await page.clock.runFor(300);
 assert.equal(await touchCell.getAttribute('data-gold-lit'),null,'Cancelled swipes release the material light');
 const recordsBefore=await page.evaluate(()=>localStorage.getItem('money_calendar_trades_22222222-2222-4222-8222-222222222222'));
 await page.getByRole('button',{name:'Следующий месяц',exact:true}).click();await page.clock.runFor(600);
 await page.getByRole('button',{name:'Предыдущий месяц',exact:true}).click();await page.clock.runFor(600);
 assert.equal(await page.locator('.pro-calendar-day .day-amount').count(),15,'Month motion preserves the calendar data');
 assert.equal(await page.evaluate(()=>localStorage.getItem('money_calendar_trades_22222222-2222-4222-8222-222222222222')),recordsBefore);
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.locator('html:not([data-gold-motion])').waitFor();
 assert.equal(await page.locator('html').getAttribute('data-gold-motion'),null);
 assert.equal(await page.evaluate(()=>document.getAnimations().filter(a=>a.id==='dayris-gold-motion').length),0,'Reduced motion cancels running gold effects');
 await page.emulateMedia({reducedMotion:'no-preference'});
 await page.locator('html[data-gold-motion]').waitFor();
 const cdp=await context.newCDPSession(page);
 await cdp.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-transparency',value:'reduce'}]});
 assert.equal(await page.locator('.dayris-header').evaluate(el=>getComputedStyle(el).backdropFilter),'none');
 await page.screenshot({path:'tests/gold-reduced-transparency.png',animations:'disabled'});
 // Opaque fallback must still distinguish gains/losses and keep readable ink.
 const semanticContrast=await page.locator('.calendar-day-surface:not([data-pnl-tone="neutral"])').evaluateAll(cells=>{
  const rgb=s=>s.match(/[\d.]+/g).slice(0,3).map(Number);
  const luminance=s=>rgb(s).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);
  return cells.map(el=>{const bg=getComputedStyle(el).backgroundColor,ink=getComputedStyle(el.querySelector('.day-amount')).color;const a=luminance(bg),b=luminance(ink);return {tone:el.dataset.pnlTone,rgb:rgb(bg),contrast:(Math.max(a,b)+.05)/(Math.min(a,b)+.05)};});
 });
 assert.ok(semanticContrast.every(s=>s.contrast>=4.5),'Reduced-transparency amounts meet 4.5:1 contrast');
 assert.ok(semanticContrast.every(s=>s.tone==='profit'?s.rgb[1]>s.rgb[0]*2:s.rgb[0]>s.rgb[1]*2),`Gains stay green and losses red: ${JSON.stringify(semanticContrast)}`);
 await cdp.send('Emulation.setEmulatedMedia',{features:[]});
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
 assert.equal(await page.locator('html').getAttribute('data-gold-motion'),null,'Leaving Gold removes its event effects');
 assert.equal(await page.evaluate(()=>document.getAnimations().filter(a=>a.id==='dayris-gold-motion').length),0);
 await gold.click();await page.clock.runFor(600);
 assert.equal(await page.locator('html').getAttribute('data-dayris-theme'),'gold');
 await emerald.click();await page.clock.runFor(600);
 assert.equal(await page.locator('html').getAttribute('data-dayris-theme'),'emerald');
 await emerald.scrollIntoViewIfNeeded();await page.screenshot({path:'tests/pro-theme-collection-390.png',animations:'disabled'});
 await settings.getByRole('button',{name:'Закрыть настройки',exact:true}).click();await page.clock.runFor(400);
 await page.screenshot({path:'tests/emerald-reference-390.png',animations:'disabled'});
 await page.getByRole('button',{name:'Настройки',exact:true}).click();await page.clock.runFor(400);
 await gold.click();await page.clock.runFor(600);
 await settings.getByRole('button',{name:'Закрыть настройки',exact:true}).click();await page.clock.runFor(400);
 // Same PRO account may select Gold even with the FREE workspace view.
 await page.locator('.workspace-mode-toggle').click();await page.clock.runFor(500);
 assert.equal(await page.locator('html').getAttribute('data-dayris-theme'),'gold');
 await page.locator('.workspace-mode-toggle').click();await page.clock.runFor(500);
 await page.getByRole('button',{name:'История',exact:true}).click();await page.clock.runFor(500);
 const history=page.locator('.financial-history-dialog');await history.waitFor();
 assert.equal(await history.evaluate(el=>getComputedStyle(el).getPropertyValue('--fh-gold').trim()),'#f4d58e');
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
 await cdp.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-transparency',value:'reduce'}]});
 assert.equal(await page.locator('.dayris-header').evaluate(el=>getComputedStyle(el).backdropFilter),'none');
 await page.emulateMedia({reducedMotion:'reduce'});
 assert.equal(await page.locator('.calendar-day-surface').first().evaluate(el=>getComputedStyle(el).transitionDuration),'0s');
 assert.deepEqual(errors,[]);
 console.log('PASS: Gold and Emerald PRO gates, no loading flash, 320/390/1280, amounts, collection selection, FREE workspace, history, revocation, locked previews, upsell, restoration, reduced transparency/motion.');
} finally {await browser.close();}
