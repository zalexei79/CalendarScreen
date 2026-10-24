import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';import path from 'node:path';
import {installStoryAccount} from './life-story-auth-fixture.mjs';
import {selectBirthday} from './birthday-test-helper.mjs';
import {ONBOARDING_VIDEO_COPY} from '../src/features/onboarding/onboardingVideoCopy.js';
const require=createRequire('C:/Users/aveel/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const cases=[
 ['ru','Русский','Продолжить','Увидеть мою историю'],['en','English','Continue','See my story'],['ro','Română','Continuă','Descoperă povestea mea'],['uk','Українська','Продовжити','Побачити мою історію'],['zh','简体中文','继续','看看我的故事'],
 ['en','English','Continue','See my story','desktop'],
];
for(const engine of ['chromium','webkit']){
 if(process.env.FEEDBACK_BROWSER&&engine!==process.env.FEEDBACK_BROWSER)continue;
 const browser=await require('playwright')[engine].launch(engine==='chromium'?{channel:'msedge',headless:true}:{headless:true});
 try{for(const [lang,name,next,story,format='mobile'] of engine==='webkit'?cases.slice(1,2):cases){
  if(process.env.FEEDBACK_CASE&&format!==process.env.FEEDBACK_CASE)continue;
  const context=await browser.newContext({viewport:format==='desktop'?{width:1440,height:1000}:{width:lang==='ro'?320:390,height:844},hasTouch:format==='mobile',isMobile:format==='mobile',serviceWorkers:'block'}),errors=[];
  await context.addInitScript(({haptics})=>{
   localStorage.setItem('atj_language','ru');localStorage.setItem('atj_theme','dark');localStorage.setItem('calendar_guide_completed','1');localStorage.setItem('dayris_voice_feedback','off');
   window.feedbackAudit={contexts:[],starts:[],pulses:[],gesture:false};
   document.addEventListener('click',event=>{window.feedbackAudit.gesture=event.isTrusted},true);document.addEventListener('click',()=>window.feedbackAudit.gesture=false);
   const Native=window.AudioContext||window.webkitAudioContext;
   if(Native){const Wrapped=new Proxy(Native,{construct(target,args){const audio=Reflect.construct(target,args);window.feedbackAudit.contexts.push({audio,gesture:navigator.userActivation?.isActive??window.feedbackAudit.gesture});const original=audio.createBufferSource.bind(audio);audio.createBufferSource=()=>{const source=original(),start=source.start.bind(source);source.start=(...a)=>{window.feedbackAudit.starts.push({length:source.buffer?.length,time:performance.now()});return start(...a)};return source};return audio;}});window.AudioContext=Wrapped;}
   if(haptics)Object.defineProperty(navigator,'vibrate',{configurable:true,value:n=>{window.feedbackAudit.pulses.push(n);return true}});
  },{haptics:engine==='chromium'&&format==='mobile'});
  await context.route('**/*',route=>{
   const u=new URL(route.request().url());if(u.origin!=='http://calendar.test')return route.abort();
   const file=path.resolve('dist',u.pathname==='/'?'index.html':'.'+u.pathname);if(!file.startsWith(path.resolve('dist')+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:''});
   const types={'.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.mp4':'video/mp4','.json':'application/json'};return route.fulfill({contentType:types[path.extname(file)]||'text/html',body:fs.readFileSync(file)});
  });
  await installStoryAccount(context);const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.clock.install({time:new Date('2026-10-05T12:00:00')});await page.goto('http://calendar.test/');await page.clock.pauseAt(new Date('2026-10-05T13:00:00'));
  await page.getByRole('button',{name:new RegExp(name)}).click();await page.locator('.first-run-dialog').getByRole('button',{name:next,exact:true}).click();await page.locator('.first-run-dialog').getByRole('button',{name:/USD/}).click();await selectBirthday(page,'1998-03-14');await page.getByRole('button',{name:story,exact:true}).click();
  const audioSupported=await page.evaluate(()=>Boolean(window.AudioContext||window.webkitAudioContext));assert.ok(audioSupported||engine==='webkit','Chromium audio must be exercised');await page.clock.runFor(32);if(audioSupported)await page.waitForFunction(()=>window.feedbackAudit.contexts[0]?.audio.state==='running');await page.clock.runFor(1800);
  const audit=()=>page.evaluate(()=>({created:window.feedbackAudit.contexts.map(c=>({gesture:c.gesture,state:c.audio.state})),clicks:window.feedbackAudit.starts.filter(s=>s.length>1).length,pulses:window.feedbackAudit.pulses.filter(n=>n===4).length}));
  let result=await audit();if(audioSupported){assert.ok(result.created[0].gesture,'AudioContext is unlocked in the trusted start click');assert.ok(result.clicks>=2&&result.clicks<=14);}else{assert.equal(result.created.length,0);assert.equal(result.clicks,0);}if(engine==='chromium'&&format==='mobile')assert.ok(result.pulses>=2&&result.pulses<=5);else assert.equal(result.pulses,0);
  const mute=page.getByRole('button',{name:ONBOARDING_VIDEO_COPY[lang].mute,exact:true});await mute.click();let before=(await audit()).clicks;await page.clock.runFor(800);assert.equal((await audit()).clicks,before);
  await page.getByRole('button',{name:ONBOARDING_VIDEO_COPY[lang].unmute,exact:true}).click();await page.clock.runFor(800);if(audioSupported)assert.ok((await audit()).clicks>before,'Unmute resumes gentle clicks without resetting the counter');
  const fit=await page.locator('.life-story-top').evaluate(n=>n.scrollWidth<=n.clientWidth+1);assert.ok(fit,'Localized header fits the phone');await page.screenshot({path:`tests/life-feedback-${engine}-${lang}-${format}.png`,animations:'disabled'});
  await page.getByRole('button',{name:ONBOARDING_VIDEO_COPY[lang].mute,exact:true}).click();before=(await audit()).clicks;
  await page.clock.fastForward(12000);await page.clock.runFor(32);await page.locator('.onboarding-video[data-active="true"]').waitFor();assert.equal(await page.locator('.onboarding-video video').evaluate(v=>v.muted),true,'Mute carries into the video');await page.clock.runFor(1000);assert.equal((await audit()).clicks,before,'Clicks stop before the film');
  await page.keyboard.press('Escape');await page.clock.runFor(1100);await page.waitForFunction(()=>!document.querySelector('.first-run-dialog'));if(audioSupported){await page.waitForFunction(()=>window.feedbackAudit.contexts[0].audio.state==='closed');assert.equal((await audit()).created[0].state,'closed','Audio resources close on exit');}assert.deepEqual(errors,[]);
  console.log(engine,lang,format,audioSupported?'counter audio, haptics, localized mute, video handoff and cleanup passed':'unsupported-audio fallback, localized mute, video handoff and navigation passed');await context.close();
 }}finally{await browser.close();}
}
