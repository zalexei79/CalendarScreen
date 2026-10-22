import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire(path.resolve('package.json'));
const { build } = require('esbuild');
const palette=process.env.DAYRIS_TEST_THEME==='gold'?'gold':'emerald';
const blur=28;
const { chromium } = createRequire('C:/Users/aveel/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('playwright');
const bundle = await build({ stdin: { resolveDir:process.cwd(), loader:'jsx', contents:`
import React,{useState} from 'react';import {createRoot} from 'react-dom/client';
import First from './src/features/onboarding/FirstRunSetup.jsx';
import Wallet from './src/features/wallet/WalletPanel.jsx';
import Planner from './src/features/reminders/FinancePlanComposer.jsx';
import Voice from './src/shared/ui/VoiceWorkspace.jsx';
import Capital from './src/features/capital/CapitalPanel.jsx';
function App(){
 const [screen,setScreen]=useState('first'),[theme,setTheme]=useState(${JSON.stringify(palette)}),[step,setStep]=useState('appearance'),[access,setAccess]=useState(true);
 window.setScreen=setScreen;window.setTheme=setTheme;window.setAccess=setAccess;
 document.documentElement.dataset.dayrisTheme=theme;
 const base={language:'ru',isLight:theme==='light'};
 return <main className="premium-shell" style={{minHeight:'100dvh',padding:16}}>
 {screen==='first'&&<First {...base} proAccessActive={access} step={step} theme={theme} currency="USD" onTheme={setTheme} onLanguage={()=>{}} onCurrency={()=>{}} onStep={setStep} onSkip={()=>setScreen('wallet')}/>}
 {screen==='wallet'&&<Wallet {...base} currency="USD" transactions={[]} balanceByCurrency={{USD:12500}} onSave={async()=>{}} onDelete={async()=>{}} onBackToCalendar={()=>{}}/>}
 {screen==='planner'&&<Planner {...base} open dateKey="2026-10-15" defaultCurrency="USD" onClose={()=>setScreen('wallet')} onCreate={async()=>{}}/>}
 {screen==='voice'&&<Voice {...base} locale="ru" status="Микрофон на паузе" help={{filtered:true,title:'Например',phrases:[]}} onClose={()=>{}} onCollapse={()=>{}} onListen={()=>{}}/>}
 {screen==='capital'&&<Capital {...base} currency="USD" onBack={()=>{}} onWallet={()=>{}}/>}
 </main>;
}createRoot(document.getElementById('root')).render(<App/>);
` },bundle:true,write:false,outfile:'emerald.js',format:'iife',define:{'import.meta.env':JSON.stringify({VITE_SUPABASE_URL:'https://example.supabase.co',VITE_SUPABASE_ANON_KEY:'test'})}});
const css=fs.readFileSync(path.join('dist/assets',fs.readdirSync('dist/assets').find(f=>f.startsWith('main-')&&f.endsWith('.css'))),'utf8');
const script=bundle.outputFiles.find(f=>f.path.endsWith('.js')).text;
const browser=await chromium.launch({channel:'msedge',headless:true});
try {
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>{
  const url=new URL(route.request().url());
  if(url.origin!=='http://emerald.test') return route.abort();
  if(url.pathname!=='/') {
   const file=path.resolve('dist','.'+url.pathname);
   if(file.startsWith(path.resolve('dist')+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile()) return route.fulfill({body:fs.readFileSync(file),contentType:file.endsWith('.svg')?'image/svg+xml':file.endsWith('.png')?'image/png':'image/webp'});
   return route.fulfill({status:404,body:''});
  }
  return route.fulfill({contentType:'text/html',body:`<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}body{margin:0}</style><div id="root"></div><script>${script.replaceAll('</script>','<\\/script>')}</script>`});
 });
 await page.goto('http://emerald.test');
 await page.getByRole('heading',{name:'Твой стиль DAYRIS.'}).waitFor();
 const glass = locator=>locator.evaluate(el=>{const s=getComputedStyle(el);return {image:s.backgroundImage,blur:s.backdropFilter,color:s.color,bg:s.backgroundColor};});
 for(const width of [390,1280]) {
  await page.setViewportSize({width,height:width===390?844:950});
  const shell=await glass(page.locator('.first-run-shell'));
  assert.ok(shell.blur.includes(`blur(${blur}px)`));
  assert.match(shell.image,/linear-gradient/);
  assert.equal(await page.locator('.first-run-dialog').evaluate(el=>el.scrollWidth<=el.clientWidth),true);
  await page.screenshot({path:`tests/${palette}-glass-onboarding-${width}.png`,animations:'disabled'});
 }
 // Selecting themes immediately updates the native top-layer onboarding dialog.
 await page.getByRole('button',{name:'Светлое',exact:true}).click();
 assert.equal(await page.locator('html').getAttribute('data-dayris-theme'),'light');
 assert.ok(!(await glass(page.locator('.first-run-shell'))).blur.includes(`${blur}px`));
 await page.getByRole('button',{name:palette==='gold'?'Золото':'Изумрудное',exact:true}).click();
 assert.ok((await glass(page.locator('.first-run-shell'))).blur.includes(`${blur}px`));
 await page.evaluate(()=>{window.setTheme('dark');window.setAccess(false);});
 for(const name of ['Золото','Изумрудное']) {
  await page.getByRole('button',{name,exact:true}).click();
  const preview=page.locator('.theme-preview-dialog');await preview.waitFor();
  assert.equal(await page.locator('html').getAttribute('data-dayris-theme'),'dark');
  assert.equal(await page.locator('.first-run-dialog').evaluate(el=>el.open),true,'Preview stays above the native first-run dialog');
  await page.screenshot({path:`tests/onboarding-locked-${name==='Золото'?'gold':'emerald'}.png`,animations:'disabled'});
  await page.keyboard.press('Escape');
  await preview.waitFor({state:'detached'});
  assert.equal(await page.locator('.first-run-dialog').evaluate(el=>el.open),true,'Escape does not dismiss first run');
 }
 await page.evaluate(p=>{window.setAccess(true);window.setTheme(p);},palette);
 await page.getByRole('button',{name:'Продолжить',exact:true}).click();
 await page.getByRole('heading',{name:'Настроим под тебя.'}).waitFor();
 await page.getByRole('button',{name:'Назад',exact:true}).click();
 await page.getByRole('heading',{name:'Твой стиль DAYRIS.'}).waitFor();
 await page.getByRole('button',{name:'Продолжить',exact:true}).click();
 await page.getByRole('button',{name:/Доллар США/}).click();
 await page.locator('.life-birthday-card').waitFor();
 assert.match((await glass(page.locator('.life-birthday-card'))).image,/linear-gradient/);
 await page.setViewportSize({width:390,height:844});
 await page.evaluate(()=>window.setScreen('wallet'));
 await page.locator('.wallet-balance-card').waitFor();
 assert.match((await glass(page.locator('.wallet-balance-card'))).image,/linear-gradient/);
 await page.getByRole('button',{name:'Понятно, начать',exact:true}).click();
 await page.screenshot({path:`tests/${palette}-glass-wallet.png`,animations:'disabled'});
 await page.evaluate(()=>window.setScreen('capital'));
 await page.locator('.capital-panel').waitFor();
 assert.equal(await page.locator('.capital-panel').evaluate(el=>getComputedStyle(el).getPropertyValue('--cap-bg').trim()),palette==='gold'?'#0b0b0d':'#030e0b');
 await page.screenshot({path:`tests/${palette}-glass-capital.png`,animations:'disabled'});
 await page.evaluate(()=>window.setScreen('voice'));
 await page.locator('.voice-workspace').waitFor();
 assert.ok((await glass(page.locator('.voice-workspace'))).blur.includes(`${blur}px`));
 await page.screenshot({path:`tests/${palette}-glass-voice.png`,animations:'disabled'});
 await page.evaluate(()=>window.setScreen('planner'));
 await page.locator('.plan-dialog').waitFor();
 assert.ok((await glass(page.locator('.plan-dialog'))).blur.includes(`${blur}px`));
 await page.screenshot({path:`tests/${palette}-glass-planner.png`,animations:'disabled'});
 const session=await page.context().newCDPSession(page);
 await session.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-transparency',value:'reduce'}]});
 assert.equal((await glass(page.locator('.plan-dialog'))).blur,'none');
 assert.equal((await glass(page.locator('.plan-dialog'))).bg,palette==='gold'?'rgb(21, 23, 27)':'rgb(12, 38, 30)');
 await session.send('Emulation.setEmulatedMedia',{features:[]});
 await page.evaluate(()=>window.setScreen('wallet'));
 await page.evaluate(()=>window.setTheme('dark'));
 assert.doesNotMatch((await glass(page.locator('.wallet-balance-card'))).image,/182, 255, 233/);
 assert.deepEqual(errors,[]);
 console.log(`PASS: ${palette} onboarding at phone/desktop sizes, theme switching, birthday, wallet, investments, voice, planner, reduced transparency; no runtime errors.`);
} finally {await browser.close();}
