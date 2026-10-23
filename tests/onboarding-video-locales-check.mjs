import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import {installStoryAccount} from './life-story-auth-fixture.mjs';
import {selectBirthday} from './birthday-test-helper.mjs';
import {ONBOARDING_VIDEO_COPY} from '../src/features/onboarding/onboardingVideoCopy.js';
const require=createRequire('C:/Users/aveel/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
let browser;
const launch=()=>require('playwright').chromium.launch({channel:'msedge',headless:true});
const locales=[
 {lang:'en',code:'en',name:'English',next:'Continue',story:'See my story'},
 {lang:'ro',code:'md',name:'Română',next:'Continuă',story:'Descoperă povestea mea'},
 {lang:'uk',code:'uk',name:'Українська',next:'Продовжити',story:'Побачити мою історію'},
 {lang:'zh',code:'zh-CN',name:'简体中文',next:'继续',story:'看看我的故事'},
];
try{for(const locale of locales)for(const mobile of [false,true]){
 const {lang}=locale,copy=ONBOARDING_VIDEO_COPY[lang],name=`${lang}-${mobile?'mobile':'desktop'}`;
 if(process.env.LOCALE_CASE&&!process.env.LOCALE_CASE.split(',').includes(name))continue;
 // Isolate each film decoder and graphics context from the previous case.
 if(browser)await browser.close();browser=await launch();
 const context=await browser.newContext({viewport:mobile?{width:lang==='ro'?320:390,height:844}:{width:1440,height:1000},serviceWorkers:'block'}),errors=[];
 await context.addInitScript(()=>{localStorage.setItem('atj_language','ru');localStorage.setItem('atj_theme','dark');localStorage.setItem('calendar_guide_completed','1');localStorage.setItem('dayris_voice_feedback','off');});
 await context.route('**/*',async route=>{
  const u=new URL(route.request().url());if(u.origin!=='http://calendar.test')return route.abort();
  const f=path.resolve('dist',u.pathname==='/'?'index.html':'.'+u.pathname);
  if(!f.startsWith(path.resolve('dist')+path.sep)||!fs.existsSync(f))return route.fulfill({status:404,body:''});
  const ext=path.extname(f),types={'.js':'text/javascript','.css':'text/css','.mp4':'video/mp4','.webp':'image/webp','.png':'image/png','.json':'application/json'};
  return route.fulfill({contentType:types[ext]||'text/html',body:fs.readFileSync(f)});
 });
 await installStoryAccount(context);const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.clock.install({time:new Date('2026-10-05T12:00:00')});await page.goto('http://calendar.test/');await page.clock.pauseAt(new Date('2026-10-05T13:00:00'));
 await page.getByRole('button',{name:new RegExp(locale.name)}).click();
 await page.locator('.first-run-dialog').getByRole('button',{name:locale.next,exact:true}).click();
 await page.locator('.first-run-dialog').getByRole('button',{name:/USD/}).click();await selectBirthday(page,'1998-03-14');
 await page.getByRole('button',{name:locale.story,exact:true}).click();await page.clock.runFor(32);await page.clock.fastForward(14500);await page.clock.runFor(32);
 const section=page.locator('.onboarding-video[data-active="true"]');
 assert.deepEqual(errors,[],`${name}: story starts without runtime errors`);await section.waitFor();
 await page.waitForFunction(()=>document.querySelector('.onboarding-video video').readyState>=2).catch(async error=>{console.error(name,await section.locator('video').evaluate(v=>({src:v.currentSrc,state:v.readyState,network:v.networkState,error:v.error?.message})),errors);throw error;});await page.clock.runFor(1500);
 const video=section.locator('video');assert.ok((await video.getAttribute('src')).includes(`/${name}-`));assert.equal(await section.getAttribute('aria-label'),copy.intro);
 await section.locator('.onboarding-video-calendar-action').waitFor({timeout:40000});
 assert.ok(await video.evaluate(v=>v.currentTime>=Math.min(19,v.duration-1.25)));
 await page.locator('.onboarding-video[data-phase="ready"]').waitFor();await page.clock.runFor(700);
 assert.equal(await section.locator('.onboarding-video-speaker-action strong').innerText(),copy.add);
 assert.equal(await section.locator('.onboarding-video-skip').innerText(),copy.skip);
 assert.equal(await section.locator('.onboarding-video-status').innerText(),copy.ready);
 assert.ok(!/[А-Яа-яЁё]/.test(await section.innerText())||lang==='uk','No Russian controls in translated scene');
 await page.screenshot({path:`tests/onboarding-locale-${name}-ready.png`,animations:'disabled'});
 const overflow=await section.locator('button:not(.onboarding-video-calendar-action)').evaluateAll(buttons=>buttons.filter(b=>b.clientWidth>0&&b.scrollWidth>b.clientWidth+2).map(b=>b.textContent));assert.deepEqual(overflow,[],`${name}: button labels fit`);
 if(mobile){
  await page.clock.fastForward(19300);await page.clock.runFor(0);assert.equal(await page.getByRole('timer').innerText(),'10');assert.equal(await section.locator('.onboarding-idle').getAttribute('data-emotion'),'angry');
  await page.clock.fastForward(10000);await page.clock.runFor(32);await page.locator('.onboarding-video[data-phase="expired"]').waitFor();
  assert.equal(await section.locator('h2').innerText(),copy.ended);assert.equal(await section.getByRole('button').count(),1);
  await page.clock.fastForward(3300);await page.clock.runFor(0);await page.screenshot({path:`tests/onboarding-locale-${name}-expired.png`,animations:'disabled'});
  await page.clock.fastForward(6700);await page.clock.runFor(0);assert.equal(await section.locator('.onboarding-idle').getAttribute('data-emotion'),'sad');
  await section.getByRole('button',{name:copy.restart,exact:true}).click();await page.locator('.life-story').waitFor();
  await page.clock.runFor(32);await page.clock.fastForward(14500);await page.clock.runFor(32);await section.waitFor();await page.waitForFunction(()=>document.querySelector('.onboarding-video video').readyState>=2);await page.clock.runFor(1500);
  await page.waitForFunction(()=>document.querySelector('.onboarding-video').dataset.phase==='playing');await video.evaluate(v=>{v.pause();v.dispatchEvent(new Event('ended'))});
  assert.equal(await section.locator('.onboarding-idle').getAttribute('data-emotion'),'smile');assert.equal(await page.getByRole('timer').count(),0);
 }
 await section.locator(mobile?'.onboarding-video-speaker-action':'.onboarding-video-calendar-action').click();await page.clock.runFor(1100);await page.waitForFunction(()=>!document.querySelector('.first-run-dialog'));
 assert.equal(await page.locator('.premium-shell .calendar-days-grid').evaluate(g=>getComputedStyle(g).visibility),'visible');
 assert.deepEqual(errors,[]);console.log(name,'localized film, controls, entry'+(mobile?', countdown, emotion cycle and restart':'')+' passed');await context.close();
}}finally{await browser?.close();}
