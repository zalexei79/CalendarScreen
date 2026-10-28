import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { installStoryAccount, storyUserId } from './life-story-auth-fixture.mjs';
const { chromium } = createRequire('C:/Users/aveel/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('playwright');
const browser = await chromium.launch({ channel:'msedge',headless:true });
fs.mkdirSync('artifacts/streak-review',{recursive:true});
try {
  for(const [theme,language] of [['dark','ru'],['light','ru'],['gold','ru'],['emerald','md'],['purple','en']]){
    const context=await browser.newContext({viewport:{width:390,height:844},timezoneId:'Europe/Bucharest',serviceWorkers:'block'});
    await context.addInitScript(({theme,language})=>{
      for(const [key,value] of Object.entries({atj_language:language,atj_theme:theme,atj_currency:'USD',atj_pro_view:'0',dayris_onboarding_v2_completed:'1',calendar_guide_completed:'1'}))localStorage.setItem(key,value);
    },{theme,language});
    await context.route('**/*',route=>{
      const url=new URL(route.request().url());
      if(url.pathname.startsWith('/rest/v1/'))return route.fulfill({contentType:'application/json',body:url.pathname.endsWith('get_my_pro_status')?'{"active":false}':'[]'});
      if(url.origin!=='http://calendar.test')return route.abort();
      const file=path.resolve('dist',url.pathname==='/'?'index.html':'.'+url.pathname);
      if(!file.startsWith(path.resolve('dist')+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:''});
      return route.fulfill({body:fs.readFileSync(file),contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':'text/html'});
    });
    await installStoryAccount(context);
    await context.route('**/rest/v1/rpc/sync_activity_streak',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({accountId:storyUserId,currentStreak:8,lastActiveDate:'2026-10-27',entryDate:'2026-10-27',completedToday:false,paused:true,timeZone:'Europe/Bucharest',serverDate:'2026-10-28',rule:'daily-entry'})}));
    const page=await context.newPage(); const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.clock.install({time:new Date('2026-10-28T12:00:00+02:00')});
    await page.goto('http://calendar.test'); await page.locator('.calendar-days-grid').waitFor();
    await page.locator('.activity-streak-pause').waitFor();
    for(const width of [320,390,1440]){
      await page.setViewportSize({width,height:844});
      const badge=await page.locator('.activity-streak').boundingBox(),actions=await page.locator('[data-site-element=actions]').boundingBox();
      if(theme==='dark' && width===320)await page.screenshot({path:'artifacts/streak-review/header-pause-320.png',animations:'disabled'});
      assert.ok(badge.x>=0 && badge.x+badge.width<=width,`${theme}: streak fits ${width}px`);
      assert.ok(badge.x+badge.width<=actions.x || badge.y>=actions.y+actions.height,`${theme}: pause does not overlap header controls at ${width}px: ${JSON.stringify({badge,actions})}`);
      assert.equal(await page.locator('.activity-streak-pause').isVisible(),true);
    }
    await page.setViewportSize({width:390,height:844});
    await page.clock.runFor(1200);
    await page.locator('.activity-streak-reminder').waitFor();
    await page.screenshot({path:`artifacts/streak-review/app-pause-${theme}.png`,animations:'disabled'});
    await page.locator('.activity-streak-reminder-copy button').click();
    await page.clock.runFor(400);
    await page.locator('input[type=date]').waitFor();
    assert.equal(await page.locator('input[type=date]').inputValue(),'2026-10-28','reminder opens a new entry for today');
    assert.equal(await page.locator('.activity-streak-reminder').count(),0);
    assert.deepEqual(errors,[]);
    await context.close();
  }
  console.log('PASS: visible pause at 320/390/1440px in five themes; no header overlap; daily reminder opens today’s actual entry composer');
}finally{await browser.close();}
