import {voiceEntryReview,extractEntryDate} from './voiceEntryReview.js';
import {parseNaturalVoiceEntry,resolveVoiceCorrections} from './naturalVoiceEntry.js';

const trimConnector=text=>text.replace(/(?:[,;]|\s(?:и|and|și|si))\s*$/u,'').trim();
const prefixes={ru:(index,count,common)=>common?'Для всех записей. ':`Запись ${index+1} из ${count}. `,en:(index,count,common)=>common?'For all entries. ':`Entry ${index+1} of ${count}. `,ro:(index,count,common)=>common?'Pentru toate înregistrările. ':`Înregistrarea ${index+1} din ${count}. `,zh:(index,count,common)=>common?'所有记录：':`第${index+1}条，共${count}条。`};
function resultFor(batch,locale){
 const pending=batch.states.findIndex(state=>state.draft);
 const activeIndex=pending>=0?pending:Math.min(batch.activeIndex||0,batch.states.length-1);
 const next={...batch,activeIndex},state=batch.states[activeIndex];
 if(state.draft)return {...state,batch:next,prompt:(prefixes[locale]||prefixes.ru)(activeIndex,batch.states.length,batch.commonFields.includes(state.field))+state.prompt};
 return {batch:next,entry:state.entry};
}
function naturalPart(text,categories,today){return parseNaturalVoiceEntry(extractEntryDate(text,today).text,{categories});}
function meaningful(parts,categories,today){
 const parsed=parts.map(part=>naturalPart(part,categories,today));
 if(parts.length<2||parsed.some(state=>!state||state.invalid||state.ambiguous.length||!state.patch.amount||!(state.patch.category||state.patch.item||state.patch.sign)))return false;
 const explicit=parts.map(part=>part.split(/\s+/).some(word=>naturalPart(word,categories,today)?.patch?.sign));
 return parsed.filter(state=>state.patch.category||state.patch.item).length>=2||explicit.every(Boolean)||new Set(parsed.map(state=>state.patch.sign).filter(Boolean)).size>1;
}
function partsFor(text,categories,today){
 const dates=extractEntryDate(text,today);
 // Amount ranges preserve decimals, spoken numbers, cents and numeric category
 // names. Each range must have its own category or explicit money action.
 if(!dates.invalid){
  const parsed=parseNaturalVoiceEntry(dates.text,{categories}),ranges=parsed?.amountRanges;
  if(ranges?.length>=2){
   const parts=ranges.map((range,index)=>trimConnector(dates.text.slice(index?range.start:0,ranges[index+1]?.start||dates.text.length)));
   if(meaningful(parts,categories,today))return {parts,sharedDate:dates.dateKey};
  }
 }
 const parts=text.split(/;\s*|,\s+|\s+(?:и|and|și|si)\s+/u).map(part=>part.trim()).filter(Boolean);
 return meaningful(parts,categories,today)?{parts,sharedDate:!dates.invalid?dates.dateKey:null}:null;
}
const targetNumbers={первой:1,первая:1,второй:2,вторая:2,третьей:3,третья:3,четвертой:4,четвертая:4,пятой:5,пятая:5,шестой:6,шестая:6,седьмой:7,седьмая:7,восьмой:8,восьмая:8,девятой:9,девятая:9,десятой:10,десятая:10,first:1,second:2,third:3};
export function voiceEntryBatch(phrase,batch=null,locale='ru',categories=[],options={}){
 const corrected=resolveVoiceCorrections(phrase),text=corrected.text;
 if(batch){
  if(/^(?:отмена|отмени|не надо|cancel|stop|anulează|anuleaza|取消)$/.test(text))return {cancelled:true};
  if(corrected.negated)return {invalid:true};
  const target=text.match(/^(?:(?:в|во|in)\s+)?(\d+|первой|первая|второй|вторая|третьей|третья|четвертой|четвертая|пятой|пятая|шестой|шестая|седьмой|седьмая|восьмой|восьмая|девятой|девятая|десятой|десятая|first|second|third)\s+(?:записи|запись|entry)\s*(.*)$/);
  const index=target?(targetNumbers[target[1]]||Number(target[1]))-1:batch.activeIndex;
  if(index<0||index>=batch.states.length)return {invalid:true};
  const old=batch.states[index],state=voiceEntryReview(target?target[2]:text,old.draft||old.entry,locale,categories,options);
  if(!state||state.invalid)return {invalid:true};
  if(state.cancelled)return state;
  const states=batch.states.slice();states[index]=state;
  const field=old.field,value=(state.entry||state.draft)?.[field==='date'?'dateKey':field];
  if(batch.commonFields.includes(field)&&value&&state.field!==field){
   const reply=field==='destination'?{main:'calendar',wallet:'wallet',both:'both'}[value]:String(value);
   for(let i=0;i<states.length;i++)if(i!==index&&states[i].field===field){const updated=voiceEntryReview(reply,states[i].draft,locale,categories,options);if(updated&&!updated.invalid)states[i]=updated;}
  }
  return resultFor({...batch,states,activeIndex:index,commonFields:batch.commonFields.filter(name=>states.some(state=>state.field===name))},locale);
 }
 if(corrected.negated||text.length>1500)return null;
 const split=partsFor(text,categories,options.todayKey);if(!split)return null;
 if(split.parts.length>10)return {invalid:true};
 const parsed=split.parts.map(part=>naturalPart(part,categories,options.todayKey));
 const shared={};
 for(const field of ['sign','currency','destination']){
  const values=[...new Set(parsed.map(state=>state.patch[field]).filter(Boolean))];
  if(values.length===1)shared[field]=values[0];
 }
 if(split.sharedDate)shared.dateKey=split.sharedDate;
 const states=split.parts.map(part=>voiceEntryReview(part,shared,locale,categories,options));
 if(states.some(state=>!state||state.invalid||state.cancelled))return null;
 const commonFields=['currency','date','destination'].filter(field=>states.every(state=>state.field===field));
 return resultFor({states,activeIndex:0,commonFields},locale);
}
export function selectVoiceBatchEntry(batch,index,locale='ru'){
 if(index<0||index>=batch.states.length)return null;
 return resultFor({...batch,activeIndex:index},locale);
}
export function voiceBatchHasProgress(progress){return Boolean(progress.wallet||progress.calendar||progress.entries?.some(entry=>entry.done||entry.wallet||entry.calendar));}
export async function saveVoiceBatch(entries,progress,saveEntry){
 const key=JSON.stringify(entries);
 if(progress.batchKey!==key){
  if(voiceBatchHasProgress(progress))throw new Error('Часть записей уже сохранена. Завершите сохранение исходного списка.');
  progress.batchKey=key;progress.entries=entries.map(()=>progress.undoGroup?{undoGroup:progress.undoGroup}:{});
 }
 for(let index=0;index<entries.length;index++){
  if(progress.entries[index].done)continue;
  await saveEntry(entries[index],progress.entries[index]);progress.entries[index].done=true;
 }
}
