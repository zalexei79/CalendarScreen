import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import {installStoryAccount} from './life-story-auth-fixture.mjs';
const require=createRequire('C:/Users/aveel/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const browser=await require('playwright').chromium.launch({channel:'msedge',headless:true});
const user={id:'1002cf63-5bea-4dd0-bff9-9553eedf4659',name:'Telegram test',email:null};
let grants=[],mode='full',writes=0,filter='';const errors=[];
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'});
 await context.route('**/*',async route=>{
  const url=new URL(route.request().url()),rpc=url.pathname.split('/rpc/')[1];
  const json=data=>route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
  const args=rpc?route.request().postDataJSON()||{}:{};
  if(rpc==='admin_capabilities')return json({viewUsers:mode!=='denied',editUsers:mode==='full',design:true});
  if(rpc==='admin_list_users_activity')return json({users:[],total:0});
  if(rpc==='admin_recent_entries')return json({rows:[],total:0});
  if(rpc==='admin_list_pro'){filter=args.p_filter;const users=filter==='all'||grants.length?[{...user,active_until:grants.at(-1)?.ends_at}]:[];return json({users,total:users.length,server_now:new Date().toISOString()});}
  if(rpc==='admin_pro_state')return json({grants,subscriptions:[],server_now:new Date().toISOString()});
  if(rpc==='admin_change_pro'){
   assert.equal(mode,'full');assert.equal(args.p_user_id,user.id);assert.deepEqual(args.p_expected,{grants,subscriptions:[]});assert.equal(args.p_reason,args.p_action==='extend'?'':'Подарок Telegram пользователю');writes++;
   if(args.p_action==='extend'){assert.equal(args.p_amount,77);assert.equal(args.p_unit,'years');grants=[{user_id:user.id,source:'admin',starts_at:new Date().toISOString(),ends_at:'2103-10-20T12:00:00Z'}];}else grants=[];
   return json({grants,server_now:new Date().toISOString()});
  }
  if(url.origin!=='http://calendar.test')return route.abort();
  const root=path.resolve('dist'),file=path.resolve(root,'.'+url.pathname);
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||fs.statSync(file).isDirectory())return route.fulfill({status:404,body:''});
  return route.fulfill({contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.webmanifest')?'application/manifest+json':'text/html',body:fs.readFileSync(file)});
 });
 await installStoryAccount(context);const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://calendar.test/admin.html');await page.getByRole('button',{name:'PRO',exact:true}).click();
 await page.getByText('Пользователи не найдены. Для выдачи выберите «Все пользователи».',{exact:true}).waitFor();assert.equal(filter,'active');
 await page.getByLabel('Показать',{exact:true}).selectOption('all');
 await page.getByLabel('Поиск PRO-пользователя').fill(user.id);await page.getByRole('button',{name:'Найти',exact:true}).click();
 await page.getByRole('button',{name:/Telegram test/}).click();
 await page.getByRole('button',{name:'77 лет',exact:true}).click();
 await page.getByRole('button',{name:'Выдать PRO',exact:true}).click();
 const dialog=page.getByRole('dialog');await dialog.getByRole('button',{name:'Отмена',exact:true}).click();assert.equal(writes,0);
 await page.getByRole('button',{name:'Выдать PRO',exact:true}).click();await dialog.getByRole('button',{name:'Подтвердить изменение PRO'}).click();
 await page.getByRole('button',{name:'Продлить PRO',exact:true}).waitFor();assert.equal(writes,1);
 await page.screenshot({path:'tests/admin-pro-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.screenshot({path:'tests/admin-pro-mobile.png',fullPage:true});
 await page.getByLabel('Причина изменения PRO').fill('Подарок Telegram пользователю');
 await page.getByRole('button',{name:'Отключить PRO',exact:true}).click();await dialog.getByText(/Возврат денег/).waitFor();await dialog.getByRole('button',{name:'Подтвердить изменение PRO'}).click();
 await page.getByRole('button',{name:'Выдать PRO',exact:true}).waitFor();assert.equal(writes,2);
 mode='reader';await page.reload();await page.getByRole('button',{name:'PRO',exact:true}).click();await page.getByLabel('Показать',{exact:true}).selectOption('all');await page.getByRole('button',{name:/Telegram test/}).click();await page.getByRole('heading',{name:'PRO не активен',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Выдать PRO',exact:true}).count(),0);
 mode='denied';await page.reload();await page.getByRole('button',{name:'PRO',exact:true}).click();await page.getByRole('heading',{name:'Нужен доступ к данным пользователей'}).waitFor();
 assert.deepEqual(errors,[]);console.log('PASS: PRO grant, 77 years, confirmation cancellation, revoke, mobile, reader and denied role. Mock accounts only.');
}finally{await browser.close();}
