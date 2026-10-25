import React, { useMemo } from 'react';
import { ChevronDown } from 'lucide-react';
import { parseScaled, MONEY_SCALE, formatMoney } from '../../features/capital/decimal.js';
import './CalendarMonthBrief.css';

export function summarizeCalendarEntries(entries) {
  let income=0n, expense=0n, wins=0, losses=0, invalid=0;
  for (const entry of entries) {
    try {
      const amount=parseScaled(entry.pnl ?? 0,MONEY_SCALE,{allowNegative:true});
      if(amount>0n){income+=amount;wins++;} else if(amount<0n){expense-=amount;losses++;}
    } catch { invalid++; }
  }
  return {income,expense,net:income-expense,wins,losses,invalid,count:entries.length};
}
const copy={
 uk:{title:'Підсумок місяця',month:'Місяць',trading:'Трейди',income:'Доходи',expense:'Витрати',net:'Різниця',profit:'Прибуткові угоди',loss:'Збиткові угоди',result:'Результат торгівлі',empty:'Поки немає записів',records:'Записів',scope:'За записами в',filtered:'Застосовано фільтри',incomplete:'Частину сум не вдалося прочитати'},
 ru:{title:'Итог месяца',income:'Доходы',expense:'Расходы',net:'Разница',profit:'Прибыльные сделки',loss:'Убыточные сделки',result:'Результат торговли',empty:'Пока нет записей',records:'Записей',scope:'По записям в',filtered:'Применены фильтры',incomplete:'Часть сумм не удалось прочитать'},
 en:{title:'Month summary',income:'Income',expense:'Expenses',net:'Net income',profit:'Winning trades',loss:'Losing trades',result:'Trading result',empty:'No entries yet',records:'Entries',scope:'Recorded in',filtered:'Filters applied',incomplete:'Some amounts could not be read'},
 ro:{title:'Rezumatul lunii',income:'Venituri',expense:'Cheltuieli',net:'Diferență',profit:'Tranzacții profitabile',loss:'Tranzacții în pierdere',result:'Rezultat de trading',empty:'Încă nu sunt înregistrări',records:'Înregistrări',scope:'Înregistrări în',filtered:'Filtre aplicate',incomplete:'Unele sume nu au putut fi citite'},
 zh:{title:'本月概览',income:'收入',expense:'支出',net:'净收入',profit:'盈利交易',loss:'亏损交易',result:'交易结果',empty:'暂无记录',records:'记录',scope:'记录货币',filtered:'已应用筛选',incomplete:'部分金额无法读取'},
};
const compactTitles={ru:['Месяц','Трейды'],en:['Month','Trades'],ro:['Luna','Trading'],zh:['本月','交易'],uk:['Місяць','Трейди']};
export default function CalendarMonthBrief({summary,currency,language,traderMode,filtered=false,isLight,goalSummary,goalProgress,goalAchieved=false,children}){
  const locale=String(language).startsWith('uk')?'uk':String(language).startsWith('zh')?'zh':['ro','md'].includes(language)?'ro':language==='en'?'en':'ru';
  const c=copy[locale],stats=useMemo(()=>summarizeCalendarEntries(summary?.entries||[]),[summary]);
  const money=value=>formatMoney(value,currency,locale),result=stats.invalid?'—':`${stats.net>0n?'+':''}${money(stats.net)}`;
  return <details className={`calendar-month-brief ${goalSummary?'calendar-month-overview':''}`} data-light={Boolean(isLight)} data-goal-achieved={goalAchieved} key={`${currency}:${traderMode}`}>
    <summary title={traderMode?c.result:c.title}><span className="month-brief-title">{goalSummary?compactTitles[locale][traderMode?1:0]:traderMode?c.result:c.title}</span><strong data-sign={stats.net>0n?'positive':stats.net<0n?'negative':'neutral'}>{stats.count?result:c.empty}</strong>{goalSummary}<ChevronDown size={14} aria-hidden="true"/>{goalSummary&&<span className="month-overview-progress" aria-hidden="true"><i style={{width:`${goalProgress||0}%`}}/></span>}</summary>
    <div className="month-brief-details"><div className="month-brief-grid">
      <div><span>{traderMode?c.profit:c.income}</span><b>{traderMode?stats.wins:money(stats.income)}</b></div>
      <div><span>{traderMode?c.loss:c.expense}</span><b>{traderMode?stats.losses:money(stats.expense)}</b></div>
      <div><span>{traderMode?c.result:c.net}</span><b>{result}</b></div>
    </div><p>{c.scope} {currency} · {c.records}: {stats.count}{filtered?` · ${c.filtered}`:''}</p>{stats.invalid>0&&<p role="status">{c.incomplete}</p>}</div>
    {children}
  </details>;
}
