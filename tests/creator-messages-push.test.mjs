import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {creatorNotificationPayload} from '../supabase/functions/send-reminders/creatorNotification.mjs';
const job={message_id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',delivery_id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',push_title:'Ваш подарок',push_body:'Спасибо! Откройте сообщение от создателя.'};
test('creator payload preserves authored text and validates IDs',()=>{
 assert.equal(creatorNotificationPayload(job).title,job.push_title);
 assert.equal(creatorNotificationPayload({...job,push_body:'я'.repeat(200)}).body.length,160);
 for(const bad of [{message_id:'-'.repeat(36)},{push_title:123},{push_body:' '}])assert.equal(creatorNotificationPayload({...job,...bad}),null);
});
test('creator push opens the exact inbox message without reminder actions',async()=>{
 const handlers={};let shown,opened,pending;
 vm.runInNewContext(readFileSync('public/sw.js','utf8'),{URL,self:{location:{origin:'https://dayris.test'},addEventListener:(n,h)=>handlers[n]=h,registration:{showNotification:(title,options)=>{shown={title,...options};return Promise.resolve();}},clients:{matchAll:async()=>[],openWindow:async url=>{opened=url;}}}});
 handlers.push({data:{json:()=>creatorNotificationPayload(job)},waitUntil:p=>pending=p});await pending;
 assert.equal(shown.title,job.push_title);assert.equal(shown.body,job.push_body);assert.equal(shown.actions.length,0);
 handlers.notificationclick({notification:{...shown,close(){}},action:'',waitUntil:p=>pending=p});await pending;
 assert.equal(opened,'https://dayris.test/?creatorMessage='+job.message_id);
});
