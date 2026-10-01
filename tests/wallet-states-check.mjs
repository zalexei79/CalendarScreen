import {createRequire} from 'node:module';
import path from 'node:path';
import assert from 'node:assert/strict';
const bundle=await createRequire(path.resolve('package.json'))('esbuild').build({stdin:{resolveDir:process.cwd(),loader:'jsx',contents:`
import React from 'react'; import {createRoot} from 'react-dom/client'; import Wallet from './src/features/wallet/WalletPanel.jsx';
import Wealth from './src/features/pro/WealthPlan.jsx';
const root=createRoot(document.getElementById('root'));
window.showWallet=(loading,language,error)=>root.render(<Wallet loading={loading} language={language} error={error} currency="USD" transactions={[]} balanceByCurrency={{USD:125}} onSave={async()=>{}} onDelete={()=>{}}/>);
window.showWealth=()=>root.render(<Wealth trades={[]} isTrading={()=>false} currency="USD" symbol="$" formatMoney={String} language="ru" onReview={()=>{}} onStartReview={()=>{}}/>);
showWallet(true,'ru',null);
`},bundle:true,write:false,outfile:'wallet.js',format:'iife'});
const browser=await createRequire(process.env.DAYRIS_PLAYWRIGHT_PACKAGE||import.meta.url)('playwright').chromium.launch({channel:'msedge',headless:true});
try {
const page=await browser.newPage(); const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>localStorage.setItem('dayris_wallet_onboarding_v2','1'));
await page.route('http://wallet.test/**',r=>r.fulfill({contentType:'text/html',body:`<style>${bundle.outputFiles.find(f=>f.path.endsWith('.css')).text}</style><div id="root"></div><script>${bundle.outputFiles.find(f=>f.path.endsWith('.js')).text}</script>`}));
await page.goto('http://wallet.test'); await page.locator('.wallet-loading-row').first().waitFor();
assert.equal(await page.locator('.wallet-loading-row').count(),3);
assert.equal(await page.locator('.wallet-activity-list').getAttribute('aria-busy'),'true');
assert.ok(!(await page.locator('body').textContent()).includes('+\u00240.00'));
await page.emulateMedia({reducedMotion:'reduce'});
assert.equal(await page.locator('.wallet-loading-row span').first().evaluate(el=>getComputedStyle(el).animationName),'none');
for(const [language,label] of [['ru','Учтённый баланс'],['en','Recorded balance'],['md','Sold înregistrat']]) {
 await page.evaluate(language=>showWallet(false,language,'MIGRATION raw database error'),language);
 await page.waitForFunction(label=>document.body.textContent.includes(label),label);
 assert.equal(await page.locator('.wallet-loading-row').count(),0);
 assert.ok(!(await page.locator('[role="alert"]').textContent()).includes('raw database'));
}
assert.deepEqual(errors,[]);
await page.evaluate(()=>showWealth());
await page.locator('.dayris-details-reveal').waitFor({state:'attached'});
assert.equal(await page.locator('.dayris-details-reveal').evaluate(el=>el.inert),true);
await page.locator('button[aria-expanded]').click();
assert.equal(await page.locator('.dayris-details-reveal').evaluate(el=>el.inert),false);
assert.equal(await page.locator('.dayris-details-reveal').getAttribute('data-open'),'true');
console.log('PASS: wallet loading preserves truthful amounts, localized errors and reduced-motion loading.');
}finally{await browser.close();}
