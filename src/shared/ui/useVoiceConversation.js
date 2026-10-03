import {useEffect,useRef} from 'react';
import {parseVoiceConversation,conversationDate} from '../lib/voiceConversation.js';
import {parseCalendarVoiceCommand} from '../lib/calendarVoiceCommand.js';
import {categoryMatches,normalizeVoiceCategory} from '../lib/voiceCategory.js';
import {financialQueryRange,resolveFinancialQueryCategory} from '../lib/financialVoiceQuery.js';
import {MONEY_CATEGORIES,getMoneyCategoryLabel} from '../config/constants.js';

const spokenIndex=text=>{
 const words=[['первую','первая'],['вторую','вторая'],['третью','третья'],['четвертую','четвертая'],['пятую','пятая'],['шестую','шестая'],['седьмую','седьмая'],['восьмую','восьмая'],['девятую','девятая'],['десятую','десятая']];
 return /^(?:[1-9]|10)$/.test(text)?Number(text)-1:words.findIndex(names=>names.includes(text));
};

export default function useVoiceConversation({userId,recordsRef,categories,todayKey,isTrading,mutateRecord,saveRecord,deleteWallet,saveWallet}) {
 const pending=useRef(null),lastQuery=useRef(null),journal=useRef(null),busy=useRef(false),owner=useRef(userId),lastDate=useRef(null);
 owner.current=userId;
 useEffect(()=>{owner.current=userId;pending.current=null;lastQuery.current=null;journal.current=null;lastDate.current=null;},[userId]);
 const personal=()=>Object.entries(recordsRef.current||{}).flatMap(([dateKey,rows])=>rows.map(item=>({...item,dateKey}))).filter(item=>!isTrading(item)).sort((a,b)=>b.dateKey.localeCompare(a.dateKey)||String(b.time||'').localeCompare(String(a.time||'')));
 const category=name=>resolveFinancialQueryCategory(name,MONEY_CATEGORIES,categories);
 const format=item=>`${item.dateKey} · ${item.instrument} · ${item.pnl} ${item.currency||'USD'}`;
 const draft=item=>({type:'entry',kind:'record',amount:String(Math.abs(item.pnl)),sign:item.pnl<0?'minus':'plus',currency:item.currency||'USD',category:item.instrument,dateKey:item.dateKey,destination:'main'});
 const resolveSnapshot=snapshot=>{
  const rows=recordsRef.current[snapshot.dateKey]||[],exact=rows.find(item=>String(item.id)===String(snapshot.id));
  if(exact){if(['pnl','currency','instrument','time','comment'].some(key=>exact[key]!==snapshot[key]))throw new Error('Запись уже изменилась. Найдите её ещё раз.');return {...exact,dateKey:snapshot.dateKey};}
  if(String(snapshot.id).startsWith('local-')){const matches=rows.filter(item=>['pnl','currency','instrument','time','comment'].every(key=>item[key]===snapshot[key]));if(matches.length===1)return {...matches[0],dateKey:snapshot.dateKey};}
  throw new Error('Запись уже изменилась. Найдите её ещё раз.');
 };
 const rememberQuery=(command,result,showRecords)=>{lastQuery.current={command,result,showRecords};lastDate.current=command.period==='exact-day'?command.dateKey:null;};
 const recordSave=(entry,progress)=>{
  if(owner.current!==userId)return;
  if(!journal.current||journal.current.group!==progress.undoGroup)journal.current={kind:'save',group:progress.undoGroup,rows:[]};
  if(journal.current.rows.some(row=>row.progress===progress))return;
  journal.current.rows.push({entry:{...entry},progress,calendar:progress.calendarResult?{...progress.calendarResult,dateKey:entry.dateKey}:null,wallet:progress.walletResult||null});
 };
 async function undo(restore=false,requestOwner=owner.current){
  const checkOwner=()=>{if(owner.current!==requestOwner)throw new Error('Аккаунт изменился.');};
  const current=journal.current;if(!current)return {text:'В этом разговоре пока нечего отменять.'};
  if(restore&&!current.undone)return {text:'Последнее действие не отменено.'};
  if(!restore&&current.undone)return {text:'Уже отменено. Можно сказать «восстанови».'};
  if(current.kind==='edit'){
   const snapshot=resolveSnapshot(restore?current.before:current.after);
   const updated=await mutateRecord({snapshot,amount:restore?current.after.pnl:current.before.pnl});
   if(restore)current.after=updated;else current.before=updated;
  }else{
   for(const row of current.rows){
    checkOwner();
    if(restore){
     if(row.calendarRemoved){const item=row.calendar;row.calendar=await saveRecord({dateKey:item.dateKey,time:item.time,instrument:item.instrument,direction:item.direction,signedPnl:item.pnl,comment:item.comment||'',platform:item.platform||'Manual',currency:item.currency,traderMode:false});row.calendar.dateKey=item.dateKey;row.calendarRemoved=false;}
     if(row.walletRemoved){checkOwner();const {id,...item}=row.wallet;row.wallet=await saveWallet(item);row.walletRemoved=false;}
    }else{
     if(row.calendar&&!row.calendarRemoved){const snapshot=resolveSnapshot(row.calendar);await mutateRecord({snapshot,remove:true});row.calendarRemoved=true;}
     if(row.wallet&&!row.walletRemoved){checkOwner();await deleteWallet(row.wallet.id);row.walletRemoved=true;}
    }
   }
  }
  checkOwner();current.undone=!restore;return {text:restore?'Восстановлено.':'Отменено. Скажите «восстанови», если передумали.',help:restore?['Что записал сегодня?']:['Восстанови','Что записал сегодня?']};
 }
 function selectMutation(item,command){
  const entry=draft(item);
  if(command.type==='voice-repeat'){if(command.amount)entry.amount=command.amount;entry.dateKey=todayKey;return {entry,contextLabel:`Повтор платежа · ${getMoneyCategoryLabel(item.instrument,'ru')} · сегодня`};}
  entry.amount=command.amount;entry.mutation=true;entry.beforeAmount=String(Math.abs(item.pnl));entry.mutationSnapshot=item;
  pending.current={kind:'edit',snapshot:item};return {entry,contextLabel:'Изменение существующей записи'};
 }
 async function handle(phrase,context){
  const text=normalizeVoiceCategory(phrase),requestOwner=owner.current;
  if(busy.current)return {text:'Сохраняю. Подождите немного.'};
  const selection=pending.current;
  if(selection&&/^(отмена|не надо|cancel)$/.test(text)){pending.current=null;return {text:'Отменено. Можно задать другой вопрос.'};}
  if(selection?.kind==='selection'){
   const index=spokenIndex(text);
   const chosen=index>=0?selection.items[index]:selection.items.find(item=>text===normalizeVoiceCategory(format(item)));
   if(chosen){pending.current=null;return selectMutation(chosen,selection.command);}
  }
  if(selection?.kind==='period'){
   const parsed=parseCalendarVoiceCommand(`сколько потратил ${text}`);
   if(parsed?.type==='question'){pending.current=null;return {delegate:{...selection.command,...parsed,metric:selection.command.metric,category:selection.command.category,type:selection.command.type,mode:selection.command.mode}};}
  }
  if(selection?.kind==='category'){
   const index=spokenIndex(text),choice=index>=0?selection.choices[index]:selection.choices.find(item=>normalizeVoiceCategory(item.label)===text);
   if(choice){pending.current=null;try{const key=`dayris_voice_aliases:${userId||'guest'}`,saved=JSON.parse(localStorage.getItem(key)||'{}');localStorage.setItem(key,JSON.stringify({...saved,[selection.alias]:choice.value}));}catch{}return {delegate:{...selection.command,...(choice.value==='all-transport'?{categories:selection.names,category:null}:{category:choice.value})}};}
  }
  const command=parseVoiceConversation(phrase,context||lastQuery.current?.command,{todayKey});
  if(!command){
   if(/^(покажи|найди|сколько)/.test(text)&&/(?:за|на)\s*$/.test(text)){
    const query=parseCalendarVoiceCommand(text.replace(/(?:за|на)\s*$/,''));if(query){pending.current={kind:'period',command:query};return {text:`${query.category?`Раздел «${query.category}»`:'Расходы'} понял. За какой период?`,help:['За эту неделю','За прошлый месяц','За сентябрь']};}
   }
   const query=parseCalendarVoiceCommand(phrase);
   if(query?.type==='question'||query?.type==='financial-search'){
    pending.current=null;
    if(/^(машину|машина|авто)$/.test(query.category||'')){
     const names=categories.filter(name=>/^(авто|машина|такси|транспорт)$/i.test(name));let saved;try{saved=JSON.parse(localStorage.getItem(`dayris_voice_aliases:${userId||'guest'}`)||'{}')[query.category];}catch{}
     if(saved&&(saved==='all-transport'?names.length>0:names.some(name=>categoryMatches(name,saved))))return {delegate:{...query,...(saved==='all-transport'?{categories:names,category:null}:{category:saved})}};
     if(names.length>1){const choices=[...names.map(value=>({label:value,value})),{label:'Весь транспорт',value:'all-transport'}];pending.current={kind:'category',command:query,alias:query.category,names,choices};return {text:'Какой раздел показать? Скажите название. Этот выбор запомню.',choices:choices.map(item=>item.label),help:choices.map(item=>item.label)};}
    }
    return {delegate:query};
   }
   if(/^(покажи|найди|сколько)/.test(text)&&/(?:за|на)\s*$/.test(text)){
    const query=parseCalendarVoiceCommand(text.replace(/(?:за|на)\s*$/,''));if(query){pending.current={kind:'period',command:query};return {text:`${query.category?`Раздел «${query.category}»`:'Расходы'} понял. За какой период?`,help:['За эту неделю','За прошлый месяц','За сентябрь']};}
   }
   return null;
  }
  if(command.type==='conversation-invalid')return command;
  pending.current=null;
  if(command.type==='conversation-entry')return command;
  if(command.type==='conversation-action'){
   if(command.action==='calendar')return {delegate:{type:'voice-calendar'}};
   if(!lastQuery.current)return {text:'Сначала найдите записи или задайте вопрос о расходах.'};
   if(command.action==='show'){lastQuery.current.showRecords();return {text:'Открыл найденные записи.',context:lastQuery.current.command,compact:true,help:['Открой последнюю','Вернись в календарь']};}
   return {delegate:{...lastQuery.current.command,type:'financial-search',mode:'last',openRecords:true}};
  }
  if(command.type==='question'||command.type==='financial-search')return {delegate:command};
  busy.current=true;
  try{
   if(command.type==='voice-undo'||command.type==='voice-restore')return await undo(command.type==='voice-restore');
   if(command.type==='voice-edit'||command.type==='voice-repeat'){
    const name=category(command.category),range=command.dateKey?{from:command.dateKey,to:command.dateKey}:financialQueryRange({period:command.period||'all-time'},todayKey);
    const matches=personal().filter(item=>categoryMatches(item.instrument,name)&&item.dateKey>=range.from&&item.dateKey<=range.to&&(command.oldAmount===null||command.oldAmount===undefined||Math.abs(item.pnl)===Number(command.oldAmount)));
    if(!matches.length)return {text:`Запись «${name}» за этот период не найдена.`};
    if(matches.length>1&&command.type==='voice-edit'){pending.current={kind:'selection',command,items:matches.slice(0,10)};return {text:'Подходит несколько записей. Скажите «первую», «вторую» или выберите строку.',choices:matches.slice(0,10).map(format),help:['Первую','Вторую','Отмена']};}
    return selectMutation(matches[0],command);
   }
  }finally{busy.current=false;if(requestOwner!==owner.current)pending.current=null;}
  return null;
 }
 async function confirm(entry){
  const plan=pending.current;if(plan?.kind!=='edit')throw new Error('Сначала найдите запись для изменения.');
  if(entry.dateKey!==plan.snapshot.dateKey||entry.currency!==(plan.snapshot.currency||'USD')||!categoryMatches(entry.category,plan.snapshot.instrument))throw new Error('Для этой записи можно изменить сумму. Остальные поля сохранены.');
  const snapshot=resolveSnapshot(plan.snapshot),amount=Number(entry.amount)*(entry.sign==='minus'?-1:1);
  const after=await mutateRecord({snapshot,amount});journal.current={kind:'edit',before:snapshot,after,undone:false};pending.current=null;
  return {text:'Сумма исправлена. Можно сказать «отмени это».'};
 }
 return {handle,confirm,recordSave,rememberQuery,reset:()=>{pending.current=null;lastQuery.current=null;lastDate.current=null;}};
}
