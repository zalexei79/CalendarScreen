import {createRequire} from 'node:module';
import path from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire(path.resolve('package.json'));
const bundle=await require('esbuild').build({stdin:{resolveDir:process.cwd(),loader:'jsx',contents:`import React from 'react';import {createRoot} from 'react-dom/client';import Voice from './src/shared/ui/CalendarVoiceButton.jsx';window.saved=[];createRoot(document.getElementById('root')).render(<Voice defaultCurrency="MDL" categoryOptions={['сок']} onSaveEntry={entry=>saved.push(entry)} onConversation={phrase=>phrase.includes('раздел')?{text:'Категория «клавиатура» готова.'}:null} onCommand={()=>{}}/>);`},bundle:true,write:false,outfile:'voice.js',format:'iife'});
const browser=await createRequire(process.env.DAYRIS_PLAYWRIGHT_PACKAGE||'C:/Users/aveel/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('playwright').chromium.launch({channel:'msedge',headless:true});
try {
 for(const feedback of ['on','off']){
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await context.addInitScript(value=>{
   localStorage.setItem('dayris_voice_feedback',value);window.starts=0;
   window.SpeechRecognition=class{constructor(){window.voice=this;}start(){starts++;this.onstart?.();}abort(){this.aborted=true;}};
   window.SpeechSynthesisUtterance=class{constructor(text){this.text=text;}};
   Object.defineProperty(window,'speechSynthesis',{value:{getVoices:()=>[{voiceURI:'ru',name:'Russian',lang:'ru-RU'}],cancel:()=>{},speak:u=>{u.onstart?.();u.onend?.();}}});
   window.emit=text=>voice.onresult?.({results:[Object.assign([{transcript:text,confidence:0.99}],{isFinal:true})]});
  },feedback);
  await context.route('http://result.test/**',r=>r.fulfill({contentType:'text/html',body:`<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#0d0e10;font-family:Arial}button{font:inherit}${bundle.outputFiles.find(f=>f.path.endsWith('.css')).text}</style><div id="root"></div><script>${bundle.outputFiles.find(f=>f.path.endsWith('.js')).text}</script>`}));
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://result.test');await page.locator('.calendar-voice-button').click();
  const sheet=page.locator('.voice-workspace'),mic=sheet.locator('.voice-workspace-mic');
  await page.evaluate(()=>emit('Создай раздел клавиатура'));await mic.click();
  await sheet.locator('.calendar-voice-answer').waitFor();await page.waitForTimeout(1000);
  assert.equal(await page.evaluate(()=>starts),1,'A completed category answer never restarts recognition');
  assert.equal(await sheet.getAttribute('data-view'),'result');
  assert.match(await sheet.locator('.calendar-voice-answer').innerText(),/клавиатура/);
  assert.equal(await sheet.locator('.voice-workspace-phrase').isVisible(),false,'The answer is not buried under the repeated phrase');
  assert.equal(await sheet.locator('.voice-workspace-next').isVisible(),false);
  if(feedback==='on')await sheet.screenshot({path:'tests/voice-result-pro.png',animations:'disabled'});
  await mic.click();await page.waitForFunction(()=>starts===2&&!voice.aborted);
  await page.evaluate(()=>emit('Потратил 50 лей на сок'));await mic.click();
  await page.waitForFunction(()=>saved.length===1);await page.waitForTimeout(1000);
  assert.equal(await page.evaluate(()=>starts),2,'Save confirmation stays readable until manual continuation');
  assert.equal(await sheet.getAttribute('data-view'),'result');
  assert.equal(await sheet.getAttribute('data-listening'),'false');
  await mic.click();await page.waitForFunction(()=>starts===3&&!voice.aborted);
  assert.equal(await sheet.getAttribute('data-view'),'capture');
  await sheet.locator('.voice-workspace-exit').click();assert.deepEqual(errors,[]);
  await context.close();
 }
 console.log('PASS: category and save results persist with feedback on/off; no automatic microphone restart, clear result view, explicit continuation.');
} finally {await browser.close();}
