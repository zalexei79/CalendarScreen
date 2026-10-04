import {voiceEntryReview,extractEntryDate} from './voiceEntryReview.js';
import {voiceEntryBatch} from './voiceEntryBatch.js';
import {parseSpokenAmount} from './spokenAmount.js';
import {categoryMatches} from './voiceCategory.js';

export const isVoiceCommit=phrase=>/^(?:готово|все|всё|сохрани(?: все| всё)?|сохранить(?: все| всё)?|да сохрани|save(?: it| all)?|done|salvează(?: tot)?|salveaza(?: tot)?|gata|保存|确认保存|全部保存|完成)$/iu.test(String(phrase).trim().replace(/[.!?。！？]+$/u,''));
const itemOf=state=>state.entry||state.draft;
const nameOf=state=>itemOf(state)?.category;
function resultFor(batch,commitRequested=false){
 if(!batch.states.length)return {empty:true,commitRequested};
 const activeIndex=Math.max(0,batch.states.findIndex(state=>state.draft));
 const state=batch.states[activeIndex];
 return {...state,batch:{...batch,activeIndex},commitRequested};
}

// Apply clauses in spoken order to an unsaved shopping draft. The reducer never
// writes records and returns no changed draft when a clause is ambiguous.
export function voiceDictation(phrase,batch=null,locale='ru',categories=[],options={}){
 let text=String(phrase).trim().replace(/ё/g,'е')
  .replace(/\s+(?=хотя\s+нет|нет[, ]+на\s+|давай\s+(?:запишем|запиши|оставим))/giu,'; ')
  .replace(/(на\s+[\p{L} -]+?\s+(?:потратил[аи]?\s+)?\d+(?:[.,]\d+)?(?:\s+(?:лей|леев|рублей|евро|долларов))?)\s+(?=на\s+[\p{L} -]+?\s+(?:потратил|потратила|\d))/giu,'$1; ');
 if(isVoiceCommit(text))return batch?resultFor(batch,true):null;
 if(locale!=='ru')return null;
 if(batch&&/^(?:нет[, ]+|во?\s+\S+\s+записи)/iu.test(text)&&!/(?:на\s+.+?\s+не\s+|не\s+\d.+?\s+а\s+)/iu.test(text))return null;
 let commitRequested=false;
 text=text.replace(/(?:[,;.!?]|\s)\s*(готово|сохрани(?: все)?|сохранить(?: все)?)\s*[.!?]*$/iu,()=>{commitRequested=true;return '';});
 const actions=[];
 const mask=(pattern,kind)=>{text=text.replace(pattern,(raw,...args)=>{const groups=args.slice(0,-2);const index=actions.push({kind,raw,groups})-1;return `;__VOICE_${index}__;`;});};
 // Mask compound corrections before comma splitting (the comma in «не 80,
 // а 50» is part of one correction, not a second purchase).
 mask(/(?:нет[, ]+)?(?:на\s+)?([\p{L}][\p{L} -]{0,45}?)\s+(?:было\s+)?не\s+(\d+(?:[.,]\d+)?)\s*(?:лей|леев|рублей|евро|долларов)?\s*[, ]+а\s+(\d+(?:[.,]\d+)?)(?:\s+(?:лей|леев|рублей|евро|долларов))?/giu,'replace');
 mask(/(?:хотя\s+нет[, ]*)?(?:(?:сегодня|вчера)\s+)?([\p{L}][\p{L} -]{0,45}?)\s+не\s+(?:брал[аи]?|покупал[аи]?|купил[аи]?|нужен|нужно)/giu,'remove');
 mask(/(?:давай\s+)?(?:запишем|запиши|оставь|оставим|сохрани)\s+только\s+(.+?)(?=[.;!?]|,\s*на\s|\s+на\s+[\p{L} -]+\s+(?:потрат|\d)|$)/giu,'only');
 if(!batch&&!actions.length&&!commitRequested)return null;
 const next={states:batch?.states.map(state=>structuredClone(state))||[],activeIndex:batch?.activeIndex||0,commonFields:batch?.commonFields?.slice()||[]};
 let changed=false;
 const context=()=>{const values=next.states.map(itemOf);const last=values.at(-1)||{};return {dateKey:last.dateKey||options.baseDate||options.todayKey,destination:last.destination||'main',...(last.sign?{sign:last.sign}:{}),...(last.currency?{currency:last.currency}:{})};};
 const find=name=>next.states.map((state,index)=>categoryMatches(nameOf(state)||'',name)?index:-1).filter(index=>index>=0);
 const upsert=state=>{
  const name=nameOf(state);if(!name)return false;
  const matches=find(name);if(matches.length>1)return false;
  if(matches.length)next.states[matches[0]]=state;else next.states.push(state);
  changed=true;return next.states.length<=10;
 };
 const pieces=text.split(/;|[.!?](?!\d)|,(?!\d)/u).map(part=>part.trim()).filter(Boolean);
 for(const piece of pieces){
  const marker=piece.match(/^__VOICE_(\d+)__$/u);
  if(marker){
   const action=actions[Number(marker[1])];let [name,oldAmount,newAmount]=action.groups;
   name=String(name).trim().replace(/^(?:нет[, ]*|хотя нет[, ]*|сегодня |вчера )+/iu,'');
   if(action.kind==='only'){
    const names=name.split(/\s+и\s+|,/u).map(value=>value.trim()).filter(Boolean);
    if(!names.length||names.length>10||names.some(value=>!/^\p{L}[\p{L} -]{0,59}$/u.test(value)))return {invalid:true};
    const seed=context();next.states=next.states.filter(state=>names.some(value=>categoryMatches(nameOf(state)||'',value)));
    for(const value of names)if(!find(value).length){const state=voiceEntryReview(`на ${value}`,seed,locale,categories,{...options,requireCategory:true});if(!state?.draft&&!state?.entry)return {invalid:true};next.states.push(state);}
   }else{
    const matches=find(name);if(matches.length!==1)return {invalid:true};
    if(action.kind==='remove'){const date=extractEntryDate(action.raw,options.todayKey);if(date.invalid||(date.dateKey&&itemOf(next.states[matches[0]]).dateKey!==date.dateKey))return {invalid:true};next.states.splice(matches[0],1);}
    else{
     const previous=itemOf(next.states[matches[0]]);
     if(previous.amount!==parseSpokenAmount(oldAmount))return {invalid:true};
     const state=voiceEntryReview(`нет, ${newAmount}`,previous,locale,categories,{...options,requireCategory:true});if(!state?.entry&&!state?.draft)return {invalid:true};next.states[matches[0]]=state;
    }
   }
   changed=true;continue;
  }
  // A filler between sentences carries no money intent.
  const plain=piece.replace(/^(?:и\s+|еще\s+|давай\s+)+/iu,'');
  if(!plain)continue;
  const seed=context();
  const list=voiceEntryBatch(plain,null,locale,categories,options);
  const states=list?.batch?.states||[voiceEntryReview(plain,seed,locale,categories,{...options,newEntry:true,requireCategory:true})];
  for(let state of states){
   if(batch&&!actions.length&&!commitRequested&&pieces.length===1&&(!state?.entry||!state.entry.category||!state.entry.amount))return null;
   if(state?.draft&&seed.currency&&!state.draft.currency)state=voiceEntryReview('',{...seed,...state.draft,currency:seed.currency},locale,categories,{...options,requireCategory:true});
   if(!state||state.invalid||(!state.entry&&!state.draft)||!upsert(state))return batch||actions.length||commitRequested?{invalid:true}:null;
  }
 }
 if(!changed&&!commitRequested)return null;
 return resultFor(next,commitRequested);
}
