import {createRequire} from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const bundle=await createRequire(path.resolve('package.json'))('esbuild').build({stdin:{resolveDir:process.cwd(),loader:'jsx',contents:`
import React from 'react';import {createRoot} from 'react-dom/client';import Wallet from './src/features/wallet/WalletPanel.jsx';
window.saved=[];localStorage.setItem('dayris_wallet_onboarding_v2','1');
createRoot(document.getElementById('root')).render(<Wallet language="ru" currency="MDL" transactions={[]} balanceByCurrency={{MDL:125}} onSave={async item=>window.saved.push(item)} onDelete={()=>{}}/>);
`},bundle:true,write:false,outfile:'wallet.js',format:'iife'});
const css=fs.readFileSync(path.join('dist/assets',fs.readdirSync('dist/assets').find(f=>f.endsWith('.css'))),'utf8');
const browser=await createRequire(process.env.DAYRIS_PLAYWRIGHT_PACKAGE||import.meta.url)('playwright').chromium.launch({channel:'msedge',headless:true});
try{
for(const width of [320,390]){
const context=await browser.newContext({viewport:{width,height:740},isMobile:true,hasTouch:true});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('http://wallet.test/**',r=>r.fulfill({contentType:'text/html',body:`<meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><div id="root"></div><script>${bundle.outputFiles.find(f=>f.path.endsWith('.js')).text}</script>`}));
await page.goto('http://wallet.test');
for(const [label,kind] of [['Добавить деньги','income'],['Вывести деньги','expense']]){
await page.getByRole('button',{name:label,exact:true}).click();const form=page.locator('.wallet-composer');const amount=form.getByRole('textbox',{name:'Сколько?'});
assert.equal(await amount.evaluate(el=>el.readOnly),true);assert.equal(await amount.evaluate(el=>document.activeElement===el),false);assert.equal(await amount.getAttribute('inputmode'),'none');
assert.ok(await form.evaluate(el=>el.scrollWidth<=el.clientWidth+1),'no horizontal overflow');await form.evaluate(el=>Promise.all(el.getAnimations().map(a=>a.finished.catch(()=>{}))));const box=await form.boundingBox();assert.ok(box.width<=width+1);assert.ok(box.y>=0,JSON.stringify({box,viewport:await page.evaluate(()=>({h:innerHeight,w:innerWidth,visual:visualViewport.height,style:getComputedStyle(document.querySelector(".wallet-composer")).maxHeight,parent:document.querySelector(".wallet-composer").parentElement.getBoundingClientRect().toJSON(),parentStyle:getComputedStyle(document.querySelector(".wallet-composer").parentElement).padding,margin:getComputedStyle(document.querySelector(".wallet-composer")).margin}))}));assert.ok(box.height<=740);
await form.getByRole('button',{name:'50',exact:true}).click();for(const key of ['.','2','5'])await form.getByRole('button',{name:key,exact:true}).click();assert.equal(await amount.inputValue(),'50.25');assert.equal(await page.evaluate(()=>saved.length),kind==='income'?0:1);
await form.getByRole('button',{name:new RegExp(kind==='income'?'^Добавить L':'^Вывести L')}).click();await form.waitFor({state:'detached'});const row=await page.evaluate(()=>saved.at(-1));assert.equal(row.amount,50.25);assert.equal(row.currency,'MDL');assert.equal(row.kind,kind);
}
assert.deepEqual(errors,[]);await context.close();
}
console.log('PASS: wallet income/withdrawal, touch keypad, no autofocus, narrow viewport and saved amounts.');
}finally{await browser.close();}
