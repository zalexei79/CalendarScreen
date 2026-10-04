import {createRequire} from 'node:module';
import path from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire(path.resolve('package.json'));
const bundle=await require('esbuild').build({stdin:{resolveDir:process.cwd(),loader:'jsx',contents:`import React from 'react';import {createRoot} from 'react-dom/client';import Voice from './src/shared/ui/CalendarVoiceButton.jsx';window.saved=[];window.saveCalls=[];createRoot(document.getElementById('root')).render(<Voice userId="a" defaultCurrency="MDL" categoryOptions={['сок','продукты']} onCommand={()=>{}} onSaveEntry={async entry=>{saveCalls.push(entry);if(window.failSave)throw new Error('Нет соединения');if(window.holdSave)await new Promise(resolve=>window.resolveSave=resolve);saved.push(entry);}}/>);`},bundle:true,write:false,outfile:'voice.js',format:'iife'});
const browser=await createRequire(process.env.DAYRIS_PLAYWRIGHT_PACKAGE||import.meta.url)('playwright').chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  window.spoken=[];window.phrasePauses=[];const nativeTimeout=setTimeout.bind(window);window.setTimeout=(cb,ms,...args)=>{if(ms===900||ms===1900)phrasePauses.push(cb);return [900,1600,1900,8000,20000].includes(ms)?nativeTimeout(()=>{},60000):nativeTimeout(cb,ms,...args);};
  window.SpeechRecognition=class{constructor(){window.voice=this;}start(){this.onstart?.();}abort(){this.aborted=true;}};
  window.SpeechSynthesisUtterance=class{constructor(text){this.text=text;}};
  Object.defineProperty(window,'speechSynthesis',{value:{getVoices:()=>[{voiceURI:'ru',name:'Russian',lang:'ru-RU'}],cancel:()=>{},speak:utterance=>{spoken.push(utterance.text);utterance.onstart?.();utterance.onend?.();}}});
  window.emit=(text,confidence=0.95)=>voice.onresult({results:[Object.assign([{transcript:text,confidence}],{isFinal:true})]});
 });
 await page.route('http://autosave.test/**',r=>r.fulfill({contentType:'text/html',body:`<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#0d0e10;font-family:Arial}button{font:inherit}${bundle.outputFiles.find(f=>f.path.endsWith('.css')).text}</style><div id="root"></div><script>${bundle.outputFiles.find(f=>f.path.endsWith('.js')).text}</script>`}));
 await page.goto('http://autosave.test');const sheet=page.locator('.voice-workspace'),mic=sheet.locator('.voice-workspace-mic');
 const say=async(text,confidence=0.95)=>{await page.waitForFunction(()=>voice.onresult&&!voice.aborted);await page.evaluate(([text,confidence])=>emit(text,confidence),[text,confidence]);await mic.click();};

 await page.locator('.calendar-voice-button').click();await say('Ну, я сегодня потратил 50 лей на сок',.4);await page.locator('.calendar-voice-review').waitFor();
 await page.waitForFunction(()=>voice.onresult&&!voice.aborted);
 const count=await page.evaluate(()=>phrasePauses.length);
 await page.evaluate(()=>emit('Нет не 50 лей а 70',.95));
 assert.ok(await page.evaluate(()=>phrasePauses.length)>count,'a complete correction schedules processing without a save keyword');
 await page.evaluate(()=>phrasePauses.at(-1)());await page.locator('.voice-correction-feedback').waitFor().catch(async e=>{console.log(await sheet.innerText());console.log(await page.evaluate(()=>({spoken,saved,phrasePauses:phrasePauses.length})));throw e;});
 assert.match(await page.locator('.voice-correction-feedback').innerText(),/50 MDL.*70 MDL/s);assert.match(await page.locator('.voice-correction-feedback').innerText(),/не сохранено/);
 assert.equal(await page.evaluate(()=>saved.length),0);assert.match(await page.locator('.calendar-voice-review-summary strong').innerText(),/70/);await page.waitForFunction(()=>spoken.some(text=>/сумма/i.test(text)&&text.includes('70')));
 await sheet.screenshot({path:'tests/voice-correction-feedback.png',animations:'disabled'});
 await say('нет какой-то странный шум',.95);assert.match(await page.locator('.calendar-voice-audio-error').first().innerText(),/осталась прежней/);assert.match(await page.locator('.calendar-voice-review-summary strong').innerText(),/70/);assert.equal(await page.evaluate(()=>saved.length),0);
 await say('сохрани');await page.waitForFunction(()=>saved.length===1);assert.equal(await page.evaluate(()=>saved[0].amount),'70');
 assert.deepEqual(errors,[]);console.log('PASS: conversational purchase, high-confidence correction processes after pause, visual before/after and spoken acknowledgement, unchanged failed correction, explicit single save.');
}finally{await browser.close();}
