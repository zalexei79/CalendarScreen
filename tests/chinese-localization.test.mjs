import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import {parseSpokenAmount} from '../src/shared/lib/spokenAmount.js';
import {parseCalendarVoiceCommand} from '../src/shared/lib/calendarVoiceCommand.js';
import {voiceEntryDialog} from '../src/shared/lib/voiceEntryDialog.js';
import {voiceEntryReview,extractEntryDate,shortEntryAnswer} from '../src/shared/lib/voiceEntryReview.js';
import {financialVoiceAnswer} from '../src/shared/lib/financialVoiceAnswer.js';
import {resolveLocalizedCategory} from '../src/shared/lib/voiceCategory.js';
import {voiceHelp} from '../src/shared/lib/voiceHelp.js';
import {formatMoneyShort} from '../src/shared/lib/formatters.js';
import {getProOfferCopy} from '../src/features/pro/proOfferCopy.js';
import {PLANNER_COPY,plannerLanguage} from '../src/features/reminders/plannerCopy.js';
import {intlLocale,localeKey} from '../src/shared/i18n/locale.js';

test('Chinese amounts include decimal digits, large units and yuan fractions',()=>{
  for(const [phrase,amount] of Object.entries({'一百二十五':'125','两千零五':'2005','一万两千三百四十五':'12345','一亿二千万':'120000000','125.50元':'125.5','三十五点零五':'35.05','十元五角二分':'10.52','一百美元':'100','2万':'20000'}))assert.equal(parseSpokenAmount(phrase),amount,phrase);
  for(const phrase of ['负一百','一百和二百','12元和20元','一百点零零五','一月二日','百百','一百收入两百','十二元五十角'])assert.equal(parseSpokenAmount(phrase),null,phrase);
});

test('Chinese voice commands cover navigation, dates, finance and all supported currencies',()=>{
  assert.deepEqual(parseCalendarVoiceCommand('打开设置'),{type:'settings'});
  assert.deepEqual(parseCalendarVoiceCommand('下个月'),{type:'month',direction:1});
  assert.deepEqual(parseCalendarVoiceCommand('切换深色主题'),{type:'theme',theme:'dark'});
  assert.equal(parseCalendarVoiceCommand('打开2048年11月13日').dateKey,'2048-11-13');
  assert.equal(parseCalendarVoiceCommand('打开2026年2月30日'),null);
  assert.deepEqual(parseCalendarVoiceCommand('这个月食品花了多少'),{type:'question',metric:'expense',period:'current-month',category:'食品'});
  assert.deepEqual(parseCalendarVoiceCommand('支出一百二十五元用于食品'),{type:'entry',kind:'record',amount:'125',currency:'CNY',sign:'minus',category:'食品'});
  for(const [word,currency] of [['美元','USD'],['欧元','EUR'],['卢布','RUB'],['列伊','MDL'],['人民币','CNY']])assert.equal(parseCalendarVoiceCommand(`收入100${word}`).currency,currency);
  for(const phrase of ['不要打开设置','收入支出100元','支出一百元和二百元'])assert.equal(parseCalendarVoiceCommand(phrase),null);
});

test('Chinese entry review retains fields and date, maps categories and never saves automatically',()=>{
  const categories=[{value:'Продукты',label:'食品'}],options={todayKey:'2026-10-02',defaultCurrency:'CNY',walletAvailable:true};
  const initial=voiceEntryReview('昨天支出一百二十五元用于食品',null,'zh',categories,options);
  assert.equal(initial.entry.dateKey,'2026-10-01');assert.equal(initial.entry.category,'Продукты');assert.equal(initial.entry.currency,'CNY');
  const corrected=voiceEntryReview('不，350',initial.entry,'zh',categories,options);
  assert.equal(corrected.entry.amount,'350');assert.equal(corrected.entry.dateKey,'2026-10-01');
  const routed=voiceEntryReview('保存到钱包',corrected.entry,'zh',categories,options);
  assert.equal(routed.entry.destination,'wallet');
  const blocked=voiceEntryReview('明天支出100元',null,'zh',categories,options);
  assert.equal(blocked.field,'date');assert.match(blocked.prompt,/未来/);
  assert.deepEqual(voiceEntryDialog('取消',initial.entry,'zh',categories,options),{cancelled:true});
  assert.equal(extractEntryDate('2026年10月1日收入100元','2026-10-02').dateKey,'2026-10-01');
  assert.match(shortEntryAnswer(initial.entry,'zh'),/已记录支出/);
});

test('Chinese financial answers keep currencies separate and resolve canonical categories',()=>{
  assert.equal(resolveLocalizedCategory('食品',[{key:'Продукты','zh-CN':'食品'}],['Продукты']),'Продукты');
  const answer=financialVoiceAnswer({records:{'2026-10-01':[{pnl:-100,currency:'CNY',instrument:'食品'},{pnl:-20,currency:'USD',instrument:'食品'}]},monthKey:'2026-10',metric:'expense',language:'zh-CN'});
  assert.match(answer,/个人支出/);assert.match(answer,/100/);assert.match(answer,/20/);assert.doesNotMatch(answer,/120/);
  assert.equal(formatMoneyShort(25000,'zh-CN'),'3万');assert.equal(formatMoneyShort(200000000,'zh-CN'),'2亿');
});

test('Chinese planner and PRO bundles have complete keys and help examples execute',()=>{
  assert.equal(localeKey('zh-Hans-CN'),'zh');assert.equal(intlLocale('zh'),'zh-CN');assert.equal(plannerLanguage('zh-CN'),'zh');
  assert.deepEqual(Object.keys(PLANNER_COPY.zh).sort(),Object.keys(PLANNER_COPY.en).sort());
  assert.deepEqual(Object.keys(getProOfferCopy('zh-CN')).sort(),Object.keys(getProOfferCopy('en')).sort());
  for(const phrase of voiceHelp('zh',true).groups.flatMap(group=>group.phrases).filter(s=>!s.includes('[')&&!s.includes('/')))assert.ok(parseCalendarVoiceCommand(phrase),phrase);
  for(const page of ['public/privacy-zh.html','public/delete-account-zh.html']){const html=fs.readFileSync(page,'utf8');assert.match(html,/lang="zh-CN"/);assert.doesNotMatch(html,/[А-Яа-яЁё]/);}
});
