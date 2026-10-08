import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import * as categories from '../src/shared/lib/voiceCategory.js';
import {parseCalendarVoiceCommand} from '../src/shared/lib/calendarVoiceCommand.js';
const source=fs.readFileSync('CalendarScreen.jsx','utf8');
const names=source.match(/import \{([^}]+)\} from '\.\/src\/shared\/lib\/voiceCategory.js'/)[1].split(',').map(v=>v.trim());
const classifier=source.match(/  function isTradingHistoryRecord\(item\) \{[\s\S]*?\n  \}/)?.[0];
assert.ok(classifier,'the screen classification function must be present');
test('actual screen classification resolves custom categories with its actual imports',()=>{
 const classify=new Function(...names,'voiceCategories','getMoneyCategoryMeta',`${classifier};return isTradingHistoryRecord;`)(...names.map(name=>categories[name]),{categories:['Пиво']},()=>null);
 assert.equal(classify({instrument:'Пиво'}),false);assert.equal(classify({instrument:'Пиво',platform:'cTrader'}),true);
});
test('actual screen navigation executes before custom category calculations',()=>{
 const section=source.slice(source.indexOf('  function handleCalendarVoiceCommand(command) {'),source.indexOf('            const categoryNames = moneyCategoryNames;',source.indexOf('  function handleCalendarVoiceCommand(command) {')));
 const body=section.slice(section.indexOf('{')+1);
 let action='';
 const execute=new Function('command','language','openHistory','openSettings','validUserId','todayKey','requestLogin','getEntryCopy',body);
 for(const [phrase,target] of [['Бро, откройте историю','history'],['Ну, можно открыть настройки, плиз','settings']]){
  execute(parseCalendarVoiceCommand(phrase),'ru',()=>action='history',()=>action='settings','test-user');assert.equal(action,target);
 }
 action='';let loginDate;
 assert.equal(execute({type:'history'},'ru',()=>action='history',()=>action='settings',null,'2026-10-08',date=>loginDate=date,()=>({addHint:'Войдите'})),'Войдите');
 assert.equal(loginDate,'2026-10-08');assert.equal(action,'','a logged-out voice command respects the screen login guard');
});
