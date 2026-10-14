import {createRequire} from 'node:module';import path from 'node:path';import assert from 'node:assert/strict';
const bundle=await createRequire(path.resolve('package.json'))('esbuild').build({stdin:{resolveDir:process.cwd(),loader:'jsx',contents:`
import React,{useState} from 'react';import {createRoot} from 'react-dom/client';import Brief,{summarizeCalendarEntries} from './src/shared/ui/CalendarMonthBrief.jsx';
window.summarize=summarizeCalendarEntries;
function App(){const [language,setLanguage]=useState('ru'),[traderMode,setTrader]=useState(false);window.setLanguage=setLanguage;window.setTrader=setTrader;return <Brief language={language} traderMode={traderMode} currency="USD" summary={{entries:[{pnl:'0.1'},{pnl:'0.2'},{pnl:'-0.05'}]}}/>;}createRoot(document.getElementById('root')).render(<App/>);`},bundle:true,write:false,outfile:'brief.js'});
const browser=await createRequire('C:/Users/aveel/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('playwright').chromium.launch({channel:'msedge',headless:true});
try{const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setContent('<div id="root"></div>');await page.addStyleTag({content:bundle.outputFiles.find(f=>f.path.endsWith('.css')).text});await page.addScriptTag({content:bundle.outputFiles.find(f=>f.path.endsWith('.js')).text});
await page.locator('.calendar-month-brief').waitFor();
assert.deepEqual(await page.evaluate(()=>{const x=summarize([{pnl:'0.1'},{pnl:'0.2'},{pnl:'-0.05'}]);return [x.income.toString(),x.expense.toString(),x.net.toString(),x.wins,x.losses];}),['3000000000','500000000','2500000000',2,1]);
assert.equal(await page.evaluate(()=>summarize([{pnl:'bad'}]).invalid),1);
assert.equal(await page.locator('.month-brief-details').isVisible(),false);
for(const width of [320,390,1280])for(const locale of ['ru','en','ro','zh']){await page.setViewportSize({width,height:844});await page.evaluate(locale=>setLanguage(locale),locale);const box=await page.locator('.calendar-month-brief summary').boundingBox();assert.ok(box.height<=44);await page.locator('.calendar-month-brief summary').click();assert.equal(await page.locator('.month-brief-grid>div').count(),3);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.locator('.calendar-month-brief summary').click();}
await page.evaluate(()=>setTrader(true));await page.locator('.calendar-month-brief summary').click();assert.deepEqual(await page.locator('.month-brief-grid b').allTextContents().then(values=>values.slice(0,2)),['2','1']);
assert.deepEqual(errors,[]);console.log('PASS: exact 0.1+0.2-0.05, invalid amounts, compact disclosure, finance/trader, four languages and three widths.');
}finally{await browser.close();}
