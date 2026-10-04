import {createRequire} from 'node:module';
import path from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire(path.resolve('package.json'));
const bundle=await require('esbuild').build({stdin:{resolveDir:process.cwd(),loader:'jsx',contents:`import React from 'react';import {createRoot} from 'react-dom/client';import Voice from './src/shared/ui/CalendarVoiceButton.jsx';window.commands=[];createRoot(document.getElementById('root')).render(<Voice defaultCurrency="MDL" categoryOptions={['продукты']} onCommand={c=>commands.push(c)}/>);`},bundle:true,write:false,outfile:'voice.js',format:'iife'});
const browser=await createRequire(process.env.DAYRIS_PLAYWRIGHT_PACKAGE||import.meta.url)('playwright').chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  window.autoStart=false;window.starts=0;window.audioContexts=0;window.ttsCalls=0;window.watchdogs=[];
  const nativeTimeout=window.setTimeout.bind(window);window.setTimeout=(cb,ms,...args)=>{if(ms===8000){watchdogs.push(cb);return nativeTimeout(()=>{},60000);}if([900,1600,1900,20000].includes(ms))return nativeTimeout(()=>{},60000);return nativeTimeout(cb,ms,...args);};
  window.SpeechRecognition=window.webkitSpeechRecognition=class{constructor(){window.voice=this;}start(){starts++;if(autoStart)this.onstart?.();}abort(){this.aborted=true;}};
  window.AudioContext=class{constructor(){audioContexts++;}};
  window.SpeechSynthesisUtterance=class{constructor(text){this.text=text;}};
  Object.defineProperty(window,'speechSynthesis',{value:{getVoices:()=>[{voiceURI:'ru',name:'Russian',lang:'ru-RU'}],speak:()=>ttsCalls++,cancel:()=>{}}});
  window.emit=(text,isFinal=false)=>voice.onresult({results:[Object.assign([{transcript:text,confidence:0.4}],{isFinal})]});
 });
 await page.route('http://listening.test/**',r=>r.fulfill({contentType:'text/html',body:`<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#0d0e10;font-family:Arial}button{font:inherit;cursor:pointer} ${bundle.outputFiles.find(f=>f.path.endsWith('.css')).text}</style><div id="root"></div><script>${bundle.outputFiles.find(f=>f.path.endsWith('.js')).text}</script>`}));
 await page.goto('http://listening.test');const surface=page.locator('.voice-workspace'),mic=surface.locator('.voice-workspace-mic');
 await page.locator('.calendar-voice-button').click();
 assert.equal(await surface.getAttribute('data-listening'),'false','not listening before browser confirms start');assert.equal(await mic.isDisabled(),true);assert.match(await surface.locator('.voice-workspace-status').textContent(),/Включаю/);
 assert.equal(await surface.locator('.voice-workspace-phrase').count(),0);assert.equal(await surface.locator('.calendar-voice-commands li:visible').count(),0);
 assert.deepEqual(await page.evaluate(()=>[ttsCalls,audioContexts]),[0,0],'iOS mic start must not compete with TTS/cue playback');
 await page.evaluate(()=>voice.onstart());assert.equal(await mic.isDisabled(),false);assert.match(await surface.locator('.voice-workspace-status').textContent(),/Слушаю/);
 await page.evaluate(()=>watchdogs.at(-1)());assert.match(await surface.locator('.voice-workspace-status').textContent(),/Пока не слышу/);await page.evaluate(()=>voice.onspeechstart());assert.match(await surface.locator('.voice-workspace-status').textContent(),/Слушаю/);
 await surface.screenshot({path:'tests/voice-listening-ready.png',animations:'disabled'});
 await page.evaluate(()=>voice.onsoundstart());assert.equal(await surface.getAttribute('data-talking'),'true');assert.equal(await surface.locator('.voice-workspace-wave i').first().evaluate(el=>getComputedStyle(el).animationName),'voice-wave-talk');
 await page.evaluate(()=>emit('вчера потратил 250 на продукты'));assert.match(await surface.locator('.voice-workspace-phrase').textContent(),/250 на продукты/);assert.match(await surface.locator('.voice-workspace-status').textContent(),/Слушаю/);
 await surface.screenshot({path:'tests/voice-listening-speaking.png',animations:'disabled'});
 await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await surface.locator('.voice-workspace-wave i').first().evaluate(el=>getComputedStyle(el).animationName),'none');await page.emulateMedia({reducedMotion:'no-preference'});
 await page.evaluate(()=>{autoStart=true;emit('вчера потратил 250 лей на продукты',true);});await mic.click();await page.locator('.calendar-voice-review').waitFor();await page.waitForFunction(()=>document.querySelector('.voice-workspace')?.dataset.listening==='true');assert.match(await surface.locator('.voice-workspace-instruction').textContent(),/сохрани/);await surface.screenshot({path:'tests/voice-listening-review.png',animations:'disabled'});
 const late=await page.evaluate(()=>{window.lateSound=voice.onsoundstart;autoStart=false;return starts;});await page.getByRole('button',{name:'Закрыть голосовой режим',exact:true}).click();await page.evaluate(()=>lateSound());assert.equal(await surface.count(),0,'late sound event cannot reopen UI');
 await page.locator('.calendar-voice-button').click();await page.evaluate(()=>watchdogs.at(-1)());assert.equal(await mic.isDisabled(),false);assert.match(await surface.locator('.voice-workspace-status').textContent(),/недоступен/);
 await page.evaluate(()=>autoStart=true);await mic.click();assert.match(await surface.locator('.voice-workspace-status').textContent(),/Слушаю/);await page.evaluate(()=>voice.onerror({error:'no-speech'}));assert.match(await surface.locator('.voice-workspace-status').textContent(),/Не услышал/);
 await mic.click();await page.evaluate(()=>voice.onerror({error:'audio-capture'}));assert.match(await surface.locator('.voice-workspace-status').textContent(),/Микрофон недоступен/);
 await mic.click();await page.evaluate(()=>voice.onend());await page.waitForFunction(n=>starts===n+1,await page.evaluate(()=>starts));await page.evaluate(()=>voice.onend());assert.match(await surface.locator('.voice-workspace-status').textContent(),/Не услышал/);const count=await page.evaluate(()=>starts);await page.waitForTimeout(500);assert.equal(await page.evaluate(()=>starts),count,'early empty end retries once, never loops');
 await mic.click();await page.evaluate(()=>voice.onerror({error:'not-allowed'}));assert.match(await surface.locator('.voice-workspace-status').textContent(),/Разрешите/);assert.equal(await surface.getAttribute('data-listening'),'false');
 for(const width of [320,390,1280]){await page.setViewportSize({width,height:844});const box=await surface.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width+1&&box.y>=0&&box.y+box.height<=844);}
 assert.ok(late>0);assert.deepEqual(errors,[]);console.log('PASS: iOS startup, no fake transcript, secondary hints, speech-reactive wave, reduced motion, startup watchdog, no-speech, capture/permission errors, bounded retry, cancellation and responsive layout.');
}finally{await browser.close();}
