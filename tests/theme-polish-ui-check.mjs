import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { installStoryAccount, storyUserId } from './life-story-auth-fixture.mjs';
const require=createRequire('C:/Users/aveel/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const browser=await require('playwright').chromium.launch({channel:'msedge',headless:true});
try {
  const context=await browser.newContext({viewport:{width:1880,height:1000},serviceWorkers:'block'});
  await context.addInitScript(id=>{
    localStorage.setItem('atj_language','ru'); localStorage.setItem('atj_currency','USD');
    if(!localStorage.getItem('atj_theme')) localStorage.setItem('atj_theme','purple');
    localStorage.setItem('dayris_onboarding_v2_completed','1'); localStorage.setItem('calendar_guide_completed','1');
    localStorage.setItem(`money_calendar_trades_${id}`,JSON.stringify({
      '2026-10-05':[{id:'loss',pnl:-136,currency:'USD',instrument:'Продукты',traderMode:false,time:'10:00'}],
      '2026-10-06':[{id:'profit',pnl:500,currency:'USD',instrument:'Подарок',traderMode:false,time:'10:00'}],
    }));
  },storyUserId);
  await context.route('**/*',route=>{
    const url=new URL(route.request().url()); if(url.origin!=='http://calendar.test') return route.abort();
    const file=path.resolve('dist',url.pathname==='/'?'index.html':'.'+url.pathname);
    if(!file.startsWith(path.resolve('dist')+path.sep)||!fs.existsSync(file)) return route.fulfill({status:404,body:''});
    return route.fulfill({contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html',body:fs.readFileSync(file)});
  });
  await installStoryAccount(context);
  const page=await context.newPage(),errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.clock.install({time:new Date('2026-10-07T12:00:00')});
  await page.goto('http://calendar.test/'); await page.clock.pauseAt(new Date('2026-10-07T13:00:00'));
  for(const [theme,label,bg] of [['purple','Фиолетовое','rgb(17, 16, 21)'],['emerald','Изумрудное','rgb(7, 28, 22)']]) {
    await page.getByRole('button',{name:'Настройки',exact:true}).click(); await page.clock.runFor(500);
    await page.getByRole('button',{name:/Оформление/}).click();
    await page.getByRole('button',{name:label,exact:true}).click(); await page.clock.runFor(800);
    await page.waitForFunction(color=>getComputedStyle(document.querySelector('.premium-shell')).backgroundColor===color,bg);
    await page.screenshot({path:`tests/theme-${theme}-settings.png`,animations:'disabled'});
    await page.getByRole('button',{name:'Закрыть настройки',exact:true}).click(); await page.clock.runFor(500);
    for(const width of [1880,390]) {
      await page.setViewportSize({width,height:width===390?844:1000}); await page.clock.runFor(500);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
      const colors=await page.evaluate(()=>{
        const style=(el,pseudo)=>getComputedStyle(el,pseudo);
        const profit=document.querySelector('.calendar-day-surface[data-pnl-tone="profit"] .day-amount');
        const loss=document.querySelector('.calendar-day-surface[data-pnl-tone="loss"] .day-amount');
        return {profit:style(profit).color,loss:style(loss).color,ambient:style(document.querySelector('.today-calendar-cell'),'::after').animationName};
      });
      assert.equal(colors.profit,'rgb(145, 197, 172)'); assert.equal(colors.loss,'rgb(211, 160, 167)'); assert.equal(colors.ambient,'none');
      await page.screenshot({path:`tests/theme-${theme}-${width}.png`,animations:'disabled'});
    }
  }
  await page.emulateMedia({reducedMotion:'reduce'});
  assert.equal(await page.locator('.calendar-day-surface').first().evaluate(el=>getComputedStyle(el).transitionDuration),'0s');
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.getByRole('button',{name:'Октябрь',exact:true}).click();
  assert.equal(await page.locator('.dayris-date-menu').evaluate(el=>getComputedStyle(el).animationName),'dayris-material-enter');
  await page.emulateMedia({reducedMotion:'reduce'});
  assert.equal(await page.locator('.dayris-date-menu').evaluate(el=>getComputedStyle(el).animationName),'none');
  assert.deepEqual(errors,[]);
  console.log('PASS: restrained themes, semantic amount colors, theme selection, settings and desktop/mobile layouts, reduced motion.');
} finally { await browser.close(); }
