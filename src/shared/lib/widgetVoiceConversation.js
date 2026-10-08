import {voiceEntryReview, shortEntryAnswer} from './voiceEntryReview.js';
import {voiceEntryBatch} from './voiceEntryBatch.js';
import {canAutoSaveVoiceEntry} from './voiceAutoSave.js';
import {isVoiceHelpRequest} from './voiceCapabilities.js';
import {normalizeVoicePhrase} from './voicePhrase.js';
import {resolveVoiceCorrections} from './naturalVoiceEntry.js';
import {categoryMatches} from './voiceCategory.js';
export {spokenText as widgetSpokenReply} from './spokenText.js';

const copy={
 ru:{ready:'Скажите расход или доход. Например: потратил 50 лей на сок.',invalid:'Не разобрал фразу. Повторите или скажите «отмена».',confirm:'Скажите «сохрани», назовите исправление или скажите «отмена».',cancelled:'Отменил. Ничего не записано.',empty:'Пока нечего сохранять. Назовите расход или доход.',help:'Записываю доходы и расходы в календарь. Можно назвать сумму, валюту, покупку и дату в любом порядке. Если данных не хватает, уточню. Несколько покупок проверю вместе. Можно исправить сумму или сказать «отмена».',saved:'Записи добавлены.'},
 en:{ready:'Say an expense or income. For example: spent 50 dollars on juice.',invalid:'I could not understand. Repeat or say cancel.',confirm:'Say save, a correction, or cancel.',cancelled:'Cancelled. Nothing was recorded.',empty:'Nothing to save yet. Say an expense or income.',help:'I record expenses and income in the calendar. Say the amount, currency, category and date in any order. I ask for missing details. You can correct amounts, record several purchases, or cancel.',saved:'Entries added.'},
 ro:{ready:'Spune o cheltuială sau un venit. De exemplu: am cheltuit 50 de lei pe suc.',invalid:'Nu am înțeles. Repetă sau spune anulează.',confirm:'Spune salvează, o corectare sau anulează.',cancelled:'Anulat. Nu am înregistrat nimic.',empty:'Nimic de salvat încă. Spune o cheltuială sau un venit.',help:'Înregistrez cheltuieli și venituri în calendar. Spune suma, moneda, categoria și data în orice ordine. Întreb ce lipsește. Poți corecta sume, înregistra mai multe cumpărături sau anula.',saved:'Înregistrări adăugate.'},
 zh:{ready:'请说出支出或收入，例如：今天花了50元买果汁。',invalid:'没听清，请重复或说取消。',confirm:'请说保存、修改内容或取消。',cancelled:'已取消，没有保存记录。',empty:'还没有记录，请说出支出或收入。',help:'我能在日历中记录支出和收入，可以说金额、币种、类别和日期。信息不完整时我会询问。也可以修改、添加多笔或取消。',saved:'记录已添加。'},
};
export function widgetLocale(language){const locale=String(language).toLowerCase().split(/[-_]/u)[0];return ['zh','en','ro'].includes(locale)?locale:'ru';}
export function widgetSettings(value={}){
 const locale=widgetLocale(value.locale);
 const currency=['MDL','USD','EUR','RUB','CNY'].includes(value.currency)?value.currency:'MDL';
 const categories=Array.isArray(value.categories)?value.categories.slice(0,200).flatMap(item=>{
  if(!item||typeof item.value!=='string'||!item.value.trim()||item.value.length>60)return [];
  return [{value:item.value.trim(),label:typeof item.label==='string'?item.label.slice(0,80):item.value,type:['plus','minus'].includes(item.type)?item.type:undefined}];
 }):[];
 return {locale,currency,categories};
}
function checkedEntries(entries,todayKey){
 if(!Array.isArray(entries)||!entries.length||entries.length>10)return [];
 return entries.map(entry=>{
  if(!entry||!Number.isFinite(Number(entry.amount))||Number(entry.amount)<=0||Number(entry.amount)>=1e12||!['plus','minus'].includes(entry.sign)||!['MDL','USD','EUR','RUB','CNY'].includes(entry.currency)||entry.destination!=='main'||!entry.category?.trim()||entry.category.length>60||!/^\d{4}-\d{2}-\d{2}$/.test(entry.dateKey)||entry.dateKey>todayKey)throw new Error('INVALID_ENTRY');
  return {amount:String(entry.amount),sign:entry.sign,currency:entry.currency,category:entry.category.trim(),dateKey:entry.dateKey,destination:'main'};
 });
}
function recordedAnswer(entry,locale){
 const answer=shortEntryAnswer(entry,locale).replace(/[.。]$/u,'');
 return locale==='ru'?`${answer}: ${entry.category}.`:locale==='zh'?`${answer}，${entry.category}。`:`${answer}: ${entry.category}.`;
}
// The server owns this context. Clients send phrases, never monetary rows or owner IDs.
export function widgetVoiceTurn({phrase,context=null,settings={},todayKey,confidence=0,alternatives=[],now=Date.now()}){
 const prefs=widgetSettings(settings),{locale,categories}=prefs,labels=copy[locale];
 if(typeof phrase!=='string'||!phrase.trim()||phrase.length>1500)throw new Error('INVALID_PHRASE');
 const text=normalizeVoicePhrase(phrase).toLowerCase();
 const old=context&&Number.isFinite(context.updatedAt)&&now-context.updatedAt<10*60*1000&&now>=context.updatedAt?context:null;
 const result=(status,reply,next=old,entries=[])=>({status,reply,context:next?{...next,updatedAt:now}:null,entries});
 if(/^(отмена|отмени|не надо|cancel|stop|anuleaza|anulează|取消)$/u.test(text))return result('cancelled',labels.cancelled,null);
 if(isVoiceHelpRequest(text))return result('clarify',labels.help,old);
 const save=/^(сохрани|сохранить|готово|запиши|save|done|salveaza|salvează|gata|保存|完成)$/u.test(text);
 if(save){
  const entries=checkedEntries(old?.entries||[],todayKey);
  if(entries.length)return result('saved',entries.length===1?recordedAnswer(entries[0],locale):labels.saved,null,entries);
  return result('clarify',old?.prompt||labels.empty,old);
 }
 const options={todayKey,defaultCurrency:prefs.currency,requireCategory:true,askDestination:false,walletAvailable:false};
 const batch=voiceEntryBatch(phrase,old?.batch||null,locale,categories,options);
 const parsed=batch||voiceEntryReview(phrase,old?.draft||old?.entries?.[0]||null,locale,categories,options);
 if(!parsed||parsed.invalid)return result('clarify',old?.prompt?`${labels.invalid} ${old.prompt}`:labels.invalid);
 if(parsed.cancelled)return result('cancelled',labels.cancelled,null);
 if(parsed.draft)return result('clarify',parsed.prompt,{draft:parsed.draft,batch:parsed.batch||null,prompt:parsed.prompt});
 const entries=checkedEntries(parsed.batch?parsed.batch.states.map(state=>state.entry):[parsed.entry],todayKey);
 if(!entries.length)return result('clarify',labels.invalid);
 const safe=!old&&canAutoSaveVoiceEntry(phrase,parsed,locale,categories,options,{isFinal:true,confidence,alternatives});
 // Finishing a missing field can save without another verbal confirmation;
 // explicit corrections and batches retain a short spoken review.
 const corrected=resolveVoiceCorrections(phrase).correction||/^(нет|no|nu|не |точнее|вернее|ой|исправь|измени|not |actually|de fapt)/u.test(text);
 const categoryAnswer=old?.draft?.pendingFields?.includes('category');
 const explicitCategory=!categoryAnswer||/^(?:на|за|для|on|for|pe|pentru|用于|类别)(?:\s|[\u3400-\u9fff])/u.test(text)||!text.includes(' ')||categories.some(item=>categoryMatches(item.value,text)||categoryMatches(item.label,text));
 const signature=entry=>JSON.stringify(['amount','currency','sign','category','dateKey','destination'].map(key=>entry[key]));
 const alternativesAgree=alternatives.every(alternative=>{
  const candidate=voiceEntryBatch(alternative,old?.batch||null,locale,categories,options)||voiceEntryReview(alternative,old?.draft||null,locale,categories,options);
  if(candidate?.cancelled||candidate?.batch)return false;
  if(candidate?.entry)return signature(candidate.entry)===signature(entries[0]);
  return !candidate?.draft||(!candidate.draft.datePending&&!['amount','currency','sign','category'].some(field=>candidate.draft[field]&&candidate.draft[field]!==entries[0][field]));
 });
 if(safe||(old?.draft&&!parsed.batch&&!corrected&&explicitCategory&&alternativesAgree&&!(confidence>0&&confidence<.6)))return result('saved',recordedAnswer(entries[0],locale),null,entries);
 const review=entries.map(entry=>`${entry.category}: ${entry.sign==='minus'?'−':'+'}${entry.amount} ${entry.currency}`).join('; ');
 const prompt=`${review}. ${labels.confirm}`;
 return result('clarify',prompt,{entries,batch:parsed.batch||null,prompt});
}
