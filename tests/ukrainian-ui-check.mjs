import {createRequire} from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const require=createRequire(path.resolve('package.json'));
const bundle=await require('esbuild').build({stdin:{resolveDir:process.cwd(),loader:'jsx',contents:`
import React,{useState} from 'react';import {createRoot} from 'react-dom/client';
import First from './src/features/onboarding/FirstRunSetup.jsx';import Goal from './MonthlyGoal.jsx';
import Wallet from './src/features/wallet/WalletPanel.jsx';import Planner from './src/features/reminders/FinancePlanComposer.jsx';
import Grid from './CalendarGrid.jsx';import Amount from './src/shared/ui/AmountEntry.jsx';
import {CURRENCIES,getMoneyCategoryLabel} from './src/shared/config/constants.js';
function App(){const[screen,setScreen]=useState('first'),[language,setLanguage]=useState('uk'),[currency,setCurrency]=useState('UAH'),[amount,setAmount]=useState('');window.ukScreen=setScreen;window.ukLanguage=setLanguage;
const base={language,isLight:false};const today=new Date(2026,9,20);const cells=Array.from({length:35},(_,i)=>{const date=new Date(2026,8,28+i);return {date,key:date.toISOString().slice(0,10),inMonth:date.getMonth()===9,isToday:i===22}});
return <main style={{maxWidth:800,margin:'auto',padding:12}}>
{['first','currency','birthday'].includes(screen)&&<First {...base} step={screen==='first'?'language':screen} theme="dark" currency={currency} onCurrency={setCurrency} onLanguage={item=>setLanguage(item.code)} onStep={()=>{}} onSkip={()=>{}}/>}
{screen==='grid'&&<Grid {...base} cells={cells} notes={{}} tradesForDayFiltered={()=>[]} totalPnlForDay={()=>0} formatPnlDisplay={String} onSelectDay={()=>{}} onEmptyClick={()=>{}}/>}
{screen==='wallet'&&<Wallet {...base} currency={currency} transactions={[]} balanceByCurrency={{UAH:12345}} onSave={async value=>{window.ukSaved=value}} onDelete={async()=>{}} onBackToCalendar={()=>{}}/>}
{screen==='goal'&&<Goal {...base} year={2026} month={9} currency={currency} currencySymbol="₴" currentPnl={1250}/>}
{screen==='planner'&&<Planner {...base} open dateKey="2027-10-20" defaultCurrency={currency} onClose={()=>{}} onCreate={async()=>{}}/>}
{screen==='amount'&&<Amount {...base} value={amount} onChange={setAmount}/>}
{screen==='currency-meta'&&<><span>{CURRENCIES.find(c=>c.code==='UAH').symbol}</span><span>{getMoneyCategoryLabel('Жильё',language)}</span></>}
</main>};createRoot(document.getElementById('root')).render(<App/>);`},bundle:true,write:false,outfile:'uk.js',format:'iife',define:{'import.meta.env':JSON.stringify({VITE_SUPABASE_URL:'https://example.supabase.co',VITE_SUPABASE_ANON_KEY:'test'})}});
const playwright=createRequire(process.env.DAYRIS_PLAYWRIGHT_PACKAGE||'C:/Users/aveel/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('playwright');
const browser=await playwright.chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});page.setDefaultTimeout(6000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{localStorage.setItem('atj_language','uk');window.SpeechRecognition=class{constructor(){window.ukSpeech=this;}start(){this.onstart?.()}abort(){}stop(){}};});
 const css=fs.readFileSync(path.join('dist/assets',fs.readdirSync('dist/assets').find(f=>f.endsWith('.css'))),'utf8');
 await page.route('http://uk.test/**',route=>route.fulfill({contentType:'text/html',body:`<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{background:#09090b;color:white;margin:0}${css}${bundle.outputFiles.find(f=>f.path.endsWith('.css'))?.text||''}</style><div id="root"></div><script>${bundle.outputFiles.find(f=>f.path.endsWith('.js')).text}</script>`}));
 await page.goto('http://uk.test');await page.getByRole('button',{name:/Українська/}).waitFor();
 for(const [screen,expected]of [['currency','Українська гривня'],['birthday','Дата народження'],['wallet','Мій гаманець'],['goal','Мета місяця'],['planner','Що заплануємо?'],['amount','Швидкі суми'],['currency-meta','Житло']]){
  await page.evaluate(screen=>window.ukScreen(screen),screen);await page.getByText(expected,{exact:false}).first().waitFor();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),screen+' fits mobile');
  if(screen==='amount'){await page.getByRole('button',{name:'Назвати суму'}).click();assert.equal(await page.evaluate(()=>window.ukSpeech.lang),'uk-UA');}
 }
 await page.evaluate(()=>window.ukScreen('grid'));await page.locator('.calendar-weekdays').first().waitFor();
 for(const [language,expected]of [['uk','ПнВтСрЧтПтСбНд'],['en','MonTueWedThuFriSatSun'],['md','LuMaMiJoViSâDu'],['ru','ПнВтСрЧтПтСбВс'],['uk','ПнВтСрЧтПтСбНд']]){
  await page.evaluate(language=>window.ukLanguage(language),language);await page.waitForFunction(expected=>[...document.querySelectorAll('.calendar-weekdays')].every(row=>row.textContent===expected),expected);
 }
 assert.deepEqual(errors,[]);console.log('PASS: Ukrainian onboarding, UAH, wallet, planner, goal, keypad and live weekday switching at mobile width');
}finally{await browser.close();}
