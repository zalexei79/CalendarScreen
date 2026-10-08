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
 await page.locator('.calendar-voice-button').click();await page.evaluate(()=>holdSave=true);await page.evaluate(()=>{emit('я сегодня потратил 50 лей на сок');phrasePauses.at(-1)();});
 await page.waitForFunction(()=>saveCalls.length===1);assert.equal(await page.locator('.calendar-voice-review').count(),0,'no final card before automatic save');assert.equal(await mic.isDisabled(),true);assert.equal(await page.evaluate(()=>saved.length),0);
 await page.evaluate(()=>{holdSave=false;resolveSave();});await page.waitForFunction(()=>saved.length===1&&spoken.some(text=>text.includes('50')));assert.equal(await page.locator('.calendar-voice-review').count(),0);assert.deepEqual(await page.evaluate(()=>[saved[0].amount,saved[0].currency,saved[0].category]),['50','MDL','сок']);
 // Uncertain recognition retains the existing explicit confirmation path.
 await say('потратил 70 лей на продукты',0.3);await page.locator('.calendar-voice-review').waitFor();assert.equal(await page.evaluate(()=>saved.length),1);
 await page.locator('.calendar-voice-save').click();await page.waitForFunction(()=>saved.length===2);
 // A clarification is a continuation, never a first-phrase automatic save.
 await say('потратил 80 лей');await sheet.locator('.calendar-voice-answer').waitFor();await say('сок');await page.locator('.calendar-voice-review').waitFor();assert.equal(await page.evaluate(()=>saved.length),2);await say('сохрани');await page.waitForFunction(()=>saved.length===3);
 // A failed automatic write returns a retryable card; the success voice is not played.
 const spokenBefore=await page.evaluate(()=>spoken.length);await page.evaluate(()=>failSave=true);await say('потратил 90 лей на сок');await page.locator('.calendar-voice-review').waitFor();assert.match(await page.locator('.calendar-voice-review').textContent(),/Нет соединения/);assert.equal(await page.evaluate(()=>saved.length),3);assert.equal(await page.evaluate(()=>spoken.length),spokenBefore);
 await page.evaluate(()=>failSave=false);await page.locator('.calendar-voice-save').click();await page.waitForFunction(()=>saved.length===4);assert.equal(await page.evaluate(()=>saved[3].amount),'90');assert.equal(await page.evaluate(()=>saveCalls.length),5);
 // New spoken aliases still pass through the actual microphone/persistence flow.
 await say('Я заплатил полтинник лэй за сок');await page.waitForFunction(()=>saved.length===5);
 assert.deepEqual(await page.evaluate(()=>[saved[4].amount,saved[4].currency,saved[4].category]),['50','MDL','сок']);assert.equal(await page.locator('.calendar-voice-review').count(),0);
 assert.deepEqual(errors,[]);console.log('PASS: complete phrase saves once without card; spoken success after persistence; uncertain/incomplete phrases keep review; errors show retryable card and manual retry works.');
}finally{await browser.close();}
