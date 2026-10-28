// Real settings and production CSS with a display-only profile, no auth session.
// Device capabilities and permission prompts are simulated locally.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';

const engine=process.env.DAYRIS_TEST_ENGINE==='webkit'?'webkit':'chromium';
const require=createRequire('C:/Users/aveel/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const fixture=`
import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import SettingsPanel from './src/shared/ui/SettingsPanel.jsx';
import {translate} from './src/shared/i18n/index.js';
function Fixture(){
 const params=new URLSearchParams(location.search),language=params.get('language')||'ru';
 const [theme,setTheme]=useState(params.get('theme')||'emerald');
 useEffect(()=>{document.documentElement.dataset.dayrisTheme=theme;},[theme]);
 return <SettingsPanel t={key=>translate(language,key)} language={language} setLanguage={()=>{}} currency="MDL" setCurrency={()=>{}}
  theme={theme} setTheme={setTheme} isLight={theme==='light'} user={{email:'preview@example.test',user_metadata:{nickname:'DAYRIS'}}}
  proAccessActive={!params.has('free')} proAccessLoading={false} onClose={()=>{}} visible/>;
}
createRoot(document.getElementById('root')).render(<Fixture/>);`;
const bundle=await build({stdin:{contents:fixture,resolveDir:process.cwd(),loader:'jsx'},bundle:true,write:false,outfile:'settings.js',format:'iife',loader:{'.svg':'dataurl'},define:{'process.env.NODE_ENV':'"production"','import.meta.env':'{"VITE_SUPABASE_URL":"https://settings.test","VITE_SUPABASE_ANON_KEY":"fixture"}'}});
const js=bundle.outputFiles.find(file=>file.path.endsWith('.js')).text;
const css=fs.readFileSync(path.join('dist/assets',fs.readdirSync('dist/assets').find(file=>/^main-.*\.css$/.test(file))),'utf8');
const browser=await (engine==='webkit'?require('playwright').webkit.launch({headless:true}):require('playwright').chromium.launch({channel:'msedge',headless:true}));
const shots=`artifacts/phone-motion-settings/${engine}`;
fs.mkdirSync(shots,{recursive:true});
try{
 for(const touch of [false,true]){
  const context=await browser.newContext({hasTouch:touch,viewport:{width:390,height:844},serviceWorkers:'block'});
  await context.route('**/*',route=>{
   const url=new URL(route.request().url());
   if(url.origin!=='https://settings.test')return route.abort();
   if(url.pathname==='/rest/v1/rpc/is_site_admin')return route.fulfill({contentType:'application/json',body:'false'});
   if(url.pathname.startsWith('/brand-'))return route.fulfill({contentType:'image/png',body:fs.readFileSync('public/brand-mark-192.png')});
   return route.fulfill({contentType:'text/html',body:'<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css+'</style><div id="root"></div><script>'+js+'</script>'});
  });
  await context.addInitScript(()=>{
   window.__tiltCalls=0;window.__motionCalls=0;
   const missing=new URLSearchParams(location.search).has('unavailable');
   Object.defineProperty(window,'DeviceOrientationEvent',{configurable:true,value:missing?undefined:class {static requestPermission(){window.__tiltCalls++;return Promise.resolve('granted');}}});
   Object.defineProperty(window,'DeviceMotionEvent',{configurable:true,value:missing?undefined:class {static requestPermission(){window.__motionCalls++;return Promise.resolve('granted');}}});
  });
  const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  const group=page.locator('.settings-phone-motion');
  for(const width of [390,1280])for(const theme of ['light','dark','purple','gold','emerald']){
   await page.setViewportSize({width,height:844});
   await page.goto(`https://settings.test/?theme=${theme}`);
   await page.locator('.theme-collection').waitFor();
   assert.equal(await group.count(),touch?1:0,`${engine}: ${touch?'phone':'desktop'} ${theme} ${width}`);
   assert.equal(await page.locator('.glass-parallax-control').count(),touch&&['gold','emerald'].includes(theme)?1:0);
   assert.equal(await page.locator('.month-shake-control').count(),touch?1:0,'desktop has no phone gesture setting, including a narrow desktop window');
   if(touch){
    assert.ok(await group.evaluate(el=>el.parentElement.classList.contains('theme-collection')&&el.previousElementSibling.classList.contains('theme-collection-access')),'phone controls sit together immediately below themes');
    assert.equal(await page.locator('.settings-group .month-shake-control').count(),0,'no second copy under Calendar');
   }
   assert.equal(await page.evaluate(()=>window.__tiltCalls+window.__motionCalls),0,'opening settings never requests sensor permissions');
   await page.locator('.dayris-settings-panel').evaluate(el=>Promise.all(el.getAnimations({subtree:true}).filter(animation=>animation.effect.getTiming().iterations!==Infinity).map(animation=>animation.finished.catch(()=>{}))));
   assert.ok(await page.locator('.dayris-settings-panel').evaluate(el=>el.scrollWidth<=el.clientWidth+1),`settings fit without horizontal overflow: ${touch?'phone':'desktop'} ${theme} ${width}`);
   if(theme==='emerald'){if(touch)await group.scrollIntoViewIfNeeded();await page.screenshot({path:`${shots}/${touch?'phone':'desktop'}-${width}.png`,animations:'disabled'});}
  }
  if(touch){
   const names={ru:'Движение телефона',uk:'Рух телефона',en:'Phone motion',md:'Mișcarea telefonului','zh-CN':'手机动作'};
   for(const [language,label] of Object.entries(names)){
    await page.goto(`https://settings.test/?theme=gold&language=${language}`);
    await page.getByRole('group',{name:label,exact:true}).waitFor();
   }
   for(const width of [320,844]){
    await page.setViewportSize({width,height:844});await page.goto('https://settings.test/?theme=emerald');await group.waitFor();
    assert.equal(await group.getByRole('switch').count(),2,'both phone controls remain available in portrait and landscape');
   }
   await page.setViewportSize({width:390,height:844});await page.goto('https://settings.test/?theme=emerald');await group.waitFor();
   const tilt=group.getByRole('switch',{name:'Глубина при наклоне',exact:true}),motion=group.getByRole('switch',{name:'Месяцы движением телефона',exact:true});
   await tilt.click();assert.equal(await tilt.getAttribute('aria-checked'),'true');
   await motion.click();assert.equal(await motion.getAttribute('aria-checked'),'true');
   assert.deepEqual(await page.evaluate(()=>[window.__tiltCalls,window.__motionCalls]),[1,1]);
   await group.getByRole('button',{name:'Повышенная',exact:true}).click();
   assert.equal(await page.evaluate(()=>localStorage.getItem('dayris_month_shake_sensitivity_v1')),'high');
   await motion.click();assert.equal(await tilt.getAttribute('aria-checked'),'true','switches remain independent');
   await page.goto('https://settings.test/?theme=light&free');await group.waitFor();
   assert.equal(await group.getByRole('switch').count(),1,'month gestures remain available without PRO');
   await page.goto('https://settings.test/?theme=gold&unavailable');await group.waitFor();
   assert.equal(await group.getByRole('switch',{name:'Месяцы движением телефона',exact:true}).isDisabled(),true);
  }
  assert.deepEqual(errors,[]);
  await context.close();
 }
 console.log(`PASS ${engine}: desktop controls absent, grouped phone controls, five themes/locales, portrait/landscape, opt-in permissions, independent switches and sensitivity.`);
}finally{await browser.close();}
