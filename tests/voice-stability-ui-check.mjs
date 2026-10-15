import {createRequire} from 'node:module';
import path from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire(path.resolve('package.json'));
const bundle=await require('esbuild').build({stdin:{resolveDir:process.cwd(),loader:'jsx',contents:`import React from 'react';import {createRoot} from 'react-dom/client';import Voice from './src/shared/ui/CalendarVoiceButton.jsx';createRoot(document.getElementById('root')).render(<Voice userId="a" defaultCurrency="MDL" categoryOptions={['продукты','сок']} onCommand={()=>'Готово'}/>);`},bundle:true,write:false,outfile:'voice.js',format:'iife'});
const browser=await createRequire(process.env.DAYRIS_PLAYWRIGHT_PACKAGE||import.meta.url)('playwright').chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.addInitScript(()=>{
  localStorage.setItem('dayris_voice_feedback','off');window.starts=0;window.busyErrors=0;window.failStarts=0;
  const timeout=setTimeout.bind(window);window.setTimeout=(cb,ms,...args)=>[900,1900,2400,8000,20000].includes(ms)?timeout(()=>{},60000):timeout(cb,ms,...args);
  window.SpeechRecognition=class{
   constructor(){window.voice=this;}
   start(){starts++;if((window.hardware&&hardware!==this)||failStarts>0){if(failStarts>0)failStarts--;else busyErrors++;this.onerror?.({error:'audio-capture'});timeout(()=>this.onend?.(),30);return;}window.hardware=this;this.started=true;this.onstart?.();}
   abort(){this.aborted=true;if(this.started){this.started=false;timeout(()=>{if(window.hardware===this)window.hardware=null;this.onend?.();},700);}else timeout(()=>this.onend?.(),30);}
  };
  window.emit=(text,isFinal=false)=>voice.onresult({results:[Object.assign([{transcript:text,confidence:.4}],{isFinal})]});
  window.boxes=()=>{const b=s=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,cx:r.x+r.width/2,cy:r.y+r.height/2};};return {sheet:b('.voice-workspace'),header:b('.voice-workspace-header'),mic:b('.voice-workspace-mic'),status:b('.voice-workspace-status'),card:b('.calendar-voice-review')};};
  window.record=()=>{window.frames=[];window.sampling=true;const tick=()=>{if(!sampling)return;frames.push(boxes());requestAnimationFrame(tick);};requestAnimationFrame(tick);};
 });
 await page.route('http://stable.test/**',route=>route.fulfill({contentType:'text/html',body:`<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#0d0e10;font-family:Arial}button{font:inherit}${bundle.outputFiles.find(file=>file.path.endsWith('.css')).text}</style><div id="root"></div><script>${bundle.outputFiles.find(file=>file.path.endsWith('.js')).text}</script>`}));
 await page.goto('http://stable.test');const sheet=page.locator('.voice-workspace'),mic=sheet.locator('.voice-workspace-mic');
 const listen=()=>page.waitForFunction(()=>voice.started&&!voice.aborted);
 const still=(frames,name,keys)=>{for(const key of keys){const values=frames.map(frame=>frame[name]?.[key]).filter(Number.isFinite);assert.ok(Math.max(...values)-Math.min(...values)<1.1,name+'.'+key+' must stay fixed');}};
 await page.locator('.calendar-voice-button').click();await listen();await page.waitForTimeout(350);await page.evaluate(()=>record());
 await page.evaluate(()=>emit('потратил 500'));await page.waitForTimeout(120);await page.evaluate(()=>emit('потратил 500 лей на продукты',true));await mic.click();
 await sheet.locator('.calendar-voice-review').waitFor();await listen();await page.evaluate(()=>window.sampling=false);
 const first=await page.evaluate(()=>frames);for(const name of ['sheet','header'])still(first,name,['x','y','w','h']);still(first,'mic',['cx','cy']);
 assert.equal(await page.evaluate(()=>busyErrors),0,'automatic continuation waits for Safari to release the old input');
 await page.evaluate(()=>{window.card=document.querySelector('.calendar-voice-review');window.result=document.querySelector('.voice-workspace-result');window.details=document.querySelector('.voice-workspace-transcript');details.open=true;});
 await page.waitForTimeout(100);await page.evaluate(()=>record());
 await page.evaluate(()=>{voice.onspeechstart();emit('нет не 500 а 700');});
 assert.equal(await sheet.locator('.calendar-voice-review').isVisible(),true,'speaking never hides the current card');
 assert.equal(await page.evaluate(()=>details.open),true,'transcript expansion survives new speech');
 await page.evaluate(()=>emit('нет не 500 а 700',true));await mic.click();await page.waitForFunction(()=>document.querySelector('.calendar-voice-review-summary')?.textContent.includes('700'));await listen();
 await page.evaluate(()=>window.sampling=false);const correction=await page.evaluate(()=>frames);
 for(const name of ['sheet','header'])still(correction,name,['x','y','w','h']);still(correction,'mic',['cx','cy']);
 assert.equal(await page.evaluate(()=>card.isConnected&&result===document.querySelector('.voice-workspace-result')),true,'result container and editable card are never remounted');
 assert.equal(await sheet.evaluate(el=>el.getAnimations().filter(a=>a.playState==='running').length),0,'new results never reanimate the window');
 // One transient audio-capture failure is retried, with no tall error headline.
 const starts=await page.evaluate(()=>window.starts);await page.evaluate(()=>{failStarts=1;emit('нет не 700 а 800',true);});await mic.click();await listen();await page.waitForFunction(n=>window.starts>=n+2,starts);
 assert.match(await sheet.locator('.calendar-voice-review-summary').innerText(),/800/);
 // A real repeated failure remains actionable without destroying or shifting the card.
 await page.evaluate(()=>{failStarts=2;emit('нет не 800 а 900',true);});await mic.click();await page.waitForFunction(()=>document.querySelector('.calendar-voice-review')?.textContent.includes('Микрофон недоступен'));
 assert.equal(await sheet.locator('.voice-workspace-status').innerText(),'Проверьте запись');assert.match(await sheet.locator('.calendar-voice-review-summary').innerText(),/900/);
 await sheet.screenshot({path:'tests/voice-stable-review.png',animations:'disabled'});
 const before=await page.evaluate(()=>boxes());await sheet.locator('.voice-workspace-command-toggle').click();await sheet.locator('.voice-capabilities').waitFor();const help=await page.evaluate(()=>boxes());
 for(const key of ['x','y','w','h'])assert.equal(help.sheet[key],before.sheet[key]);for(const key of ['cx','cy'])assert.equal(help.mic[key],before.mic[key],'help keeps microphone centered');
 await sheet.locator('.voice-workspace-command-toggle').click();assert.equal(await page.evaluate(()=>details.open),true,'help preserves expanded transcript');
 for(const width of [320,390,1440]){await page.setViewportSize({width,height:844});await page.waitForTimeout(80);const b=await sheet.boundingBox();assert.ok(b.x>=0&&b.x+b.width<=width+1&&b.y>=0&&b.y+b.height<=844);}
 assert.deepEqual(errors,[]);console.log('PASS: stable shell/header/mic across speech, pause, processing, review, corrections, help and audio errors; preserved DOM; Safari input release; bounded retry; 320–1440px.');
}finally{await browser.close();}
