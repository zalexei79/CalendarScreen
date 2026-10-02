import {createRequire} from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const require=createRequire(path.resolve('package.json'));
const bundle=await require('esbuild').build({stdin:{resolveDir:process.cwd(),loader:'jsx',contents:`
import React,{useState} from 'react';import {createRoot} from 'react-dom/client';
import Dock from './src/shared/ui/WorkspaceDock.jsx';import Voice from './src/shared/ui/CalendarVoiceButton.jsx';
import Settings from './src/shared/ui/VoiceSettings.jsx';
function App(){const [light,setLight]=useState(false),[language,setLanguage]=useState('ru'),[hidden,setHidden]=useState(false);window.setLight=setLight;window.setLanguage=setLanguage;window.hideVoice=setHidden;return <><Settings language={language} isLight={light}/><Dock hidden={hidden}><div className="pointer-events-auto"><Voice language={language} isLight={light} defaultCurrency="MDL" walletAvailable={window.walletAvailable!==false} categoryOptions={[{value:'Продукты',label:'Продукты'},{value:'Кафе',label:'Кафе'}]} onCommand={command=>window.commands.push(command)} onSaveEntry={async (entry,progress)=>{window.saves.push(entry);if(window.partialFailure){progress.wallet=true;window.partialFailure=false;throw new Error('В кошельке сохранено. Повторите сохранение.');}if(window.failSave){window.failSave=false;throw new Error('Не удалось сохранить');}if(window.waitSave)await new Promise(resolve=>window.resolveSave=resolve);}}/></div></Dock></>}
window.commands=[];window.saves=[];createRoot(document.getElementById('root')).render(<App/>);
`},bundle:true,write:false,outfile:'voice.js',format:'iife'});
const utility=fs.readFileSync(path.join('dist/assets',fs.readdirSync('dist/assets').find(file=>file.endsWith('.css'))),'utf8');
const browser=await createRequire(process.env.DAYRIS_PLAYWRIGHT_PACKAGE||import.meta.url)('playwright').chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.addInitScript(()=>{
  window.SpeechRecognition=class{constructor(){window.voice=this;}start(){window.starts=(window.starts||0)+1;if(!window.delayStart)this.onstart?.();}stop(){this.onend?.();}abort(){this.aborted=true;}};
  window.emit=phrase=>{window.voice.onresult({results:[Object.assign([{transcript:phrase}],{isFinal:true})]});};
  window.finishPhrase=phrase=>{window.emit(phrase);window.voice.onend?.();};
  window.SpeechSynthesisUtterance=class{constructor(text){this.text=text;}};
  Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{getVoices:()=>[{voiceURI:'ru',name:'Russian',lang:'ru-RU',localService:true}],speak:utterance=>{window.spoken=utterance;window.speechCount=(window.speechCount||0)+1;utterance.onstart?.();},cancel:()=>{},resume:()=>{},addEventListener:()=>{},removeEventListener:()=>{}}});
  window.AudioContext=class{state='running';currentTime=0;resume(){return Promise.resolve();}close(){return Promise.resolve();}createOscillator(){return {frequency:{value:0},connect(){},disconnect(){},start(){window.cues=(window.cues||0)+1;},stop(){}};}createGain(){return {gain:{setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){}};}};
 });
 await page.route('http://voice.test/**',route=>route.fulfill({contentType:'text/html',body:`<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${utility}${bundle.outputFiles.find(file=>file.path.endsWith('.css')).text}body{background:#0b0c10;padding:20px;color:#ddd;font-family:Arial}</style><div id="root"></div><script>${bundle.outputFiles.find(file=>file.path.endsWith('.js')).text}</script>`}));
 await page.goto('http://voice.test');
 const mic=()=>page.locator('.calendar-voice-button');
 const phrase=async value=>{await mic().click();await page.evaluate(value=>window.finishPhrase(value),value);};
 // A start request is not readiness. Sound and ready text wait for onstart.
 await page.evaluate(()=>window.delayStart=true);await mic().click();
 assert.match(await page.locator('.calendar-voice-message').textContent(),/Включаю микрофон/);assert.equal(await page.evaluate(()=>window.cues||0),0);
 await page.evaluate(()=>{window.delayStart=false;window.voice.onstart();});assert.equal(await page.evaluate(()=>window.cues),1);
 await page.evaluate(()=>window.emit('потратил 250 леев на продукты вчера'));
 await page.locator('.calendar-voice-review').waitFor();assert.equal(await page.evaluate(()=>window.saves.length),0);
 assert.match(await page.locator('.calendar-voice-review-summary').textContent(),/Вчера · Продукты/);
 await page.evaluate(()=>document.getAnimations().forEach(animation=>animation.finish()));
 for(const width of [320,390,430,1280]){
  await page.setViewportSize({width,height:844});
  const box=await page.locator('.calendar-voice-review').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width,`review fits ${width}`);
  for(const button of await page.locator('.calendar-voice-review-actions button').all())assert.ok((await button.boundingBox()).height>=44);
 }
 await page.setViewportSize({width:390,height:844});
 await page.locator('.calendar-voice-review').screenshot({path:'tests/voice-review-dark.png',animations:'disabled'});
 await page.evaluate(()=>setLight(true));await page.locator('.calendar-voice-review').screenshot({path:'tests/voice-review-light.png',animations:'disabled'});await page.evaluate(()=>setLight(false));
 await phrase('нет, 350');assert.match(await page.locator('.calendar-voice-review-summary').textContent(),/−350 MDL/);
 await phrase('это доход');assert.match(await page.locator('.calendar-voice-review-summary').textContent(),/\+350 MDL/);
 await phrase('запиши в кошелёк');assert.match(await page.locator('.calendar-voice-review-summary').textContent(),/Кошелёк/);
 await phrase('непонятная фраза');assert.match(await page.locator('.calendar-voice-review [role="alert"]').textContent(),/Не понял/);assert.equal(await page.evaluate(()=>window.saves.length),0);
 await page.getByRole('button',{name:'Исправить',exact:true}).click();await page.getByLabel('Сумма',{exact:true}).fill('400');
 await page.getByLabel('Категория',{exact:true}).fill('Кафе');await page.getByLabel('Место записи',{exact:true}).selectOption('main');
 await page.getByLabel('Сумма',{exact:true}).fill('');assert.equal(await page.getByRole('button',{name:'Сохранить',exact:true}).isDisabled(),true);await page.getByLabel('Сумма',{exact:true}).fill('400');
 await page.locator('.calendar-voice-feedback input').uncheck();assert.equal(await page.locator('[data-voice-settings] input[type=checkbox]').isChecked(),false);
 await page.evaluate(()=>window.waitSave=true);await page.getByRole('button',{name:'Сохранить',exact:true}).evaluate(button=>{button.click();button.click();});
 assert.equal(await page.evaluate(()=>window.saves.length),1);assert.equal(await mic().isDisabled(),true);
 await page.evaluate(()=>{window.waitSave=false;window.resolveSave();});await page.locator('.calendar-voice-review').waitFor({state:'detached'});
 assert.match(await page.locator('.calendar-voice-answer').textContent(),/Записал доход 400 MDL/);assert.equal(await page.evaluate(()=>window.speechCount||0),0,'disabled speech never plays');
 assert.equal(await page.evaluate(()=>window.saves[0].category),'Кафе');
 await phrase('потратил 90');assert.match(await page.locator('.calendar-voice-answer').textContent(),/леях/);const starts=await page.evaluate(()=>window.starts);await page.waitForTimeout(400);assert.equal(await page.evaluate(()=>window.starts),starts,'silent prompts wait for user');
 await page.getByRole('button',{name:'€ EUR',exact:true}).click();await page.getByRole('button',{name:'Отправить',exact:true}).click();await page.locator('.calendar-voice-review').waitFor();
 await page.evaluate(()=>window.failSave=true);await page.getByRole('button',{name:'Сохранить',exact:true}).click();assert.match(await page.locator('.calendar-voice-review [role="alert"]').textContent(),/Не удалось/);
 await page.getByRole('button',{name:'Сохранить',exact:true}).click();await page.locator('.calendar-voice-review').waitFor({state:'detached'});
 await phrase('потратил 60 евро');await page.getByRole('button',{name:'Отмена',exact:true}).click();assert.equal(await page.locator('.calendar-voice-review').count(),0);
 await phrase('потратил 80 лей в оба');await page.evaluate(()=>window.partialFailure=true);await page.getByRole('button',{name:'Сохранить',exact:true}).click();
 assert.equal(await page.getByRole('button',{name:'Исправить',exact:true}).isDisabled(),true);assert.equal(await mic().isDisabled(),true);
 await page.getByRole('button',{name:'Сохранить',exact:true}).click();await page.locator('.calendar-voice-review').waitFor({state:'detached'});
 await page.reload();assert.equal(await page.locator('[data-voice-settings] input[type=checkbox]').isChecked(),false,'preference survives reload');
 await phrase('вчера на продукты 250 лей ушло');await page.locator('.calendar-voice-review').waitFor();
 await phrase('не 250, а 350');await phrase('не вчера, а сегодня');await phrase('не расход, а доход');
 assert.match(await page.locator('.calendar-voice-review-summary').textContent(),/Сегодня · Продукты\+350 MDL/);
 await phrase('350 лей и 400 лей');assert.match(await page.locator('.calendar-voice-answer').textContent(),/несколько сумм/);assert.equal(await page.locator('.calendar-voice-review').count(),0);
 await phrase('400');await page.locator('.calendar-voice-review').waitFor();assert.match(await page.locator('.calendar-voice-review-summary').textContent(),/Сегодня · Продукты\+400 MDL/);
 await phrase('на продукты и на кафе');assert.match(await page.locator('.calendar-voice-answer').textContent(),/одну категорию/);assert.equal(await page.getByRole('button',{name:/Создать/}).count(),0);
 await page.getByLabel('Категория',{exact:true}).selectOption('Продукты');await page.getByRole('button',{name:'Отправить',exact:true}).click();await page.locator('.calendar-voice-review').waitFor();
 assert.equal(await page.evaluate(()=>window.saves.length),0);await phrase('отмена');assert.equal(await page.locator('.calendar-voice-review').count(),0);
 await phrase('открой историю');assert.equal(await page.evaluate(()=>window.commands[0].type),'history');
 await page.locator('[data-voice-settings] input[type=checkbox]').check();await phrase('потратил 20');await page.waitForFunction(()=>window.spoken?.text.includes('леях'));
 const count=await page.evaluate(()=>window.starts);await page.evaluate(()=>window.spoken.onend());await page.waitForFunction(count=>window.starts===count+1,count);
 await page.evaluate(()=>window.finishPhrase('да'));await page.locator('.calendar-voice-review').waitFor();assert.equal(await page.evaluate(()=>window.saves.length),0);
 await mic().click();await page.evaluate(()=>{window.lateResult=window.voice.onresult;window.hideVoice(true);});await page.waitForFunction(()=>window.voice.aborted);
 await page.evaluate(()=>window.lateResult({results:[Object.assign([{transcript:'сохрани'}],{isFinal:true})]}));assert.equal(await page.evaluate(()=>window.saves.length),0);
 assert.deepEqual(errors,[]);console.log('PASS: review, corrections, manual editing, explicit save, retry, double-tap protection, audio preference, readiness and cancellation at 320–1280px');
}finally{await browser.close();}
