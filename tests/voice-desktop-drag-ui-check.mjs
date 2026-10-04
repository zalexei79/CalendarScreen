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

 const recordMotion=()=>page.evaluate(()=>{window.motionFrames=[];const start=performance.now();const sample=()=>{const el=document.querySelector('.voice-workspace');if(el){const b=el.getBoundingClientRect();motionFrames.push({x:b.x,y:b.y,width:b.width,height:b.height,bottom:b.bottom,floating:el.dataset.floating});}if(performance.now()-start<600)requestAnimationFrame(sample);};requestAnimationFrame(sample);});
 const horizontalStill=frames=>assert.ok(Math.max(...frames.map(f=>f.x))-Math.min(...frames.map(f=>f.x))<1,'centered transitions never wander horizontally');
 const oneDirection=(frames,key)=>{const delta=frames.at(-1)[key]-frames[0][key];for(let i=1;i<frames.length;i++)assert.ok((frames[i][key]-frames[i-1][key])*Math.sign(delta)>=-1,'return follows one direction without reversing');};
 await recordMotion();await page.locator('.calendar-voice-button').click();
 await page.waitForFunction(()=>document.querySelector('.voice-workspace')?.dataset.floating==='true');
 await page.waitForTimeout(450);
 const header=sheet.locator('.voice-workspace-header'),brand=sheet.locator('.voice-workspace-brand');
 const opening=await page.evaluate(()=>motionFrames);horizontalStill(opening);assert.ok(opening.every(f=>f.floating==='true'),'desktop layout is correct from the first painted frame');
 const before=await sheet.boundingBox();
 assert.ok(Math.abs(before.x+before.width/2-800)<1,'assistant opens centered on desktop before any dragging');
 const drag=async(dx,dy,cancel=false)=>{const b=await brand.boundingBox();await page.mouse.move(b.x+20,b.y+8);await page.mouse.down();await page.mouse.move(b.x+20+dx,b.y+8+dy,{steps:12});if(cancel)await header.dispatchEvent('pointercancel',{pointerId:1});await page.mouse.up();};
 await drag(-300,-200);let box=await sheet.boundingBox();assert.ok(Math.abs(box.x-(before.x-300))<2);assert.ok(Math.abs(box.y-(before.y-200))<2);
 assert.equal(await page.evaluate(()=>voice.aborted),undefined,'moving preserves recognition');
 await brand.focus();await page.keyboard.press('ArrowLeft');assert.equal(Math.round((await sheet.boundingBox()).x),Math.round(box.x)-10);


 await drag(-2000,-2000,true);box=await sheet.boundingBox();assert.equal(box.x,0);assert.equal(box.y,0,'header remains visible');
 await recordMotion();await page.getByRole('button',{name:'Вернуть окно на место',exact:true}).click();await page.waitForTimeout(650);
 const returned=await page.evaluate(()=>motionFrames);oneDirection(returned,'x');oneDirection(returned,'y');assert.ok(Math.abs(returned.at(-1).x+returned.at(-1).width/2-800)<1,'reset settles at center');
 const h=await brand.boundingBox();await page.mouse.move(h.x+20,h.y+8);await page.mouse.down();await page.mouse.move(h.x+20,875,{steps:12});await page.locator('.voice-workspace-dock-target').waitFor();const target=await page.locator('.voice-workspace-dock-target').boundingBox();assert.ok(Math.abs(target.x+target.width/2-800)<1,'preview is centered');await page.mouse.up();
 await page.waitForFunction(()=>document.querySelector('.voice-workspace')?.dataset.docked==='true'&&document.querySelector('.voice-workspace')?.dataset.compact==='true');await page.waitForTimeout(350);box=await sheet.boundingBox();assert.ok(box.y+box.height<=900&&box.y>700,'compact dock sits along bottom');assert.equal(await page.evaluate(()=>voice.aborted),undefined);
 await sheet.screenshot({path:'tests/voice-desktop-docked.png',animations:'disabled'});
 assert.ok(Math.abs(box.x+box.width/2-800)<1,'docked assistant is centered');
 await page.setViewportSize({width:900,height:900});await page.waitForTimeout(100);box=await sheet.boundingBox();assert.ok(Math.abs(box.x+box.width/2-450)<1,'dock stays centered after resizing');await page.setViewportSize({width:1600,height:900});await page.waitForTimeout(100);
 await recordMotion();await page.getByRole('button',{name:'Развернуть помощника',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('.voice-workspace').getAnimations().some(a=>a.playState==='running'&&a.effect.getKeyframes().some(k=>k.height)));
 await page.waitForTimeout(650);horizontalStill(await page.evaluate(()=>motionFrames));assert.ok((await sheet.boundingBox()).height>box.height,'expansion settles at full height');
 // Interrupt a transition while speech also updates the panel.
 await recordMotion();await sheet.locator('button[aria-label="Свернуть голосовой режим"]').evaluate(el=>el.click());await page.waitForTimeout(70);
 await sheet.locator('button[aria-label="Развернуть помощника"]').evaluate(el=>el.click());await page.evaluate(()=>emit(['на сок']));await page.waitForTimeout(650);
 horizontalStill(await page.evaluate(()=>motionFrames));assert.equal(await sheet.getAttribute('data-compact'),'false');assert.equal(await sheet.evaluate(el=>el.getAnimations().filter(a=>a.playState==='running').length),0,'rapid reversals finish without competing shell animations');
 await drag(100,-60);box=await sheet.boundingBox();await page.getByRole('button',{name:'Закрыть голосовой режим',exact:true}).click();await page.locator('.calendar-voice-button').click();await page.waitForTimeout(450);const reopened=await sheet.boundingBox();assert.equal(reopened.x,box.x);assert.equal(reopened.y,box.y);
 await page.getByRole('button',{name:'Вернуть окно на место',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('.voice-workspace').style.left);
 await page.setViewportSize({width:390,height:844});await page.waitForFunction(()=>document.querySelector('.voice-workspace').dataset.floating==='false');assert.equal(await brand.getAttribute('tabindex'),null);assert.equal(await sheet.evaluate(el=>el.style.left),'');
 await page.emulateMedia({reducedMotion:'reduce'});await page.getByRole('button',{name:'Свернуть голосовой режим',exact:true}).click();assert.equal(await sheet.evaluate(el=>el.getAnimations().filter(a=>a.playState==='running').length),0,'reduced motion skips shell animation');
 assert.deepEqual(errors,[]);console.log('PASS: desktop drag, keyboard, reachable header, magnetic docking, position memory, reset and mobile layout without restarting microphone.');

}finally{await browser.close();}
