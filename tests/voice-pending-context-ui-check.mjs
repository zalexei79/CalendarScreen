import {createRequire} from 'node:module';
import path from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire(path.resolve('package.json'));
const bundle=await require('esbuild').build({stdin:{resolveDir:process.cwd(),loader:'jsx',contents:`import React from 'react';import {createRoot} from 'react-dom/client';import Voice from './src/shared/ui/CalendarVoiceButton.jsx';window.saved=[];window.commands=[];function App(){const [owner,setOwner]=React.useState('a');window.setOwner=setOwner;return <Voice userId={owner} defaultCurrency="MDL" categoryOptions={['продукты']} onSaveEntry={entry=>saved.push(entry)} onCommand={command=>commands.push(command)}/>;}createRoot(document.getElementById('root')).render(<App/>);`},bundle:true,write:false,outfile:'voice.js',format:'iife'});
const browser=await createRequire(process.env.DAYRIS_PLAYWRIGHT_PACKAGE||import.meta.url)('playwright').chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  localStorage.setItem('dayris_voice_feedback','off');window.starts=0;
  const nativeTimeout=setTimeout.bind(window);window.setTimeout=(cb,ms,...args)=>[900,1600,1900,8000,20000].includes(ms)?nativeTimeout(()=>{},60000):nativeTimeout(cb,ms,...args);
  window.SpeechRecognition=class{constructor(){window.voice=this;}start(){starts++;this.onstart?.();}abort(){this.aborted=true;}};
  window.emit=text=>voice.onresult({results:[Object.assign([{transcript:text}],{isFinal:true})]});
 });
 await page.route('http://pending.test/**',r=>r.fulfill({contentType:'text/html',body:`<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#0d0e10;font-family:Arial}button{font:inherit}${bundle.outputFiles.find(f=>f.path.endsWith('.css')).text}</style><div id="root"></div><script>${bundle.outputFiles.find(f=>f.path.endsWith('.js')).text}</script>`}));
 await page.goto('http://pending.test');const sheet=page.locator('.voice-workspace'),mic=sheet.locator('.voice-workspace-mic');
 const listening=()=>page.waitForFunction(()=>voice.onresult&&!voice.aborted);
 const say=async text=>{await listening();await page.evaluate(text=>emit(text),text);await mic.click();};
 await page.locator('.calendar-voice-button').click();await say('я потратил 50 лей');
 await sheet.locator('.calendar-voice-answer').waitFor();assert.match(await sheet.locator('.calendar-voice-answer').textContent(),/На что/);
 assert.equal(await page.evaluate(()=>saved.length),0);assert.match(await sheet.locator('.voice-workspace-context').textContent(),/50 MDL/);
 await listening();assert.match(await sheet.locator('.voice-workspace-instruction').textContent(),/На что/);
 const starts=await page.evaluate(()=>window.starts);await mic.click();assert.equal(await page.evaluate(()=>window.starts),starts);assert.equal(await page.evaluate(()=>voice.aborted||false),false,'empty mic tap continues the pending task');
 await page.evaluate(()=>voice.onerror({error:'no-speech'}));assert.match(await sheet.locator('.calendar-voice-answer').textContent(),/На что/);assert.match(await sheet.locator('.voice-workspace-context').textContent(),/50 MDL/);
 await mic.click();await listening();assert.match(await sheet.locator('.voice-workspace-instruction').textContent(),/На что/);
 await page.evaluate(()=>voice.onerror({error:'audio-capture'}));assert.match(await sheet.locator('.calendar-voice-answer').textContent(),/На что/);await mic.click();
 await say('сок');await page.locator('.calendar-voice-review').waitFor();assert.match(await page.locator('.calendar-voice-review').textContent(),/50/);assert.match(await page.locator('.calendar-voice-review').textContent(),/сок/);assert.equal(await page.evaluate(()=>saved.length),0);
 await say('сохрани');await page.waitForFunction(()=>saved.length===1);assert.deepEqual(await page.evaluate(()=>[saved[0].amount,saved[0].currency,saved[0].category]),['50','MDL','сок']);
 await say('потратил 80 евро');await sheet.locator('.calendar-voice-answer').waitFor();await listening();await say('отмена');await sheet.waitFor({state:'detached'});
 await page.locator('.calendar-voice-button').click();await say('потратил 90 лей');await sheet.locator('.calendar-voice-answer').waitFor();await page.evaluate(()=>setOwner('b'));await sheet.waitFor({state:'detached'});
 await page.locator('.calendar-voice-button').click();assert.equal(await sheet.locator('.voice-workspace-context').count(),0,'owner change clears pending money');assert.equal(await sheet.locator('.calendar-voice-answer').count(),0);
 assert.equal(await page.evaluate(()=>saved.length),1);assert.deepEqual(errors,[]);
 console.log('PASS: same draft survives empty mic tap, silence, capture error and restart; bare category keeps amount/currency; voice save once; cancel and owner change clear context.');
}finally{await browser.close();}
