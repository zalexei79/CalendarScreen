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
let proActive=true;
const browser=await createRequire(process.env.DAYRIS_PLAYWRIGHT_PACKAGE||import.meta.url)('playwright').chromium.launch({channel:'msedge',headless:true});
fs.mkdirSync('artifacts/receipt-check',{recursive:true});
try{
 const context=await browser.newContext({viewport:{width:390,height:844},timezoneId:'Europe/Bucharest',serviceWorkers:'block'});
 await context.addInitScript(()=>{localStorage.setItem('atj_language','ru');localStorage.setItem('atj_currency','MDL');if(localStorage.getItem('atj_pro_view')===null)localStorage.setItem('atj_pro_view','1');localStorage.setItem('dayris_onboarding_v2_completed','1');localStorage.setItem('calendar_guide_completed','1');});
 await context.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url());requests.push({url:url.href,method:request.method()});
  if(url.origin===origin)return route.continue();
  if(url.pathname.startsWith('/rest/v1/')){
   let data=[];
   if(url.pathname.endsWith('get_my_pro_status'))data={active:proActive};
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
 // A paid account in the regular view and a free account with a stale PRO
 // preference must both omit the camera and its upload inputs altogether.
 for(const [active,mode] of [[true,'0'],[false,'1']]){
  proActive=active;await page.evaluate(value=>localStorage.setItem('atj_pro_view',value),mode);
  const checked=page.waitForResponse(response=>response.url().endsWith('/rpc/get_my_pro_status'));
  await page.reload();await checked;await page.locator('.calendar-days-grid').waitFor();await page.waitForFunction(()=>!document.getElementById('boot-screen'));
  assert.equal(await page.locator('.receipt-launch,.receipt-file,.receipt-dialog').count(),0,`camera hidden with access=${active}, PRO view=${mode}`);
  for(const width of[390,1280]){
   await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   await page.screenshot({path:`artifacts/receipt-check/camera-hidden-${active?'regular':'free'}-${width}.png`});
  }
 }
 await page.setViewportSize({width:390,height:844});
 proActive=true;await page.evaluate(()=>localStorage.setItem('atj_pro_view','1'));await page.reload();await page.locator('.receipt-launch:not([disabled])').waitFor();
 const positions=await page.evaluate(()=>{const mic=document.querySelector('.calendar-voice-button').getBoundingClientRect(),photo=document.querySelector('.receipt-launch').getBoundingClientRect();return{distance:Math.abs(photo.x-mic.x),top:Math.abs(photo.y-mic.y),overflow:document.documentElement.scrollWidth>innerWidth};});
 assert.equal(positions.overflow,false);assert.ok(positions.distance<100&&positions.top<10,'photo is beside microphone');
 const png=await page.evaluate(()=>{
  const canvas=document.createElement('canvas');canvas.width=900;canvas.height=1250;const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,900,1250);ctx.fillStyle='black';ctx.font='30px monospace';
  ['MAGAZIN TEST','IDNO: 1234567890123','','PAINE','1 buc x 7.10 = 7.10 A','','BERE','2 buc x 23.95 = 39.90 A','','TOTAL LEI 67.00','NUMERAR LEI 67.00','REST 0.00','','19-10-2026 19:16','BON FISCAL'].forEach((line,index)=>ctx.fillText(line,60,85+index*66));return canvas.toDataURL('image/png').split(',')[1];
 });
 const choosing=page.waitForEvent('filechooser');await page.locator('.receipt-launch').click();
 await (await choosing).setFiles({name:'bon.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});
 await page.locator('.receipt-fields').waitFor({timeout:120000});
 if(await page.locator('.receipt-warning[role="alert"]').count())throw new Error(await page.locator('.receipt-warning[role="alert"]').innerText());
 assert.equal(await page.getByLabel('Итог чека',{exact:true}).inputValue(),'67.00');assert.equal(await page.getByLabel('Валюта чека',{exact:true}).inputValue(),'MDL');assert.equal(await page.locator('.receipt-item').count(),0,'unreliable details default to the independent total');assert.equal(await page.getByRole('checkbox').isChecked(),false);await page.getByRole('button',{name:'Проверить позиции',exact:true}).click();assert.equal(await page.locator('.receipt-item').count(),2);
 assert.equal(writes.length,0,'OCR alone does not write');
 await page.getByRole('button',{name:'Проверить покупку',exact:true}).click();await page.waitForFunction(()=>document.activeElement?.getAttribute('aria-label')==='Цена за единицу 2');
 assert.equal(writes.length,0,'the primary correction action cannot save inconsistent values');assert.equal(await page.getByRole('checkbox').count(),0);assert.equal(await page.locator('.receipt-warning').count(),0);
 assert.equal(await page.getByLabel('Сумма позиции 2',{exact:true}).evaluate(input=>input.readOnly),true);assert.equal(await page.getByLabel('Сумма позиции 2',{exact:true}).inputValue(),'47.90');
 await page.getByLabel('Цена за единицу 2',{exact:true}).fill('29.95');assert.equal(await page.getByLabel('Сумма позиции 2',{exact:true}).inputValue(),'59.90');await page.locator('.receipt-item-summary').nth(1).click();
 await page.locator('.receipt-item-summary').first().click();await page.getByLabel('Название 1',{exact:true}).fill('Хлеб');await page.locator('.receipt-item-summary').first().click();await page.getByRole('checkbox').check();
 await page.screenshot({path:'artifacts/receipt-check/full-app-mobile.png'});
 await page.getByRole('button',{name:'Сохранить расход',exact:true}).click();await page.locator('.receipt-success').waitFor();
 assert.equal(writes.length,1);assert.equal(writes[0].pnl,-67);assert.equal(writes[0].currency,'MDL');assert.equal(writes[0].date_key,'2026-10-19');assert.equal(writes[0].user_id,storyUserId);assert.match(writes[0].comment,/Хлеб/);assert.match(writes[0].comment,/2 × 29.95 = 59.90 MDL/);
 await page.getByRole('button',{name:'Готово',exact:true}).click();
 await page.locator('.receipt-file').first().setInputFiles({name:'bon.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});await page.locator('.receipt-fields').waitFor({timeout:120000});await page.getByRole('button',{name:'Проверить позиции',exact:true}).click();await page.locator('.receipt-item-summary').nth(1).click();await page.getByLabel('Цена за единицу 2',{exact:true}).fill('29.95');await page.locator('.receipt-item-summary').first().click();await page.getByLabel('Название 1',{exact:true}).fill('Хлеб');await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Сохранить расход',exact:true}).click();await page.getByRole('alert').filter({hasText:'Похожий чек'}).waitFor();assert.equal(writes.length,1,'duplicate reimport is blocked');
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
  if(await page.locator('.receipt-item[data-issue="true"]').count() || await page.locator('.receipt-difference').count()){
   assert.equal(await page.getByRole('button',{name:'Сохранить расход',exact:true}).count(),0,'real OCR disagreements cannot be confirmed away');
   assert.equal(await page.getByRole('checkbox').count(),0);
  }
  // Every factor and result must now be recognized correctly without manual correction.
  for(const [index,quantity,price,total] of [[0,'2','29.95','59.90'],[1,'1','23.95','23.95'],[2,'1','15.95','15.95'],[3,'1','7.10','7.10'],[4,'1','44.95','44.95']]){
   assert.equal(await page.getByLabel(`Количество ${index+1}`,{exact:true}).inputValue(),quantity);
   assert.equal(await page.getByLabel(`Цена за единицу ${index+1}`,{exact:true}).inputValue(),price);
   assert.equal(await page.getByLabel(`Сумма позиции ${index+1}`,{exact:true}).inputValue(),total);
  }
  assert.equal(await page.getByRole('checkbox').isChecked(),false);await page.getByRole('checkbox').check();
  assert.equal(await page.getByRole('button',{name:'Сохранить расход',exact:true}).isEnabled(),true);
  await page.getByRole('button',{name:'Сохранить расход',exact:true}).click();await page.locator('.receipt-success').waitFor();
  assert.equal(writes.length,2);assert.equal(writes[1].pnl,-151.85);assert.match(writes[1].comment,/2 × 29.95 = 59.90 MDL/);
  console.log('REAL SAMPLE: all five factors and results recognized correctly without manual corrections; 151.85 MDL, mocked persistence only.');
  await page.getByRole('button',{name:'Готово',exact:true}).click();
 }
 if(process.env.DAYRIS_RECEIPT_CROP){
  await page.locator('.receipt-file').first().setInputFiles(process.env.DAYRIS_RECEIPT_CROP);await page.locator('.receipt-fields').waitFor({timeout:120000});
  assert.equal(await page.getByLabel('Итог чека',{exact:true}).inputValue(),'151.85');assert.equal(await page.locator('.receipt-item').count(),5);
  for(const [index,quantity,price,total] of [[0,'2','29.95','59.90'],[1,'1','23.95','23.95'],[2,'1','15.95','15.95'],[3,'1','7.10','7.10'],[4,'1','44.95','44.95']]){
   assert.equal(await page.getByLabel(`Количество ${index+1}`,{exact:true}).inputValue(),quantity);assert.equal(await page.getByLabel(`Цена за единицу ${index+1}`,{exact:true}).inputValue(),price);assert.equal(await page.getByLabel(`Сумма позиции ${index+1}`,{exact:true}).inputValue(),total);
  }
  assert.equal(await page.locator('.receipt-item[data-issue="true"]').count(),0);
  // This crop omits the date; metadata still requires explicit user input.
  await page.getByLabel('Дата чека',{exact:true}).fill('2026-10-19');await page.getByLabel('Валюта чека',{exact:true}).selectOption('MDL');
  if(await page.locator('.receipt-metadata').evaluate(el=>el.open))await page.locator('.receipt-metadata>summary').click();
  await page.getByRole('checkbox').check();assert.equal(await page.getByRole('button',{name:'Сохранить расход',exact:true}).isEnabled(),true);
  await page.screenshot({path:'artifacts/receipt-check/real-crop-mobile.png'});console.log('REAL CROP: all five factors and results recognized correctly without manual item corrections.');
 }
 if(process.env.DAYRIS_CALCULATOR_SAMPLE){
  if(await page.locator('.receipt-dialog').isVisible())await page.getByRole('button',{name:'Закрыть чек',exact:true}).click();
  await page.locator('.receipt-file').first().setInputFiles(process.env.DAYRIS_CALCULATOR_SAMPLE);await page.locator('.receipt-fields').waitFor({timeout:120000});
  assert.equal(await page.getByLabel('Итог чека',{exact:true}).inputValue(),'59.90');assert.equal(await page.getByLabel('Валюта чека',{exact:true}).inputValue(),'MDL');assert.equal(await page.locator('.receipt-section-title').count(),0);assert.equal(await page.locator('.receipt-warning').count(),0);
  assert.equal(await page.locator('#receipt-title').innerText(),'Фото в календарь');assert.doesNotMatch(await page.locator('.receipt-composer').innerText(),/22:37|LTE|Укажите дату/);assert.match(await page.locator('.receipt-amount-caption').innerText(),/29,95 × 2/);
  await page.getByRole('checkbox').check();await page.screenshot({path:'artifacts/receipt-check/real-calculator-mobile.png'});
  const previousWrites=writes.length;await page.getByRole('button',{name:'Сохранить расход',exact:true}).click();await page.locator('.receipt-success').waitFor();assert.equal(writes.length,previousWrites+1);assert.equal(writes.at(-1).pnl,-59.90);assert.match(writes.at(-1).comment,/^📷/u);assert.doesNotMatch(writes.at(-1).comment,/22:37|LTE/);
  await page.getByRole('button',{name:'Готово',exact:true}).click();await page.getByRole('button',{name:'История',exact:true}).click();const card=page.locator('.receipt-history').filter({hasText:'Сумма с фото'});await card.waitFor();assert.match(await card.innerText(),/59,90/);assert.equal(await card.locator('.receipt-history-items').count(),0);await card.screenshot({path:'artifacts/receipt-check/photo-amount-history.png'});
  console.log('CALCULATOR: real screenshot recognized as 59.90 MDL; clean amount card and photo expense history, no store/status-bar pollution.');
 }
 if(process.env.DAYRIS_CONSTRUCTION_SAMPLE){
  if(await page.locator('.receipt-dialog').isVisible())await page.getByRole('button',{name:'Закрыть чек',exact:true}).click();
  await page.locator('.receipt-file').first().setInputFiles(process.env.DAYRIS_CONSTRUCTION_SAMPLE);await page.locator('.receipt-fields').waitFor({timeout:120000});
  assert.equal(await page.locator('#receipt-title').innerText(),'Чек в календарь');
  assert.equal(await page.getByLabel('Итог чека',{exact:true}).inputValue(),'16628.00','never the final item amount 652.00');
  assert.equal(await page.getByLabel('Дата чека',{exact:true}).inputValue(),'2007-03-14');
  assert.equal(await page.getByLabel('Валюта чека',{exact:true}).inputValue(),'','no currency printed: never use the selected calendar currency');
  assert.equal(await page.locator('.receipt-item').count(),4,await page.getByLabel('Распознанный текст',{exact:true}).inputValue());
  for(const [index,quantity,price,total]of[[0,'800','10.22','8176.00'],[1,'1','5400.00','5400.00'],[2,'5','480.00','2400.00'],[3,'4','163.00','652.00']]){
   assert.equal(await page.getByLabel(`Количество ${index+1}`,{exact:true}).inputValue(),quantity);assert.equal(await page.getByLabel(`Цена за единицу ${index+1}`,{exact:true}).inputValue(),price);assert.equal(await page.getByLabel(`Сумма позиции ${index+1}`,{exact:true}).inputValue(),total);
  }
  assert.equal(await page.locator('.receipt-difference').count(),0);assert.equal(await page.getByRole('checkbox').count(),0,'unknown currency cannot be confirmed away');
  await page.getByLabel('Валюта чека',{exact:true}).selectOption('RUB');await page.getByRole('checkbox').check();assert.equal(await page.getByRole('button',{name:'Сохранить расход',exact:true}).isEnabled(),true);
  await page.locator('.receipt-scroll').evaluate(el=>el.scrollTop=0);await page.screenshot({path:'artifacts/receipt-check/real-construction-mobile.png'});
  console.log('CONSTRUCTION: real photo, grand total 16628.00, all four amounts and printed factors correct; missing currency requires explicit choice.');
 }
 if(process.env.DAYRIS_UNUSUAL_SCREENSHOTS_DIR){
  for(const [number,x,y,width,height,expected]of[[1,141,255,310,415,'532.90'],[2,141,275,310,415,'725.00'],[3,200,275,192,416,'']]){
   if(await page.locator('.receipt-dialog').isVisible())await page.getByRole('button',{name:'Закрыть чек',exact:true}).click();
   const source=fs.readFileSync(path.join(process.env.DAYRIS_UNUSUAL_SCREENSHOTS_DIR,`${number}-Фото-${number}.jpg`)).toString('base64');
   // The attachments are app screenshots. Extract only the actual source image
   // at its native low resolution; never feed the app's displayed wrong amount.
   const png=await page.evaluate(async({source,x,y,width,height})=>{const img=new Image();img.src='data:image/jpeg;base64,'+source;await img.decode();const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;canvas.getContext('2d').drawImage(img,x,y,width,height,0,0,width,height);return canvas.toDataURL('image/png').split(',')[1];},{source,x,y,width,height});
   await page.locator('.receipt-file').first().setInputFiles({name:`unusual-${number}.png`,mimeType:'image/png',buffer:Buffer.from(png,'base64')});await page.locator('.receipt-fields').waitFor({timeout:120000});
   const actual=await page.getByLabel('Итог чека',{exact:true}).inputValue();
   if(actual!==expected){fs.writeFileSync(`artifacts/receipt-check/unusual-failed-${number}.txt`,await page.getByLabel('Распознанный текст',{exact:true}).inputValue());await page.screenshot({path:`artifacts/receipt-check/unusual-failed-${number}.png`});}
   assert.equal(actual,expected,`source ${number}`);
   if(number<3){assert.equal(await page.locator('#receipt-title').innerText(),'Чек в календарь');assert.equal(await page.getByLabel('Валюта чека',{exact:true}).inputValue(),'','never silently assign MDL');assert.equal(await page.locator('.receipt-item').count(),0,'uncertain products do not obscure the recovered total');if(await page.locator('.receipt-omitted').count())assert.equal(await page.getByRole('button',{name:'Проверить позиции',exact:true}).isVisible(),true);}
   else{assert.match(await page.locator('.receipt-document-status').innerText(),/история сделок/);assert.equal(await page.getByRole('button',{name:'Сохранить расход',exact:true}).count(),0);assert.equal(await page.getByRole('checkbox').count(),0);}
   for(const size of[390,1280]){await page.setViewportSize({width:size,height:900});await page.locator('.receipt-scroll').evaluate(el=>el.scrollTop=0);await page.screenshot({path:`artifacts/receipt-check/unusual-source-${number}-${size}.png`});}
   console.log(`UNUSUAL SOURCE ${number}: ${expected||'trading history blocked'}, real local OCR of native-size source region from supplied screenshot.`);
  }
 }
 if(process.env.DAYRIS_CURVED_SAMPLE){
  if(await page.locator('.receipt-dialog').isVisible())await page.getByRole('button',{name:'Закрыть чек',exact:true}).click();
  await page.locator('.receipt-file').first().setInputFiles(process.env.DAYRIS_CURVED_SAMPLE);await page.locator('.receipt-fields').waitFor({timeout:120000});
  assert.equal(await page.getByLabel('Итог чека',{exact:true}).inputValue(),'','conflicting OCR cannot set an automatic expense amount');
  assert.equal(await page.getByLabel('Итог чека',{exact:true}).getAttribute('placeholder'),'—');assert.equal(await page.locator('.receipt-sum,.receipt-difference').count(),0);
  assert.equal(await page.getByLabel('Магазин',{exact:true}).inputValue(),'','isolated footer OCR cannot invent a store');
  await page.getByRole('button',{name:'Выбрать сумму 695,50',exact:true}).waitFor();assert.equal(await page.locator('.receipt-item').count(),0);assert.equal(await page.getByRole('button',{name:'Сохранить расход',exact:true}).count(),0);
  for(const width of[320,390,1280]){await page.setViewportSize({width,height:900});await page.screenshot({path:`artifacts/receipt-check/curved-candidates-${width}.png`});}
  await page.getByRole('button',{name:'Выбрать сумму 695,50',exact:true}).click();assert.equal(await page.getByLabel('Итог чека',{exact:true}).inputValue(),'695.50');assert.equal(await page.locator('.receipt-total-options').count(),0);
  assert.equal(await page.getByLabel('Валюта чека',{exact:true}).inputValue(),'','the photo has no explicit currency, so none may be invented');assert.equal(await page.getByRole('checkbox').count(),0,'missing date/currency still require review');
  await page.screenshot({path:'artifacts/receipt-check/curved-verified-total.png'});
  console.log('CURVED RECEIPT: total row located independently of items; conflicting OCR offers 695.50 for explicit photo review, no automatic saving.');
 }
 await page.setViewportSize({width:1280,height:900});await page.screenshot({path:'artifacts/receipt-check/full-app-desktop.png'});
 assert.equal(requests.some(item=>item.method==='POST' && !item.url.includes('supabase.co') && !item.url.startsWith(origin)),false,'photo is never sent to an OCR service');
 assert.equal(requests.some(item=>/cdn\.jsdelivr|unpkg/.test(item.url)),false,'engine/languages are same-origin');
 assert.deepEqual(errors,[]);console.log('PASS: production calendar, adjacent photo button, real local OCR, editable review, PRO checks, exact persistent expense, duplicate guard, no external OCR/CDN.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
