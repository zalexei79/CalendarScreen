import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
// Browser source modules use extensionless imports; import the standalone helper directly.
import {isVoiceHelpRequest,voiceCapabilities} from '../src/shared/lib/voiceCapabilities.js';
test('capabilities questions accept natural variants and punctuation',()=>{
 for(const phrase of ['Что ты умеешь?','Что умеешь','Скажи, что ты можешь?','Какие команды ты знаешь?','Помоги','Что можно сказать?','Расскажи, пожалуйста, что ты умеешь','what can you do?','Ce poți face?','你能做什么？'])assert.equal(isVoiceHelpRequest(phrase),true,phrase);
});
test('help does not consume entries, corrections or unrelated questions',()=>{
 for(const phrase of ['Потратил 250 на помощь','Создай раздел Помощь','Что записал вчера?','Сколько потратил на продукты?','Что ты умеешь потратил 20'])assert.equal(isVoiceHelpRequest(phrase),false,phrase);
});
test('catalog is complete for enabled features and contains no paid wallet actions in FREE',()=>{
 const free=voiceCapabilities('ru'),pro=voiceCapabilities('ru',{walletAvailable:true,traderMode:true});
 assert.equal(free.groups.length,8);assert.ok(!JSON.stringify(free).includes('кошелёк'));assert.ok(JSON.stringify(pro).includes('кошелёк'));assert.ok(JSON.stringify(pro).includes('Добавь сделку'));
 for(const locale of ['en','ro','zh'])assert.ok(voiceCapabilities(locale).summary.length>0);
 assert.match(readFileSync('src/shared/ui/CalendarVoiceButton.jsx','utf8'),/isVoiceHelpRequest\(phrase\)/);
});
