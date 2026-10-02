import {createRequire} from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const require=createRequire(path.resolve('package.json'));
const bundle=await require('esbuild').build({stdin:{resolveDir:process.cwd(),loader:'jsx',contents:`
import React from 'react';import {createRoot} from 'react-dom/client';import Dock from './src/shared/ui/WorkspaceDock.jsx';import Voice from './src/shared/ui/CalendarVoiceButton.jsx';import {saveVoiceDestinations} from './src/shared/lib/saveVoiceDestinations.js';
window.calls=[];window.writes=[];createRoot(document.getElementById('root')).render(<Dock><div className="pointer-events-auto"><Voice language="ru" defaultCurrency="MDL" walletAvailable categoryOptions={[]} onCommand={()=>{}} onSaveEntry={async(entry,progress)=>{window.calls.push(entry);await saveVoiceDestinations({destination:entry.destination,key:JSON.stringify(entry),progress,saveWallet:async()=>window.writes.push('wallet '+entry.category),saveCalendar:async()=>{if(window.failSecond&&entry.category==='такси'){window.failSecond=false;throw new Error('Повторите сохранение.');}if(window.waitSave)await new Promise(resolve=>window.releaseSave=resolve);window.writes.push('calendar '+entry.category);}});}}/></div></Dock>);
`},bundle:true,write:false,outfile:'voice.js',format:'iife'});
const utility=fs.readFileSync(path.join('dist/assets',fs.readdirSync('dist/assets').find(file=>file.endsWith('.css'))),'utf8');
const browser=await createRequire(process.env.DAYRIS_PLAYWRIGHT_PACKAGE||import.meta.url)('playwright').chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.addInitScript(()=>{localStorage.setItem('dayris_voice_feedback','off');window.SpeechRecognition=class{constructor(){window.voice=this;}start(){this.onstart?.();}stop(){this.onend?.();}abort(){}};window.finishPhrase=text=>{window.voice.onresult({results:[Object.assign([{transcript:text}],{isFinal:true})]});window.voice.onend?.();};});
 await page.route('http://voice.test/**',route=>route.fulfill({contentType:'text/html',body:`<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${utility}${bundle.outputFiles.find(file=>file.path.endsWith('.css')).text}body{background:#0b0c10;color:#ddd;font-family:Arial}</style><div id="root"></div><script>${bundle.outputFiles.find(file=>file.path.endsWith('.js')).text}</script>`}));
 await page.goto('http://voice.test');const phrase=async value=>{await page.locator('.calendar-voice-button').click();await page.evaluate(value=>window.finishPhrase(value),value);};
 await phrase('80 на сок, 50 на такси и 30к на монитор');assert.match(await page.locator('.calendar-voice-answer').textContent(),/всех записей/);await page.getByRole('button',{name:'Да',exact:true}).click();
 await page.locator('.calendar-voice-batch').waitFor();assert.equal(await page.locator('.calendar-voice-batch-row').count(),3);assert.equal(await page.evaluate(()=>window.writes.length),0);assert.match(await page.locator('.calendar-voice-batch-totals').textContent(),/30130 MDL/);
 await phrase('во второй записи сумма 60');assert.match(await page.locator('.calendar-voice-batch-row').nth(1).textContent(),/60 MDL/);assert.match(await page.locator('.calendar-voice-batch-row').nth(0).textContent(),/80 MDL/);
 await page.locator('.calendar-voice-batch-row').nth(2).click();await phrase('потратил на компьютер');assert.match(await page.locator('.calendar-voice-batch-row').nth(2).textContent(),/компьютер/);
 for(const width of [320,390,430,1280]){await page.setViewportSize({width,height:844});await page.evaluate(()=>document.getAnimations().forEach(animation=>animation.finish()));const box=await page.locator('.calendar-voice-batch').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width,`batch fits ${width}`);}
 await page.setViewportSize({width:390,height:844});await page.locator('.calendar-voice-batch').screenshot({path:'tests/voice-batch-dark.png',animations:'disabled'});
 await page.getByRole('button',{name:'Убрать запись 3',exact:true}).click();assert.equal(await page.locator('.calendar-voice-batch-row').count(),2);await phrase('отмена');assert.equal(await page.locator('.calendar-voice-batch').count(),0);assert.equal(await page.evaluate(()=>window.writes.length),0);
 await phrase('80 лей на сок и 50 на такси и 200 на продукты в оба');await page.evaluate(()=>window.failSecond=true);await page.getByRole('button',{name:'Сохранить всё',exact:true}).click();
 assert.match(await page.locator('.calendar-voice-batch [role="alert"]').textContent(),/Сохранено 1 из 3/);assert.equal(await page.locator('.calendar-voice-button').isDisabled(),true);assert.equal(await page.locator('.calendar-voice-batch-row').nth(0).isDisabled(),true);
 await page.getByRole('button',{name:'Сохранить всё',exact:true}).click();await page.locator('.calendar-voice-batch').waitFor({state:'detached'});
 assert.deepEqual(await page.evaluate(()=>window.writes),['wallet сок','calendar сок','wallet такси','calendar такси','wallet продукты','calendar продукты']);assert.match(await page.locator('.calendar-voice-answer').textContent(),/Сохранено записей: 3/);
 await phrase('80 лей на сок и 50 на такси');await page.evaluate(()=>window.waitSave=true);await page.getByRole('button',{name:'Сохранить всё',exact:true}).evaluate(button=>{button.click();button.click();});await page.waitForFunction(()=>window.releaseSave);assert.equal(await page.evaluate(()=>window.calls.length),5,'double tap starts only one save');
 await page.evaluate(()=>{window.waitSave=false;window.releaseSave();});await page.locator('.calendar-voice-batch').waitFor({state:'detached'});assert.equal(await page.evaluate(()=>window.calls.length),6);
 assert.deepEqual(errors,[]);console.log('PASS: batch review, shared currency, k amount, numbered and selected corrections, removal, cancellation, partial ledger retries and double-tap protection');
}finally{await browser.close();}
