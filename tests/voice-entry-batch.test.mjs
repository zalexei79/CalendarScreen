import test from 'node:test';
import assert from 'node:assert/strict';
import {voiceEntryBatch as batch,saveVoiceBatch,voiceBatchHasProgress} from '../src/shared/lib/voiceEntryBatch.js';
import {voiceEntryReview} from '../src/shared/lib/voiceEntryReview.js';
import {parseSpokenAmount} from '../src/shared/lib/spokenAmount.js';
import {saveVoiceDestinations} from '../src/shared/lib/saveVoiceDestinations.js';
const options={todayKey:'2026-10-02',defaultCurrency:'MDL',walletAvailable:true};
const categories=[{value:'Продукты',label:'Продукты'},{value:'Кафе 24/7',label:'Кафе 24/7'},{value:'Еда и напитки',label:'Еда и напитки'}];
const parse=(phrase,state=null,config=options)=>batch(phrase,state,'ru',categories,config);
test('k is an explicit thousand multiplier, including decimals and spoken amounts',()=>{
 for(const [phrase,value] of [['30к','30000'],['30 К','30000'],['1,5k','1500'],['полтора к','1500'],['тридцать ка','30000'],['0.5к','500'],['30к лей','30000']]){
  assert.equal(parseSpokenAmount(phrase),value,phrase);assert.equal(voiceEntryReview(`потратил ${phrase} лей на монитор`,null,'ru',[],options).entry.amount,value,phrase);
 }
 assert.equal(voiceEntryReview('потратил два с половиной к лей на монитор',null,'ru',[],options).entry.amount,'2500');
 for(const phrase of ['30kk','30 к к','1000000000к','30кг','-30к'])assert.equal(parseSpokenAmount(phrase),null,phrase);
 assert.equal(voiceEntryReview('потратил 30кг на монитор',null,'ru',[],options).invalid,true);
 const state=voiceEntryReview('потратил 30к на монитор',null,'ru',[],options);assert.equal(state.field,'currency');assert.equal(state.draft.amount,'30000');
});
test('several entries retain separate amounts, categories and a shared explicit currency/date',()=>{
 for(const phrase of ['вчера потратил 80 лей на сок, 50 на такси и 200 на продукты','вчера потратил 80 лей на сок 50 на такси и 200 на продукты','80 на сок и 50 на такси и 200 лей на продукты вчера']){
  const state=parse(phrase);assert.ok(state.batch);assert.deepEqual(state.batch.states.map(item=>item.entry.amount),['80','50','200']);
  assert.deepEqual(state.batch.states.map(item=>item.entry.category),['сок','такси','Продукты']);assert.ok(state.batch.states.every(item=>item.entry.dateKey==='2026-10-01'&&item.entry.currency==='MDL'));
 }
});
test('one currency answer completes the entire list without copying an amount',()=>{
 const first=parse('80 на сок, 50 на такси и 200 на продукты');assert.equal(first.field,'currency');assert.match(first.prompt,/всех записей/);
 const next=parse('да',first.batch);assert.deepEqual(next.batch.states.map(state=>state.entry.amount),['80','50','200']);assert.ok(next.batch.states.every(state=>state.entry.currency==='MDL'));
});
test('mixed currencies, actions and per-entry dates remain independent',()=>{
 const state=parse('вчера потратил 80 лей на сок, сегодня получил 100 евро');assert.deepEqual(state.batch.states.map(item=>[item.entry.amount,item.entry.currency,item.entry.sign,item.entry.dateKey]),[['80','MDL','minus','2026-10-01'],['100','EUR','plus','2026-10-02']]);
 const chinese=batch('支出80元用于食品和收入100元',null,'zh',categories,options);assert.equal(chinese,null);
});
test('batch clarification retains a large k amount and shared FREE/date restrictions',()=>{
 let state=parse('потратил 30к лей на монитор и 80 на сок завтра');assert.equal(state.field,'date');state=parse('вчера',state.batch);assert.ok(state.batch.states.every(item=>item.entry.dateKey==='2026-10-01'));
 state=parse('30к лей на монитор и 80 на сок в кошелек',null,{...options,walletAvailable:false});assert.equal(state.field,'destination');
 state=parse('календарь',state.batch,{...options,walletAvailable:false});assert.ok(state.batch.states.every(item=>item.entry.destination==='main'));assert.equal(state.batch.states[0].entry.amount,'30000');
});
test('voice corrections can target a numbered entry and cancellation discards the whole list',()=>{
 const state=parse('80 лей на сок и 50 на такси');const corrected=parse('во второй записи сумма 100',state.batch);
 assert.deepEqual(corrected.batch.states.map(state=>state.entry.amount),['80','100']);assert.equal(corrected.batch.activeIndex,1);
 assert.equal(parse('не 100, а 120',corrected.batch).batch.states[1].entry.amount,'120');
 assert.equal(parse('во второй записи потратил на монитор',corrected.batch).batch.states[1].entry.category,'монитор');
 assert.equal(parse('в третьей записи сумма 100',state.batch).invalid,true);assert.equal(parse('отмена',state.batch).cancelled,true);
});
test('multiple unassigned amounts, numeric categories, decimals and queries are never arbitrary batches',()=>{
 for(const phrase of ['потратил 250 лей и 350 лей на продукты','на продукты вчера потратил 250 лей и 350 евро','потратил 30,50 лей на сок','потратил 30 лей 50 bani на сок','потратил 250 лей на кафе 24/7','потратил 250 лей на еда и напитки','сколько потратил 80 лей на сок и 50 на такси','потратил 80 лей на сок и удали запись'])assert.equal(parse(phrase),null,phrase);
});
test('a partial save retries only the unfinished row and ledger and freezes saved input',async()=>{
 const entries=parse('80 лей на сок и 50 на такси').batch.states.map(state=>state.entry),progress={},writes=[];let fail=true;
 const save=async(entry,row)=>saveVoiceDestinations({destination:'both',key:entry.amount,progress:row,saveWallet:async()=>writes.push('wallet '+entry.amount),saveCalendar:async()=>{if(entry.amount==='50'&&fail){fail=false;throw new Error('offline');}writes.push('calendar '+entry.amount);}});
 await assert.rejects(saveVoiceBatch(entries,progress,save),/offline/);assert.equal(progress.entries[0].done,true);assert.equal(progress.entries[1].wallet,true);assert.equal(voiceBatchHasProgress(progress),true);
 await assert.rejects(saveVoiceBatch([{...entries[0],amount:'99'},entries[1]],progress,save),/уже сохранена/);
 await saveVoiceBatch(entries,progress,save);assert.deepEqual(writes,['wallet 80','calendar 80','wallet 50','calendar 50']);assert.ok(progress.entries.every(row=>row.done));
});
