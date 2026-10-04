import {createRequire} from 'node:module';
import path from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire(path.resolve('package.json'));
const bundle=await require('esbuild').build({stdin:{resolveDir:process.cwd(),loader:'jsx',contents:`import React from 'react';import {createRoot} from 'react-dom/client';import Voice from './src/shared/ui/CalendarVoiceButton.jsx';window.saved=[];createRoot(document.getElementById('root')).render(<Voice defaultCurrency="MDL" categoryOptions={['сок']} onCommand={()=>{}} onSaveEntry={entry=>saved.push(entry)}/>);`},bundle:true,write:false,outfile:'voice.js',format:'iife'});
const browser=await createRequire(process.env.DAYRIS_PLAYWRIGHT_PACKAGE||import.meta.url)('playwright').chromium.launch({channel:'msedge',headless:true});
try{
 for(const mode of ['pip','popup','blocked']){
  const context=await browser.newContext({viewport:{width:1400,height:900}}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(mode=>{
   localStorage.setItem('dayris_voice_feedback','off');
   const nativeTimeout=setTimeout.bind(window);window.setTimeout=(cb,ms,...args)=>[8000,20000].includes(ms)?nativeTimeout(()=>{},60000):nativeTimeout(cb,ms,...args);
   window.SpeechRecognition=class{constructor(){window.voice=this;window.starts=(window.starts||0);}start(){starts++;this.onstart?.();}abort(){this.aborted=true;}};
   window.emit=text=>voice.onresult({results:[Object.assign([{transcript:text,confidence:.4}],{isFinal:true})]});
   const nativeOpen=window.open.bind(window);
   Object.defineProperty(window,'documentPictureInPicture',{configurable:true,value:mode==='pip'?{requestWindow:async()=>{window.pipRequests=(window.pipRequests||0)+1;return nativeOpen('','test-pip','popup,width=430,height=590');}}:undefined});
   if(mode==='blocked')window.open=()=>null;
  },mode);
  await page.route('http://widget.test/**',r=>r.fulfill({contentType:'text/html',body:`<meta charset="UTF-8"><style>body{margin:0;background:#141619;font-family:Arial}button{font:inherit}${bundle.outputFiles.find(f=>f.path.endsWith('.css')).text}</style><div id="root"></div><script>${bundle.outputFiles.find(f=>f.path.endsWith('.js')).text}</script>`}));
  await page.goto('http://widget.test');await page.locator('.calendar-voice-button').click();
  await page.evaluate(()=>emit('потратил 50 лей'));await page.waitForFunction(()=>document.querySelector('.voice-workspace-instruction')?.textContent.includes('На что'));
  await page.waitForTimeout(350);const starts=await page.evaluate(()=>starts);
  const popout=page.getByRole('button',{name:'Открыть отдельным виджетом',exact:true});
  if(mode==='blocked'){
   await popout.click();await page.locator('.voice-workspace-widget-error').waitFor();assert.equal(await page.locator('.voice-workspace').count(),1);assert.equal(await page.evaluate(()=>starts),starts);await context.close();continue;
  }
  const popupPromise=page.waitForEvent('popup');await popout.click();const widget=await popupPromise;widget.on('pageerror',e=>errors.push(e.message));
  await widget.locator('.voice-workspace[data-widget="true"]').waitFor();assert.equal(await page.locator('.voice-workspace').count(),0);
  assert.match(await widget.locator('.voice-workspace-instruction').innerText(),/На что/);assert.equal(await page.evaluate(()=>starts),starts,'popout keeps existing microphone');
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});assert.equal(await page.evaluate(()=>voice.aborted),undefined,'widget keeps session when calendar loses visibility');
  await widget.locator('.voice-workspace-hints').evaluate(el=>el.open=true);
  await widget.screenshot({path:`tests/voice-widget-${mode}.png`,animations:'disabled'});
  await widget.getByRole('button',{name:'Вернуть в календарь',exact:true}).click();await page.locator('.voice-workspace[data-widget="false"]').waitFor();assert.match(await page.locator('.voice-workspace-instruction').innerText(),/На что/);
  await page.evaluate(()=>Object.defineProperty(document,'hidden',{configurable:true,value:false}));
  const nextPopup=page.waitForEvent('popup');await popout.click();const next=await nextPopup;await next.locator('.voice-workspace').waitFor();await next.close();await page.locator('.voice-workspace').waitFor();
  assert.match(await page.locator('.voice-workspace-instruction').innerText(),/На что/,'closing OS window returns unfinished context');
  const lastPopup=page.waitForEvent('popup');await popout.click();const last=await lastPopup;await last.getByRole('button',{name:'Закрыть голосовой режим',exact:true}).click();await page.waitForFunction(()=>voice.aborted);await page.locator('.voice-workspace').waitFor({state:'detached'});
  assert.deepEqual(errors,[]);await context.close();
 }
 console.log('PASS: PiP branch, popup fallback, blocked popup recovery, draft continuity, hidden-calendar microphone, return and OS close, explicit exit.');
}finally{await browser.close();}
