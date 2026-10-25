import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import {installStoryAccount} from './life-story-auth-fixture.mjs';

// Exercise the complete production CSS and calendar, not an isolated component.
const require=createRequire(process.env.DAYRIS_PLAYWRIGHT_PACKAGE||'C:/Users/aveel/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const browser=await require('playwright').chromium.launch({channel:'msedge',headless:true});
try {
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
 await context.addInitScript(()=>{localStorage.setItem('dayris_voice_intro_v1:22222222-2222-4222-8222-222222222222','seen');
  for(const [key,value] of Object.entries({atj_pro_view:'0',atj_trader_mode:'0',atj_language:'ru',atj_theme:'emerald',atj_currency:'USD',dayris_onboarding_v2_completed:'1',calendar_guide_completed:'1'}))localStorage.setItem(key,value);
  window.SpeechRecognition=class {constructor(){window.recognizer=this;}start(){this.onstart?.();}abort(){this.aborted=true;}};
 });
 await context.route('**/*',route=>{
  const url=new URL(route.request().url());
  if(url.origin!=='http://studio.test')return route.abort();
  const file=path.resolve('dist',url.pathname==='/'?'index.html':'.'+url.pathname);
  if(!file.startsWith(path.resolve('dist')+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:''});
  return route.fulfill({contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':'text/html',body:fs.readFileSync(file)});
 });
 await installStoryAccount(context);
 await context.route('**/rest/v1/rpc/get_my_pro_status',route=>route.fulfill({contentType:'application/json',body:'{"active":false}'}));
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://studio.test/');
 await page.locator('.calendar-voice-button').click();
 const studio=page.locator('[data-interface=voice-studio]');
 await studio.waitFor();
 assert.equal(await studio.getAttribute('data-view'),'capture');
 assert.equal(await studio.locator('.voice-workspace-command-toggle').innerText(),'Что я умею');
 assert.equal(await studio.locator('.voice-workspace-hints').count(),0);
 await page.screenshot({path:'tests/voice-studio-capture.png',animations:'disabled'});
 await studio.locator('.voice-workspace-command-toggle').click();
 await page.waitForFunction(()=>document.querySelector('[data-view=help]')?.getBoundingClientRect().height>500);
 assert.equal(await page.evaluate(()=>recognizer.aborted),true,'Guide pauses the actual recognition instance');
 assert.equal(await studio.locator('.voice-discover-actions button').count(),8);
 for(const width of [320,390,768,1440]){
  await page.setViewportSize({width,height:844});
  await page.waitForFunction(()=>!document.querySelector('[data-interface=voice-studio]').getAnimations().some(a=>a.playState==='running'));
  const body=studio.locator('.voice-workspace-scroll'),mic=studio.locator('.voice-workspace-mic');
  const box=await studio.boundingBox(),content=await body.boundingBox(),before=await mic.boundingBox();
  assert.ok(content.height>250,'Command catalog is never clipped to compact height');
  assert.ok(box.x>=0&&box.x+box.width<=width+1&&box.y>=0&&box.y+box.height<=845,'Studio fits viewport');
  await body.evaluate(el=>el.scrollTop=el.scrollHeight);
  const after=await mic.boundingBox();assert.equal(after.y,before.y,'Microphone stays pinned');
  assert.ok(await studio.locator('.voice-workspace-exit').isVisible());
  await body.evaluate(el=>el.scrollTop=0);
 }
 await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:'tests/voice-studio-commands.png',animations:'disabled'});
 await studio.locator('.voice-workspace-mic').click();
 await page.waitForFunction(()=>document.querySelector('[data-view=capture]')&&recognizer&&!recognizer.aborted);
 assert.equal(await studio.locator('.voice-capabilities').count(),0);
 await page.evaluate(()=>recognizer.onresult({results:[Object.assign([{transcript:'потратил 500 лей на продукты',confidence:.4}],{isFinal:true})]}));
 await studio.locator('.voice-workspace-mic').click();await studio.locator('.calendar-voice-review').waitFor();
 await page.waitForFunction(()=>!document.querySelector('[data-interface=voice-studio]').getAnimations().some(a=>a.playState==='running'));
 assert.equal(await studio.evaluate(el=>[...el.querySelectorAll('.calendar-voice-review-actions button')].every(button=>button.getBoundingClientRect().bottom<=el.querySelector('.voice-workspace-transport').getBoundingClientRect().top)),true,'Entry actions fit above the pinned microphone in production CSS');
 await page.screenshot({path:'tests/voice-studio-review.png',animations:'disabled'});
 await page.waitForFunction(()=>document.querySelector('[data-interface=voice-studio]')?.getAttribute('aria-busy')!=='true');
 await studio.locator('.voice-workspace-exit').click();await studio.waitFor({state:'detached'});
 assert.deepEqual(errors,[]);
 console.log('PASS: production calendar voice studio, real command guide, paused capture, pinned controls, resume, 320–1440px, no runtime errors.');
} finally {await browser.close();}
