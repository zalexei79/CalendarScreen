import {createRequire} from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const bundle=await createRequire(path.resolve('package.json'))('esbuild').build({stdin:{resolveDir:process.cwd(),loader:'jsx',contents:`
import React,{useState} from 'react';import {createRoot} from 'react-dom/client';
import Dock from './src/shared/ui/WorkspaceDock.jsx';import Voice from './src/shared/ui/CalendarVoiceButton.jsx';
function App(){const[hidden,setHidden]=useState(false);window.hideVoice=()=>setHidden(true);return <Dock hidden={hidden} proView><div className="pointer-events-auto flex items-center gap-1.5 rounded-full p-1.5"><button className="flex items-center gap-2 px-2 text-xs"><span className="w-6">◷</span>История</button><button className="flex items-center gap-2 px-3 text-xs"><span className="w-5">+</span>Добавить</button><Voice onCommand={c=>{window.commands.push(c);if(c.type==='question')return 'Личные расходы: 50 рублей.';}}/></div></Dock>}
window.commands=[];createRoot(document.getElementById('root')).render(<App/>);
`},bundle:true,write:false,outfile:'voice.js',format:'iife'});
const utility=fs.readFileSync(path.join('dist/assets',fs.readdirSync('dist/assets').find(f=>f.endsWith('.css'))),'utf8');
const browser=await createRequire(process.env.DAYRIS_PLAYWRIGHT_PACKAGE||import.meta.url)('playwright').chromium.launch({channel:'msedge',headless:true});
try{
const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{window.SpeechRecognition=class{constructor(){window.voice=this;}start(){window.starts=(window.starts||0)+1;this.onstart?.();}stop(){window.stops=(window.stops||0)+1;setTimeout(()=>this.onend?.(),20);}abort(){this.aborted=true;}};window.emit=text=>window.voice.onresult({resultIndex:0,results:[Object.assign([{transcript:text}],{isFinal:true})]});});
await page.route('http://voice.test/**',r=>r.fulfill({contentType:'text/html',body:`<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${utility}${bundle.outputFiles.find(f=>f.path.endsWith('.css')).text}</style><div id="root"></div><script>${bundle.outputFiles.find(f=>f.path.endsWith('.js')).text}</script>`}));
await page.goto('http://voice.test');await page.locator('.calendar-voice-button').waitFor();
await page.evaluate(()=>{window.SpeechSynthesisUtterance=class{constructor(text){this.text=text;}};Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{getVoices:()=>[],speak:utterance=>{if(!utterance.text)return;window.spoken=utterance;window.speakCount=(window.speakCount||0)+1;utterance.onstart?.();},cancel:()=>{window.cancelCount=(window.cancelCount||0)+1;}}});});
assert.equal(await page.evaluate(()=>window.starts||0),0);
for(const width of [320,390,430,1280]){
 await page.setViewportSize({width,height:844});
 for(const button of await page.locator('.calendar-action-dock button').all()){const box=await button.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width&&box.height>=44,`tap target fits ${width}`);}
}
await page.getByRole('button',{name:'Голосовая команда'}).click();await page.evaluate(()=>emit('включи 13 ноября 2048'));
await page.waitForFunction(()=>window.commands.length===1);
assert.equal(await page.evaluate(()=>window.commands[0]?.dateKey),'2048-11-13');
await page.getByRole('button',{name:'Голосовая команда'}).click();await page.evaluate(()=>emit('добавь запись'));
await page.waitForFunction(()=>window.commands.length===2);
assert.equal(await page.evaluate(()=>window.commands[1].type),'add');
await page.getByRole('button',{name:'Голосовая команда'}).click();
assert.equal(await page.locator('.calendar-voice-commands li').count(),13);
assert.equal(await page.locator('.calendar-dock-actions > div > button').first().isVisible(),false,'voice mode replaces history and add');
assert.match(await page.locator('[role="status"]').textContent(),/Слушаю/);
assert.match(await page.locator('.calendar-voice-message').textContent(),/Сегодня я потратил 50 рублей/);
await page.getByRole('button',{name:'Готово — обработать фразу'}).click();
await page.getByRole('button',{name:'Голосовая команда'}).waitFor();
await page.getByRole('button',{name:'Голосовая команда'}).click();await page.evaluate(()=>emit('удали запись'));
await page.getByRole('button',{name:'Голосовая команда'}).waitFor();
assert.equal(await page.evaluate(()=>window.commands.length),2);
assert.match(await page.locator('[role="status"]').textContent(),/Не понял/);
await page.getByRole('button',{name:'Голосовая команда'}).click();await page.evaluate(()=>window.voice.onerror({error:'not-allowed'}));
assert.match(await page.locator('[role="status"]').textContent(),/Разрешите/);
await page.getByRole('button',{name:'Голосовая команда'}).click();await page.evaluate(()=>emit('Сколько я потратил за этот месяц'));
await page.locator('.calendar-voice-answer').waitFor();
assert.match(await page.locator('.calendar-voice-answer').textContent(),/50 рублей/);
await page.waitForFunction(()=>window.spoken?.lang==='ru-RU');
assert.equal(await page.evaluate(()=>window.spoken.lang),'ru-RU');
assert.equal(await page.evaluate(()=>window.speakCount),1);
assert.equal(await page.locator('.calendar-voice-commands').count(),0,'answers do not display the help list');
await page.getByRole('button',{name:'Остановить ответ'}).click();
assert.equal(await page.evaluate(()=>window.cancelCount),1);
await page.getByRole('button',{name:'Прослушать ответ'}).click();
assert.equal(await page.evaluate(()=>window.speakCount),2);
await page.getByRole('button',{name:'Голосовая команда'}).click();
assert.equal(await page.evaluate(()=>window.cancelCount),2,'starting microphone stops speech');
await page.evaluate(()=>emit('Подведи итог за этот месяц'));
await page.waitForFunction(()=>window.speakCount===3);
await page.evaluate(()=>window.spoken.onerror({error:'not-allowed'}));
assert.match(await page.locator('[role="alert"]').textContent(),/Звук не запустился/);
await page.getByRole('button',{name:'Прослушать ответ'}).click();
assert.equal(await page.evaluate(()=>window.speakCount),4,'audio can be retried from a direct gesture');
await page.evaluate(()=>hideVoice());await page.waitForFunction(()=>window.cancelCount===3);
await page.reload();await page.locator('.calendar-voice-button').waitFor();
await page.getByRole('button',{name:'Голосовая команда'}).click();
await page.evaluate(()=>{
 const current=window.voice;
 current.onresult({resultIndex:0,results:[Object.assign([{transcript:'добавь 60 лей я сегодня потратил'}],{isFinal:false})]});
 current.stop=()=>{window.manualStopped=true;current.onresult({resultIndex:0,results:[Object.assign([{transcript:'добавь 60 лей я сегодня потратил'}],{isFinal:true})]});};
 const original=current.stop;current.stop=()=>{current.stop=()=>setTimeout(()=>current.onend?.(),20);original();};
});
assert.match(await page.locator('.calendar-voice-transcript').textContent(),/60 лей/);
await page.getByRole('button',{name:'Готово — обработать фразу'}).click();
await page.waitForFunction(()=>window.commands.length===1);
assert.equal(await page.evaluate(()=>window.commands[0].amount),'60','Done processes the final result instead of aborting it');
await page.getByRole('button',{name:'Голосовая команда'}).click();await page.getByRole('button',{name:'Закрыть голосовой режим'}).click();
await page.locator('.calendar-dock-actions > div > button').first().waitFor({state:'visible'});
await page.getByRole('button',{name:'Голосовая команда'}).click();await page.evaluate(()=>{window.lateResult=window.voice.onresult;hideVoice();});
await page.waitForFunction(()=>window.voice.aborted);
await page.evaluate(()=>window.lateResult({resultIndex:0,results:[Object.assign([{transcript:'добавь запись'}],{isFinal:true})]}));
assert.equal(await page.evaluate(()=>window.commands.length),1,'unmounted controls never execute late commands');
assert.deepEqual(errors,[]);console.log('PASS: phone voice commands, safe rejection, permission failure, unmount cancellation and dock at 320–1280px.');
}finally{await browser.close();}
