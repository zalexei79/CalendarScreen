import React,{useState} from 'react';
import {ArrowUpRight,Sparkles,Check} from 'lucide-react';
import {savingsText} from './savingsCopy.js';
import './SavingsPlan.css';
export default function WealthPlan({trades,isTrading,currency,symbol,formatMoney,language,isLight,onStartReview,plan,onClear}){
 const t=savingsText(language),mixed=currency==='ALL';
 const [error,setError]=useState('');
 const clear=()=>{try{onClear();setError('');}catch{setError(t('Не удалось убрать план. Попробуй ещё раз.','Could not remove the plan. Try again.','Nu s-a putut șterge planul. Încearcă din nou.','无法删除计划，请重试。'));}};
 const count=trades.filter(item=>!isTrading(item)&&Number(item.pnl)<0).length;
 const saved=plan?.currency===currency&&plan.actions.length>0;
 return <section className={`wealth-entry ${isLight?'is-light':''}`}>
  <div className="wealth-entry-heading"><span className="savings-eyebrow"><Sparkles size={14}/> DAYRIS PRO</span>{saved&&<span className="savings-saved"><Check size={13}/>{t('План сохранён','Plan saved','Plan salvat','计划已保存')}</span>}</div>
  <h3>{t('Стать богаче','Grow your wealth','Mai mulți bani','积累更多财富')}</h3>
  <p>{saved?t('Твой выбор сохранён. Пересматривай план, когда меняются привычки.','Your choices are saved. Review your plan as habits change.','Alegerile sunt salvate. Revizuiește planul când se schimbă obiceiurile.','你的选择已保存，习惯变化时可重新查看计划。'):t('Записывай расходы. Найдём, что можно сократить, и покажем, сколько останется у тебя.','Keep logging expenses. Find what to reduce and see how much you could keep.','Notează cheltuielile. Găsim ce poți reduce și cât poți păstra.','记录支出，找出可以减少的购买，看看能留下多少资金。')}</p>
  {saved&&<div className="wealth-saved-amount"><span>+{symbol}{formatMoney(plan.saving)}</span><small>{t('по сохранённому сценарию','in your saved scenario','în scenariul salvat','按已保存方案')}<br/>{plan.period}</small><button type="button" className="savings-text-button" onClick={clear}>{t('Убрать план','Remove plan','Șterge planul','删除计划')}</button></div>}
  {error&&<p role="alert">{error}</p>}
  <div className="wealth-entry-footer"><small>{mixed?t('Выбери одну валюту выше','Choose one currency above','Alege o monedă mai sus','请在上方选择一种货币'):count?`${count} ${t('расходов за выбранный период','expenses in this period','cheltuieli în perioadă','笔本时段支出')}`:t('Начни с первой траты','Start with your first expense','Începe cu prima cheltuială','从第一笔支出开始')}</small><button type="button" disabled={mixed} onClick={onStartReview}>{saved?t('Пересмотреть план','Review plan','Revizuiește planul','重新查看计划'):t('Разобрать мои расходы','Review my spending','Analizează cheltuielile','分析我的支出')}<ArrowUpRight size={16}/></button></div>
 </section>;
}
