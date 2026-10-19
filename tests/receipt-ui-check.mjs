import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const require = createRequire(path.resolve('package.json'));
const sample = `Magazin\nIDNO: 1234567890123\nPaine\n1 buc x 7.10= 7.10 A\nBere\n2 buc x 29.95= 59.90 A\nTOTAL LEI 67.00\n19-10-2026 19:16`;
const build = await require('esbuild').build({stdin:{resolveDir:process.cwd(),loader:'jsx',contents:`
import React from 'react';import{createRoot}from'react-dom/client';import Receipt from './src/features/receipts/ReceiptCapture.jsx';
window.receiptText=${JSON.stringify(sample)};window.writes=[];window.serverPro=true;window.ocrCalls=0;window.upgrades=0;
function App(){const[owner,setOwner]=React.useState('owner-a'),[pro,setPro]=React.useState(true),[light,setLight]=React.useState(false),[language,setLanguage]=React.useState('ru');Object.assign(window,{setOwner,setPro,setLight,setLanguage});return <><button id="background" onClick={()=>window.backgroundClicked=true}>Background</button><Receipt userId={owner} proActive={pro} language={language} isLight={light} onUpgrade={()=>window.upgrades++} checkAccess={async()=>{if(window.failAccess)throw new Error('RECEIPT_ACCESS_UNAVAILABLE');return window.serverPro;}} recognize={async(file,{signal})=>{window.ocrCalls++;if(window.delay)await new Promise(resolve=>{window.releaseOcr=resolve;signal.addEventListener('abort',()=>{window.aborted=true;resolve();});});if(window.failOcr)throw new Error('OCR_FAILED');return window.receiptText;}} onSaveReceipt={async(draft,owner)=>{window.writes.push({draft,owner});return{dayTotal:'167.00'};}}/></>;}createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>);
`},bundle:true,write:false,outfile:'receipt-test.js',format:'iife',plugins:[{name:'receipt-services',setup(build){build.onResolve({filter:/receipt(?:Access|Ocr)\.js$/},args=>({path:args.path,namespace:'fixture'}));build.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export const checkReceiptAccess=async()=>false;export const recognizeReceipt=async()=>"";',loader:'js'}));}}]});
const browser = await createRequire(process.env.DAYRIS_PLAYWRIGHT_PACKAGE || import.meta.url)('playwright').chromium.launch({channel:'msedge',headless:true});
fs.mkdirSync('artifacts/receipt-check',{recursive:true});
try {
 const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage(),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.route('http://receipt.test/**',route=>route.fulfill({contentType:'text/html',body:`<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:Arial;background:#101318}*{box-sizing:border-box}${build.outputFiles.find(file=>file.path.endsWith('.css')).text}</style><div id="root"></div><script>${build.outputFiles.find(file=>file.path.endsWith('.js')).text}</script>`}));
 await page.goto('http://receipt.test');
 const upload = () => page.locator('.receipt-file').first().setInputFiles({name:'receipt.png',mimeType:'image/png',buffer:Buffer.from('fixture')});
 await page.evaluate(()=>setPro(false));await page.locator('.receipt-launch').click();assert.equal(await page.evaluate(()=>upgrades),1);assert.equal(await page.evaluate(()=>ocrCalls),0);
 await page.evaluate(()=>setPro(true));await upload();await page.locator('.receipt-fields').waitFor();
 assert.equal(await page.getByLabel('Итог чека',{exact:true}).inputValue(),'67.00');assert.equal(await page.locator('.receipt-item').count(),2);
 await page.getByRole('button',{name:'Изменить итог',exact:true}).click();assert.equal(await page.getByLabel('Итог чека',{exact:true}).evaluate(el=>el===document.activeElement),true);
 assert.equal(await page.getByRole('button',{name:'Сохранить расход',exact:true}).isDisabled(),true);
 assert.equal(await page.locator('.receipt-item-editor:visible').count(),0,'purchases are initially a readable list');
 assert.match(await page.locator('.receipt-item-summary').first().innerText(),/Хлеб/);
 assert.match(await page.locator('.receipt-item-summary').nth(1).innerText(),/Пиво/);
 await page.locator('.receipt-item-summary').nth(1).click();assert.ok(await page.getByLabel('Количество 2',{exact:true}).evaluate(el=>parseFloat(getComputedStyle(el).fontSize)>=16),'mobile editing does not trigger iOS input zoom');await page.getByLabel('Количество 2',{exact:true}).fill('3');assert.equal(await page.getByLabel('Сумма позиции 2',{exact:true}).inputValue(),'89.85');
 await page.getByLabel('Итог чека',{exact:true}).fill('96.95');await page.locator('.receipt-item-summary').first().click();await page.getByLabel('Название 1',{exact:true}).fill('Хлеб');
 await page.getByRole('checkbox').check();await page.locator('.receipt-metadata>summary').click();await page.getByLabel('Магазин',{exact:true}).fill('Мой магазин');assert.equal(await page.getByRole('checkbox').isChecked(),false,'any edit clears total confirmation');
 await page.locator('.receipt-metadata>summary').click();await page.locator('.receipt-item-summary').first().click();await page.locator('.receipt-scroll').evaluate(el=>el.scrollTop=0);
 for(const width of [320,390,1280]){
  await page.setViewportSize({width,height:width===1280?900:844});
  for(const light of [false,true]){
   await page.evaluate(value=>setLight(value),light);
   assert.equal(await page.locator('.receipt-dialog').evaluate(el=>el.scrollWidth<=el.clientWidth+1),true);
   assert.equal(await page.locator('.receipt-scroll').evaluate(el=>el.scrollWidth<=el.clientWidth+1),true);
   assert.equal(await page.locator('.receipt-dialog').evaluate(el=>el.getBoundingClientRect().bottom<=innerHeight),true);
   await page.screenshot({path:`artifacts/receipt-check/review-${width}-${light?'light':'dark'}.png`});
  }
 }
 await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Сохранить расход',exact:true}).dblclick();await page.locator('.receipt-success').waitFor();
 assert.equal(await page.evaluate(()=>writes.length),1);assert.equal(await page.evaluate(()=>writes[0].draft.total),'96.95');assert.equal(await page.evaluate(()=>writes[0].draft.items[0].name),'Хлеб');assert.match(await page.locator('.receipt-success').innerText(),/167.00 MDL/);
 await page.getByRole('button',{name:'Готово',exact:true}).click();
 // Revoked access stops OCR even when the old UI still displays PRO.
 await page.evaluate(()=>serverPro=false);await upload();await page.waitForFunction(()=>upgrades===2);assert.equal(await page.evaluate(()=>ocrCalls),1);
 await page.evaluate(()=>{serverPro=true;delay=true;});await upload();await page.waitForFunction(()=>Boolean(window.releaseOcr));await page.getByRole('button',{name:'Закрыть чек',exact:true}).click();assert.equal(await page.evaluate(()=>aborted),true);await page.evaluate(()=>releaseOcr());assert.equal(await page.locator('.receipt-dialog').isVisible(),false);
 await page.evaluate(()=>{delete window.releaseOcr;});await upload();await page.waitForFunction(()=>Boolean(window.releaseOcr));await page.evaluate(()=>setOwner('owner-b'));await page.evaluate(()=>releaseOcr());assert.equal(await page.locator('.receipt-dialog').isVisible(),false,'account switch discards old OCR');assert.equal(await page.evaluate(()=>writes.length),1);
 await page.evaluate(()=>{delay=false;receiptText='TOTAL 25.50';});await upload();await page.locator('.receipt-fields').waitFor();assert.equal(await page.getByRole('button',{name:'Сохранить расход',exact:true}).isDisabled(),true);
 await page.getByLabel('Дата чека',{exact:true}).fill('2026-10-19');await page.getByLabel('Валюта чека',{exact:true}).selectOption('MDL');await page.getByRole('checkbox').check();assert.equal(await page.getByRole('button',{name:'Сохранить расход',exact:true}).isEnabled(),true,'manual total-only fallback');
 for(const [language,title]of[['en','Receipt to calendar'],['ro','Bon în calendar'],['zh-CN','收据记入日历']]){await page.evaluate(value=>setLanguage(value),language);assert.equal(await page.locator('#receipt-title').innerText(),title);}
 await page.evaluate(()=>setLanguage('ru'));await page.getByRole('button',{name:'Закрыть чек',exact:true}).click();
 await page.evaluate(()=>{receiptText='SHOP\nIDNO: 123\nXYZ special 400ml\n1 buc x 35.00 = 35.00 A\nTOTAL LEI 35.00\n19-10-2026';});
 await upload();await page.locator('.receipt-fields').waitFor();await page.locator('.receipt-item-summary').first().click();await page.locator('.receipt-type-picker>summary').click();await page.getByRole('searchbox',{name:'Найти тип товара',exact:true}).fill('шампунь');await page.locator('.receipt-type-options').getByRole('button',{name:/Шампунь/}).click();
 assert.match(await page.locator('.receipt-item-summary').first().innerText(),/Шампунь/);assert.equal(await page.getByLabel('Категория расхода',{exact:true}).inputValue(),'Покупки');
 await page.getByRole('button',{name:'Закрыть чек',exact:true}).click();await upload();await page.locator('.receipt-fields').waitFor();assert.match(await page.locator('.receipt-item-summary').first().innerText(),/Шампунь/,'correction is reused');
 await page.evaluate(()=>setOwner('owner-c'));await upload();await page.locator('.receipt-fields').waitFor();assert.match(await page.locator('.receipt-item-summary').first().innerText(),/XYZ special/,'another account does not inherit the correction');
 assert.deepEqual(errors,[]);console.log('PASS: receipt editing, exact arithmetic, confirmation reset, one save, server revocation, cancellation, account isolation, total-only fallback, four locales and 320/390/1280 light/dark layouts.');
} finally {await browser.close();}
