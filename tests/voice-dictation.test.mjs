import test from 'node:test';
import assert from 'node:assert/strict';
import {voiceDictation as dictate,isVoiceCommit} from '../src/shared/lib/voiceDictation.js';
import {voiceEntryBatch} from '../src/shared/lib/voiceEntryBatch.js';
const options={todayKey:'2026-10-04',defaultCurrency:'MDL'};
const example='потратил 70 лей на сок, 80 на пиво. Нет, на пиво не 80, а 50. Хотя нет, сегодня пиво не брал. Давай запишем только сок и лимонад. На сок потратил 50 лей, на лимонад 20';
test('the complete spoken example applies edits in order and waits for completion',()=>{
 const result=dictate(example,null,'ru',[],options);
 assert.equal(result.commitRequested,false);
 assert.deepEqual(result.batch.states.map(state=>[state.entry.category,state.entry.amount,state.entry.currency]),[['сок','50','MDL'],['лимонад','20','MDL']]);
 const spoken=example.replace(/[.,]/g,'');assert.deepEqual(dictate(spoken+' готово',null,'ru',[],options).batch.states.map(state=>state.entry.amount),['50','20']);
 const ready=dictate(`${example}. Готово`,null,'ru',[],options);assert.equal(ready.commitRequested,true);assert.equal(ready.batch.states.length,2);
});
test('the same operations can arrive in separate turns without changing the input',()=>{
 let batch=voiceEntryBatch('потратил 70 лей на сок, 80 на пиво',null,'ru',[],options).batch;
 const initial=JSON.stringify(batch);
 let result=dictate('Нет, на пиво не 80, а 50',batch,'ru',[],options);assert.equal(result.batch.states[1].entry.amount,'50');assert.equal(JSON.stringify(batch),initial);batch=result.batch;
 batch=dictate('Хотя нет, сегодня пиво не брал',batch,'ru',[],options).batch;assert.equal(batch.states.length,1);
 result=dictate('Давай запишем только сок и лимонад',batch,'ru',[],options);assert.equal(result.field,'amount');assert.equal(result.batch.states.length,2);batch=result.batch;
 batch=dictate('На сок потратил 50 лей, на лимонад 20',batch,'ru',[],options).batch;
 assert.deepEqual(batch.states.map(state=>state.entry.amount),['50','20']);assert.equal(dictate('Сохранить',batch,'ru',[],options).commitRequested,true);
});
test('ambiguous edits, missing amounts and category-free replies never invent entries',()=>{
 const batch=voiceEntryBatch('потратил 70 лей на сок, 80 на пиво',null,'ru',[],options).batch;
 assert.equal(dictate('на пиво не 90, а 50',batch,'ru',[],options).invalid,true);
 assert.equal(dictate('сегодня лимонад не брал',batch,'ru',[],options).invalid,true);
 assert.equal(dictate('нет, 350',batch,'ru',[],options),null);
 assert.equal(dictate('что записал вчера?',null,'ru',[],options),null);
 const pending=dictate('оставь только сок и лимонад',batch,'ru',[],options).batch;
 assert.ok(dictate('готово',pending,'ru',[],options).draft,'ready cannot make up a missing amount');
});
test('complete first entries are retained when adding the next named purchase',()=>{
 const batch=voiceEntryBatch('потратил 70 лей на сок, 80 на пиво',null,'ru',[],options).batch;
 const single={states:[batch.states[0]],activeIndex:0,commonFields:[]};
 const result=dictate('80 на пиво',single,'ru',[],options);assert.equal(result.batch.states.length,2);assert.equal(result.batch.states[1].entry.amount,'80');
 for(const phrase of ['готово','Сохрани всё','done','gata','保存'])assert.equal(isVoiceCommit(phrase),true);
});
