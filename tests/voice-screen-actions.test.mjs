import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import * as categories from '../src/shared/lib/voiceCategory.js';
const source=fs.readFileSync('CalendarScreen.jsx','utf8');
const names=source.match(/import \{([^}]+)\} from '\.\/src\/shared\/lib\/voiceCategory.js'/)[1].split(',').map(v=>v.trim());
const classifier=source.slice(source.indexOf('  function isTradingHistoryRecord(item)'),source.indexOf('  const historyFilteredTrades'));
test('actual screen classification resolves custom categories with its actual imports',()=>{
 const classify=new Function(...names,'voiceCategories','getMoneyCategoryMeta',`${classifier};return isTradingHistoryRecord;`)(...names.map(name=>categories[name]),{categories:['Пиво']},()=>null);
 assert.equal(classify({instrument:'Пиво'}),false);assert.equal(classify({instrument:'Пиво',platform:'cTrader'}),true);
});
test('actual screen navigation executes before custom category calculations',()=>{
 const section=source.slice(source.indexOf('  function handleCalendarVoiceCommand(command) {'),source.indexOf('            const categoryNames = moneyCategoryNames;',source.indexOf('  function handleCalendarVoiceCommand(command) {')));
 const body=section.slice(section.indexOf('{')+1);
 let action='';
 const execute=new Function('command','language','openHistory','openSettings',body);
 execute({type:'history'},'ru',()=>action='history',()=>action='settings');assert.equal(action,'history');
 execute({type:'settings'},'ru',()=>action='history',()=>action='settings');assert.equal(action,'settings');
});
