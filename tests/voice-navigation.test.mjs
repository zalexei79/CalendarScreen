import test from 'node:test';import assert from 'node:assert/strict';
import {parseCalendarVoiceCommand as parse}from '../src/shared/lib/calendarVoiceCommand.js';
test('natural navigation supports app sections and settings in all app languages',()=>{
 for(const phrase of ['Зайди в историю','Покажи мои записи','Можешь открыть историю','Open history','Deschide istoricul'])assert.deepEqual(parse(phrase),{type:'history'});
 for(const phrase of ['Перейди в настройки','Open settings','Deschide setări'])assert.deepEqual(parse(phrase),{type:'settings'});
 for(const phrase of ['Вернись на сегодня','Go to today','Deschide astăzi'])assert.deepEqual(parse(phrase),{type:'today'});
 for(const phrase of ['Включи темную тему','Switch to dark theme','Activează tema întunecată'])assert.deepEqual(parse(phrase),{type:'theme',theme:'dark'});
 assert.deepEqual(parse('Включи режим трейдера'),{type:'trader',enabled:true});
 assert.deepEqual(parse('Disable trader mode'),{type:'trader',enabled:false});
 assert.equal(parse('не открывай историю'),null);assert.equal(parse('удали историю'),null);assert.equal(parse('в истории нет записей'),null);
});
