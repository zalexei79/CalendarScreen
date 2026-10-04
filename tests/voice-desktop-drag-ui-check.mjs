import {createRequire} from 'node:module';
import path from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire(path.resolve('package.json'));
const bundle=await require('esbuild').build({stdin:{resolveDir:process.cwd(),loader:'jsx',contents:`import React from 'react';import {createRoot} from 'react-dom/client';import Voice from './src/shared/ui/CalendarVoiceButton.jsx';function App(){const [language,setLanguage]=React.useState('ru');window.setLanguage=setLanguage;return <Voice language={language} defaultCurrency="MDL" categoryOptions={['продукты','сок']} onCommand={()=>window.holdCommand?new Promise(resolve=>window.resolveCommand=resolve):undefined}/>}createRoot(document.getElementById('root')).render(<App/>);`},bundle:true,write:false,outfile:'voice.js',format:'iife'});
const browser=await createRequire(process.env.DAYRIS_PLAYWRIGHT_PACKAGE||import.meta.url)('playwright').chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1600,height:900}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  const nativeTimeout=setTimeout.bind(window);window.setTimeout=(cb,ms,...args)=>[900,1600,1900,8000,20000].includes(ms)?nativeTimeout(()=>{},60000):nativeTimeout(cb,ms,...args);
  window.SpeechRecognition=class{constructor(){window.voice=this;}start(){this.onstart?.();}abort(){this.aborted=true;}};
  window.emit=(phrases,isFinal=false)=>voice.onresult({results:phrases.map(transcript=>Object.assign([{transcript,confidence:0.4}],{isFinal}))});
  window.touch=(type,target,x,y)=>{const touch=new Touch({identifier:1,target,clientX:x,clientY:y});target.dispatchEvent(new TouchEvent(type,{bubbles:true,cancelable:true,touches:type==='touchend'?[]:[touch],changedTouches:[touch]}));};
 });
 await page.route('http://android.test/**',r=>r.fulfill({contentType:'text/html',body:`<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#0d0e10;font-family:Arial}button{font:inherit}${bundle.outputFiles.find(f=>f.path.endsWith('.css')).text}</style><div id="root"></div><script>${bundle.outputFiles.find(f=>f.path.endsWith('.js')).text}</script>`}));
 await page.goto('http://android.test');const sheet=page.locator('.voice-workspace');

 await page.locator('.calendar-voice-button').click();
 await page.waitForFunction(()=>document.querySelector('.voice-workspace')?.dataset.floating==='true');
 await page.waitForTimeout(450);
 const header=sheet.locator('.voice-workspace-header'),brand=sheet.locator('.voice-workspace-brand');
 const before=await sheet.boundingBox();
 const drag=async(dx,dy)=>{const b=await brand.boundingBox();await page.mouse.move(b.x+20,b.y+8);await page.mouse.down();await page.mouse.move(b.x+20+dx,b.y+8+dy,{steps:12});await page.mouse.up();};
 await drag(-300,-200);let box=await sheet.boundingBox();assert.ok(Math.abs(box.x-(before.x-300))<2);assert.ok(Math.abs(box.y-(before.y-200))<2);
 assert.equal(await page.evaluate(()=>voice.aborted),undefined,'moving preserves recognition');
 await brand.focus();await page.keyboard.press('ArrowLeft');assert.equal(Math.round((await sheet.boundingBox()).x),Math.round(box.x)-10);
 await drag(-2000,-2000);box=await sheet.boundingBox();assert.equal(box.x,12);assert.equal(box.y,12);
 await drag(2000,2000);box=await sheet.boundingBox();assert.ok(box.x+box.width<=1588.5);assert.ok(box.y+box.height<=888.5);
 await page.getByRole('button',{name:'Свернуть голосовой режим',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.voice-workspace').dataset.compact==='true');
 await page.getByRole('button',{name:'Развернуть помощника',exact:true}).click();await page.waitForTimeout(100);box=await sheet.boundingBox();assert.ok(box.y+box.height<=888.5,'growth stays on screen');
 await page.setViewportSize({width:900,height:650});await page.waitForTimeout(100);box=await sheet.boundingBox();assert.ok(box.x+box.width<=888.5&&box.y+box.height<=638.5,'resize clamps position');
 await page.getByRole('button',{name:'Закрыть голосовой режим',exact:true}).click();await page.locator('.calendar-voice-button').click();await page.waitForTimeout(100);const reopened=await sheet.boundingBox();assert.equal(reopened.x,box.x);assert.ok(reopened.y<=box.y&&box.y-reopened.y<40,'remembered position adjusts when new microphone status makes the window taller');
 await sheet.screenshot({path:'tests/voice-desktop-floating.png',animations:'disabled'});
 await page.getByRole('button',{name:'Вернуть окно на место',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('.voice-workspace').style.left);
 await page.setViewportSize({width:390,height:844});await page.waitForFunction(()=>document.querySelector('.voice-workspace').dataset.floating==='false');assert.equal(await brand.getAttribute('tabindex'),null);assert.equal(await sheet.evaluate(el=>el.style.left),'');
 assert.deepEqual(errors,[]);console.log('PASS: desktop drag, keyboard, bounds, resize, expand, position memory, reset and mobile layout without restarting microphone.');

}finally{await browser.close();}
