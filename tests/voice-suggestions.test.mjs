import test from 'node:test';
import assert from 'node:assert/strict';
import {voiceSuggestions} from '../src/shared/lib/voiceSuggestions.js';
import {voiceEntryReview} from '../src/shared/lib/voiceEntryReview.js';

const draft={type:'entry',kind:'record',amount:'80',currency:'MDL',sign:'minus',dateKey:'2026-10-01',destination:'main'};
test('expense hints narrow down with partial recognition and filled fields',()=>{
 const empty=voiceSuggestions('ru',false);assert.equal(empty.filtered,false);assert.equal(empty.groups.length,4);
 let help=voiceSuggestions('ru',false,{phrase:'потратил'});assert.equal(help.filtered,true);assert.ok(help.phrases.includes('[сумма] [валюта]'));assert.ok(help.phrases.includes('на [категория]'));assert.doesNotMatch(help.phrases.join(' '),/Получил|Открой|Сколько|кошел/);
 help=voiceSuggestions('ru',false,{phrase:'потратил 80'});assert.ok(help.phrases.includes('[валюта]'));assert.doesNotMatch(help.phrases.join(' '),/сумма/);
 help=voiceSuggestions('ru',false,{phrase:'потратил 80 лей на сок вчера'});assert.doesNotMatch(help.phrases.join(' '),/сумма|валюта|категория|вчера/);
 help=voiceSuggestions('ru',false,{phrase:'потратил',walletAvailable:true});assert.match(help.phrases.join(' '),/кошелёк/);
 assert.equal(voiceSuggestions('ru',false,{phrase:''}).filtered,false,'clearing speech restores all help');
});
test('questions and navigation do not become expense continuation hints',()=>{
 const question=voiceSuggestions('ru',false,{phrase:'сколько потратил'});assert.ok(question.phrases.length);assert.ok(question.phrases.every(phrase=>phrase.startsWith('Сколько')));
 const nav=voiceSuggestions('ru',false,{phrase:'открой настройки'});assert.deepEqual(nav.phrases,['Открой настройки']);
 const unknown=voiceSuggestions('ru',false,{phrase:'космический корабль'});assert.equal(unknown.filtered,true);assert.deepEqual(unknown.phrases,[]);assert.ok(unknown.empty);
});
test('review corrections keep existing money fields and use arbitrary categories',()=>{
 for(const phrase of ['потратил на сок','на сок','это на сок']){
  assert.deepEqual(voiceEntryReview(phrase,draft,'ru',[],{walletAvailable:true}).entry,{...draft,category:'сок'},phrase);
 }
 assert.deepEqual(voiceEntryReview('потратил на сок',draft,'ru',[{value:'Сок',label:'Сок'}],{walletAvailable:true}).entry,{...draft,category:'Сок'});
 const help=voiceSuggestions('ru',false,{phrase:'потратил на сок',draft,review:true});assert.doesNotMatch(help.phrases.join(' '),/валюта|дата|категория/);assert.match(help.phrases.join(' '),/сохрани/);
 assert.match(voiceSuggestions('ru',false,{draft,review:true}).phrases.join(' '),/потратил на/);
});
test('expense continuation hints use the selected app language',()=>{
 for(const [locale,phrase,currency] of [['en','spent 80','[currency]'],['ro','am cheltuit 80','[monedă]']])assert.ok(voiceSuggestions(locale,false,{phrase}).phrases.includes(currency));
 assert.match(voiceSuggestions('zh',false,{phrase:'支出'}).phrases.join(' '),/金额/);
});
