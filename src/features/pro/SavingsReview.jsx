import React,{useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {ArrowRight,ArrowLeft,Check,ShieldCheck,X,Sparkles} from 'lucide-react';
import {getMoneyCategoryLabel} from '../../shared/config/constants.js';
import {analyzeSavings,calculateSavings} from './savingsModel.js';
import {savingsText,savingsReason} from './savingsCopy.js';
import './SavingsPlan.css';
export default function SavingsReview({trades,isTrading,currency,symbol,formatMoney,language,isLight,onClose,onSave,savedPlan,period}){
 const [analysis]=useState(()=>analyzeSavings(trades,{currency,isTrading}));
 const [step,setStep]=useState(0),[showAll,setShowAll]=useState(false),[saved,setSaved]=useState(false),[error,setError]=useState('');
 const [choices,setChoices]=useState(()=>savedPlan?.currency===currency?savedPlan.choices||Object.fromEntries(savedPlan.actions.map(action=>[action.key,action.choice])):{});
 const [closing,setClosing]=useState(false),[entryLimits,setEntryLimits]=useState({});
 const closeTimer=useRef(null);
 const close=()=>{if(closing)return;if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){onClose();return;}setClosing(true);closeTimer.current=setTimeout(onClose,220);};
 useEffect(()=>()=>clearTimeout(closeTimer.current),[]);
 const [reminders,setReminders]=useState(savedPlan?.reminders??true);
 const dialog=useRef(null),scroll=useRef(null),t=savingsText(language);
 const result=calculateSavings(analysis,choices),money=value=>`${symbol}${formatMoney(Math.abs(value))}`;
 const labels=[t('Разбор','Review','Analiză','分析'),t('Мой выбор','My choices','Alegerea mea','我的选择'),t('Мой план','My plan','Planul meu','我的计划')];
 useEffect(()=>{
  const previous=document.activeElement;dialog.current?.focus();
  const handleKey=event=>{
   if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();}
   if(event.key==='Tab'){
    const nodes=[...dialog.current.querySelectorAll('button:not(:disabled),input:not(:disabled),summary,select,[tabindex="0"]')].filter(node=>node.getClientRects().length),first=nodes[0],last=nodes.at(-1);
    if(event.shiftKey&&(document.activeElement===first||document.activeElement===dialog.current)){event.preventDefault();last?.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
   }
  };document.addEventListener('keydown',handleKey,true);
  return()=>{document.removeEventListener('keydown',handleKey,true);if(previous?.isConnected)previous.focus();};
 },[onClose,closing]);
 const changeStep=value=>{setStep(value);scroll.current?.scrollTo({top:0});requestAnimationFrame(()=>dialog.current?.querySelector('.savings-stage h3')?.focus());};
 const save=()=>{try{onSave({currency,choices,actions:result.actions,saving:result.saving,reminders,period,createdAt:new Date().toISOString()});setSaved(true);setError('');}catch{setError(t('Не удалось сохранить план на этом устройстве. Попробуй ещё раз.','Could not save on this device. Try again.','Nu s-a putut salva pe dispozitiv. Încearcă din nou.','无法在此设备保存，请重试。'));}};
 const visible=showAll?analysis.categories:analysis.categories.slice(0,5);
 return createPortal(<div className="savings-backdrop" data-closing={closing} onClick={event=>{if(event.target===event.currentTarget)close();}}>
  <section ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="savings-review-title" className={`savings-dialog ${isLight?'is-light':''}`}>
   <header><div><span className="savings-eyebrow"><Sparkles size={13}/> DAYRIS PRO</span><h2 id="savings-review-title">{t('Стать богаче','Grow your wealth','Mai mulți bani','积累更多财富')}</h2></div><button type="button" className="savings-icon" aria-label={t('Закрыть','Close','Închide','关闭')} onClick={close}><X size={19}/></button></header>
   <nav className="savings-steps" aria-label={t('Шаги плана','Plan steps','Pașii planului','计划步骤')}>{labels.map((label,index)=><span key={label} data-active={index<=step}><i>{index<step?<Check size={12}/>:String(index+1).padStart(2,'0')}</i>{label}</span>)}</nav>
   <div ref={scroll} className="savings-scroll"><div className="savings-stage" key={`${step}:${saved}`}>
    {step===0&&<>
     <h3 tabIndex={-1}>{analysis.count?t('Деньги, которые можно оставить себе.','Money you could keep.','Bani pe care îi poți păstra.','可以留下的资金。'):t('Начнём с твоих записей.','Start with your entries.','Începem cu înregistrările tale.','从你的记录开始。')}</h3>
     <p>{t('Разобрали личные расходы выбранного периода. Вот где стоит присмотреться.','We reviewed personal spending for this period. Here is what deserves a closer look.','Am analizat cheltuielile personale din perioadă. Iată ce merită verificat.','已分析所选时段的个人支出，以下内容值得留意。')}</p>
     <div className="savings-period">{period} · {currency}</div>
     <div className="savings-overview"><div><small>{t('Расходы','Expenses','Cheltuieli','支出')}</small><strong>{money(analysis.expenses)}</strong></div><div><small>{t('Записей о тратах','Expense entries','Înregistrări de cheltuieli','支出记录')}</small><strong>{analysis.count}</strong></div></div>
     {!analysis.count?<div className="savings-empty">{t('Добавляй расходы и категории в календарь. Даже несколько записей помогут увидеть привычки.','Add expenses and categories to your calendar. A few entries can reveal patterns.','Adaugă cheltuieli și categorii în calendar. Câteva înregistrări pot arăta obiceiuri.','在日历添加支出和类别，几条记录就能帮助发现习惯。')}</div>:<>
      <div className="savings-findings">{visible.map(group=><article key={group.key} data-essential={group.essential}><div><strong>{getMoneyCategoryLabel(group.name,language)}</strong><b>{money(group.amount)}</b></div><p>{savingsReason(group.reason,t)}</p><small>{group.count} {t('записей','entries','înregistrări','条记录')} · {t('в среднем','average','în medie','平均')} {money(group.average)}</small><details><summary>{t('Посмотреть покупки','See purchases','Vezi cumpărăturile','查看购买')}</summary>{group.entries.slice(0,entryLimits[group.key]||10).map((entry,index)=><div className="savings-purchase" key={entry.id||index}><span>{entry.dateKey} {entry.comment&&<small>{entry.comment}</small>}</span><b>{money(entry.pnl)}</b></div>)}{group.entries.length>(entryLimits[group.key]||10)&&<button type="button" className="savings-text-button" onClick={()=>setEntryLimits(current=>({...current,[group.key]:(current[group.key]||10)+10}))}>{t('Ещё покупки','More purchases','Mai multe cumpărături','更多购买')}</button>}</details></article>)}</div>
      {!showAll&&analysis.categories.length>5&&<button type="button" className="savings-text-button" onClick={()=>setShowAll(true)}>{t('Показать все разделы','Show all categories','Arată toate categoriile','显示全部类别')} ({analysis.categories.length})</button>}
     </>}
     <div className="savings-footnote"><ShieldCheck size={16}/><span>{t('Торговые убытки не включены. Необходимость покупки решаешь ты; эмоциональность можно заметить только из твоих заметок.','Trading losses are excluded. You decide what is necessary; spontaneous purchases can only be suggested by your notes.','Pierderile din tranzacții sunt excluse. Tu decizi necesitatea; cumpărăturile spontane pot fi sugerate doar de note.','不包括交易亏损。是否必要由你决定；冲动购物的线索仅来自你的备注。')}</span></div>
    </>}
    {step===1&&<>
     <h3 tabIndex={-1}>{t('Что изменим в следующий раз?','What changes next time?','Ce schimbăm data viitoare?','下次如何调整？')}</h3><p>{t('Выбери только то, от чего комфортно отказаться. По умолчанию мы ничего не сокращаем.','Choose only what you can comfortably reduce. Nothing is reduced by default.','Alege doar ce poți reduce confortabil. Implicit nu reducem nimic.','只选择可以轻松减少的购买，默认不会减少任何支出。')}</p>
     <div className="savings-choices">{analysis.categories.map(group=><article key={group.key} data-essential={group.essential}><div className="savings-choice-heading"><strong>{getMoneyCategoryLabel(group.name,language)}</strong><b>{money(group.amount)}</b></div><p>{savingsReason(group.reason,t)}</p>
      {group.essential?<span className="savings-essential"><ShieldCheck size={14}/>{t('Сохраняем полностью','Keep in full','Păstrăm integral','全部保留')}</span>:<>
       <div className="savings-choice-buttons" role="group" aria-label={getMoneyCategoryLabel(group.name,language)}>{[['keep',t('Оставить','Keep','Păstrează','保留')],['reduce',t('Меньше на 25%','Reduce by 25%','Cu 25% mai puțin','减少25%')],['skip',t('На 1 покупку реже','Skip 1 purchase','Cu 1 cumpărătură mai rar','少买一次')],['essential',t('Обязательное','Essential','Esențial','必要')]].map(([choice,label])=><button type="button" key={choice} aria-pressed={(choices[group.key]||'keep')===choice} onClick={()=>setChoices(current=>({...current,[group.key]:choice}))}>{label}</button>)}</div>
       {['reduce','skip'].includes(choices[group.key])&&<small className="savings-choice-value">+{money(choices[group.key]==='skip'?group.average:group.amount*.25)} {t('может остаться','could remain','pot rămâne','可能留下')}</small>}
      </>}
     </article>)}</div>
    </>}
    {step===2&&<>
     <h3 tabIndex={-1}>{saved?t('План с тобой.','Your plan is ready.','Planul e cu tine.','计划已就绪。'):t('Меньше лишнего. Больше твоего.','Spend less. Keep more.','Mai puține cheltuieli. Mai mulți bani.','少花一点，多留一点。')}</h3>
     <p>{saved?reminders?t('При похожей новой трате напомним о твоём решении. Покупку всегда можно сохранить.','Similar new spending will bring a reminder. You can always save the purchase.','La cheltuieli similare îți amintim decizia. Poți salva oricând cumpărătura.','类似新支出会显示提醒，你仍然可以保存购买。'):t('План сохранён. Подсказки при покупках выключены.','Plan saved. Purchase reminders are off.','Plan salvat. Sugestiile sunt oprite.','计划已保存，购买提醒已关闭。'):t('Если повторить этот период с выбранными изменениями:','If you repeated this period with your chosen changes:','Dacă repeți perioada cu schimbările alese:','如果按所选调整重复同一时段：')}</p>
     <div className="savings-result"><small>{t('У тебя осталось бы ещё','You could have kept another','Ai fi păstrat încă','你本可以多留下')}</small><strong>+{money(result.saving)}</strong><span>{t('за тот же период','over the same period','în aceeași perioadă','在同一时段')} · {period}</span></div>
     <div className="savings-comparison"><div><span>{t('Расходы сейчас','Current expenses','Cheltuieli actuale','当前支出')}</span><b>{money(analysis.expenses)}</b></div><div><span>{t('С твоим выбором','With your choices','Cu alegerile tale','按你的选择')}</span><b>{money(result.expensesAfter)}</b></div></div>
     <p className="savings-balance">{t('Разница доходов и расходов','Income minus expenses','Venituri minus cheltuieli','收入减去支出')}: <b>{analysis.balance<0?'−':''}{money(analysis.balance)}</b> → <b>{result.after<0?'−':''}{money(result.after)}</b></p>
     <div className="savings-actions-list">{result.actions.map(action=><div key={action.key}><Check size={15}/><span>{getMoneyCategoryLabel(action.category,language)}<small>{action.choice==='skip'?t('На одну покупку реже · по средней сумме','One fewer purchase · using the average','Cu o cumpărătură mai rar · suma medie','少买一次 · 按平均金额'):t('Сократить расходы на 25%','Reduce spending by 25%','Redu cheltuielile cu 25%','减少支出25%')}</small></span><b>+{money(action.saving)}</b></div>)}</div>
     <label className="savings-reminders"><input type="checkbox" checked={reminders} disabled={saved} onChange={event=>setReminders(event.target.checked)}/><span>{t('Напоминать при похожих тратах','Remind me with similar spending','Amintește-mi la cheltuieli similare','遇到类似支出时提醒我')}<small>{t('Мягкая подсказка, без запрета на покупку','A gentle nudge, purchases stay available','O sugestie blândă, fără a bloca achiziția','温和提示，不会禁止购买')}</small></span></label>
     <p className="savings-disclaimer">{t('Это экономия, а не заработок: расчёт по прошлым записям. План сохраняется на этом устройстве.','These are savings, not earnings: a calculation from past entries. Your plan is stored on this device.','Este economie, nu câștig: calcul din înregistrările trecute. Planul se păstrează pe dispozitiv.','这是节省的资金，而非收益：按历史记录计算。计划保存在此设备。')}</p>
     {error&&<p role="alert" className="savings-error">{error}</p>}
    </>}
   </div></div>
   <footer>{step>0&&!saved&&<button type="button" className="savings-icon" aria-label={t('Назад','Back','Înapoi','返回')} onClick={()=>changeStep(step-1)}><ArrowLeft size={18}/></button>}
    <div className="savings-footer-caption">{step===1?<><small>{t('Может остаться','Could remain','Pot rămâne','可能留下')}</small><b>+{money(result.saving)}</b></>:<small>{labels[step]}</small>}</div>
    <button type="button" className="savings-primary" disabled={(step===0&&!analysis.count)||(step===1&&!result.actions.length)} onClick={()=>saved?close():step<2?changeStep(step+1):save()}>{saved?t('Готово','Done','Gata','完成'):step===0?t('Выбрать, что сократить','Choose what to reduce','Alege ce reduci','选择要减少的支出'):step===1?t('Посмотреть план','See my plan','Vezi planul','查看计划'):t('Сохранить план','Save plan','Salvează planul','保存计划')}{saved?<Check size={16}/>:<ArrowRight size={16}/>}</button>
   </footer>
  </section>
 </div>,document.body);
}
