import {createRequire} from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const require=createRequire(path.resolve('package.json'));
const bundle=await require('esbuild').build({stdin:{resolveDir:process.cwd(),loader:'jsx',contents:`
import React,{useState} from 'react';import {createRoot} from 'react-dom/client';
import Wallet from './src/features/wallet/WalletPanel.jsx';
import Goal from './MonthlyGoal.jsx';
import First from './src/features/onboarding/FirstRunSetup.jsx';
import Planner from './src/features/reminders/FinancePlanComposer.jsx';
import Platforms from './src/features/platforms/PlatformConnections.jsx';
import MT5 from './src/features/metatrader/MetaTraderControl.jsx';
import Wealth from './src/features/pro/WealthPlan.jsx';
import Savings from './src/features/pro/SavingsReview.jsx';
import Amount from './src/shared/ui/AmountEntry.jsx';
import Voice from './src/shared/ui/CalendarVoiceButton.jsx';
import Settings from './src/shared/ui/VoiceSettings.jsx';
import {translate} from './src/shared/i18n/index.js';
function App(){const[screen,setScreen]=useState('first');window.zhScreen=setScreen;const[pnl,setPnl]=useState('');const t=k=>translate('zh-CN',k),base={language:'zh-CN',isLight:false};return <main style={{maxWidth:800,margin:'auto',padding:12}}>
{screen==='first'&&<First {...base} step="language" theme="dark" currency="CNY" onLanguage={()=>{}} onStep={()=>{}} onSkip={()=>{}}/>}
{screen==='intro'&&<First {...base} step="intro" theme="dark" currency="CNY" onLanguage={()=>{}} onStep={()=>{}} onSkip={()=>{}}/>}
{screen==='currency'&&<First {...base} step="currency" theme="dark" currency="CNY" onLanguage={()=>{}} onStep={()=>{}} onSkip={()=>{}}/>}
{screen==='wallet'&&<Wallet {...base} currency="CNY" transactions={[]} balanceByCurrency={{CNY:12345}} onSave={async()=>{}} onDelete={async()=>{}} onBackToCalendar={()=>{}}/>}
{screen==='goal'&&<Goal {...base} year={2026} month={9} currency="CNY" currencySymbol="¥" currentPnl={1250}/>}
{screen==='planner'&&<Planner {...base} open dateKey="2026-10-05" defaultCurrency="CNY" onClose={()=>{}} onCreate={async()=>{}}/>}
{screen==='platforms'&&<Platforms {...base} ctrader={{}} metatrader={{}} onOpen={()=>{}}/>}
{screen==='mt5'&&<MT5 {...base} visible enabled userId="test" trades={{}} onClose={()=>{}} saveTrade={async()=>{}}/>}
{screen==='wealth'&&<Wealth {...base} currency="CNY" symbol="¥" trades={[]} isTrading={()=>false} formatMoney={String} onReview={()=>{}} onStartReview={()=>{}}/>}
{screen==='savings'&&<Savings {...base} trades={[]} symbol="¥" formatMoney={String} onClose={()=>{}}/>}
{screen==='amount'&&<Amount {...base} value={pnl} onChange={setPnl}/>}
{screen==='voice'&&<><Settings {...base}/><Voice {...base} onCommand={command=>{window.zhCommand=command;}}/></>}
</main>};createRoot(document.getElementById('root')).render(<App/>);
`},bundle:true,write:false,outfile:'zh.js',format:'iife',define:{'import.meta.env':JSON.stringify({VITE_SUPABASE_URL:'https://example.supabase.co',VITE_SUPABASE_ANON_KEY:'test'})}});
const playwright=createRequire(process.env.DAYRIS_PLAYWRIGHT_PACKAGE||'C:/Users/aveel/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('playwright');
const browser=await playwright.chromium.launch({channel:'msedge',headless:true});
try {
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  page.setDefaultTimeout(7000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const css=fs.readFileSync(path.join('dist/assets',fs.readdirSync('dist/assets').find(f=>f.endsWith('.css'))),'utf8');
  await page.addInitScript(()=>{localStorage.setItem('atj_language','zh-CN');window.SpeechRecognition=class{constructor(){window.zhRecognition=this;}start(){this.onstart?.();}abort(){}stop(){this.onend?.();}};});
  await page.route('http://zh.test/**',route=>route.fulfill({contentType:'text/html',body:`<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{background:#09090b;color:white;margin:0}${css}${bundle.outputFiles.find(f=>f.path.endsWith('.css'))?.text||''}</style><div id="root"></div><script>${bundle.outputFiles.find(f=>f.path.endsWith('.js')).text}</script>`}));
  await page.goto('http://zh.test');await page.getByRole('button',{name:/简体中文/}).waitFor();
  assert.match(await page.locator('body').innerText(),/用你熟悉的语言/);
  for(const screen of ['intro','currency','wallet','goal','planner','platforms','mt5','wealth','savings','amount','voice']){
    await page.evaluate(screen=>window.zhScreen(screen),screen);await page.waitForTimeout(100);
    const text=await page.locator('body').innerText();assert.doesNotMatch(text,/[А-Яа-яЁё]/,screen);assert.ok(/[\u3400-\u9fff]/.test(text),`${screen} shows Chinese`);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${screen} fits mobile width`);
    if(screen==='goal'){await page.getByRole('button',{name:/本月目标/}).click();await page.getByRole('button',{name:'设置目标',exact:true}).click();await page.getByPlaceholder('例如 30000').fill('5000');await page.getByRole('button',{name:'保存',exact:true}).click();assert.match(await page.locator('body').innerText(),/剩余/);}
    if(screen==='amount'){await page.getByRole('button',{name:'说出金额'}).click();assert.equal(await page.evaluate(()=>window.zhRecognition.lang),'zh-CN');}
    if(screen==='voice'){await page.getByRole('button',{name:'语音命令',exact:true}).click();assert.equal(await page.evaluate(()=>window.zhRecognition.lang),'zh-CN');assert.equal(await page.locator('.calendar-voice-help-groups details').count(),4);}
  }
  assert.deepEqual(errors,[]);
  await page.screenshot({path:'tests/chinese-mobile.png'});
  console.log('Chinese copy, CNY, voice locale and mobile layouts passed across 12 screens');
} finally {await browser.close();}
