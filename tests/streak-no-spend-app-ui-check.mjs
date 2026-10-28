import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { installStoryAccount, storyUserId } from './life-story-auth-fixture.mjs';
const {chromium}=createRequire('C:/Users/aveel/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('playwright');
const browser=await chromium.launch({channel:'msedge',headless:true});
fs.mkdirSync('artifacts/streak-review',{recursive:true});
try{
  for(const theme of ['dark','light','gold']){
    const context=await browser.newContext({viewport:{width:390,height:844},timezoneId:'Europe/Bucharest',serviceWorkers:'block'});
    let state={accountId:storyUserId,currentStreak:8,lastActiveDate:'2026-10-27',entryDate:'2026-10-27',completedToday:false,paused:true,timeZone:'Europe/Bucharest',serverDate:'2026-10-28',rule:'daily-entry',noSpendToday:false};
    let mode='expense',requests=0,writes=0,release;
    await context.addInitScript(theme=>{for(const [key,value] of Object.entries({atj_language:'ru',atj_theme:theme,atj_currency:'USD',atj_pro_view:'0',dayris_onboarding_v2_completed:'1',calendar_guide_completed:'1'}))localStorage.setItem(key,value);},theme);
    await context.route('**/*',async route=>{
      const url=new URL(route.request().url());
      if(url.pathname.startsWith('/rest/v1/')){
        if(route.request().method()==='POST' && /\/(trades|wallet_transactions)$/.test(url.pathname))writes++;
        let data=url.pathname.endsWith('get_my_pro_status')?{active:false}:url.pathname.includes('referral_profiles')?{referral_code:'AB123CD4'}:[];
        if(url.pathname.endsWith('sync_activity_streak'))data=state;
        if(url.pathname.endsWith('mark_streak_no_spend')){
          requests++;assert.deepEqual(Object.keys(route.request().postDataJSON()),['p_time_zone']);
          if(mode==='expense')return route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({message:'STREAK_HAS_EXPENSES',code:'P0001'})});
          if(mode==='offline')return route.abort();
          if(mode==='pending')await new Promise(resolve=>{release=resolve;});
          state={...state,currentStreak:9,lastActiveDate:'2026-10-28',entryDate:'2026-10-28',completedToday:true,noSpendToday:true,paused:false};data=state;
        }
        return route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
      }
      if(url.origin!=='http://calendar.test')return route.abort();
      const file=path.resolve('dist',url.pathname==='/'?'index.html':'.'+url.pathname);
      if(!file.startsWith(path.resolve('dist')+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:''});
      return route.fulfill({body:fs.readFileSync(file),contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.webp')?'image/webp':file.endsWith('.png')?'image/png':'text/html'});
    });
    await installStoryAccount(context);
    const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto('http://calendar.test');await page.locator('.activity-streak-pause').waitFor();
    assert.equal(await page.locator('.activity-streak-no-spend').count(),0,'no new button beside add-entry or on the main screen');
    await page.locator('.activity-streak').click();await page.locator('.activity-streak-no-spend').waitFor();
    const button=page.locator('.activity-streak-no-spend button');
    assert.equal(await button.textContent(),'Сегодня без трат');
    await button.click();await page.locator('.activity-streak-no-spend-error').waitFor();
    assert.match(await page.locator('.activity-streak-no-spend-error').textContent(),/уже есть расход/);
    assert.equal(await page.locator('.activity-streak-hero strong').textContent(),'8');
    mode='offline';await button.click();await page.waitForFunction(()=>document.querySelector('.activity-streak-no-spend-error')?.textContent.includes('Проверь интернет'));
    mode='pending';await button.evaluate(element=>{element.click();element.click();});
    await page.waitForFunction(()=>document.querySelector('.activity-streak-no-spend button').disabled);
    while(!release)await page.waitForTimeout(20);
    assert.equal(requests,3,'one RPC per click, double tap is locked');
    release();await page.waitForFunction(()=>document.querySelector('.activity-streak-no-spend button').textContent==='День без трат отмечен');
    assert.equal(await page.locator('.activity-streak-hero strong').textContent(),'9');
    assert.equal(await button.isDisabled(),true);assert.equal(writes,0,'no money writes');
    assert.match(await page.locator('.activity-streak-status').textContent(),/День без трат отмечен/);
    for(const width of [320,390,1440]){
      await page.setViewportSize({width,height:844});await button.scrollIntoViewIfNeeded();
      const box=await button.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width,'check-in fits phone/desktop');
    }
    await page.setViewportSize({width:390,height:844});await page.locator('.activity-streak-dialog-body').evaluate(element=>element.scrollTop=0);
    await page.screenshot({path:`artifacts/streak-review/no-spend-${theme}.png`,animations:'disabled'});
    const second=await context.newPage();await second.goto('http://calendar.test');await second.locator('.activity-streak').click();
    await second.waitForFunction(()=>document.querySelector('.activity-streak-no-spend button')?.textContent==='День без трат отмечен');
    assert.equal(await second.locator('.activity-streak-hero strong').textContent(),'9','another session reads account state');
    assert.equal(requests,3);assert.deepEqual(errors,[]);
    await context.close();
  }
  console.log('PASS: no-spend lives only in flame panel; errors/retry, double taps, real UI count update, account refresh, three themes and mobile/desktop layouts; zero financial writes');
}finally{await browser.close();}
