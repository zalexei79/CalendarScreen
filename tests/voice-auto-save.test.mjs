import test from 'node:test';
import assert from 'node:assert/strict';
import {voiceEntryReview} from '../src/shared/lib/voiceEntryReview.js';
import {canAutoSaveVoiceEntry} from '../src/shared/lib/voiceAutoSave.js';
const options={todayKey:'2026-10-04',defaultCurrency:'MDL',requireCategory:true};
const eligible=(phrase,evidence={isFinal:true,confidence:0.95},draft=null)=>canAutoSaveVoiceEntry(phrase,voiceEntryReview(phrase,draft,'ru',[],options),'ru',[],options,evidence);
test('complete explicit first phrases save in different word orders and currencies',()=>{
 for(const phrase of ['я сегодня потратил 50 лей на сок','потратил 50 лей на сок — на сок','на сок 50 лей потратил сегодня','получил 200 евро на зарплату вчера','потратил 30к лей на монитор'])assert.equal(eligible(phrase),true,phrase);
});
test('missing fields, shorthand, ambiguity, low confidence and interim text retain review',()=>{
 for(const phrase of ['потратил 50 лей','потратил 50 на сок','сок 50','потратил 50 и 80 лей на сок','не потратил 50 лей на сок','сколько потратил на сок'])assert.equal(eligible(phrase),false,phrase);
 assert.equal(eligible('потратил 50 лей на сок',{isFinal:false}),false);
 assert.equal(eligible('потратил 50 лей на сок',{isFinal:true,usedAlternative:true}),false);
 assert.equal(eligible('потратил 50 лей на сок',{isFinal:true,alternatives:['потратил 500 лей']}),false);
 assert.equal(eligible('потратил 50 лей на сок',{isFinal:true,confidence:0.4}),false);
 assert.equal(eligible('потратил 50 лей на сок',{isFinal:true,alternatives:['потратил 500 лей на сок']}),false);
});
test('corrections and mutations retain confirmation',()=>{
 const draft=voiceEntryReview('потратил 50 лей на сок',null,'ru',[],options).entry;
 assert.equal(eligible('нет, 350',{isFinal:true},draft),false);
 assert.equal(canAutoSaveVoiceEntry('потратил 50 лей на сок',{entry:{...draft,mutation:true}},'ru',[],options,{isFinal:true}),false);
});
