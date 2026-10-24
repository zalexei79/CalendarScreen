import {createRequire} from 'node:module';
import path from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire(path.resolve('package.json'));
const bundle=await require('esbuild').build({stdin:{resolveDir:process.cwd(),loader:'jsx',contents:`
 import React,{useState} from 'react';import {createRoot} from 'react-dom/client';import Panel from './src/features/capital/CapitalPanel.jsx';
 const user={id:'22222222-2222-4222-8222-222222222222',user_metadata:{dayris_capital_base_currency:'USD'}};
 function App(){const [language,setLanguage]=useState('ru'),[light,setLight]=useState(false);window.setLanguage=setLanguage;window.setLight=setLight;return <Panel user={user} language={language} isLight={light} onBack={()=>{}} onWallet={()=>{}} currency="USD"/>;}createRoot(document.getElementById('root')).render(<App/>);
`},bundle:true,write:false,outfile:'sections.js',plugins:[{name:'mock-database',setup(build){build.onResolve({filter:/supabaseClient(?:\.js)?$/},()=>({path:'db',namespace:'fixture'}));build.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:`
 const assets=[{id:'gold',name:'Gold',symbol:'XAU',category:'metal',currency:'USD',quote_source:'manual',manual_price:'130'},{id:'apple',name:'Apple',symbol:'AAPL',category:'stock',currency:'USD',quote_source:'manual',manual_price:'110'},{id:'cancelled',name:'Cancelled asset',category:'other',currency:'USD',quote_source:'manual',manual_price:'10'}];
 const operations=[{id:'1',asset_id:'gold',operation:'buy',quantity:'2',unit_price:'100',fee:'2',currency:'USD',occurred_on:'2026-10-01',created_at:'2026-10-01'},{id:'2',asset_id:'gold',operation:'sell',quantity:'2',unit_price:'130',fee:'1',currency:'USD',occurred_on:'2026-10-02',created_at:'2026-10-02'},{id:'3',asset_id:'apple',operation:'buy',quantity:'2',unit_price:'100',fee:'0',currency:'USD',occurred_on:'2026-10-03',created_at:'2026-10-03'}];
 export const supabase={auth:{updateUser:async()=>({})},rpc:async()=>({data:null,error:null}),from(table){const result={data:table==='capital_assets'?assets:table==='capital_operations'?operations:[],error:null};const q={select(){return q;},eq(){return q;},order(){return q;},is(){return q;},limit(){return q;},range(){return Promise.resolve(result);},maybeSingle(){return Promise.resolve({data:null,error:null});},then(resolve,reject){return Promise.resolve(result).then(resolve,reject);}};return q;}};
 `,loader:'js'}));}}]});
const browser=await createRequire(process.env.DAYRIS_PLAYWRIGHT_PACKAGE||'C:/Users/aveel/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('playwright').chromium.launch({channel:'msedge',headless:true});
try {
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('http://sections.test/**',r=>r.fulfill({contentType:'text/html',body:`<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;font-family:Arial}#root{height:100dvh;display:flex;flex-direction:column}button{font:inherit}${bundle.outputFiles.find(f=>f.path.endsWith('.css')).text}</style><div id="root"></div><script>${bundle.outputFiles.find(f=>f.path.endsWith('.js')).text}</script>`}));
 await page.route('https://**',r=>r.abort());await page.goto('http://sections.test');
 const nav=page.locator('.capital-section-nav');
 await page.waitForFunction(()=>document.querySelector('.capital-section-nav small')?.textContent==='1');
 assert.equal(await page.locator('.capital-dashboard').count(),1);assert.equal(await page.locator('.capital-holdings-panel').count(),0);
 await nav.getByRole('button',{name:/^Активы/}).click();
 assert.match(await page.locator('.capital-assets').innerText(),/Apple/);assert.doesNotMatch(await page.locator('.capital-assets').innerText(),/Gold|Cancelled/);
 await page.locator('.capital-position-switch').getByRole('button',{name:/^Закрытые/}).click();
 assert.match(await page.locator('.capital-assets').innerText(),/Gold/);assert.equal(await page.locator('.holding-facts').count(),0);
 assert.match(await page.locator('.holding-outcome').innerText(),/57,00/);
 await nav.getByRole('button',{name:'История',exact:true}).click();assert.equal(await page.locator('.capital-activity-row').count(),3);
 await page.locator('.capital-activity-tools select').selectOption('sell');assert.equal(await page.locator('.capital-activity-row').count(),1);
 assert.match(await page.locator('.capital-activity-row').innerText(),/259,00/);
 await page.locator('.capital-activity-row summary').click();assert.match(await page.locator('.capital-activity-row dl').innerText(),/1,00/);
 await page.locator('.capital-activity-main').click();await page.locator('.capital-sheet').waitFor();
 assert.match(await page.locator('.capital-sheet-head').innerText(),/Gold/);await page.locator('.capital-sheet-head button').click();
 await page.locator('.capital-activity input').fill('Apple');assert.equal(await page.locator('.capital-activity-row').count(),0);
 await page.locator('.capital-activity input').fill('');
 for(const width of [320,390,1280])for(const language of ['ru','en','ro','zh'])for(const light of [false,true]){
  await page.setViewportSize({width,height:844});await page.evaluate(({language,light})=>{setLanguage(language);setLight(light);},{language,light});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'History fits viewport in every theme and language');
 }
 await page.evaluate(()=>{setLanguage('ru');setLight(false);});await page.setViewportSize({width:390,height:844});
 await page.locator('.capital-activity h2').click();await page.screenshot({path:'tests/capital-sections-history.png',fullPage:true});
 await page.reload();await page.locator('.capital-activity').waitFor();assert.equal(await page.locator('.capital-dashboard').count(),0,'Section survives reopening');
 await nav.getByRole('button',{name:/^Активы/}).click();assert.doesNotMatch(await page.locator('.capital-assets').innerText(),/Gold/);
 await page.screenshot({path:'tests/capital-sections-assets.png',fullPage:true});
 assert.deepEqual(errors,[]);console.log('PASS: actual CapitalPanel sections, closed gold and cancelled assets excluded, archive P/L, net sales history, asset detail, search, reopen, four languages, light/dark and 320–1280px.');
} finally {await browser.close();}
