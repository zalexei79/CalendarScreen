import test from 'node:test';import assert from 'node:assert/strict';
import {voiceEntryDialog as dialog}from '../src/shared/lib/voiceEntryDialog.js';
import {saveVoiceDestinations}from '../src/shared/lib/saveVoiceDestinations.js';
const options={askDestination:true,defaultCurrency:'MDL',walletAvailable:true};
test('natural word order, suggested currency confirmation and destination',()=>{
 for(const phrase of ['я сегодня потратил 100','сегодня я потратил 100','я потратил сегодня 100']){const state=dialog(phrase,null,'ru',[],options);assert.equal(state.field,'currency');assert.equal(state.draft.amount,'100');}
 let state=dialog('я сегодня потратил',null,'ru',[],options);assert.equal(state.field,'amount');
 state=dialog('80',state.draft,'ru',[],options);assert.equal(state.field,'currency');assert.match(state.prompt,/леях/);
 state=dialog('да',state.draft,'ru',[],options);assert.equal(state.field,'destination');
 assert.equal(dialog('в календарь и в кошелёк',state.draft,'ru',[],options).command.destination,'both');
 assert.equal(dialog('кошелёк',state.draft,'ru',[],options).command.destination,'wallet');
 assert.equal(dialog('не в кошелёк',state.draft,'ru',[],options).field,'destination');
 assert.equal(dialog('я сегодня потратил 80 лей, запиши это в календарь',null,'ru',[],options).command.destination,'main');
});
test('FREE never routes to PRO wallet and destination stays explicit',()=>{
 const free={...options,walletAvailable:false};let state=dialog('потратил 80 лей',null,'ru',[],free);assert.equal(state.field,'destination');
 assert.equal(dialog('кошелёк',state.draft,'ru',[],free).field,'destination');
 assert.equal(dialog('да',state.draft,'ru',[],free).command.destination,'main');
});
test('partial dual save retries only the unfinished ledger and rejects changed fields',async()=>{
 const progress={};let wallets=0,calendars=0,fail=true;
 const request={destination:'both',key:'original',progress,saveWallet:async()=>wallets++,saveCalendar:async()=>{calendars++;if(fail)throw Error('failure');}};
 await assert.rejects(saveVoiceDestinations(request));assert.equal(wallets,1);
 await assert.rejects(saveVoiceDestinations({...request,key:'changed'}));assert.equal(wallets,1);
 fail=false;await saveVoiceDestinations(request);assert.equal(wallets,1);assert.equal(calendars,2);
 await saveVoiceDestinations(request);assert.equal(calendars,2);
});
