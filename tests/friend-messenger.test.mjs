import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createFriendKey,importFriendKey,lockFriendMessage,unlockFriendMessage,isLockedMessage,friendNote,readFriendNote,friendMessagePreview,friendWireSize} from '../src/features/messages/friendMessage.js';
const context={owner:'22222222-2222-4222-8222-222222222222',peer:'33333333-3333-4333-8333-333333333333',sender:'22222222-2222-4222-8222-222222222222',id:'44444444-4444-4444-8444-444444444444'};
test('shared keys are random, non-extractable AES keys and work from both accounts',async()=>{
 const code=createFriendKey(),secret=await importFriendKey(code),other=await importFriendKey(code);
 assert.match(code,/^DR1-[\w-]{43}$/);assert.notEqual(createFriendKey(),code);assert.equal(secret.key.extractable,false);assert.equal(secret.fingerprint,other.fingerprint);
 const text='Личный день 🤍\nДо встречи',body=await lockFriendMessage(text,secret.key,context);
 assert.ok(isLockedMessage(body));assert.ok(!body.includes('Личный'));assert.equal(body.length<=friendWireSize(text,true),true);
 assert.equal(await unlockFriendMessage(body,other.key,{...context,owner:context.peer,peer:context.owner}),text);
 assert.notEqual(await lockFriendMessage(text,secret.key,context),body);
});
test('wrong keys, altered ciphertext and replay into another identity fail closed',async()=>{
 const secret=await importFriendKey(createFriendKey()),wrong=await importFriendKey(createFriendKey()),body=await lockFriendMessage('Не показывать',secret.key,context);
 await assert.rejects(unlockFriendMessage(body,wrong.key,context));
 for(const override of [{peer:'different-peer'},{sender:context.peer},{id:'different-message'}])await assert.rejects(unlockFriendMessage(body,secret.key,{...context,...override}));
 const index=body.indexOf('\n')+8,tampered=body.slice(0,index)+(body[index]==='A'?'B':'A')+body.slice(index+1);
 await assert.rejects(unlockFriendMessage(tampered,secret.key,context));
 await assert.rejects(importFriendKey('123456'));await assert.rejects(unlockFriendMessage('DAYRIS_LOCK_V1\nwrong',secret.key,context));
});
test('quotes and Unicode respect the existing wire limit and encrypt as one payload',async()=>{
 const quote={id:'f:123',sender:context.peer,text:'Я закончил день'},payload=friendNote('Отлично! 🔥',quote),secret=await importFriendKey(createFriendKey());
 assert.deepEqual(readFriendNote(payload),{text:'Отлично! 🔥',reply:quote});
 assert.equal(friendMessagePreview(payload,{}),'Отлично! 🔥');
 const body=await lockFriendMessage(payload,secret.key,context);assert.deepEqual(readFriendNote(await unlockFriendMessage(body,secret.key,context)).reply,quote);
 const big='я'.repeat(800);assert.ok(friendWireSize(big,true)>2000);await assert.rejects(lockFriendMessage(big,secret.key,context),/MESSAGE_TOO_LONG/);
 assert.equal(readFriendNote('DAYRIS_NOTE_V1\n{"text":"x","reply":null}'),null);
 assert.equal(friendMessagePreview(body,{lockedMessage:'Protected'}),'Protected');
});
test('push notifications hide encrypted and quoted envelopes and retain friend navigation',async()=>{
 const handlers={};let shown,pending,opened;
 vm.runInNewContext(readFileSync('public/sw.js','utf8'),{URL,self:{location:{origin:'https://dayris.test'},addEventListener:(name,handler)=>handlers[name]=handler,registration:{showNotification:(title,options)=>{shown={title,...options};return Promise.resolve();}},clients:{matchAll:async()=>[],openWindow:async value=>{opened=value;}}}});
 for(const body of ['DAYRIS_LOCK_V1\nnot-plaintext','DAYRIS_NOTE_V1\n{"text":"private quote"}']){
  handlers.push({data:{json:()=>({type:'friend_message',friendId:context.peer,title:'Друг',body})},waitUntil:value=>pending=value});await pending;
  assert.equal(shown.body,'DAYRIS · Новое сообщение');assert.ok(!shown.body.includes('DAYRIS_LOCK'));assert.equal(shown.actions.length,0);
 }
 handlers.notificationclick({notification:{...shown,close(){}},action:'',waitUntil:value=>pending=value});await pending;assert.equal(opened,'https://dayris.test/?friendChat='+context.peer);
});
test('favorites, drafts and bookmark IDs are isolated by account and tolerate disabled storage',async()=>{
 const values=new Map();globalThis.localStorage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};globalThis.window={dispatchEvent(){}};
 const {readFavoriteFriends,toggleFavoriteFriend,readFriendDraft,saveFriendDraft,readSavedMessages,toggleSavedMessage}=await import('../src/features/social/friendWorkspace.js');
 toggleFavoriteFriend(context.owner,context.peer);assert.deepEqual(readFavoriteFriends(context.owner),[context.peer]);assert.deepEqual(readFavoriteFriends('other'),[]);
 saveFriendDraft(context.owner,context.peer,'Черновик');assert.equal(readFriendDraft('other',context.peer),'');assert.equal(readFriendDraft(context.owner,context.peer),'Черновик');saveFriendDraft(context.owner,context.peer,'');assert.equal(readFriendDraft(context.owner,context.peer),'');
 toggleSavedMessage(context.owner,context.peer,'f:one');assert.deepEqual(readSavedMessages(context.owner,context.peer),['f:one']);assert.deepEqual(readSavedMessages('other',context.peer),[]);
 globalThis.localStorage={getItem(){throw new Error('blocked');},setItem(){throw new Error('blocked');},removeItem(){throw new Error('blocked');}};assert.deepEqual(readFavoriteFriends(context.owner),[]);assert.doesNotThrow(()=>saveFriendDraft(context.owner,context.peer,'x'));
 delete globalThis.localStorage;delete globalThis.window;
});
