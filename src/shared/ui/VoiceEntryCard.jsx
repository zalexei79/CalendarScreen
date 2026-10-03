import React,{useState} from 'react';
import CategoryPicker from './CategoryPicker.jsx';
import {localDateKey} from '../lib/voiceEntryReview.js';
export function isVoiceEntryValid(entry){const today=localDateKey();return Boolean(entry&&Number(entry.amount)>0&&Number(entry.amount)<1e12&&/^\d+(?:[.]\d{1,2})?$/.test(entry.amount)&&entry.dateKey&&entry.dateKey<=today&&['plus','minus'].includes(entry.sign)&&['main','wallet','both'].includes(entry.destination)&&['RUB','EUR','MDL','USD','CNY'].includes(entry.currency)&&(!entry.category||entry.category.trim().length<=60));}
export default function VoiceEntryCard({onManualEdit,entry,locale,categories,walletAvailable,onChange,onSave,onCancel,busy,error,locked=false,listening=false,children,embedded=false,userId,isLight,onCreateCategory,onDeleteCategory}){
 const [editing,setEditing]=useState(false);
 const c={
  zh: {title:"核对记录",save:"保存",saving:"正在保存…",edit:"修改",cancel:"取消",amount:"金额",category:"类别",other:"其他",date:"日期",currency:"货币",kind:"记录类型",expense:"支出",income:"收入",destination:"保存位置",main:"日历",wallet:"钱包",both:"日历和钱包",hint:"请说“不，350”“收入”或“保存到钱包”。",ready:"完成",today:"今天",yesterday:"昨天"},ru:{title:'Проверьте запись',save:'Сохранить',saving:'Сохраняю…',edit:'Исправить',cancel:'Отмена',amount:'Сумма',category:'Категория',other:'Другое',date:'Дата',currency:'Валюта',kind:'Тип записи',expense:'Расход',income:'Доход',destination:'Место записи',main:'Календарь',wallet:'Кошелёк',both:'Календарь и кошелёк',hint:'Можно сказать: «потратил на сок», «нет, 350», «сохрани».',ready:'Готово',today:'Сегодня',yesterday:'Вчера'},en:{title:'Review entry',save:'Save',saving:'Saving…',edit:'Edit',cancel:'Cancel',amount:'Amount',category:'Category',other:'Other',date:'Date',currency:'Currency',kind:'Entry type',expense:'Expense',income:'Income',destination:'Save to',main:'Calendar',wallet:'Wallet',both:'Calendar and wallet',hint:'Say “spent on juice”, “no, 350” or “save”.',ready:'Done',today:'Today',yesterday:'Yesterday'},ro:{title:'Verifică înregistrarea',save:'Salvează',saving:'Salvez…',edit:'Modifică',cancel:'Anulează',amount:'Sumă',category:'Categorie',other:'Altele',date:'Data',currency:'Monedă',kind:'Tipul înregistrării',expense:'Cheltuială',income:'Venit',destination:'Salvare în',main:'Calendar',wallet:'Portofel',both:'Calendar și portofel',hint:'Spune „cheltuit pe suc”, „nu, 350” sau „salvează”.',ready:'Gata',today:'Astăzi',yesterday:'Ieri'}}[locale];
 const today=localDateKey(),yesterday=new Date();yesterday.setDate(yesterday.getDate()-1);
 const dateLabel=entry.dateKey===today?c.today:entry.dateKey===localDateKey(yesterday)?c.yesterday:new Date(`${entry.dateKey}T12:00:00`).toLocaleDateString({
  zh: "zh-CN",ru:'ru-RU',en:'en-US',ro:'ro-RO'}[locale],{day:'numeric',month:'long',year:'numeric'});
 const category=categories.find(item=>item.value===entry.category)?.label||entry.category||c.other;
 const valid=isVoiceEntryValid(entry);
 const change=(key,value)=>onChange({...entry,[key]:value});
 return <div className="calendar-voice-message calendar-voice-review" role="region" aria-label={c.title}>
  {!embedded&&<><div className="calendar-assistant-heading"><span>DAYRIS</span><small>{c.title}</small></div>
  <p className="calendar-voice-review-summary"><span>{dateLabel} · {category}</span><strong>{entry.sign==='minus'?'−':'+'}{entry.amount} {entry.currency}</strong><small>{c[entry.destination]}</small></p></>}
  {entry.mutation&&<p className="voice-mutation-diff"><span>Было: {entry.beforeAmount} {entry.currency}</span><strong>→ {entry.amount} {entry.currency}</strong></p>}
  {editing&&<fieldset disabled={busy||locked||listening} className="calendar-voice-edit-fields">
   <label>{c.date}<input disabled={entry.mutation} aria-label={c.date} type="date" max={today} value={entry.dateKey} onChange={event=>change('dateKey',event.target.value)}/></label>
   <label>{c.amount}<input aria-label={c.amount} inputMode="decimal" value={entry.amount} onChange={event=>change('amount',event.target.value.replace(',','.'))}/></label>
   <label>{c.currency}<select disabled={entry.mutation} aria-label={c.currency} value={entry.currency} onChange={event=>change('currency',event.target.value)}>{['MDL','EUR','USD','RUB','CNY'].map(value=><option key={value}>{value}</option>)}</select></label>
   <label>{c.kind}<select aria-label={c.kind} value={entry.sign} onChange={event=>change('sign',event.target.value)}><option value="minus">{c.expense}</option><option value="plus">{c.income}</option></select></label>
   <div className="calendar-voice-field-wide" inert={entry.mutation?"":undefined}><span>{c.category}</span><CategoryPicker ariaLabel={c.category} options={categories} value={entry.category||''} onChange={value=>change('category',value)} language={locale} userId={userId} isLight={isLight} allowCreate onCreate={onCreateCategory} onDelete={onDeleteCategory}/></div>
   <label className="calendar-voice-field-wide">{c.destination}<select disabled={entry.mutation} aria-label={c.destination} value={entry.destination} onChange={event=>change('destination',event.target.value)}><option value="main">{c.main}</option>{walletAvailable&&<><option value="wallet">{c.wallet}</option><option value="both">{c.both}</option></>}</select></label>
  </fieldset>}
  {error&&<p className="calendar-voice-audio-error" role="alert">{error}</p>}
  {!locked&&!embedded&&<p className="calendar-voice-help-note">{c.hint}</p>}
  {children}
  <div className="calendar-voice-review-actions">{!embedded&&<button type="button" className="calendar-voice-save" disabled={busy||!valid} onClick={onSave}>{busy?c.saving:c.save}</button>}<button type="button" disabled={busy||locked} aria-expanded={editing} onClick={()=>{onManualEdit?.();setEditing(!editing);}}>{editing?c.ready:c.edit}</button>{!embedded&&<button type="button" disabled={busy} onClick={onCancel}>{c.cancel}</button>}</div>
 </div>;
}
