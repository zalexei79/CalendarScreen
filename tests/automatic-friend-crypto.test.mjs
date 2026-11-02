import test from 'node:test';
import assert from 'node:assert/strict';
import {createDeviceIdentity,createConversationKey,wrapConversationKey,unwrapConversationKey,encryptAutomaticMessage,decryptAutomaticMessage,automaticEpoch,encodeBytes} from '../src/features/messages/automaticChatCrypto.js';
import {createAutomaticChat,registerFriendDevice} from '../src/features/messages/automaticChatSession.js';
const alice='11111111-1111-4111-8111-111111111111',bob='22222222-2222-4222-8222-222222222222',eve='33333333-3333-4333-8333-333333333333';
function memoryStore(){const values=new Map(),devices=new Map();return {values,get:async key=>values.get(key),put:async(key,value)=>values.set(key,value),delete:async key=>values.delete(key),identity:async owner=>{if(!devices.has(owner))devices.set(owner,createDeviceIdentity(owner));return devices.get(owner);}};}
function server(){const devices=new Map(),epochs=new Map(),requests=[];return {requests,devices,epochs,client(actor){return {rpc:async(name,args)=>{requests.push({name,args:structuredClone(args)});if(args.p_owner!==actor)return {error:{code:'42501'}};if(name==='friend_chat_register_device'){const previous=devices.get(args.p_device);if(previous&&(previous.owner_id!==actor||previous.public_key!==args.p_public_key))return {error:{code:'42501'}};devices.set(args.p_device,{id:args.p_device,owner_id:actor,public_key:args.p_public_key});return {data:{owner_id:actor,device_id:args.p_device}};}
 if(name==='friend_chat_keyring'){const available=[...devices.values()].filter(d=>[actor,args.p_peer].includes(d.owner_id));const matches=[...epochs.entries()].filter(([id,e])=>e.pair.includes(actor)&&e.pair.includes(args.p_peer)&&(!args.p_epochs||args.p_epochs.includes(id)));return {data:{owner_id:actor,devices:available,epochs:matches.map(([id,e])=>({id,delivered:[...e.packets.keys()]})),packets:matches.flatMap(([id,e])=>{const p=e.packets.get(args.p_device);return p?[{...p,epoch_id:id,public_key:devices.get(p.sender_device).public_key}]:[];})}};}
 if(name==='friend_chat_publish_keys'){if(!epochs.has(args.p_epoch))epochs.set(args.p_epoch,{pair:[actor,args.p_peer],packets:new Map()});const epoch=epochs.get(args.p_epoch);for(const packet of args.p_packets)if(!epoch.packets.has(packet.recipient_device))epoch.packets.set(packet.recipient_device,{...packet,sender_device:args.p_device});return {data:{owner_id:actor,epoch_id:args.p_epoch}};}
 throw new Error('Unexpected RPC '+name);}};}};}
test('automatic device agreement wraps a key without publishing private material',async()=>{
 const a=await createDeviceIdentity(alice),b=await createDeviceIdentity(bob),e=await createDeviceIdentity(eve),key=await createConversationKey(),epoch=crypto.randomUUID(),context={owner:alice,peer:bob,epoch};
 assert.equal(a.privateKey.extractable,false);assert.equal(a.draftKey.extractable,false);assert.equal(a.publicKey.length,87);
 const packet={epoch_id:epoch,sender_device:a.id,recipient_device:b.id,public_key:a.publicKey,wrapped_key:await wrapConversationKey(key,a,{id:b.id,public_key:b.publicKey},context)};
 assert.equal(packet.wrapped_key.length,54);const opened=await unwrapConversationKey(packet,b,{...context,owner:bob,peer:alice}),id=crypto.randomUUID();
 const body=await encryptAutomaticMessage('Автоматически 🤍',key,{...context,id,sender:alice});assert.equal(await decryptAutomaticMessage(body,opened,{...context,owner:bob,peer:alice,id,sender:alice}),'Автоматически 🤍');
 await assert.rejects(unwrapConversationKey(packet,e,context));await assert.rejects(unwrapConversationKey({...packet,wrapped_key:(packet.wrapped_key[0]==='A'?'B':'A')+packet.wrapped_key.slice(1)},b,context));
 for(const change of [{id:crypto.randomUUID()},{epoch:crypto.randomUUID()},{sender:bob},{peer:eve}])await assert.rejects(decryptAutomaticMessage(body,opened,{...context,id,sender:alice,...change}));
 assert.ok(!JSON.stringify(packet).includes(encodeBytes(await crypto.subtle.exportKey('raw',key))));assert.ok(!body.includes('Автоматически'));
});
test('two users reopen, exchange messages and restore history to a new device without codes',async()=>{
 globalThis.window={dispatchEvent(){}};globalThis.localStorage={getItem(){return null;},setItem(){},removeItem(){}};
 try{const cloud=server(),aStore=memoryStore(),bStore=memoryStore(),aClient=cloud.client(alice),bClient=cloud.client(bob);await registerFriendDevice(bClient,bob,bStore);
 const a=createAutomaticChat(aClient,alice,bob,aStore);assert.equal((await a.sync()).ready,true);const id=crypto.randomUUID(),body=await a.encrypt('Первое сообщение',id),message={id,body,sender_id:alice,entry_key:'f:'+id};
 const b=createAutomaticChat(bClient,bob,alice,bStore);await b.sync([automaticEpoch(body)]);assert.equal(await b.decrypt(message),'Первое сообщение');
 await a.saveDraft('Личный черновик');assert.equal(await a.loadDraft(),'Личный черновик');assert.ok(!JSON.stringify([...aStore.values]).includes('Личный черновик'));
 a.forget();const reopened=createAutomaticChat(aClient,alice,bob,aStore);await reopened.sync([automaticEpoch(body)]);assert.equal(await reopened.decrypt(message),'Первое сообщение');assert.equal(await reopened.loadDraft(),'Личный черновик');
 const freshStore=memoryStore(),fresh=createAutomaticChat(cloud.client(alice),alice,bob,freshStore);await fresh.sync([automaticEpoch(body)]);await assert.rejects(fresh.decrypt(message),/KEY_NOT_AVAILABLE/);await b.sync();await fresh.sync([automaticEpoch(body)]);assert.equal(await fresh.decrypt(message),'Первое сообщение');
 const replyId=crypto.randomUUID(),reply=await b.encrypt('Ответ друга',replyId);await fresh.sync([automaticEpoch(reply)]);assert.equal(await fresh.decrypt({id:replyId,body:reply,sender_id:bob}),'Ответ друга');
 assert.ok(!JSON.stringify(cloud.requests).includes('Первое сообщение'));assert.ok(!JSON.stringify(cloud.requests).includes('Личный черновик'));assert.ok(!JSON.stringify(cloud.requests).includes('privateKey'));
 }finally{delete globalThis.window;delete globalThis.localStorage;}
});
test('unregistered peers never cause plaintext fallback, and long Unicode messages retain their limit',async()=>{
 const cloud=server(),a=createAutomaticChat(cloud.client(alice),alice,bob,memoryStore());assert.equal((await a.sync()).status,'waiting');await assert.rejects(a.encrypt('Не отправлять открытым текстом',crypto.randomUUID()),/PEER_NOT_READY/);
 const key=await createConversationKey(),context={owner:alice,peer:bob,sender:alice,id:crypto.randomUUID(),epoch:crypto.randomUUID()},text='я'.repeat(2000),body=await encryptAutomaticMessage(text,key,context);assert.ok(body.length>2000&&body.length<12000);assert.equal(await decryptAutomaticMessage(body,key,context),text);
});
