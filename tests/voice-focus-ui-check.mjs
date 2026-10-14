import {createRequire} from 'node:module';
import path from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire(path.resolve('package.json'));
const result=await require('esbuild').build({stdin:{resolveDir:process.cwd(),loader:'jsx',contents:`
 import React,{useState} from 'react';import {createRoot} from 'react-dom/client';
 import Workspace from './src/shared/ui/VoiceWorkspace.jsx';import Card from './src/shared/ui/VoiceEntryCard.jsx';
 import './src/shared/ui/CalendarVoiceButton.css';
 function App(){const [locale,setLocale]=useState('ru'),[light,setLight]=useState(false),[review,setReview]=useState(false),[entry,setEntry]=useState({amount:'250',currency:'USD',category:'Food',sign:'minus',destination:'main',dateKey:'2026-10-01'});
 window.setLocale=setLocale;window.setLight=setLight;window.setReview=setReview;
 return <Workspace locale={locale} isLight={light} phrase="Spent 250 USD on Food" status={review?'Review':'Listening'} help={{filtered:true,phrases:['amount 70']}} phase="listening" listening={!review} resultKey={review?'review':'idle'} onClose={()=>{}} onListen={()=>{}} onSuggestion={()=>{}} onCollapse={()=>{}} categories={[]} settings={<span>Settings</span>}>
 {review&&<Card entry={entry} locale={locale} categories={[]} onChange={setEntry} onSave={()=>window.saved=entry} onCancel={()=>{}}/>}</Workspace>}
 createRoot(document.getElementById('root')).render(<App/>);
 `},bundle:true,write:false,outfile:'voice.js'});
const browser=await createRequire(process.env.DAYRIS_PLAYWRIGHT_PACKAGE||'C:/Users/aveel/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('playwright').chromium.launch({channel:'msedge',headless:true});
try {
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('http://focus.test/**',r=>r.fulfill({contentType:'text/html',body:`<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;font-family:Arial;background:#090a0e}${result.outputFiles.find(f=>f.path.endsWith('.css')).text}</style><div id="root"></div><script>${result.outputFiles.find(f=>f.path.endsWith('.js')).text}</script>`}));
 await page.goto('http://focus.test');await page.emulateMedia({reducedMotion:'reduce'});
 assert.equal(await page.locator('.voice-workspace-phrase').isVisible(),true);
 assert.equal(await page.locator('.voice-workspace-hints').getAttribute('open'),null,'Hints are optional, not another focal point');
 await page.evaluate(()=>setReview(true));
 assert.equal(await page.locator('.voice-workspace-phrase').isVisible(),false,'Review focuses on the entry');
 await page.locator('.voice-workspace-transcript summary').click();
 assert.equal(await page.locator('.voice-workspace-phrase').isVisible(),true,'Original phrase remains accessible');
 await page.locator('.voice-workspace-transcript summary').click();
 for(const locale of ['ru','en','ro','zh'])for(const width of [320,390,1280])for(const light of [false,true]){
  await page.evaluate(({locale,light})=>{setLocale(locale);setLight(light);},{locale,light});await page.setViewportSize({width,height:844});
  await page.waitForFunction(()=>{const box=document.querySelector('.voice-workspace').getBoundingClientRect();return box.x>=0&&box.right<=innerWidth+1;});
  const box=await page.locator('.voice-workspace').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width+1);
  const actions=page.locator('.calendar-voice-review-actions button');
  for(const button of await actions.all())assert.ok((await button.boundingBox()).height>=44);
  assert.match(await page.locator('.calendar-voice-review-summary').textContent(),/250 USD/);
 }
 await page.evaluate(()=>setLocale('en'));
 await page.getByRole('button',{name:'Edit',exact:true}).click();await page.getByRole('textbox',{name:'Amount',exact:true}).fill('350');
 await page.getByRole('button',{name:'Save',exact:true}).click();assert.equal(await page.evaluate(()=>window.saved.amount),'350');
 assert.deepEqual(errors,[]);console.log('PASS: focused listening/review, expandable transcript, optional help, editing/saving, RU/EN/RO/ZH, light/dark, 320/390/1280px.');
} finally {await browser.close();}
