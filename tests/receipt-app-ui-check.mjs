import { createRequire } from 'node:module';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import assert from 'node:assert/strict';
import { installStoryAccount, storyUserId } from './life-story-auth-fixture.mjs';
const root=path.resolve('dist');
const server=http.createServer((request,response)=>{
 const name=new URL(request.url,'http://localhost').pathname,file=path.resolve(root,name==='/'?'index.html':'.'+name);
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){response.writeHead(404);response.end();return;}
 response.writeHead(200,{'Content-Type':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.gz')?'application/gzip':file.endsWith('.png')?'image/png':'text/html'});response.end(fs.readFileSync(file));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`,writes=[],records=[],requests=[];
const browser=await createRequire(process.env.DAYRIS_PLAYWRIGHT_PACKAGE||import.meta.url)('playwright').chromium.launch({channel:'msedge',headless:true});
fs.mkdirSync('artifacts/receipt-check',{recursive:true});
try{
 const context=await browser.newContext({viewport:{width:390,height:844},timezoneId:'Europe/Bucharest',serviceWorkers:'block'});
 await context.addInitScript(()=>{localStorage.setItem('atj_language','ru');localStorage.setItem('atj_currency','MDL');localStorage.setItem('dayris_onboarding_v2_completed','1');localStorage.setItem('calendar_guide_completed','1');});
 await context.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url());requests.push({url:url.href,method:request.method()});
  if(url.origin===origin)return route.continue();
  if(url.pathname.startsWith('/rest/v1/')){
   let data=[];
   if(url.pathname.endsWith('get_my_pro_status'))data={active:true};
   else if(url.pathname.endsWith('/trades')){
    if(request.method()==='POST'){const body=request.postDataJSON();const record={...body,id:`receipt-${records.length+1}`};writes.push(body);records.push(record);data=record;}
    else data=records;
   }
   return route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
  }
  return route.abort();
 });
 await installStoryAccount(context);
 const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(origin);await page.locator('.calendar-days-grid').waitFor();await page.waitForFunction(()=>!document.getElementById('boot-screen'));
 await page.locator('.receipt-launch:not([disabled])').waitFor();
 const positions=await page.evaluate(()=>{const mic=document.querySelector('.calendar-voice-button').getBoundingClientRect(),photo=document.querySelector('.receipt-launch').getBoundingClientRect();return{distance:Math.abs(photo.x-mic.x),top:Math.abs(photo.y-mic.y),overflow:document.documentElement.scrollWidth>innerWidth};});
 assert.equal(positions.overflow,false);assert.ok(positions.distance<100&&positions.top<10,'photo is beside microphone');
 const png=await page.evaluate(()=>{
  const canvas=document.createElement('canvas');canvas.width=900;canvas.height=1250;const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,900,1250);ctx.fillStyle='black';ctx.font='30px monospace';
  ['MAGAZIN TEST','IDNO: 1234567890123','','PAINE','1 buc x 7.10 = 7.10 A','','BERE','2 buc x 29.95 = 59.90 A','','TOTAL LEI 67.00','NUMERAR LEI 67.00','REST 0.00','','19-10-2026 19:16','BON FISCAL'].forEach((line,index)=>ctx.fillText(line,60,85+index*66));return canvas.toDataURL('image/png').split(',')[1];
 });
 const choosing=page.waitForEvent('filechooser');await page.locator('.receipt-launch').click();
 await (await choosing).setFiles({name:'bon.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});
 await page.locator('.receipt-fields').waitFor({timeout:120000});
 if(await page.locator('.receipt-warning[role="alert"]').count())throw new Error(await page.locator('.receipt-warning[role="alert"]').innerText());
 assert.equal(await page.getByLabel('Итог чека',{exact:true}).inputValue(),'67.00');assert.equal(await page.getByLabel('Валюта чека',{exact:true}).inputValue(),'MDL');assert.equal(await page.locator('.receipt-item').count(),2);
 assert.equal(writes.length,0,'OCR alone does not write');
 await page.locator('.receipt-item-summary').first().click();await page.getByLabel('Название 1',{exact:true}).fill('Хлеб');await page.locator('.receipt-item-summary').first().click();await page.getByRole('checkbox').check();
 await page.screenshot({path:'artifacts/receipt-check/full-app-mobile.png'});
 await page.getByRole('button',{name:'Сохранить расход',exact:true}).click();await page.locator('.receipt-success').waitFor();
 assert.equal(writes.length,1);assert.equal(writes[0].pnl,-67);assert.equal(writes[0].currency,'MDL');assert.equal(writes[0].date_key,'2026-10-19');assert.equal(writes[0].user_id,storyUserId);assert.match(writes[0].comment,/Хлеб/);assert.match(writes[0].comment,/2 × 29.95 = 59.90 MDL/);
 await page.getByRole('button',{name:'Готово',exact:true}).click();
 await page.locator('.receipt-file').first().setInputFiles({name:'bon.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});await page.locator('.receipt-fields').waitFor({timeout:120000});await page.locator('.receipt-item-summary').first().click();await page.getByLabel('Название 1',{exact:true}).fill('Хлеб');await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Сохранить расход',exact:true}).click();await page.getByRole('alert').filter({hasText:'Похожий чек'}).waitFor();assert.equal(writes.length,1,'duplicate reimport is blocked');
 await page.getByRole('button',{name:'Закрыть чек',exact:true}).click();
 if(process.env.DAYRIS_RECEIPT_SAMPLE){
  await page.locator('.receipt-file').first().setInputFiles(process.env.DAYRIS_RECEIPT_SAMPLE);await page.locator('.receipt-fields').waitFor({timeout:120000});
  assert.equal(await page.getByLabel('Итог чека',{exact:true}).inputValue(),'151.85');
  assert.equal(await page.getByLabel('Дата чека',{exact:true}).inputValue(),'2026-10-19');
  assert.equal(await page.getByLabel('Валюта чека',{exact:true}).inputValue(),'MDL');
  assert.equal(await page.locator('.receipt-item').count(),5);
  console.log('REAL SAMPLE:',JSON.stringify(await page.locator('.receipt-fields').evaluate(el=>({items:el.querySelectorAll('.receipt-item').length,inputs:[...el.querySelectorAll('input')].map(input=>input.value)}))));
  await page.screenshot({path:'artifacts/receipt-check/real-sample-mobile.png'});
  await page.locator('.receipt-scroll').evaluate(el=>el.scrollTop=el.scrollHeight);
  await page.screenshot({path:'artifacts/receipt-check/real-sample-total.png'});
  await page.getByRole('checkbox').check();
  if(await page.locator('.receipt-item[data-issue="true"]').count() || await page.locator('.receipt-difference').count()){
   assert.equal(await page.getByRole('button',{name:'Сохранить расход',exact:true}).isDisabled(),true,'real OCR disagreements cannot be confirmed away');
  }
  // Corrections come from the original photo, never from distributing the grand total.
  for(const [index,quantity,price,total] of [[0,'2','29.95','59.90'],[1,'1','23.95','23.95'],[2,'1','15.95','15.95'],[3,'1','7.10','7.10'],[4,'1','44.95','44.95']]){
   await page.locator('.receipt-item-summary').nth(index).click();
   await page.getByLabel(`Количество ${index+1}`,{exact:true}).fill(quantity);
   await page.getByLabel(`Цена за единицу ${index+1}`,{exact:true}).fill(price);
   await page.getByLabel(`Сумма позиции ${index+1}`,{exact:true}).fill(total);
  }
  assert.equal(await page.getByRole('checkbox').isChecked(),false);await page.getByRole('checkbox').check();
  assert.equal(await page.getByRole('button',{name:'Сохранить расход',exact:true}).isEnabled(),true);
  await page.getByRole('button',{name:'Сохранить расход',exact:true}).click();await page.locator('.receipt-success').waitFor();
  assert.equal(writes.length,2);assert.equal(writes[1].pnl,-151.85);assert.match(writes[1].comment,/2 × 29.95 = 59.90 MDL/);
  console.log('REAL SAMPLE CORRECTIONS: five photo-verified rows reconcile to 151.85 MDL, mocked persistence only.');
 }
 await page.setViewportSize({width:1280,height:900});await page.screenshot({path:'artifacts/receipt-check/full-app-desktop.png'});
 assert.equal(requests.some(item=>item.method==='POST' && !item.url.includes('supabase.co') && !item.url.startsWith(origin)),false,'photo is never sent to an OCR service');
 assert.equal(requests.some(item=>/cdn\.jsdelivr|unpkg/.test(item.url)),false,'engine/languages are same-origin');
 assert.deepEqual(errors,[]);console.log('PASS: production calendar, adjacent photo button, real local OCR, editable review, PRO checks, exact persistent expense, duplicate guard, no external OCR/CDN.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
