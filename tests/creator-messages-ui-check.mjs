import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import {installStoryAccount} from './life-story-auth-fixture.mjs';
const require=createRequire('C:/Users/aveel/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const browser=await require('playwright').chromium.launch({channel:'msedge',headless:true});
const recipient={id:'33333333-3333-4333-8333-333333333333',name:'Тестовый пользователь',email:'user@example.test'};
const body='Спасибо, что пользуетесь DAYRIS!\nДарю вам 30 дней PRO. <script>window.injected=1</script>';
let prepared,sends=0,mode='full',history=[];const errors=[];
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'});
 await context.route('**/*',async route=>{
  const url=new URL(route.request().url()),rpc=url.pathname.split('/rpc/')[1],args=rpc?route.request().postDataJSON()||{}:{};
  const json=data=>route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
  if(rpc==='admin_capabilities')return json({viewUsers:mode!=='denied',editUsers:mode==='full',design:true});
  if(rpc==='admin_list_users_activity')return json({users:[recipient],total:1});
  if(rpc==='admin_recent_entries')return json({rows:[],total:0});
  if(rpc==='admin_user_profile')return json(recipient);
  if(rpc==='admin_pro_state')return json({grants:[],subscriptions:[],server_now:new Date().toISOString()});
  if(rpc==='admin_streak_state')return json({current_days:0});
  if(rpc==='admin_campaign_history')return json({rows:history,total:history.length});
  if(rpc==='admin_prepare_campaign'){assert.equal(mode,'full');assert.equal(args.p_body,body);assert.equal(args.p_pro_amount,30);assert.equal(args.p_push_title,'Подарок от DAYRIS');prepared={id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',audience:args.p_audience,title:args.p_title,body:args.p_body,send_push:args.p_send_push,pro_amount:args.p_pro_amount,pro_unit:args.p_pro_unit,recipient_count:args.p_audience==='all'?4:1,push_users:1,push_devices:2,sample_users:[recipient]};return json(prepared);}
  if(rpc==='admin_send_campaign'){assert.equal(mode,'full');assert.equal(args.p_id,prepared.id);assert.equal(args.p_expected_count,prepared.recipient_count);sends++;history=[{...prepared,status:'sent',sent_at:new Date().toISOString(),read_count:0,push_accepted:0,push_pending:2,push_failed:0}];return json(history[0]);}
  if(url.origin!=='http://calendar.test')return route.abort();
  const root=path.resolve('dist'),file=path.resolve(root,'.'+url.pathname);
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||fs.statSync(file).isDirectory())return route.fulfill({status:404,body:''});
  return route.fulfill({contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html',body:fs.readFileSync(file)});
 });
 await installStoryAccount(context);const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://calendar.test/admin.html');await page.getByRole('button',{name:/Тестовый пользователь user@example.test/}).click();await page.getByRole('button',{name:'Написать пользователю',exact:true}).click();
 await page.getByRole('heading',{name:'Рассылка сообщений'}).waitFor();await page.locator('.admin-message-selected').getByText(recipient.id,{exact:true}).waitFor();
 await page.getByLabel('Текст сообщения ·').fill(body);await page.getByLabel('Также отправить push',{exact:true}).check();await page.getByLabel('Заголовок push ·').fill('Подарок от DAYRIS');await page.getByLabel('Текст push ·').fill('Откройте ваш подарок');await page.getByLabel('Выдать или продлить PRO вместе с сообщением').check();
 await page.screenshot({path:'artifacts/admin-messages-desktop.png',fullPage:true});
 await page.getByRole('button',{name:'Проверить перед отправкой'}).click();const dialog=page.getByRole('dialog');await dialog.getByRole('heading',{name:'Подтвердить рассылку'}).waitFor();await dialog.getByRole('button',{name:'Назад',exact:true}).click();assert.equal(sends,0);
 await page.getByLabel('Получатели',{exact:true}).selectOption('all');await page.getByRole('button',{name:'Проверить перед отправкой'}).click();assert.equal(await dialog.getByRole('button',{name:'Отправить рассылку',exact:true}).isDisabled(),true);await dialog.getByRole('button',{name:'Назад',exact:true}).click();assert.equal(sends,0);
 for(const width of [390,320]){await page.setViewportSize({width,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:`artifacts/admin-messages-${width}.png`,fullPage:true});}
 await page.getByRole('button',{name:'Проверить перед отправкой'}).click();await dialog.getByLabel(/Подтверждаю отправку всем/).check();await dialog.getByRole('button',{name:'Отправить рассылку',exact:true}).click();await page.getByRole('button',{name:'Новая рассылка',exact:true}).waitFor();assert.equal(sends,1);assert.equal(await page.evaluate(()=>window.injected),undefined);
 mode='reader';await page.goto('http://calendar.test/admin.html?section=messages');await page.getByText(/Режим просмотра: отправка/).waitFor();assert.equal(await page.getByRole('button',{name:'Проверить перед отправкой'}).count(),0);
 mode='denied';await page.reload();await page.getByRole('heading',{name:'Нужен доступ к данным пользователей'}).waitFor();await context.close();
 const bundled=await createRequire(path.resolve('package.json'))('esbuild').build({entryPoints:['tests/creator-messages-ui.jsx'],bundle:true,write:false,outfile:'fixture.js',format:'iife',define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'fixture-rpc',setup(build){build.onResolve({filter:/supabaseClient$/},()=>({path:'rpc',namespace:'fixture'}));build.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export const supabase={rpc:(...args)=>window.fixtureRpc(...args)}',loader:'js'}));}}]});
 const js=bundled.outputFiles.find(f=>f.path.endsWith('.js')).text,css=bundled.outputFiles.find(f=>f.path.endsWith('.css')).text;
 const inbox=await browser.newContext({viewport:{width:1280,height:900},serviceWorkers:'block'});await inbox.addInitScript(({body})=>{window.inboxUser='user-a';window.read=false;window.fixtureRpc=async(name,args)=>{const m={id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',title:'Личный подарок',body,pro_until:'2027-01-01T00:00:00Z',created_at:'2026-10-29T12:00:00Z',read_at:window.read?'2026-10-29T12:05:00Z':null};if(name==='creator_ack_message'){window.read=true;return {error:null};}if(window.inboxUser!=='user-a')return {data:name==='creator_inbox'?{messages:[],total:0,unread_count:0}:null};if(name==='creator_inbox')return {data:{messages:[m],total:1,unread_count:window.read?0:1}};return {data:m};};},{body});
 await inbox.route('**/*',r=>r.fulfill({contentType:'text/html',body:`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{background:#101a17;color:#eee;font-family:system-ui}main{max-width:600px;margin:40px auto}${css}</style><div id="root"></div><script>${js}</script>`}));
 const userPage=await inbox.newPage();userPage.on('pageerror',e=>errors.push(e.message));await userPage.goto('http://inbox.test/?creatorMessage=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');await userPage.getByRole('dialog').getByRole('heading',{name:'Личный подарок'}).waitFor();await userPage.waitForFunction(()=>!location.search.includes('creatorMessage'));assert.equal(await userPage.evaluate(()=>window.injected),undefined);await userPage.screenshot({path:'artifacts/creator-inbox-desktop.png'});
 await userPage.setViewportSize({width:390,height:844});await userPage.screenshot({path:'artifacts/creator-inbox-mobile.png'});assert.equal(await userPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await userPage.getByRole('button',{name:'Прочитано',exact:true}).click();await userPage.getByRole('dialog').getByRole('button',{name:'Прочитано',exact:true}).waitFor({state:'detached'});await userPage.getByRole('button',{name:'Закрыть',exact:true}).click();await userPage.locator('.creator-gift-note').getByRole('button').click();await userPage.getByRole('dialog').waitFor();
 await userPage.evaluate(()=>{window.inboxUser='user-b';window.changeMessageAccount('user-b');});await userPage.getByRole('dialog').waitFor({state:'detached'});await userPage.locator('.creator-gift-note').waitFor({state:'detached'});await userPage.locator('.creator-messages-button').click();await userPage.getByText('Сообщений пока нет',{exact:true}).waitFor();assert.equal(await userPage.getByText(body,{exact:true}).count(),0);
 assert.deepEqual(errors,[]);console.log('PASS: admin single/all confirmation, gift/push preview, read-only/denied; recipient inbox, safe plain text, deep link, persistent gift and account isolation. Mock data only.');
}finally{await browser.close();}
