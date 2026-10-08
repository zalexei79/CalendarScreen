import {createRequire} from 'node:module';
import path from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire(path.resolve('package.json'));
const bundle=await require('esbuild').build({stdin:{resolveDir:process.cwd(),loader:'jsx',contents:`import React from 'react';import {createRoot} from 'react-dom/client';import Voice from './src/shared/ui/CalendarVoiceButton.jsx';window.saved=[];window.starts=0;function App(){const [language,setLanguage]=React.useState('ru');window.setLanguage=setLanguage;return <Voice language={language} defaultCurrency="MDL" categoryOptions={['сок','чипсы','бумага']} onCommand={()=>window.holdCommand?new Promise(resolve=>window.resolveCommand=resolve):undefined} onSaveEntry={entry=>saved.push(entry)}/>;}createRoot(document.getElementById('root')).render(<App/>);`},bundle:true,write:false,outfile:'voice.js',format:'iife'});
const browser=await createRequire(process.env.DAYRIS_PLAYWRIGHT_PACKAGE||import.meta.url)('playwright').chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  localStorage.setItem('dayris_voice_feedback','off');
  const nativeTimeout=window.setTimeout.bind(window),nativeClear=window.clearTimeout.bind(window),pauses=new Map();
  window.setTimeout=(callback,ms,...args)=>{const held=[900,1900,2400].includes(ms);const id=nativeTimeout(callback,held||[8000,20000].includes(ms)?60000:ms,...args);if(held)pauses.set(id,{callback,ms});return id;};
  window.clearTimeout=id=>{pauses.delete(id);nativeClear(id);};
  window.quiet=()=>{const pending=Array.from(pauses.entries()).at(-1);if(!pending)throw Error('No silence processing timer');pauses.delete(pending[0]);nativeClear(pending[0]);pending[1].callback();};
  window.SpeechRecognition=class{constructor(){window.voice=this;}start(){starts++;this.onstart?.();}abort(){this.aborted=true;}};
  window.emit=(text,isFinal=true,confidence=.95)=>voice.onresult({results:[Object.assign([{transcript:text,confidence}],{isFinal})]});
 });
 await page.route('http://pause.test/**',r=>r.fulfill({contentType:'text/html',body:`<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#0d0e10;font-family:Arial}button{font:inherit}${bundle.outputFiles.find(f=>f.path.endsWith('.css')).text}</style><div id="root"></div><script>${bundle.outputFiles.find(f=>f.path.endsWith('.js')).text}</script>`}));
 await page.goto('http://pause.test');const sheet=page.locator('.voice-workspace');
 const listen=()=>page.waitForFunction(()=>voice.onresult&&!voice.aborted);
 const close=()=>page.getByRole('button',{name:'Закрыть голосовой режим',exact:true}).click();
 const start=async()=>{await page.locator('.calendar-voice-button').click();await listen();};
 await start();await sheet.locator('.voice-turn-starter').waitFor();assert.match(await sheet.locator('.voice-turn-starter').innerText(),/Записать.*Потратил 50 лей на кофе/s);assert.equal(await sheet.locator('.voice-workspace-phrase').count(),0,'examples never pretend to be your words');await sheet.screenshot({path:'tests/voice-turn-start.png',animations:'disabled'});
 await page.evaluate(()=>emit('потратил 50 лей'));await page.waitForFunction(()=>document.querySelector('.voice-workspace')?.dataset.settling==='true');await sheet.locator('.voice-turn-pause').waitFor();assert.match(await sheet.locator('.voice-workspace-status').innerText(),/Завершаю/);
 await page.evaluate(()=>voice.onspeechstart());await page.waitForFunction(()=>document.querySelector('.voice-workspace')?.dataset.settling==='false');
 await page.evaluate(()=>{emit('Я вчера потратил 50 лей на сок 40 лей на чипсы и 50 на бумагу');quiet();});
 await sheet.locator('.calendar-voice-batch').waitFor();assert.equal(await page.evaluate(()=>saved.length),0,'pause reviews a list without saving it');
 assert.match(await sheet.locator('.calendar-voice-batch').innerText(),/чипсы/);await listen();
 await close();await start();
 await page.evaluate(()=>{emit('Я вчера потратил 50 лей носок 40 лей на чипсы и 50 на бумагу');quiet();});
 await page.waitForFunction(()=>document.querySelector('.voice-workspace-instruction')?.textContent.includes('носок'));await listen();await sheet.locator('.voice-turn-understood').waitFor();assert.ok((await sheet.locator('.voice-turn-understood').innerText()).includes('2 / 3'));assert.match(await sheet.locator('.voice-turn-examples').innerText(),/на сок/);await sheet.screenshot({path:'tests/voice-turn-clarify.png',animations:'disabled'});
 await page.evaluate(()=>{emit('на сок');quiet();});await sheet.locator('.calendar-voice-batch').waitFor();
 await listen();await page.evaluate(()=>{emit('сохрани');});await page.waitForFunction(()=>saved.length===3);
 assert.deepEqual(await page.evaluate(()=>saved.map(entry=>[entry.amount,entry.category,entry.currency])),[['50','сок','MDL'],['40','чипсы','MDL'],['50','бумагу','MDL']]);
 await close();await start();
 // A recognizer that never finalizes its interim result still produces a draft.
 await page.evaluate(()=>{emit('потратил 25 лей на сок',false);voice.onspeechend();quiet();});
 await sheet.locator('.calendar-voice-review').waitFor();assert.equal(await page.evaluate(()=>saved.length),3,'interim recognition cannot autosave');
 await listen();const oldStarts=await page.evaluate(()=>starts);
 // Speech-start cancels the old timeout; speech-end must arm a new one.
 await page.evaluate(()=>{emit('нет не 25 лей а 35',false);voice.onspeechstart();voice.onspeechend();quiet();});
 await page.waitForFunction(()=>document.querySelector('.calendar-voice-review-summary')?.textContent.includes('35'));await listen();
 assert.ok(await page.evaluate(()=>starts)>oldStarts);assert.equal(await page.evaluate(()=>saved.length),3);
 await close();await start();await page.evaluate(()=>{window.holdCommand=true;emit('Сколько потратил сегодня?');quiet();});await page.waitForFunction(()=>window.resolveCommand);assert.equal(await sheet.getAttribute('aria-busy'),'true');assert.match(await sheet.locator('.voice-workspace-status').innerText(),/Разбираю/);assert.equal(await sheet.locator('.voice-workspace-mic').isDisabled(),true);await sheet.screenshot({path:'tests/voice-turn-processing.png',animations:'disabled'});await page.evaluate(()=>{window.holdCommand=false;resolveCommand('Сегодня потрачено 50 лей.');});await page.waitForFunction(()=>document.querySelector('.voice-workspace')?.getAttribute('aria-busy')!=='true');await close();
 await start();await page.evaluate(()=>{emit('космический корабль');quiet();});await page.waitForFunction(()=>document.querySelector('.voice-turn-starter')?.textContent.includes('Попробуйте так'));assert.match(await sheet.locator('.voice-workspace-phrase').innerText(),/космический корабль/);assert.equal(await page.evaluate(()=>saved.length),3);await close();
 for(const [locale,expected] of [['en','Speak in your own words'],['ro','Vorbește cu cuvintele tale'],['zh','用自己的话说就可以'],['ru','Можно говорить своими словами']]){await page.evaluate(locale=>setLanguage(locale),locale);await page.locator('.calendar-voice-button').click();await sheet.locator('.voice-turn-starter').waitFor();assert.match(await sheet.locator('.voice-turn-starter').innerText(),new RegExp(expected));await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await sheet.locator('.voice-turn-starter').evaluate(el=>getComputedStyle(el).animationName),'none');await page.setViewportSize({width:320,height:844});const rect=await sheet.boundingBox();assert.ok(rect.x>=0&&rect.x+rect.width<=320);await sheet.screenshot({path:'tests/voice-turn-'+locale+'.png',animations:'disabled'});await sheet.locator('.voice-workspace-exit').click();}
 assert.deepEqual(errors,[]);console.log('PASS: final multi-entry pause, garbled category recovery, interim silence fallback and speech-end rearming preserve context without unconfirmed writes.');
}finally{await browser.close();}
