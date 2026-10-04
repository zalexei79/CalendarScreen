import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeVoicePhrase} from '../src/shared/lib/voicePhrase.js';
import {isVoiceHelpRequest} from '../src/shared/lib/voiceCapabilities.js';
import {parseCalendarVoiceCommand} from '../src/shared/lib/calendarVoiceCommand.js';
import {voiceEntryReview} from '../src/shared/lib/voiceEntryReview.js';
const options={todayKey:'2026-10-04',defaultCurrency:'MDL',requireCategory:true};
test('conversational help questions cover recognition variants without swallowing money commands',()=>{
 for(const value of ['Что-то ты умеешь','Что то ты умеешь?','Ну, расскажи мне, пожалуйста, что ты вообще умеешь?','Чем ты можешь помочь?','Какие у тебя функции?','Что тут можно делать?','Could you tell me what can you do?','Te rog, ce poți face?','请帮我你能做什么？'])assert.equal(isVoiceHelpRequest(value),true,value);
 for(const value of ['не показывай помощь','потратил 50 лей на помощь','что ты умеешь потратил 50','можешь не открыть историю'])assert.equal(isVoiceHelpRequest(value),false,value);
});
test('polite and conversational wrappers keep financial meaning and navigation',()=>{
 for(const prefix of ['Ну, пожалуйста, ','Бро, ','Можешь показать '.replace('показать ',''),'Не мог бы ты ','Я хочу посмотреть ']){
  const phrase=prefix.includes('посмотреть')?`${prefix}расходы на еду за прошлый месяц`:`${prefix}показать расходы на еду за прошлый месяц`;
  const parsed=parseCalendarVoiceCommand(phrase);assert.equal(parsed?.type,'financial-search',phrase);assert.equal(parsed.period,'last-month');assert.equal(parsed.category,'еду');
 }
 for(const phrase of ['Слушай, можешь мне открыть историю, пожалуйста','Ну, открой пожалуйста историю','Could you open history please'])assert.equal(parseCalendarVoiceCommand(phrase)?.type,'history',phrase);
 assert.equal(parseCalendarVoiceCommand('Подскажи мне пожалуйста сколько я вообще потратил на еду вчера')?.period,'yesterday');
});
test('money, categories and negation are not guessed or lost during cleanup',()=>{
 const phrase='Ну, я вчера потратил, эм, 50,25 лей на сок';const entry=voiceEntryReview(phrase,null,'ru',[],options)?.entry;assert.equal(entry?.amount,'50.25');assert.equal(entry.category,'сок');assert.equal(entry.dateKey,'2026-10-03');
 assert.equal(normalizeVoicePhrase('Создай раздел «Ну пожалуйста»'),'создай раздел «ну пожалуйста»');
 assert.ok(normalizeVoicePhrase('потратил 50 лей на Ну и сок').includes('на ну и сок'));
 assert.ok(!voiceEntryReview('ну я не потратил 50 лей на сок',null,'ru',[],options)?.entry);
 assert.ok(!voiceEntryReview('можешь не записать 50 лей на сок',null,'ru',[],options)?.entry);
 const draft=voiceEntryReview('потратил 50 лей на сок',null,'ru',[],options).entry;
 for(const phrase of ['Нет не 50 лей а 70','Ну нет, не 50 лей, а 70','Сумма 70'])assert.equal(voiceEntryReview(phrase,draft,'ru',[],options)?.entry?.amount,'70',phrase);
 assert.equal(voiceEntryReview('скажи сколько потратил на еду вчера',draft,'ru',[],options),null,'a question never changes a pending purchase');
 assert.equal(voiceEntryReview('потратил 50 и 70 лей на сок',null,'ru',[],options)?.entry,undefined);
});
test('intent survives general wrappers and reordered read-only requests',()=>{
 for(const phrase of ['Расходы на кофе за вчера покажи','Мои траты за прошлую неделю найди','Вчера на кофе сколько я потратил','Как много я потратил на еду вчера','Сколько денег я потратил на еду вчера']){
  const command=parseCalendarVoiceCommand(phrase);assert.ok(['question','financial-search'].includes(command?.type),phrase);assert.equal(command.metric,'expense');assert.ok(['yesterday','last-week'].includes(command.period));
 }
 for(const phrase of ['Какие функции у тебя есть?','Ты что-нибудь умеешь?','Что умеет это приложение?','Что ты можешь сделать для меня?','Что вообще можно тут делать?','Какие команды ты можешь выполнить?','Расскажи о своих возможностях','Как с тобой работать?','How can you help me?'])assert.equal(isVoiceHelpRequest(phrase),true,phrase);
 for(const phrase of ['Хочу записать расход 50 лей на сок','Давай запишем расход 50 лей на сок','Помоги мне записать расход 50 лей на сок','Зафиксируй расход 50 лей на сок','У меня ушло 50 лей на сок','Я выложил 50 лей на сок','Я получается потратил 50 лей на сок']){
  const entry=voiceEntryReview(phrase,null,'ru',[],options)?.entry;assert.equal(entry?.amount,'50',phrase);assert.equal(entry.category,'сок');assert.equal(entry.sign,'minus');
 }
 for(const phrase of ['Не открывай историю','Хочу не записать расход 50 лей на сок','Что умеешь потратил 50 лей на сок','Давай не будем записывать 50 лей на сок'])assert.ok(!voiceEntryReview(phrase,null,'ru',[],options)?.entry,phrase);
 assert.equal(normalizeVoicePhrase('потратил 50 лей на «Короче вообще»'),'потратил 50 лей на «короче вообще»');
});
