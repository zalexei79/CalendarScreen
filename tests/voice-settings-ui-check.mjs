import {createRequire} from 'node:module';
import path from 'node:path';
import assert from 'node:assert/strict';
const bundle=await createRequire(path.resolve('package.json'))('esbuild').build({stdin:{resolveDir:process.cwd(),loader:'jsx',contents:`
import React,{useState} from 'react';import{createRoot}from'react-dom/client';import Settings from './src/shared/ui/VoiceSettings.jsx';
function App(){const[language,setLanguage]=useState('ru');const[visible,setVisible]=useState(true);window.language=setLanguage;window.visible=setVisible;return visible?<Settings language={language}/>:null;}createRoot(document.getElementById('root')).render(<App/>);
`},bundle:true,write:false,format:'iife'});
const browser=await createRequire(process.env.DAYRIS_PLAYWRIGHT_PACKAGE||import.meta.url)('playwright').chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{window.SpeechSynthesisUtterance=class{constructor(text){this.text=text;}};Object.defineProperty(window,'speechSynthesis',{value:{getVoices:()=>[{voiceURI:'ru',name:'Русский',lang:'ru-RU'},{voiceURI:'en',name:'English',lang:'en-US'},{voiceURI:'ro',name:'Română',lang:'ro-RO'}],resume(){},speak(u){window.spoken=u;u.onstart?.();},cancel(){window.cancelled=(window.cancelled||0)+1;},addEventListener(){},removeEventListener(){}}});});
 await page.route('http://settings.test/**',r=>r.fulfill({contentType:'text/html',body:`<meta charset="utf-8"><div id="root"></div><script>${bundle.outputFiles[0].text}</script>`}));await page.goto('http://settings.test');
 for(const [language,uri,lang,label]of[['ru','ru','ru-RU','Послушать'],['en','en','en-US','Preview'],['md','ro','ro-RO','Ascultă']]){
  await page.evaluate(value=>window.language(value),language);
  await page.locator('#assistant-voice').selectOption(uri);
  assert.equal(await page.locator('#assistant-voice option').count(),2,'only voices matching app language');
  await page.getByRole('button',{name:label}).click();
  assert.deepEqual(await page.evaluate(()=>({lang:window.spoken.lang,voice:window.spoken.voice.voiceURI})),{lang,voice:uri});
  await page.evaluate(()=>window.visible(false));await page.locator('#assistant-voice').waitFor({state:'detached'});
  await page.evaluate(()=>window.visible(true));await page.locator('#assistant-voice').waitFor();
  assert.equal(await page.locator('#assistant-voice').inputValue(),uri,'preference survives remount');
 }
 assert.ok(await page.evaluate(()=>window.cancelled)>=3,'closing settings cancels preview');
 await page.evaluate(()=>{window.language('ru');window.spoken=null;window.speechSynthesis.getVoices=()=>[{voiceURI:'en',name:'English',lang:'en-US'}];});
 await page.getByRole('button',{name:'Послушать'}).click();
 assert.equal(await page.evaluate(()=>window.spoken),null,'missing Russian voice never falls back to English');
 assert.match(await page.getByRole('alert').textContent(),/Синтез речи/);
 assert.deepEqual(errors,[]);console.log('Voice settings: locale filtering, preview, persistence, missing-language guard and cleanup passed');
}finally{await browser.close();}
