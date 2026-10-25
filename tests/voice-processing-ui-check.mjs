import {createRequire} from 'node:module';
import path from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire(path.resolve('package.json'));
const bundle=await require('esbuild').build({stdin:{resolveDir:process.cwd(),loader:'jsx',contents:`import React from 'react';import {createRoot} from 'react-dom/client';import Voice from './src/shared/ui/CalendarVoiceButton.jsx';window.saved=[];window.calls=[];function App(){const [owner,setOwner]=React.useState('a');window.setOwner=setOwner;return <Voice userId={owner} defaultCurrency="MDL" categoryOptions={['сок']} onCommand={async command=>{calls.push(command);if(window.holdCommand)await new Promise(resolve=>window.resolveCommand=resolve);return 'Сегодня потрачено 50 лей.';}} onSaveEntry={async entry=>{saved.push(entry);}}/>;}createRoot(document.getElementById('root')).render(<App/>);`},bundle:true,write:false,outfile:'voice.js',format:'iife'});
const browser=await createRequire(process.env.DAYRIS_PLAYWRIGHT_PACKAGE||import.meta.url)('playwright').chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.addInitScript(()=>{/* Existing-user voice scenarios. */for(const owner of ['a','b','test-user'])localStorage.setItem('dayris_voice_intro_v1:'+owner,'seen');
  localStorage.setItem('dayris_voice_feedback','off');window.starts=0;
  const timeout=window.setTimeout.bind(window),clear=window.clearTimeout.bind(window),pauses=new Map();
  window.setTimeout=(callback,ms,...args)=>{const pause=[900,1900,2400].includes(ms),id=timeout(callback,pause||[8000,20000].includes(ms)?60000:ms,...args);if(pause)pauses.set(id,callback);return id;};
  window.clearTimeout=id=>{pauses.delete(id);clear(id);};
  window.quiet=()=>{const [id,callback]=Array.from(pauses).at(-1);clearTimeout(id);callback();};
  window.SpeechRecognition=class{constructor(){window.voice=this;}start(){starts++;this.onstart?.();}abort(){this.aborted=true;}};
  window.emit=(text,isFinal=true)=>voice.onresult({results:[Object.assign([{transcript:text,confidence:.95}],{isFinal})]});
  document.addEventListener('DOMContentLoaded',()=>{
   let previous;
   new MutationObserver(()=>{
    const mic=document.querySelector('.voice-workspace-mic'),state=mic?.dataset.micState;
    if(state==='processing'&&previous!=='processing'){
     const started=performance.now();
     // Sample the state inside the page: cross-process assertions can arrive
     // after a short command has already finished. Rendered color is checked
     // below during the held request, independently of compositor timing.
     window.redSnapshot=new Promise(resolve=>timeout(()=>resolve({state:mic.dataset.micState,signal:getComputedStyle(mic).getPropertyValue('--voice-signal-ink'),disabled:mic.disabled,listening:document.querySelector('.voice-workspace')?.dataset.listening,elapsed:performance.now()-started}),240));
    }
    previous=state;
   }).observe(document.documentElement,{subtree:true,attributes:true,childList:true,attributeFilter:['data-mic-state']});
  });
 });
 await page.route('http://processing.test/**',route=>route.fulfill({contentType:'text/html',body:`<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#0d0e10;font-family:Arial}button{font:inherit}${bundle.outputFiles.find(file=>file.path.endsWith('.css')).text}</style><div id="root"></div><script>${bundle.outputFiles.find(file=>file.path.endsWith('.js')).text}</script>`}));
 await page.goto('http://processing.test');const sheet=page.locator('.voice-workspace'),mic=sheet.locator('.voice-workspace-mic');
 const listen=()=>page.waitForFunction(()=>voice.onresult&&!voice.aborted);
 const start=async()=>{await page.evaluate(()=>window.redSnapshot=null);await page.locator('.calendar-voice-button').click();await listen();};
 const close=async()=>{await page.waitForFunction(()=>document.querySelector('.voice-workspace')?.getAttribute('aria-busy')!=='true');await sheet.locator('.voice-workspace-exit').click();await sheet.waitFor({state:'detached'});};
 const red=async()=>{
  await page.waitForFunction(()=>window.redSnapshot);const snapshot=await page.evaluate(()=>window.redSnapshot);
  assert.equal(snapshot.state,'processing','fast local parsing must remain visibly red: '+JSON.stringify(snapshot));
  assert.equal(snapshot.signal,'255,202,194');
  assert.equal(snapshot.disabled,true);assert.equal(snapshot.listening,'false','red never claims to listen');
 };
 // A synchronous local help command used to leave processing before red could paint.
 await start();await page.evaluate(()=>{emit('что ты умеешь');quiet();});await red();await sheet.locator('.voice-capabilities').waitFor();await close();
 // A final-only recognizer still gives speech feedback in the actual mic button.
 await start();await page.evaluate(()=>emit('потратил 50 лей'));await page.waitForTimeout(180);
 assert.equal(await sheet.getAttribute('data-talking'),'true');assert.ok(Number(await mic.evaluate(el=>getComputedStyle(el).scale))>1);
 await sheet.screenshot({path:'tests/voice-processing-live-speech.png',animations:'disabled'});
 await mic.click();await red();await listen();assert.match(await sheet.locator('.voice-workspace-context').innerText(),/50 MDL/);await close();
 // Browser-driven end, silence and no-speech errors all enter the same visible state.
 for(const finish of ['end','silence','error']){
  await start();await page.evaluate(finish=>{emit('что ты умеешь');if(finish==='end')voice.onend();else if(finish==='error')voice.onerror({error:'no-speech'});else quiet();},finish);
  await red();await close();
 }
 // Slow work remains red for the entire request; there is no fixed fake timeout.
 await start();await page.evaluate(()=>{window.holdCommand=true;emit('Сколько потратил сегодня?');quiet();});await red();await page.waitForTimeout(400);
 assert.equal(await mic.getAttribute('data-mic-state'),'processing');assert.equal(await page.evaluate(()=>calls.length),1);
 await page.waitForFunction(()=>getComputedStyle(document.querySelector('.voice-workspace-mic')).color==='rgb(255, 202, 194)');
 await sheet.screenshot({path:'tests/voice-processing-red.png',animations:'disabled'});
 await page.evaluate(()=>{holdCommand=false;resolveCommand();});await close();
 // Automatic persistence is not held back by the feedback animation, and runs once.
 await start();await page.evaluate(()=>{emit('потратил 50 лей на сок');quiet();});await red();assert.equal(await page.evaluate(()=>saved.length),1);await close();
 // Changing account cancels pending feedback and cannot restart an old microphone.
 await start();await page.evaluate(()=>{emit('что ты умеешь');quiet();});await page.waitForFunction(()=>document.querySelector('.voice-workspace-mic')?.dataset.micState==='processing');
 const starts=await page.evaluate(()=>window.starts);await page.evaluate(()=>setOwner('b'));await sheet.waitFor({state:'detached'});await page.waitForTimeout(650);
 assert.equal(await page.evaluate(()=>window.starts),starts);assert.equal(await sheet.count(),0);assert.deepEqual(errors,[]);
 console.log('PASS: visible red for local help, manual/silence/browser/error completion, fast/slow work, live mic speech, immediate single persistence and account cancellation.');
}finally{await browser.close();}
