import React from 'react';
import VoiceEntryCard,{isVoiceEntryValid} from './VoiceEntryCard.jsx';
const copy={
 ru:{title:'Проверьте записи',save:'Сохранить всё',saving:'Сохраняю…',cancel:'Отмена',saved:'Сохранено',other:'Другое',hint:'Выберите строку для исправления или скажите «во второй записи сумма 100».',main:'Календарь',wallet:'Кошелёк',both:'В оба',remove:'Убрать запись'},
 en:{title:'Review entries',save:'Save all',saving:'Saving…',cancel:'Cancel',saved:'Saved',other:'Other',hint:'Select an entry to edit or say “in second entry amount 100”.',main:'Calendar',wallet:'Wallet',both:'Both',remove:'Remove entry'},
 ro:{title:'Verifică înregistrările',save:'Salvează tot',saving:'Salvez…',cancel:'Anulează',saved:'Salvat',other:'Altele',hint:'Selectează o înregistrare pentru modificare.',main:'Calendar',wallet:'Portofel',both:'Ambele',remove:'Elimină înregistrarea'},
 zh:{title:'核对记录',save:'全部保存',saving:'正在保存…',cancel:'取消',saved:'已保存',other:'其他',hint:'选择需要修改的记录。',main:'日历',wallet:'钱包',both:'两者',remove:'移除记录'},
};
export default function VoiceBatchCard({batch,locale,categories,walletAvailable,onSelect,onChange,onRemove,onSave,onCancel,busy,locked,listening,error,progress,children,userId,isLight,onCreateCategory,onDeleteCategory}){
 const c=copy[locale],entries=batch.states.map(state=>state.entry),totals={};
 for(const entry of entries){const key=entry.currency;totals[key]??={plus:0,minus:0};totals[key][entry.sign]+=Math.round(Number(entry.amount)*100);}
 return <div className="calendar-voice-message calendar-voice-batch" role="region" aria-label={c.title}>
  <div className="calendar-assistant-heading"><span>DAYRIS</span><small>{c.title} · {entries.length}</small></div>
  <div className="calendar-voice-batch-list">{entries.map((entry,index)=><button key={index} className="calendar-voice-batch-row" type="button" aria-pressed={index===batch.activeIndex} disabled={busy||locked||listening} onClick={()=>onSelect(index)}>
   <span>{index+1}. {categories.find(category=>category.value===entry.category)?.label||entry.category||c.other}<small>{entry.dateKey} · {c[entry.destination]}</small></span>
   <strong>{entry.sign==='minus'?'−':'+'}{entry.amount} {entry.currency}</strong>{progress.entries?.[index]?.done&&<small>{c.saved}</small>}
  </button>)}</div>
  <div className="calendar-voice-batch-totals">{Object.entries(totals).map(([currency,total])=><p key={currency}>{total.minus>0&&`−${total.minus/100} ${currency}`}{total.minus>0&&total.plus>0&&' · '}{total.plus>0&&`+${total.plus/100} ${currency}`}</p>)}</div>
  {!locked&&<p className="calendar-voice-help-note">{c.hint}</p>}
  <VoiceEntryCard key={batch.activeIndex} embedded entry={entries[batch.activeIndex]} locale={locale} categories={categories} walletAvailable={walletAvailable} onChange={onChange} busy={busy} locked={locked} listening={listening} userId={userId} isLight={isLight} onCreateCategory={onCreateCategory} onDeleteCategory={onDeleteCategory}/>
  {!locked&&entries.length>1&&<button className="calendar-voice-batch-remove" type="button" disabled={busy||listening} onClick={onRemove}>{c.remove} {batch.activeIndex+1}</button>}
  {error&&<p className="calendar-voice-audio-error" role="alert">{error}</p>}{children}
  <div className="calendar-voice-review-actions"><button type="button" className="calendar-voice-save" disabled={busy||listening||entries.some(entry=>!isVoiceEntryValid(entry))} onClick={onSave}>{busy?c.saving:c.save}</button><button type="button" disabled={busy} onClick={onCancel}>{c.cancel}</button></div>
 </div>;
}
