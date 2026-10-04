import {normalizeVoicePhrase} from './voicePhrase.js';
import {parseCalendarVoiceCommand} from './calendarVoiceCommand.js';
import {extractEntryDate,localDateKey} from './voiceEntryReview.js';
import {parseSpokenAmount} from './spokenAmount.js';
import {financialQueryRange} from './financialVoiceQuery.js';
import {normalizeVoiceCategory} from './voiceCategory.js';

export function conversationDate(phrase,today=localDateKey()) {
 const weekdays=['воскресенье','понедельник','вторник','среду','четверг','пятницу','субботу'];
 const match=phrase.match(/(?:в |за |на )?(?:прошлую |прошлый |прошлое )?(воскресенье|понедельник|вторник|среду|четверг|пятницу|субботу)/);
 if(!match)return extractEntryDate(phrase,today);
 const date=new Date(`${today}T12:00:00`),offset=(date.getDay()-weekdays.indexOf(match[1])+7)%7;
 date.setDate(date.getDate()-(offset||7));
 return extractEntryDate(phrase.replace(match[0],localDateKey(date)),today);
}

export function parseVoiceConversation(phrase,context=null,{todayKey=localDateKey()}={}) {
 const text=normalizeVoiceCategory(normalizeVoicePhrase(phrase)).replace(/[?!]/g,'').replace(/[,.](?=\s|$)/g,' ').replace(/\s+/g,' ').trim();
 if(/^(?:покажи (?:эти|найденные) записи|show (?:these )?entries)$/.test(text))return {type:'conversation-action',action:'show'};
 if(/^(?:открой (?:последнюю|последнюю запись)|open (?:the )?last entry)$/.test(text))return {type:'conversation-action',action:'last'};
 if(/^(?:вернись (?:в|к) календар[юь]|закрой историю|back to calendar)$/.test(text))return {type:'conversation-action',action:'calendar'};
 if(/^(?:отмени (?:это|последнюю запись|последнее действие)|undo(?: that)?)$/.test(text))return {type:'voice-undo'};
 if(/^(?:восстанови|верни запись|restore)$/.test(text))return {type:'voice-restore'};
 if(context&&/^(?:а |теперь |and )/.test(text)){
  let next=text.replace(/^(?:а |теперь |and )/,'');
  if(/^(?:за |на )?прошлую(?: неделю)?$/.test(next))next='за прошлую неделю';
  if(/^(?:за |в )?прошлый(?: месяц)?$/.test(next))next='за прошлый месяц';
  const parsed=parseCalendarVoiceCommand(`сколько потратил ${next}`);
  if(parsed?.type==='question'){
   const command={...context,type:'question'};delete command.mode;
   if(/недел|месяц|сентябр|октябр|январ|феврал|март|апрел|ма[йяе]|июн|июл|август|ноябр|декабр|вчера|сегодня|время/.test(next)){command.period=parsed.period;delete command.month;delete command.year;if(parsed.month)command.month=parsed.month;if(parsed.year)command.year=parsed.year;}
   if(parsed.category){command.category=parsed.category;delete command.categories;}
   return command;
  }
 }
 if(/^(?:что (?:я )?записал[аи]?|что было|сверь день|покажи записи)(?: |$)/.test(text)){
  const date=conversationDate(text,todayKey);
  if(date.invalid)return {type:'conversation-invalid',text:'Не разобрал дату. Назовите один день.'};
  return {type:'financial-search',mode:'day-review',metric:'summary',period:'exact-day',dateKey:date.dateKey||todayKey};
 }
 const date=conversationDate(text,todayKey);
 const edit=date.text.match(/^(?:исправь |измени )?(.+?) (?:было|была|были|сумма|на самом деле) (.+?)(?: (?:а )?не (.+))?$/);
 if(edit){const amount=parseSpokenAmount(edit[2]),oldAmount=edit[3]?parseSpokenAmount(edit[3]):null;if(amount&&Number(amount)>0)return {type:'voice-edit',category:edit[1],dateKey:date.dateKey,amount,oldAmount};}
 const repeat=text.match(/^(?:повтори (?:платеж |платеж за )?)?(.+?) (?:как (?:в |за )?прошлом месяце|как в прошлый раз)(?: (?:но|только) (.+))?$/);
 if(repeat){const amount=repeat[2]?parseSpokenAmount(repeat[2]):null;if(repeat[2]&&!amount)return {type:'conversation-invalid',text:'Назовите новую сумму или скажите «как в прошлый раз».'};return {type:'voice-repeat',category:repeat[1],period:text.includes('месяц')?'last-month':'all-time',amount};}
 const forgotten=text.match(/^(.+?) (?:забыл|забыла)(?: записать)?[ ,—-]+(?:добавь|запиши) (.+)$/);
 if(forgotten)return {type:'conversation-entry',phrase:`расход ${forgotten[2]} на ${forgotten[1]}`,dateKey:context?.period==='exact-day'?context.dateKey:null};
 if(/^(?:покажи|найди) (?:расход|трат|покуп|запис)/.test(text)&&/(?:примерно|около|дороже|больше|дешевле|меньше)/.test(text)){
  const amountMatch=date.text.match(/(?:примерно (?:на )?|около |дороже |больше |дешевле |меньше )(.+?)(?: (?:за|на) |$)/);
  const value=amountMatch?parseSpokenAmount(amountMatch[1]):null;
  if(value)return {type:'financial-search',mode:'search',metric:'expense',period:date.dateKey?'exact-day':'all-time',...(date.dateKey?{dateKey:date.dateKey}:{}),amountFilter:{kind:/примерно|около/.test(text)?'approx':/дороже|больше/.test(text)?'above':'below',value:Number(value)}};
 }
 return null;
}

// Turn a spoken day list into the existing reviewed batch format. Currency and
// date stay shared; existing recognition keeps handling ordinary money phrases.
export function prepareConversationEntry(phrase,{todayKey=localDateKey(),baseDate=null,context=null}={}) {
 const date=conversationDate(normalizeVoiceCategory(normalizeVoicePhrase(phrase)).replace(/:/g,' '),todayKey);
 const common=date.text.match(/(?:[—-]\s*)?(?:все|всё) (?:в |все в )?(леях|леи|леях|евро|долларах|рублях)$/);
 const currency=common?({леях:'MDL',леи:'MDL',евро:'EUR',долларах:'USD',рублях:'RUB'}[common[1]]):null;
 const list=(common?date.text.slice(0,common.index):date.text).replace(/^[: ,]+/,'').split(/[,;]\s*/).filter(Boolean);
 const converted=list.map(part=>{
  const match=part.trim().match(/^(.+?)\s+([\d]+(?:[.,]\d+)?[кk]?|.+)$/);
  if(!match)return null;
  const amount=parseSpokenAmount(match[2]);return amount?`расход ${amount}${currency?` ${currency}`:''} на ${match[1]}`:null;
 });
 const namedList=list.length>1&&converted.every(Boolean);
 const cleaned=namedList?converted.join(', '):date.text.replace(/^(?:добавь|запиши) (?=\d)/,'расход ');
 const inherited=context?.period==='exact-day'?context.dateKey:baseDate;
 return {phrase:cleaned,dateKey:date.dateKey||inherited||null,invalid:date.invalid};
}

export function queryWithConversationRange(command,todayKey){
 return command.period==='exact-day'?{from:command.dateKey,to:command.dateKey}:financialQueryRange(command,todayKey);
}
