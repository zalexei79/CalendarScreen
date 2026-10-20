import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parse} from '@babel/parser';
import {TRANSLATIONS,translate,monthsFor} from '../src/shared/i18n/index.js';
import {localeKey,intlLocale} from '../src/shared/i18n/locale.js';
import {weekdaysFor} from '../src/shared/i18n/weekdays.js';
import * as ukCalendar from '../src/shared/i18n/ukCalendar.js';
import {getProOfferCopy} from '../src/features/pro/proOfferCopy.js';
import {PLANNER_COPY,plannerLanguage} from '../src/features/reminders/plannerCopy.js';
import {parseSpokenAmount} from '../src/shared/lib/spokenAmount.js';
import {voiceCurrencyFor} from '../src/shared/lib/voiceMoneyVocabulary.js';
import {widgetSettings} from '../src/shared/lib/widgetVoiceConversation.js';
import {parseReceipt} from '../src/features/receipts/receiptModel.js';

test('Ukrainian has complete interface keys and preserves interpolation arguments',()=>{
 assert.deepEqual(Object.keys(TRANSLATIONS.uk).sort(),Object.keys(TRANSLATIONS.ru).sort());
 for(const [key,value]of Object.entries(TRANSLATIONS.ru))assert.deepEqual(TRANSLATIONS.uk[key].match(/\{\d+\}/g)||[],value.match(/\{\d+\}/g)||[],key);
 assert.equal(translate('uk-UA','history'),'Історія');
 for(const language of ['uk','uk-UA','uk_UA']){assert.equal(localeKey(language),'uk');assert.equal(intlLocale(language),'uk-UA');}
 assert.equal(monthsFor('uk')[9],'Жовтень');assert.equal(weekdaysFor('uk')[6],'Нд');
 assert.equal(monthsFor('ru')[9],'Октябрь');assert.equal(weekdaysFor('en')[6],'Sun');
});
test('every inline calendar dictionary includes complete Ukrainian keys',()=>{
 const ast=parse(fs.readFileSync('CalendarScreen.jsx','utf8'),{sourceType:'module',plugins:['jsx']});let count=0;
 function walk(node){if(!node||typeof node!=='object')return;
  if(node.type==='VariableDeclarator'&&ukCalendar[node.id?.name]){
   const entries=node.init.object.properties,ru=entries.find(p=>p.key?.name==='ru'),uk=entries.find(p=>p.key?.name==='uk');
   assert.ok(uk,node.id.name);assert.deepEqual(Object.keys(ukCalendar[node.id.name]).sort(),ru.value.properties.map(p=>p.key.name).sort(),node.id.name);count++;
  }
  for(const value of Object.values(node))if(Array.isArray(value))value.forEach(walk);else if(value&&typeof value==='object')walk(value);
 }walk(ast);assert.equal(count,6);
});
test('Ukrainian planner and PRO include every field',()=>{
 assert.equal(plannerLanguage('uk-UA'),'uk');
 assert.deepEqual(Object.keys(PLANNER_COPY.uk).sort(),Object.keys(PLANNER_COPY.ru).sort());
 assert.deepEqual(Object.keys(getProOfferCopy('uk')).sort(),Object.keys(getProOfferCopy('ru')).sort());
});
test('hryvnia voice aliases and Ukrainian spoken amounts retain exact values',()=>{
 for(const word of ['гривня','гривні','гривень','гривен','UAH','₴'])assert.equal(voiceCurrencyFor(word),'UAH');
 for(const [text,amount]of [['125 гривень','125'],['сто двадцять п’ять гривень','125'],['двісті п’ятдесят гривень','250'],['₴125.50','125.5']])assert.equal(parseSpokenAmount(text),amount,text);
 assert.equal(parseSpokenAmount('мінус сто гривень'),null);
 assert.equal(parseSpokenAmount('дві тисячі п’ятсот гривень'),'2500');
 assert.equal(parseSpokenAmount('десять гривень п’ятдесят копійок'),'10.5');
 assert.equal(widgetSettings({currency:'UAH'}).currency,'UAH');
 assert.equal(parseReceipt('МАГАЗИН\nХЛІБ 25.00\nTOTAL 25.00 UAH').currency,'UAH');
});
