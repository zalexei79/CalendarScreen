import {createRequire} from 'node:module';
import path from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire(path.resolve('package.json'));
const bundle=await require('esbuild').build({stdin:{resolveDir:process.cwd(),loader:'jsx',contents:`import React from 'react';import {createRoot} from 'react-dom/client';import Voice from './src/shared/ui/CalendarVoiceButton.jsx';window.commands=[];window.conversations=0;createRoot(document.getElementById('root')).render(<Voice defaultCurrency="MDL" categoryOptions={['Продукты']} onConversation={()=>{conversations++;return null;}} onCommand={c=>commands.push(c)}/>);`},bundle:true,write:false,outfile:'voice.js',format:'iife'});
const browser=await createRequire(process.env.DAYRIS_PLAYWRIGHT_PACKAGE||import.meta.url)('playwright').chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  window.SpeechRecognition=class{constructor(){window.voice=this;}start(){this.onstart?.();}abort(){this.aborted=true;}};
  window.emit=text=>voice.onresult?.({results:[Object.assign([{transcript:text,confidence:0.4}],{isFinal:true})]});
  window.SpeechSynthesisUtterance=class{constructor(text){this.text=text;}};
  Object.defineProperty(window,'speechSynthesis',{value:{getVoices:()=>[{voiceURI:'ru',name:'Russian',lang:'ru-RU',localService:true}],speak:u=>{window.spoken=u;u.onstart?.();},cancel:()=>{}}});
 });
 await page.route('http://capabilities.test/**',r=>r.fulfill({contentType:'text/html',body:`<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#101114;color:#eee;font-family:Arial}button{font:inherit;color:inherit;background:transparent} ${bundle.outputFiles.find(f=>f.path.endsWith('.css')).text}</style><div id="root"></div><script>${bundle.outputFiles.find(f=>f.path.endsWith('.js')).text}</script>`}));
 await page.goto('http://capabilities.test');const surface=page.locator('.voice-workspace'),catalog=page.locator('.voice-capabilities');
 const speak=async phrase=>{await page.waitForFunction(()=>voice?.onresult&&!voice.aborted);await page.evaluate(text=>emit(text),phrase);};
 await page.locator('.calendar-voice-button').click();await speak('Что-то ты умеешь?');await catalog.waitFor();assert.equal(await catalog.locator('details').count(),8);
 assert.equal(await page.evaluate(()=>conversations),0);assert.deepEqual(await page.evaluate(()=>commands),[]);assert.match(await page.evaluate(()=>spoken.text),/Могу записывать/);assert.ok(!await catalog.innerText().then(text=>text.includes('кошелёк')));
 await catalog.locator('summary').first().click();assert.match(await catalog.innerText(),/Вчера потратил 250/);
 const mic=surface.locator('.voice-workspace-mic'),exit=surface.locator('.voice-workspace-exit');const before=await mic.boundingBox();await surface.locator('.voice-workspace-scroll').evaluate(el=>el.scrollTop=el.scrollHeight);const after=await mic.boundingBox();assert.equal(after.y,before.y,'recording control stays pinned while scrolling help');assert.ok(await exit.isVisible());
 await page.getByRole('button',{name:'Свернуть голосовой режим',exact:true}).click();assert.equal(await surface.getAttribute('data-compact'),'true');assert.ok(await mic.isVisible());assert.ok(await exit.isVisible());assert.ok((await surface.boundingBox()).height<230,'quick-access strip leaves calendar visible');
 await page.getByRole('button',{name:'Развернуть помощника',exact:true}).click();assert.equal(await surface.getAttribute('data-compact'),'false');await surface.locator('.voice-workspace-scroll').evaluate(el=>el.scrollTop=0);await surface.screenshot({path:'tests/voice-capabilities.png',animations:'disabled'});
 await page.evaluate(()=>spoken.onend());await speak('Вчера потратил 250 лей на продукты');await page.locator('.calendar-voice-review').waitFor();assert.equal(await catalog.count(),0);const count=await page.evaluate(()=>conversations);
 await speak('Какие команды ты знаешь?');await catalog.waitFor();assert.equal(await page.evaluate(()=>conversations),count,'help takes priority over pending entry');assert.match(await page.locator('.calendar-voice-review').textContent(),/250 MDL/);assert.deepEqual(await page.evaluate(()=>commands),[],'asking for help never saves a pending entry');
 await page.evaluate(()=>spoken.onend());await speak('Сохрани');await page.waitForFunction(()=>commands.length===1);assert.equal(await page.evaluate(()=>commands[0].amount),'250');assert.equal(await catalog.count(),0);
 await page.getByRole('button',{name:'Закрыть голосовой режим',exact:true}).click();assert.equal(await catalog.count(),0);assert.deepEqual(errors,[]);
 console.log('PASS: voice capabilities response, spoken summary, all groups, FREE restrictions, continuation, pending draft preservation and explicit save.');
}finally{await browser.close();}
