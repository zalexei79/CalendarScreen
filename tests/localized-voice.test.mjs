import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCalendarVoiceCommand as parse} from '../src/shared/lib/calendarVoiceCommand.js';
import {resolveLocalizedCategory} from '../src/shared/lib/voiceCategory.js';
test('English and Romanian commands cover navigation, categories and finance',()=>{
 for(const phrase of ['Create a category Beer','Creează categoria Bere'])assert.equal(parse(phrase).type,'category');
 for(const phrase of ['How much earned this month','Cât am câștigat luna aceasta'])assert.deepEqual(parse(phrase),{type:'question',metric:'income',period:'current-month'});
 for(const phrase of ['How much did I spend on beer this month','Cât am cheltuit pe bere luna aceasta'])assert.equal(parse(phrase).category,phrase.includes('beer')?'beer':'bere');
 for(const phrase of ['Deschide portofelul','Intră în portofel'])assert.equal(parse(phrase).type,'wallet');
 assert.deepEqual(parse('Activează modul pro'),{type:'pro',enabled:true});
 assert.deepEqual(parse('Dezactivează modul pro'),{type:'pro',enabled:false});
 assert.deepEqual(parse('Treci la luna următoare'),{type:'month',direction:1});
 assert.deepEqual(parse('Luna precedentă'),{type:'month',direction:-1});
 for(const phrase of ['Record I spent eighty lei on beer','Înregistrează am cheltuit optzeci de lei pe bere']){const result=parse(phrase);assert.equal(result.amount,'80');assert.equal(result.currency,'MDL');assert.equal(result.sign,'minus');}
 assert.equal(parse('Am cheltuit douăzeci și cinci virgulă cinci lei pe țigări').amount,'25.5');
 assert.equal(parse('Am cheltuit douăzeci și cinci lei pe țigări').category,'țigări');
 assert.deepEqual(parse('How much did I spend on beer last month'),{type:'question',metric:'expense',period:'last-month',category:'beer'});
});
test('translated categories reuse canonical records and preserve custom categories',()=>{
 const categories=[{key:'Сигареты',en:'Tobacco',ro:'Tutun'},{key:'Покупки',en:'Shopping',ro:'Cumpărături'}];
 for(const name of ['Tobacco','Tutun','cigarettes','țigări'])assert.equal(resolveLocalizedCategory(name,categories,['Сигареты']), 'Сигареты');
 assert.equal(resolveLocalizedCategory('Cumparaturi',categories,[]),'Покупки');
 assert.equal(resolveLocalizedCategory('Coffee',categories,['Coffee']),'Coffee');
});
