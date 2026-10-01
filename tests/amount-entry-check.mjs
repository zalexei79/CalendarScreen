import {createRequire} from 'node:module';
import path from 'node:path';
import assert from 'node:assert/strict';
const bundle=await createRequire(path.resolve('package.json'))('esbuild').build({stdin:{resolveDir:process.cwd(),loader:'jsx',contents:`
import React,{useState} from 'react';import {createRoot} from 'react-dom/client';
import Keypad,{AmountInput} from './src/shared/ui/AmountEntry.jsx';
function App(){const[value,setValue]=useState('');const[saved,setSaved]=useState('');return <form onSubmit={e=>{e.preventDefault();setSaved(value)}}><AmountInput aria-label="Сумма" value={value} onChange={e=>setValue(e.target.value)}/><Keypad value={value} onChange={setValue}/><button>Сохранить</button><output>{saved}</output></form>}
createRoot(document.getElementById('root')).render(<App/>);
`},bundle:true,write:false,outfile:'amount.js',format:'iife'});
const browser=await createRequire(process.env.DAYRIS_PLAYWRIGHT_PACKAGE||import.meta.url)('playwright').chromium.launch({channel:'msedge',headless:true});
try {
for(const mobile of [true,false]) {
 const context=await browser.newContext({viewport:{width:mobile?390:1280,height:844},isMobile:mobile,hasTouch:mobile});
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('http://amount.test/**',r=>r.fulfill({contentType:'text/html',body:`<meta name="viewport" content="width=device-width,initial-scale=1"><style>${bundle.outputFiles.find(f=>f.path.endsWith('.css')).text}</style><div id="root"></div><script>${bundle.outputFiles.find(f=>f.path.endsWith('.js')).text}</script>`}));
 await page.goto('http://amount.test');await page.locator('input').waitFor();
 assert.equal(await page.locator('input').evaluate(el=>el.readOnly),mobile);
 assert.equal(await page.locator('input').evaluate(el=>document.activeElement===el),false,'opening does not focus amount');
 if(mobile){
  assert.equal(await page.locator('input').getAttribute('inputmode'),'none');
  await page.getByRole('button',{name:'50',exact:true}).click();
  assert.equal(await page.locator('input').inputValue(),'50');
  for(const key of ['.','2','5','.'])await page.getByRole('button',{name:key,exact:true}).click();
  assert.equal(await page.locator('input').inputValue(),'50.25');
  await page.getByRole('button',{name:'Удалить цифру'}).click();assert.equal(await page.locator('input').inputValue(),'50.2');
  assert.equal(await page.locator('output').textContent(),'','keypad does not submit');
  await page.getByRole('button',{name:'Сохранить'}).click();assert.equal(await page.locator('output').textContent(),'50.2');
  const box=await page.locator('.amount-keypad').boundingBox();assert.ok(box.height<260);
  await page.getByRole('button',{name:'Очистить'}).click();assert.equal(await page.locator('input').inputValue(),'');
  await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('.amount-keypad').evaluate(el=>getComputedStyle(el).animationName),'none');
 }else {await page.locator('input').fill('125.75');assert.equal(await page.locator('.amount-keypad').isVisible(),false);}
 assert.deepEqual(errors,[]);await context.close();
}
console.log('PASS: mobile keypad, no automatic keyboard, presets, decimal edits, non-submit keys, compact layout and desktop typing.');
}finally{await browser.close();}
