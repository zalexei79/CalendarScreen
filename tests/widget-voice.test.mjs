import test from 'node:test';
import assert from 'node:assert/strict';
import {widgetVoiceTurn as turn,widgetSettings,widgetLocale} from '../src/shared/lib/widgetVoiceConversation.js';
import {readWidgetHandshake,widgetSetupActive,finishWidgetSetup} from '../src/shared/lib/widgetPairing.js';
import {rememberWidgetDevice,revokeBoundWidgetDevices,widgetDisconnectError} from '../src/shared/lib/widgetDeviceBinding.js';
const settings={locale:'ru',currency:'MDL',categories:[{value:'Продукты',label:'Продукты'}]};
const config={settings,todayKey:'2026-10-08',now:1000000};
test('standalone complete utterances save automatically in all supported languages',()=>{
 for(const [locale,phrase,currency,amount] of [['ru','Я сегодня потратил 50 лей на сок','MDL','50'],['en','spent 50 dollars on juice','USD','50'],['ro','am cheltuit 50 lei pe suc','MDL','50'],['zh','今天花了50元买果汁','CNY','50'],['ru','получил 30к лей на зарплату','MDL','30000']]){
  const result=turn({...config,settings:{...settings,locale},phrase});assert.equal(result.status,'saved',phrase);assert.equal(result.entries[0].currency,currency);assert.equal(result.entries[0].amount,amount);
 }
});
test('a paused widget keeps the amount and answers only the missing category',()=>{
 const first=turn({...config,phrase:'вчера потратил 50 лей'});
 assert.equal(first.status,'clarify');assert.equal(first.context.draft.amount,'50');
 const next=turn({...config,phrase:'на сок',context:first.context,now:config.now+20000});
 assert.equal(next.status,'saved');assert.equal(next.entries[0].dateKey,'2026-10-07');assert.equal(next.entries[0].category,'сок');
});
test('low confidence and disagreeing alternatives require a spoken review',()=>{
 for(const evidence of [{confidence:.2},{alternatives:['потратил 70 лей на сок']}]){
  const first=turn({...config,phrase:'потратил 50 лей на сок',...evidence});assert.equal(first.status,'clarify');assert.equal(first.entries.length,0);
  const corrected=turn({...config,phrase:'нет не 50 лей а 70',context:first.context});assert.equal(corrected.context.entries[0].amount,'70');assert.equal(corrected.entries.length,0);
  const saved=turn({...config,phrase:'сохрани',context:corrected.context});assert.equal(saved.entries[0].amount,'70');assert.equal(saved.status,'saved');
 }
});
test('conflicting alternatives during a clarification cannot silently save the wrong purchase',()=>{
 const first=turn({...config,phrase:'потратил 50 лей'});
 const ambiguous=turn({...config,phrase:'на сок',alternatives:['на пиво'],context:first.context});
 assert.equal(ambiguous.status,'clarify');assert.equal(ambiguous.entries.length,0);assert.equal(ambiguous.context.entries[0].category,'сок');
 const saved=turn({...config,phrase:'сохрани',context:ambiguous.context});assert.equal(saved.entries[0].category,'сок');
});
test('several purchases share date/currency but save only after spoken confirmation',()=>{
 const first=turn({...config,phrase:'вчера потратил 50 лей на сок 40 лей на чипсы и 50 на бумагу'});
 assert.equal(first.status,'clarify');assert.equal(first.context.entries.length,3);assert.equal(first.entries.length,0);
 const corrected=turn({...config,phrase:'во второй записи нет не 40 а 70',context:first.context});assert.equal(corrected.context.entries[1].amount,'70');
 const saved=turn({...config,phrase:'готово',context:corrected.context});assert.deepEqual(saved.entries.map(entry=>entry.amount),['50','70','50']);
});
test('help, rejected phrases, cancellation, expired drafts and wallet routing never write entries',()=>{
 const first=turn({...config,phrase:'потратил 50 лей'});
 for(const phrase of ['что ты умеешь','не потратил 50 лей','случайный разговор','потратил 50 лей на сок в кошелек','завтра потратил 50 лей на сок']){
  const result=turn({...config,phrase,context:first.context});assert.equal(result.entries.length,0,phrase);
 }
 assert.equal(turn({...config,phrase:'отмена',context:first.context}).context,null);
 assert.equal(turn({...config,phrase:'на сок',context:first.context,now:config.now+600001}).entries.length,0);
 assert.equal(turn({...config,phrase:'сохрани'}).entries.length,0);
});
test('settings accept only scoped locale, currencies and small category labels',()=>{
 assert.deepEqual(widgetSettings({locale:'xx',currency:'INJECT',categories:[{value:'x'.repeat(100)},{value:'сок',label:'сок',type:'minus'}]}),{locale:'ru',currency:'MDL',categories:[{value:'сок',label:'сок',type:'minus'}]});
});
test('regional system locales retain localized pairing and logout messages',()=>{
 for(const [locale,expected] of [['en-US','en'],['ro-RO','ro'],['zh-CN','zh'],['ru-RU','ru']]){
  assert.equal(widgetLocale(locale),expected);assert.equal(widgetDisconnectError(locale),widgetDisconnectError(expected));
 }
});
test('pairing survives Google redirect, rejects foreign messages, and consumes its intent',()=>{
 const values=new Map(),storage={getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
 const location={href:'https://example.test/?widgetSetup=1&ref=friend#calendar',origin:'https://example.test'};
 assert.equal(widgetSetupActive(location,storage,100),true);
 const root={href:'https://example.test/',origin:location.origin};assert.equal(widgetSetupActive(root,storage,200),true);assert.equal(widgetSetupActive(root,storage,400000),false);
 const event={origin:location.origin,ports:[{postMessage(){}}],data:JSON.stringify({type:'dayris.widget.hello',nonce:'08e0b5d0-f4d7-4679-9c8a-bb60e5f40e73'})};
 assert.ok(readWidgetHandshake(event,location,true));assert.equal(readWidgetHandshake({...event,origin:'https://evil.test'},location,true),null);assert.equal(readWidgetHandshake(event,location,false),null);assert.equal(readWidgetHandshake({...event,ports:[]},location,true),null);
 let replaced;finishWidgetSetup(location,{state:null,replaceState:(_,__,path)=>replaced=path},storage);assert.equal(replaced,'/?ref=friend#calendar');assert.equal(values.size,0);
});
test('logout revokes only widgets paired in this browser and retains failed revocations for retry',async()=>{
 const values=new Map(),storage={getItem:async key=>values.get(key),setItem:async(key,value)=>values.set(key,value),removeItem:async key=>values.delete(key)};
 const device='94786c07-d9ce-4a7b-ab91-5371c3e3f19a';await rememberWidgetDevice('owner',device,storage);await rememberWidgetDevice('owner',device,storage);
 let revoked,fail=true;
 const client={auth:{getSession:async()=>({data:{session:{user:{id:'owner'}}}})},from:table=>{assert.equal(table,'voice_widget_devices');return {update:()=>({in:async(_,ids)=>{revoked=ids;return {error:fail?new Error():null};}})};}};
 await assert.rejects(revokeBoundWidgetDevices(client,'owner',storage),/WIDGET_DISCONNECT_FAILED/);assert.equal(values.size,1);
 fail=false;await revokeBoundWidgetDevices(client,'owner',storage);assert.deepEqual(revoked,[device]);assert.equal(values.size,0);
 await rememberWidgetDevice('owner',device,storage);client.auth.getSession=async()=>({data:{session:{user:{id:'different-owner'}}}});
 await assert.rejects(revokeBoundWidgetDevices(client,'owner',storage),/ACCOUNT_CHANGED/);assert.equal(values.size,1);
});
