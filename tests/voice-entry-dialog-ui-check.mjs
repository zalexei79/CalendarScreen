import {createRequire} from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const bundle=await createRequire(path.resolve('package.json'))('esbuild').build({stdin:{resolveDir:process.cwd(),loader:'jsx',contents:`
import React,{useState} from 'react';import {createRoot} from 'react-dom/client';
import Dock from './src/shared/ui/WorkspaceDock.jsx';import Voice from './src/shared/ui/CalendarVoiceButton.jsx';
import useVoiceCategories from './src/shared/ui/useVoiceCategories.js';
function CategoryFixture(){const[owner,setOwner]=useState('a');const categories=useVoiceCategories(owner);window.addCategory=categories.add;window.categoryNames=categories.categories;window.switchCategoryOwner=setOwner;return null;}
function App(){const[language,setLanguage]=useState('ru');window.voiceLanguage=setLanguage;const[hidden,setHidden]=useState(false);window.hideVoice=()=>setHidden(true);return <Dock hidden={hidden} proView><div className="pointer-events-auto flex items-center gap-1.5 rounded-full p-1.5"><button className="flex items-center gap-2 px-2 text-xs"><span className="w-6">◷</span>История</button><button className="flex items-center gap-2 px-3 text-xs"><span className="w-5">+</span>Добавить</button><Voice language={language} onCommand={c=>{window.commands.push(c);if(c.type==='question')return 'Личные расходы: 50 рублей.';}}/></div></Dock>}
window.commands=[];createRoot(document.getElementById('root')).render(<><CategoryFixture/><App/></>);
`},bundle:true,write:false,outfile:'voice.js',format:'iife'});
const utility=fs.readFileSync(path.join('dist/assets',fs.readdirSync('dist/assets').find(f=>f.endsWith('.css'))),'utf8');
const browser=await createRequire(process.env.DAYRIS_PLAYWRIGHT_PACKAGE||import.meta.url)('playwright').chromium.launch({channel:'msedge',headless:true});
try{
const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36'});const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{window.SpeechRecognition=class{constructor(){window.voice=this;}start(){window.starts=(window.starts||0)+1;this.onstart?.();}stop(){window.stops=(window.stops||0)+1;setTimeout(()=>this.onend?.(),20);}abort(){this.aborted=true;}};window.emit=text=>window.voice.onresult({resultIndex:0,results:[Object.assign([{transcript:text}],{isFinal:true})]});});
await page.route('http://voice.test/**',r=>r.fulfill({contentType:'text/html',body:`<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${utility}${bundle.outputFiles.find(f=>f.path.endsWith('.css')).text}</style><div id="root"></div><script>${bundle.outputFiles.find(f=>f.path.endsWith('.js')).text}</script>`}));
await page.goto('http://voice.test');await page.locator('.calendar-voice-button').waitFor();
await page.evaluate(()=>{window.SpeechSynthesisUtterance=class{constructor(text){this.text=text;}};Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{getVoices:()=>[{voiceURI:'ru',name:'Russian',lang:'ru-RU',localService:true}],speak:utterance=>{if(!utterance.text){window.warmups=(window.warmups||0)+1;return;}window.spoken=utterance;window.speakCount=(window.speakCount||0)+1;utterance.onstart?.();},cancel:()=>{window.cancelCount=(window.cancelCount||0)+1;}}});});
assert.equal(await page.evaluate(()=>window.starts||0),0);
await page.getByRole('button',{name:'Голосовая команда'}).click();await page.evaluate(()=>emit('потратил 80'));
await page.waitForFunction(()=>window.spoken?.text.includes('валюте'));
assert.equal(await page.evaluate(()=>window.commands.length),0,'question never saves or submits a draft');
assert.equal(await page.evaluate(()=>window.starts),1,'microphone waits for question speech to end');
await page.evaluate(()=>window.spoken.onend());await page.waitForFunction(()=>window.starts===2);
assert.equal(await page.evaluate(()=>window.voice.lang),'ru-RU');
await page.evaluate(()=>emit('в леях'));await page.waitForFunction(()=>window.commands.length===1);
assert.deepEqual(await page.evaluate(()=>window.commands[0]),{type:'entry',kind:'record',sign:'minus',amount:'80',currency:'MDL'});
await page.evaluate(()=>window.spoken=null);await page.getByRole('button',{name:'Голосовая команда'}).click();await page.evaluate(()=>emit('потратил 50'));
await page.waitForFunction(()=>window.spoken?.text.includes('валюте'));await page.getByRole('button',{name:'Закрыть голосовой режим'}).click();
assert.equal(await page.evaluate(()=>window.spoken.onend),null,'closing removes automatic listening callback');
assert.deepEqual(errors,[]);console.log('PASS: spoken clarification, automatic follow-up listening, draft completion and cancellation');
}finally{await browser.close();}
