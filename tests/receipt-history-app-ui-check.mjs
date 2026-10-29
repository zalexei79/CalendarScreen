import {createRequire} from 'node:module';
import fs from 'node:fs';import path from 'node:path';import http from 'node:http';import assert from 'node:assert/strict';
import {installStoryAccount,storyUserId} from './life-story-auth-fixture.mjs';
import {legacyReceiptComment} from './fixtures/receipt-history.mjs';
import {receiptComment} from '../src/features/receipts/receiptModel.js';
const root=path.resolve('dist'),server=http.createServer((request,response)=>{
 const url=new URL(request.url,'http://localhost'),file=path.resolve(root,url.pathname==='/'?'index.html':'.'+url.pathname);
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){response.writeHead(404);response.end();return;}
 response.writeHead(200,{'Content-Type':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html'});response.end(fs.readFileSync(file));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await createRequire(process.env.DAYRIS_PLAYWRIGHT_PACKAGE||import.meta.url)('playwright').chromium.launch({channel:'msedge',headless:true});
const current=new Date(),dateKey=`${current.getFullYear()}-${String(current.getMonth()+1).padStart(2,'0')}-${String(current.getDate()).padStart(2,'0')}`;
const records=[
 {id:'legacy-receipt',date_key:dateKey,time:'22:00',pnl:-151.85,currency:'MDL',platform:'Manual',instrument:'ПРОДУКТЫ',comment:legacyReceiptComment,user_id:storyUserId},
 {id:'new-receipt',date_key:dateKey,time:'21:00',pnl:-35,currency:'MDL',platform:'Manual',instrument:'ПОКУПКИ',comment:receiptComment({merchant:'COSMETICS SHOP',currency:'MDL',items:[{name:'XYZ creme',productType:'shampoo',quantity:'1',unitPrice:'35.00',total:'35.00'}]}),user_id:storyUserId},
 {id:'ordinary',date_key:dateKey,time:'09:00',pnl:200,currency:'MDL',platform:'Manual',instrument:'ЗАРПЛАТА',comment:'Важный обычный комментарий',user_id:storyUserId},
];
fs.mkdirSync('artifacts/receipt-history',{recursive:true});
try{
 for(const [width,light]of[[320,false],[390,false],[1280,false],[390,true],[1280,true]]){
  const context=await browser.newContext({viewport:{width,height:width===1280?1000:844},serviceWorkers:'block'});
  await context.addInitScript(({dateKey,records,id,light})=>{for(const[key,value]of Object.entries({atj_language:'ru',atj_currency:'MDL',atj_trader_mode:'0',atj_pro_view:'1',atj_theme:light?'light':'dark',dayris_onboarding_v2_completed:'1',calendar_guide_completed:'1'}))localStorage.setItem(key,value);localStorage.setItem(`money_calendar_trades_${id}`,JSON.stringify({[dateKey]:records}));},{dateKey,records,id:storyUserId,light});
  await context.route('**/*',route=>{const url=new URL(route.request().url());if(url.origin===origin)return route.continue();if(url.pathname.startsWith('/rest/v1/'))return route.fulfill({contentType:'application/json',body:JSON.stringify(url.pathname.endsWith('get_my_pro_status')?{active:true}:url.pathname.endsWith('/trades')?records:[])});return route.abort();});
  await installStoryAccount(context);
  const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(origin);await page.locator('.calendar-days-grid').waitFor();await page.waitForFunction(()=>!document.getElementById('boot-screen'));
  await page.locator('[data-today-cell=true]').click();await page.locator('.receipt-history').first().waitFor();
  assert.equal(await page.locator('.receipt-history').count(),2);
  const card=page.locator('.receipt-history').filter({hasText:'MOLDRETAIL'});assert.equal(await card.locator('.receipt-history-items>li').count(),5);assert.match(await card.innerText(),/151,85/);assert.match(await card.innerText(),/Пиво BIERMANN/);assert.match(await card.innerText(),/20,00/);
  const beer=card.locator('.receipt-history-items>li').first();assert.match(await beer.innerText(),/2 шт\. × 23,95 = 47,90 MDL/);assert.match(await beer.innerText(),/Считано\s*39,90/);assert.match(await beer.innerText(),/Цена и сумма не сходятся/);
  assert.equal(await card.evaluate(el=>el.scrollWidth<=el.clientWidth+1),true);await card.locator('h4').click();assert.equal(await card.isVisible(),true,'reading receipt text does not dismiss day history');
  assert.equal(await page.getByText('Важный обычный комментарий',{exact:true}).isVisible(),true);
  await card.screenshot({path:`artifacts/receipt-history/day-${width}-${light?'light':'dark'}.png`});
  await page.mouse.click(2,2);await page.locator('.receipt-history').first().waitFor({state:'detached'});
  await page.getByRole('button',{name:'История',exact:true}).click();const history=page.locator('.financial-history-dialog');await history.waitFor();
  await history.getByRole('button',{name:/История операций/}).click();
  const globalCard=history.locator('.receipt-history').filter({hasText:'MOLDRETAIL'});await globalCard.waitFor();assert.equal(await globalCard.locator('.receipt-history-items>li').count(),3);
  await globalCard.getByRole('button',{name:/Показать все покупки/}).click();assert.equal(await globalCard.locator('.receipt-history-items>li').count(),5);
  assert.equal(await history.evaluate(el=>el.scrollWidth<=el.clientWidth+1),true);assert.equal(await globalCard.evaluate(el=>el.scrollWidth<=el.clientWidth+1),true);
  await globalCard.screenshot({path:`artifacts/receipt-history/global-${width}-${light?'light':'dark'}.png`});
  await globalCard.getByRole('button',{name:'Изменить запись',exact:true}).click();await page.locator('textarea').first().waitFor({timeout:10000});
  assert.deepEqual(errors,[]);await context.close();
 }
 console.log('PASS: actual day/global histories, old/new receipts, original totals, mismatch rows, ordinary comments, expansion, edit action and 320/390/1280 dark/light layouts.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
