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
 await page.locator('.receipt-launch').click();await page.locator('.receipt-scanner').waitFor();const waitForReview=async()=>{await page.locator('.receipt-fields,.receipt-scan-failed').first().waitFor({timeout:120000});if(await page.locator('.receipt-scan-failed').count())await page.getByRole('button',{name:'Ввести вручную',exact:true}).click();await page.locator('.receipt-fields').waitFor();};const choosing=page.waitForEvent('filechooser');await page.getByRole('button',{name:'Галерея',exact:true}).click();
 await (await choosing).setFiles({name:'bon.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});
 await waitForReview();
 if(await page.locator('.receipt-warning[role="alert"]').count())throw new Error(await page.locator('.receipt-warning[role="alert"]').innerText());
 assert.equal(await page.getByLabel('Итог чека',{exact:true}).inputValue(),'67.00');assert.equal(await page.getByLabel('Валюта чека',{exact:true}).inputValue(),'MDL');assert.equal(await page.locator('.receipt-item').count(),2,'recognized details are included by default');
 const includeDetails=()=>page.getByRole('switch',{name:'Сохранить список покупок',exact:true});
 assert.equal(await includeDetails().isChecked(),true);assert.equal(await page.getByRole('button',{name:'Сохранить расход',exact:true}).isEnabled(),true,'OCR discrepancies do not block the independent receipt total');assert.equal(writes.length,0,'OCR alone never writes');
 await includeDetails().uncheck();assert.equal(await page.locator('.receipt-item').count(),0);assert.equal(await page.getByLabel('Итог чека',{exact:true}).inputValue(),'67.00');assert.equal(await page.getByRole('button',{name:'Сохранить расход',exact:true}).isEnabled(),true);
 await includeDetails().check();assert.equal(await page.locator('.receipt-item').count(),2,'the switch restores the same OCR draft');
 await page.locator('.receipt-item-summary').nth(1).click();assert.equal(await page.getByLabel('Цена за единицу 2',{exact:true}).inputValue(),'23.95');assert.equal(await page.getByLabel('Сумма позиции 2',{exact:true}).evaluate(input=>input.readOnly),true);await page.locator('.receipt-item-summary').nth(1).click();
 await page.screenshot({path:'artifacts/receipt-check/full-app-mobile.png'});
 await page.getByRole('button',{name:'Сохранить расход',exact:true}).click();await page.locator('.receipt-success').waitFor();
 assert.equal(writes.length,1);assert.equal(writes[0].pnl,-67,'the expense is never replaced by the partial item sum');assert.equal(writes[0].currency,'MDL');assert.equal(writes[0].date_key,'2026-10-19');assert.equal(writes[0].user_id,storyUserId);assert.match(writes[0].comment,/Хлеб/);assert.match(writes[0].comment,/39.90 MDL/,'the uncertain printed row amount remains in history');assert.doesNotMatch(writes[0].comment,/2 × 23.95 = 39.90/,'contradictory factors never serialize as a false equation');
 await page.getByRole('button',{name:'Готово',exact:true}).click();
 await page.locator('.receipt-file').first().setInputFiles({name:'bon.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});await waitForReview();if(await page.locator('.receipt-warning[role="alert"]').count())throw new Error(await page.locator('.receipt-warning[role="alert"]').innerText());assert.equal(await page.locator('.receipt-item').count(),2);assert.equal(await includeDetails().isChecked(),true);await page.getByRole('button',{name:'Сохранить расход',exact:true}).click();await page.getByRole('alert').filter({hasText:'Похожий чек'}).waitFor();assert.equal(writes.length,1,'duplicate reimport is blocked');
 await page.getByRole('button',{name:'Закрыть чек',exact:true}).click();
 if(process.env.DAYRIS_RECEIPT_DISTANCE_SAMPLE){
  const source='data:image/jpeg;base64,'+fs.readFileSync(process.env.DAYRIS_RECEIPT_DISTANCE_SAMPLE).toString('base64');
  for(const scene of ['original','table','hand']){const hand=scene==='hand';
   const jpg=await page.evaluate(async({source,hand,scene})=>{if(scene==='original')return source.split(',')[1];const image=new Image();image.src=source;await image.decode();const canvas=document.createElement('canvas');canvas.width=1400;canvas.height=1700;const c=canvas.getContext('2d');c.fillStyle='#717477';c.fillRect(0,0,1400,1700);c.save();c.translate(700,850);c.rotate(.06);c.drawImage(image,image.width*.314,image.height*.068,image.width*.333,image.height*.806,-165,-535,330,1070);c.restore();if(hand){c.fillStyle='#c08d72';c.beginPath();c.ellipse(530,950,75,130,-.3,0,Math.PI*2);c.fill();}return canvas.toDataURL('image/jpeg',.93).split(',')[1];},{source,hand,scene});
   fs.writeFileSync('artifacts/receipt-check/distant-'+scene+'.jpg',Buffer.from(jpg,'base64'));
   const started=Date.now();await page.locator('.receipt-file').first().setInputFiles({name:'distant.jpg',mimeType:'image/jpeg',buffer:Buffer.from(jpg,'base64')});await waitForReview();
   let total=await page.getByLabel('Итог чека',{exact:true}).inputValue();if(!total){console.log('DISTANT CANDIDATES:',await page.locator('.receipt-total-options').allTextContents());const candidate=page.getByRole('button',{name:'Выбрать сумму 151,85',exact:true});if(await candidate.count()){await candidate.click();total=await page.getByLabel('Итог чека',{exact:true}).inputValue();}}console.log('DISTANT '+scene.toUpperCase()+': total='+total+', elapsed='+Math.round((Date.now()-started)/1000)+'s');if(!total)console.log('DISTANT RAW:',await page.locator('.receipt-raw textarea').inputValue());
   assert.equal(total,'151.85','distant receipt total comes from printed pixels');assert.equal(writes.length,1,'recognition never persists automatically');await page.screenshot({path:'artifacts/receipt-check/distant-result-'+scene+'.png'});await page.getByRole('button',{name:'Закрыть чек',exact:true}).click();
  }
 }
 if(process.env.DAYRIS_RECEIPT_SAMPLE){
  await page.locator('.receipt-file').first().setInputFiles(process.env.DAYRIS_RECEIPT_SAMPLE);await waitForReview();
  let total=await page.getByLabel('Итог чека',{exact:true}).inputValue();if(!total){await page.getByRole('button',{name:'Выбрать сумму 151,85',exact:true}).click();total=await page.getByLabel('Итог чека',{exact:true}).inputValue();}assert.equal(total,'151.85');
  await page.getByLabel('Дата чека',{exact:true}).fill('2026-10-19');await page.getByLabel('Валюта чека',{exact:true}).selectOption('MDL');
  const count=await page.locator('.receipt-item').count();if(count)assert.equal(await includeDetails().isChecked(),true);assert.equal(await page.getByRole('button',{name:'Сохранить расход',exact:true}).isEnabled(),true,'partial details never block the printed total');
  await page.screenshot({path:'artifacts/receipt-check/real-sample-mobile.png'});const before=writes.length;await page.getByRole('button',{name:'Сохранить расход',exact:true}).click();await page.locator('.receipt-success').waitFor();assert.equal(writes.length,before+1);assert.equal(writes.at(-1).pnl,-151.85);await page.getByRole('button',{name:'Готово',exact:true}).click();
  console.log('REAL SAMPLE:151.85 MDL saved independently of optional OCR details.');
 }
 if(process.env.DAYRIS_RECEIPT_CROP){
  await page.locator('.receipt-file').first().setInputFiles(process.env.DAYRIS_RECEIPT_CROP);await waitForReview();
  assert.equal(await page.getByLabel('Итог чека',{exact:true}).inputValue(),'151.85');assert.equal(await page.locator('.receipt-item').count(),5);
  for(const [index,quantity,price,total] of [[0,'2','29.95','59.90'],[1,'1','23.95','23.95'],[2,'1','15.95','15.95'],[3,'1','7.10','7.10'],[4,'1','44.95','44.95']]){
   assert.equal(await page.getByLabel(`Количество ${index+1}`,{exact:true}).inputValue(),quantity);assert.equal(await page.getByLabel(`Цена за единицу ${index+1}`,{exact:true}).inputValue(),price);assert.equal(await page.getByLabel(`Сумма позиции ${index+1}`,{exact:true}).inputValue(),total);
  }
  assert.equal(await page.locator('.receipt-item[data-issue="true"]').count(),0);
  // This crop omits the date; metadata still requires explicit user input.
  await page.getByLabel('Дата чека',{exact:true}).fill('2026-10-19');await page.getByLabel('Валюта чека',{exact:true}).selectOption('MDL');
  if(await page.locator('.receipt-metadata').evaluate(el=>el.open))await page.locator('.receipt-metadata>summary').click();
  assert.equal(await page.getByRole('button',{name:'Сохранить расход',exact:true}).isEnabled(),true);
  await page.screenshot({path:'artifacts/receipt-check/real-crop-mobile.png'});console.log('REAL CROP: all five factors and results recognized correctly without manual item corrections.');
 }
 if(process.env.DAYRIS_CALCULATOR_SAMPLE){
  if(await page.locator('.receipt-dialog').isVisible())await page.getByRole('button',{name:'Закрыть чек',exact:true}).click();
  await page.locator('.receipt-file').first().setInputFiles(process.env.DAYRIS_CALCULATOR_SAMPLE);await waitForReview();
  assert.equal(await page.getByLabel('Итог чека',{exact:true}).inputValue(),'59.90');assert.equal(await page.getByLabel('Валюта чека',{exact:true}).inputValue(),'MDL');assert.equal(await page.locator('.receipt-section-title').count(),0);assert.equal(await page.locator('.receipt-warning').count(),0);
  assert.equal(await page.locator('#receipt-title').innerText(),'Фото в календарь');assert.doesNotMatch(await page.locator('.receipt-composer').innerText(),/22:37|LTE|Укажите дату/);assert.match(await page.locator('.receipt-amount-caption').innerText(),/29,95 × 2/);
  await page.screenshot({path:'artifacts/receipt-check/real-calculator-mobile.png'});
  const previousWrites=writes.length;await page.getByRole('button',{name:'Сохранить расход',exact:true}).click();await page.locator('.receipt-success').waitFor();assert.equal(writes.length,previousWrites+1);assert.equal(writes.at(-1).pnl,-59.90);assert.match(writes.at(-1).comment,/^📷/u);assert.doesNotMatch(writes.at(-1).comment,/22:37|LTE/);
  await page.getByRole('button',{name:'Готово',exact:true}).click();await page.getByRole('button',{name:'История',exact:true}).click();const card=page.locator('.receipt-history').filter({hasText:'Сумма с фото'});await card.waitFor();assert.match(await card.innerText(),/59,90/);assert.equal(await card.locator('.receipt-history-items').count(),0);await card.screenshot({path:'artifacts/receipt-check/photo-amount-history.png'});
  console.log('CALCULATOR: real screenshot recognized as 59.90 MDL; clean amount card and photo expense history, no store/status-bar pollution.');
 }
 if(process.env.DAYRIS_CONSTRUCTION_SAMPLE){
  if(await page.locator('.receipt-dialog').isVisible())await page.getByRole('button',{name:'Закрыть чек',exact:true}).click();
  await page.locator('.receipt-file').first().setInputFiles(process.env.DAYRIS_CONSTRUCTION_SAMPLE);await waitForReview();
  assert.equal(await page.locator('#receipt-title').innerText(),'Чек в календарь');
  assert.equal(await page.getByLabel('Итог чека',{exact:true}).inputValue(),'16628.00','never the final item amount 652.00');
  assert.equal(await page.getByLabel('Дата чека',{exact:true}).inputValue(),'2007-03-14');
  assert.equal(await page.getByLabel('Валюта чека',{exact:true}).inputValue(),'','no currency printed: never use the selected calendar currency');
  const itemCount=await page.locator('.receipt-item').count();assert.ok(itemCount>0,'recognized construction rows are visible');assert.equal(await includeDetails().isChecked(),true);assert.equal(await page.getByRole('button',{name:'Сохранить расход',exact:true}).count(),0,'missing currency is still required');
  await page.getByLabel('Валюта чека',{exact:true}).selectOption('RUB');assert.equal(await page.getByRole('button',{name:'Сохранить расход',exact:true}).isEnabled(),true);
  await page.locator('.receipt-scroll').evaluate(el=>el.scrollTop=0);await page.screenshot({path:'artifacts/receipt-check/real-construction-mobile.png'});
  console.log('CONSTRUCTION: real photo, grand total 16628.00, recognized item rows stay visible; missing currency requires explicit choice.');
 }
 if(process.env.DAYRIS_UNUSUAL_SCREENSHOTS_DIR){
  for(const [number,x,y,width,height,expected]of[[1,141,255,310,415,'532.90'],[2,141,275,310,415,'725.00'],[3,200,275,192,416,'']]){
   if(await page.locator('.receipt-dialog').isVisible())await page.getByRole('button',{name:'Закрыть чек',exact:true}).click();
   const source=fs.readFileSync(path.join(process.env.DAYRIS_UNUSUAL_SCREENSHOTS_DIR,`${number}-Фото-${number}.jpg`)).toString('base64');
   // The attachments are app screenshots. Extract only the actual source image
   // at its native low resolution; never feed the app's displayed wrong amount.
   const png=await page.evaluate(async({source,x,y,width,height})=>{const img=new Image();img.src='data:image/jpeg;base64,'+source;await img.decode();const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;canvas.getContext('2d').drawImage(img,x,y,width,height,0,0,width,height);return canvas.toDataURL('image/png').split(',')[1];},{source,x,y,width,height});
   await page.locator('.receipt-file').first().setInputFiles({name:`unusual-${number}.png`,mimeType:'image/png',buffer:Buffer.from(png,'base64')});await waitForReview();
   const actual=await page.getByLabel('Итог чека',{exact:true}).inputValue();
   if(actual!==expected){fs.writeFileSync(`artifacts/receipt-check/unusual-failed-${number}.txt`,await page.getByLabel('Распознанный текст',{exact:true}).inputValue());await page.screenshot({path:`artifacts/receipt-check/unusual-failed-${number}.png`});}
   assert.equal(actual,expected,`source ${number}`);
   if(number<3){assert.equal(await page.locator('#receipt-title').innerText(),'Чек в календарь');assert.equal(await page.getByLabel('Валюта чека',{exact:true}).inputValue(),'','never silently assign MDL');if(await includeDetails().count())assert.equal(await includeDetails().isChecked(),true,'partial OCR details are not hidden automatically');}
   else{assert.match(await page.locator('.receipt-document-status').innerText(),/история сделок/);assert.equal(await page.getByRole('button',{name:'Сохранить расход',exact:true}).count(),0);assert.equal(await page.getByRole('checkbox').count(),0);}
   for(const size of[390,1280]){await page.setViewportSize({width:size,height:900});await page.locator('.receipt-scroll').evaluate(el=>el.scrollTop=0);await page.screenshot({path:`artifacts/receipt-check/unusual-source-${number}-${size}.png`});}
   console.log(`UNUSUAL SOURCE ${number}: ${expected||'trading history blocked'}, real local OCR of native-size source region from supplied screenshot.`);
  }
 }
 if(process.env.DAYRIS_CURVED_SAMPLE){
  if(await page.locator('.receipt-dialog').isVisible())await page.getByRole('button',{name:'Закрыть чек',exact:true}).click();
  await page.locator('.receipt-file').first().setInputFiles(process.env.DAYRIS_CURVED_SAMPLE);await waitForReview();
  const foundTotal=await page.getByLabel('Итог чека',{exact:true}).inputValue();assert.ok(!foundTotal||foundTotal==='695.50','only the actual total may be selected without conflicting reads');
  assert.equal(await page.getByLabel('Итог чека',{exact:true}).getAttribute('placeholder'),'—');assert.equal(await page.getByRole('button',{name:'Сохранить расход',exact:true}).count(),0,'unreadable total or required metadata remain unresolved');
  assert.equal(await page.getByLabel('Магазин',{exact:true}).inputValue(),'','isolated footer OCR cannot invent a store');
  if(!foundTotal)await page.getByRole('button',{name:'Выбрать сумму 695,50',exact:true}).waitFor();if(await includeDetails().count())assert.equal(await includeDetails().isChecked(),true);assert.equal(await page.getByRole('button',{name:'Сохранить расход',exact:true}).count(),0);
  for(const width of[320,390,1280]){await page.setViewportSize({width,height:900});await page.screenshot({path:`artifacts/receipt-check/curved-candidates-${width}.png`});}
  if(!foundTotal)await page.getByRole('button',{name:'Выбрать сумму 695,50',exact:true}).click();assert.equal(await page.getByLabel('Итог чека',{exact:true}).inputValue(),'695.50');assert.equal(await page.locator('.receipt-total-options').count(),0);
  assert.equal(await page.getByLabel('Валюта чека',{exact:true}).inputValue(),'','the photo has no explicit currency, so none may be invented');assert.equal(await page.getByRole('checkbox').count(),0,'missing date/currency still require review');
  await page.screenshot({path:'artifacts/receipt-check/curved-verified-total.png'});
  console.log('CURVED RECEIPT: total row located independently of items; conflicting OCR offers 695.50 for explicit photo review, no automatic saving.');
 }
 if(process.env.DAYRIS_CURVED_VARIANTS){
  const source=fs.readFileSync(process.env.DAYRIS_CURVED_VARIANTS).toString('base64');
  for(const width of[540,360]){
   if(await page.locator('.receipt-dialog').isVisible())await page.getByRole('button',{name:'Закрыть чек',exact:true}).click();
   const jpg=await page.evaluate(async({source,width})=>{const img=new Image();img.src='data:image/jpeg;base64,'+source;await img.decode();const canvas=document.createElement('canvas');canvas.width=width;canvas.height=Math.round(img.naturalHeight*width/img.naturalWidth);canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);return canvas.toDataURL('image/jpeg',.8).split(',')[1];},{source,width});
   await page.locator('.receipt-file').first().setInputFiles({name:`receipt-${width}.jpg`,mimeType:'image/jpeg',buffer:Buffer.from(jpg,'base64')});await waitForReview();
   const total=await page.getByLabel('Итог чека',{exact:true}).inputValue(),choices=await page.locator('.receipt-total-options button').allTextContents();
   console.log('RESIZED RECEIPT',width,JSON.stringify({total,choices,raw:await page.getByLabel('Распознанный текст',{exact:true}).inputValue()}));
   assert.ok(total==='695.50'||!total&&choices.some(value=>value.replace(/[\s\u00a0]/g,'')==='695,50'),`resized ${width}px photo must recover the actual total, not lose it`);
   assert.equal(await page.getByLabel('Магазин',{exact:true}).inputValue(),'');await page.screenshot({path:`artifacts/receipt-check/curved-resized-${width}.png`});
  }
 }
 if(process.env.DAYRIS_RECEIPT_VISIBLE_SAMPLE){
  if(await page.locator('.receipt-dialog').isVisible())await page.getByRole('button',{name:'Закрыть чек',exact:true}).click();
  // Native pixels of the visible receipt region in the user's 591px screenshot.
  // Exclude application amounts/buttons: they cannot corroborate the receipt.
  const source=fs.readFileSync(process.env.DAYRIS_RECEIPT_VISIBLE_SAMPLE).toString('base64');
  const png=await page.evaluate(async source=>{const img=new Image();img.src='data:image/jpeg;base64,'+source;await img.decode();const canvas=document.createElement('canvas');canvas.width=234;canvas.height=216;canvas.getContext('2d').drawImage(img,179,194,234,216,0,0,234,216);return canvas.toDataURL('image/png').split(',')[1];},source);
  await page.locator('.receipt-file').first().setInputFiles({name:'visible-receipt.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});await waitForReview();
  const total=await page.getByLabel('Итог чека',{exact:true}).inputValue(),choices=await page.locator('.receipt-total-options button').allTextContents();console.log('VISIBLE RECEIPT',JSON.stringify({total,choices,raw:await page.getByLabel('Распознанный текст',{exact:true}).inputValue()}));
  assert.ok(!total||total==='695.50','a tiny screenshot preview must never silently select a wrong total');assert.equal(await page.getByRole('button',{name:'Сохранить расход',exact:true}).count(),0,'missing metadata or unreadable label still require review');await page.screenshot({path:'artifacts/receipt-check/visible-receipt-total.png'});
 }
 if(process.env.DAYRIS_RECEIPT_MOLDOVA_SCREEN){
  if(await page.locator('.receipt-dialog').isVisible())await page.getByRole('button',{name:'Закрыть чек',exact:true}).click();
  // Only the receipt photograph inside the supplied screenshot. Application
  // labels, status bar and buttons cannot serve as OCR evidence.
  const bytes=fs.readFileSync(process.env.DAYRIS_RECEIPT_MOLDOVA_SCREEN).toString('base64');
  const png=await page.evaluate(async base64=>{const image=await createImageBitmap(await fetch('data:image/jpeg;base64,'+base64).then(r=>r.blob())),canvas=document.createElement('canvas');canvas.width=405;canvas.height=539;canvas.getContext('2d').drawImage(image,97,276,405,539,0,0,405,539);image.close();return canvas.toDataURL('image/png').split(',')[1];},bytes);
  await page.locator('.receipt-file').first().setInputFiles({name:'moldova-distant.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});await waitForReview();
  let total=await page.getByLabel('Итог чека',{exact:true}).inputValue();assert.ok(!total||total==='44.70','a different number cannot silently become this receipt total');
  if(!total){await page.getByRole('button',{name:'Выбрать сумму 44,70',exact:true}).click();total=await page.getByLabel('Итог чека',{exact:true}).inputValue();}assert.equal(total,'44.70');
  await page.getByLabel('Валюта чека',{exact:true}).selectOption('MDL');await page.getByLabel('Дата чека',{exact:true}).fill('2026-10-23');assert.equal(await page.getByRole('checkbox').count(),0);
  assert.equal(await page.getByRole('button',{name:'Сохранить расход',exact:true}).isEnabled(),true,'saving is the only confirmation after fields are corrected');
  for(const width of[390,1280]){await page.setViewportSize({width,height:900});assert.equal(await page.locator('.receipt-scroll').evaluate(el=>el.scrollWidth<=el.clientWidth+1),true);await page.screenshot({path:`artifacts/receipt-check/moldova-4470-${width}.png`});}
  const before=writes.length;await page.getByRole('button',{name:'Сохранить расход',exact:true}).click();await page.locator('.receipt-success').waitFor();assert.equal(writes.length,before+1);assert.equal(writes.at(-1).pnl,-44.70);await page.getByRole('button',{name:'Готово',exact:true}).click();
  console.log('MOLDOVA: photograph pixels expose44.70; corrected date/currency save in one action without a photo checkbox.');
 }
 await page.setViewportSize({width:1280,height:900});await page.screenshot({path:'artifacts/receipt-check/full-app-desktop.png'});
 assert.equal(requests.some(item=>item.method==='POST' && !item.url.includes('supabase.co') && !item.url.startsWith(origin)),false,'photo is never sent to an OCR service');
 assert.equal(requests.some(item=>/cdn\.jsdelivr|unpkg/.test(item.url)),false,'engine/languages are same-origin');
 assert.deepEqual(errors,[]);console.log('PASS: production calendar, adjacent photo button, real local OCR, editable review, PRO checks, exact persistent expense, duplicate guard, no external OCR/CDN.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
