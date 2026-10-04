import {createRequire} from 'node:module';
import path from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire(path.resolve('package.json'));
const bundle=await require('esbuild').build({stdin:{resolveDir:process.cwd(),loader:'jsx',contents:`import React from 'react';import {createRoot} from 'react-dom/client';import Voice from './src/shared/ui/CalendarVoiceButton.jsx';function App(){const [language,setLanguage]=React.useState('ru');window.setLanguage=setLanguage;return <Voice language={language} defaultCurrency="MDL" categoryOptions={['продукты','сок']} onCommand={()=>window.holdCommand?new Promise(resolve=>window.resolveCommand=resolve):undefined}/>}createRoot(document.getElementById('root')).render(<App/>);`},bundle:true,write:false,outfile:'voice.js',format:'iife'});
const browser=await createRequire(process.env.DAYRIS_PLAYWRIGHT_PACKAGE||import.meta.url)('playwright').chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36'});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  const nativeTimeout=setTimeout.bind(window);window.setTimeout=(cb,ms,...args)=>[900,1600,1900,8000,20000].includes(ms)?nativeTimeout(()=>{},60000):nativeTimeout(cb,ms,...args);
  window.SpeechRecognition=class{constructor(){window.voice=this;}start(){this.onstart?.();}abort(){this.aborted=true;}};
  window.emit=(phrases,isFinal=false)=>voice.onresult({results:phrases.map(transcript=>Object.assign([{transcript,confidence:0.4}],{isFinal}))});
  window.touch=(type,target,x,y)=>{const touch=new Touch({identifier:1,target,clientX:x,clientY:y});target.dispatchEvent(new TouchEvent(type,{bubbles:true,cancelable:true,touches:type==='touchend'?[]:[touch],changedTouches:[touch]}));};
 });
 await page.route('http://android.test/**',r=>r.fulfill({contentType:'text/html',body:`<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#0d0e10;font-family:Arial}button{font:inherit}${bundle.outputFiles.find(f=>f.path.endsWith('.css')).text}</style><div id="root"></div><script>${bundle.outputFiles.find(f=>f.path.endsWith('.js')).text}</script>`}));
 await page.goto('http://android.test');const sheet=page.locator('.voice-workspace');
 await page.locator('.calendar-voice-button').click();
 const hypotheses=['я','Я сегодня','Я сегодня потра','Я сегодня потратил','Я сегодня потратил 50','Я сегодня потратил 50 лей','Я сегодня потратил 50 лей на сок'];
 await page.evaluate(phrases=>emit(phrases),hypotheses);
 assert.equal(await sheet.locator('.voice-workspace-phrase').textContent(),hypotheses.at(-1));
 await sheet.locator('.voice-workspace-mic').click();await page.locator('.calendar-voice-review').waitFor();
 assert.match(await page.locator('.calendar-voice-review').textContent(),/50/);
 assert.match(await page.locator('.calendar-voice-review').textContent(),/сок/i);
 const drag=async(distance,delay=0,target='.voice-workspace-drag-handle')=>{
  await page.evaluate(selector=>{window.dragTarget=document.querySelector(selector);touch('touchstart',dragTarget,150,160);},target);
  if(delay)await page.waitForTimeout(delay);
  await page.evaluate(d=>{touch('touchmove',dragTarget,150,160+d);touch('touchend',dragTarget,150,160+d);},distance);
 };
 // A slow short drag snaps back and does not stop the session.
 await drag(15,140);await page.waitForTimeout(240);assert.equal(await sheet.count(),1);
 await page.waitForFunction(()=>voice.onresult&&!voice.aborted);
 // A fast short swipe dismisses; audio stops at acceptance, before animation completes.
 await page.evaluate(()=>window.lateResult=voice.onresult);await drag(45);
 assert.equal(await page.evaluate(()=>voice.aborted),true);await sheet.waitFor({state:'detached'});
 await page.evaluate(()=>lateResult({results:[Object.assign([{transcript:'добавь запись'}],{isFinal:true})]}));assert.equal(await sheet.count(),0);
 // Scrolling content must not close the assistant.
 await page.locator('.calendar-voice-button').click();await page.evaluate(()=>emit(['Что ты умеешь?'],true));await sheet.locator('.voice-workspace-mic').click();await page.locator('.voice-capabilities').waitFor();
 await page.evaluate(()=>{const el=document.querySelector('.voice-workspace-scroll');el.scrollTop=80;});
 assert.ok(await sheet.locator('.voice-workspace-scroll').evaluate(el=>el.scrollTop)>0);
 await drag(120,0,'.voice-workspace-scroll');await page.waitForTimeout(240);assert.equal(await sheet.count(),1);
 await page.emulateMedia({reducedMotion:'reduce'});await drag(120);await sheet.waitFor({state:'detached'});
 // A pending operation blocks dismissal until its response completes.
 await page.locator('.calendar-voice-button').click();await page.evaluate(()=>{window.holdCommand=true;emit(['добавь запись'],true);});await sheet.locator('.voice-workspace-mic').click();
 await page.waitForFunction(()=>typeof resolveCommand==='function');await drag(120);assert.equal(await sheet.count(),1);assert.equal(await sheet.getAttribute('data-phase'),'processing');
 await page.evaluate(()=>{holdCommand=false;resolveCommand('Готово');});await page.waitForFunction(()=>document.querySelector('.voice-workspace')?.dataset.phase!=='processing');
 // Compact view supports the same dismissal gesture.
 await sheet.getByRole('button',{name:'Свернуть голосовой режим',exact:true}).click();assert.equal(await sheet.getAttribute('data-compact'),'true');await drag(120);await sheet.waitFor({state:'detached'});
 // Recognition locale and native help questions in every supported language.
 for(const [language,lang,question,title] of [['ru','ru-RU','Что ты умеешь?','Что я умею'],['en','en-US','What can you do?','What I can do'],['md','ro-RO','Ce poți face?','Ce pot face'],['zh-CN','zh-CN','你能做什么？','我可以做什么']]){
  await page.evaluate(value=>setLanguage(value),language);
  await page.locator('.calendar-voice-button').click();assert.equal(await page.evaluate(()=>voice.lang),lang);
  await page.evaluate(text=>emit([text],true),question);await sheet.locator('.voice-workspace-mic').click();await page.locator('.voice-capabilities').waitFor();assert.match(await page.locator('.voice-capabilities').textContent(),new RegExp(title));
  await drag(120);await sheet.waitFor({state:'detached'});
 }
 assert.deepEqual(errors,[]);
 console.log('PASS: Android cumulative hypotheses render/parse once; short swipe, cancellation, scroll isolation, immediate mic stop, late callback, reduced motion and RU/EN/RO/ZH help.');
}finally{await browser.close();}
