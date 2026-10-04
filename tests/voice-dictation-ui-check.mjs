import {createRequire} from 'node:module';
import path from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire(path.resolve('package.json'));
const bundle=await require('esbuild').build({stdin:{resolveDir:process.cwd(),loader:'jsx',contents:`import React from 'react';import {createRoot} from 'react-dom/client';import Voice from './src/shared/ui/CalendarVoiceButton.jsx';window.saved=[];window.starts=0;createRoot(document.getElementById('root')).render(<Voice userId="a" defaultCurrency="MDL" categoryOptions={['сок','пиво','лимонад']} onCommand={()=>{}} onSaveEntry={entry=>saved.push(entry)}/>);`},bundle:true,write:false,outfile:'voice.js',format:'iife'});
const browser=await createRequire(process.env.DAYRIS_PLAYWRIGHT_PACKAGE||import.meta.url)('playwright').chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  localStorage.setItem('dayris_voice_feedback','off');
  const nativeTimeout=setTimeout.bind(window);window.setTimeout=(cb,ms,...args)=>[8000,20000].includes(ms)?nativeTimeout(()=>{},60000):nativeTimeout(cb,ms,...args);
  window.SpeechRecognition=class{constructor(){window.voice=this;}start(){starts++;this.onstart?.();}abort(){this.aborted=true;}};
  window.emit=(text,isFinal=true)=>voice.onresult({results:[Object.assign([{transcript:text,confidence:0.95}],{isFinal})]});
 });
 await page.route('http://dictation.test/**',r=>r.fulfill({contentType:'text/html',body:`<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#0d0e10;font-family:Arial}button{font:inherit}${bundle.outputFiles.find(f=>f.path.endsWith('.css')).text}</style><div id="root"></div><script>${bundle.outputFiles.find(f=>f.path.endsWith('.js')).text}</script>`}));
 await page.goto('http://dictation.test');const sheet=page.locator('.voice-workspace'),mic=sheet.locator('.voice-workspace-mic');
 const listen=()=>page.waitForFunction(()=>voice.onresult&&!voice.aborted);
 const turn=async text=>{await listen();await page.evaluate(text=>emit(text),text);await mic.click();};
 const example='потратил 70 лей на сок, 80 на пиво. Нет, на пиво не 80, а 50. Хотя нет, сегодня пиво не брал. Давай запишем только сок и лимонад. На сок потратил 50 лей, на лимонад 20';
 await page.locator('.calendar-voice-button').click();await page.evaluate(()=>emit('потратил 70 лей на сок',false));await page.waitForTimeout(1700);
 assert.equal(await page.evaluate(()=>starts),1,'interim chunk keeps the same microphone listening');assert.equal(await page.evaluate(()=>saved.length),0);
 await page.evaluate(text=>emit(text),example);await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>saved.length),0);
 await page.evaluate(text=>emit(text+' готово'),example);await page.waitForFunction(()=>saved.length===2);
 assert.deepEqual(await page.evaluate(()=>saved.map(entry=>[entry.category,entry.amount,entry.currency])),[['сок','50','MDL'],['лимонад','20','MDL']]);
 await page.getByRole('button',{name:'Закрыть голосовой режим',exact:true}).click();await page.locator('.calendar-voice-button').click();
 await turn('потратил 70 лей на сок, 80 на пиво');await page.locator('.calendar-voice-batch').waitFor();assert.equal(await page.evaluate(()=>saved.length),2);
 await turn('на пиво не 80, а 50');await page.waitForFunction(()=>document.querySelector('.calendar-voice-batch')?.textContent.includes('50'));
 await turn('сегодня пиво не брал');await page.waitForFunction(()=>!document.querySelector('.calendar-voice-batch')?.textContent.includes('пиво'));
 await turn('оставь только сок и лимонад');await sheet.locator('.calendar-voice-answer').waitFor();
 await turn('готово');await sheet.locator('.calendar-voice-answer').waitFor();assert.equal(await page.evaluate(()=>saved.length),2,'done does not invent missing lemonade amount');
 await turn('на сок потратил 50 лей, на лимонад 20');await page.locator('.calendar-voice-batch').waitFor();await listen();await page.evaluate(()=>emit('сохрани'));await page.waitForFunction(()=>saved.length===4);
 assert.deepEqual(await page.evaluate(()=>saved.slice(2).map(entry=>[entry.category,entry.amount])),[['сок','50'],['лимонад','20']]);
 assert.deepEqual(errors,[]);console.log('PASS: microphone holds through interim dictation; one-stream and multi-turn corrections/removals/replacement list save only final juice 50 + lemonade 20 on done/save; missing amounts block commit.');
}finally{await browser.close();}
