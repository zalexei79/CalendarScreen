import React, {useEffect, useState} from 'react';
import {ArrowDownLeft, ArrowUpRight, ArrowRight, ChartNoAxesCombined} from 'lucide-react';
import {getMoneyCategoryLabel} from '../../shared/config/constants.js';
import './FinancialHistoryOverview.css';

export default function FinancialHistoryOverview({income, expense, total, count, currency, symbol, formatMoney, analysis, insights, language, isLight, hasTrading, scope, onCategory, children}) {
  const [direction, setDirection] = useState('expense');
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setRevealed(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  useEffect(() => { if (scope === 'income' || scope === 'expense') setDirection(scope); }, [scope]);
  const copy = (ru, en, ro, zh) => language === 'ru' ? ru : language === 'ro' || language === 'md' ? ro : language === 'zh-CN' ? zh : en;
  const mixed = currency === 'ALL';
  const flow = income + expense;
  const share = flow > 0 ? income / flow : 0;
  const groups = direction === 'expense' ? analysis.expenseCategories : analysis.incomeSources;
  const groupTotal = direction === 'expense' ? expense : income;
  const money = (value, signed = false) => `${signed ? value < 0 ? '−' : value > 0 ? '+' : '' : ''}${symbol}${formatMoney(Math.abs(value))}`;
  return <div className={`financial-overview ${isLight ? 'is-light' : ''}`}>
    <section className="financial-hero" aria-label={copy('Итог периода', 'Period result', 'Rezultatul perioadei', '时段结果')}>
      <div className="financial-hero-heading"><span className="financial-eyebrow">DAYRIS <i>PRO</i></span><span className="financial-quiet">{count} {copy('записей', 'entries', 'înregistrări', '条记录')} · {mixed ? copy('Все валюты', 'All currencies', 'Toate monedele', '全部货币') : currency}</span></div>
      <div className="financial-hero-main">
        <div className="financial-balance">
          <p>{copy('Итог периода', 'Period result', 'Rezultatul perioadei', '时段结果')}</p>
          <div key={`${currency}:${total}`} className="financial-amount">{mixed ? '—' : money(total, true)}</div>
          <p className="financial-summary">{mixed ? copy('Выберите валюту, чтобы увидеть итог и распределение.', 'Choose a currency to see your result and breakdown.', 'Alege moneda pentru rezultat și distribuție.', '选择货币查看结果与分布。') : !count ? copy('Всё начинается с первой записи.', 'It starts with your first entry.', 'Totul începe cu prima înregistrare.', '从第一条记录开始。') : total >= 0 ? copy('Поступления покрывают списания за выбранный период.', 'Inflows cover outflows for this period.', 'Încasările acoperă ieșirile în această perioadă.', '本时段收入覆盖支出。') : copy('За этот период списано больше, чем поступило.', 'Outflows exceeded inflows for this period.', 'În această perioadă ieșirile depășesc încasările.', '本时段支出超过收入。')}</p>
        </div>
        {!mixed && <div className="financial-flow" aria-label={copy('Доля поступлений', 'Inflow share', 'Ponderea încasărilor', '收入占比')}>
          <svg viewBox="0 0 128 128" aria-hidden="true"><circle className="financial-ring-track" cx="64" cy="64" r="54"/><circle className="financial-ring-value" cx="64" cy="64" r="54" pathLength="100" strokeDasharray={`${revealed ? share * 100 : 0} 100`} transform="rotate(-90 64 64)"/></svg>
          <div><strong>{Math.round(share * 100)}<small>%</small></strong><span>{copy('поступления', 'inflows', 'încasări', '收入')}</span></div>
        </div>}
      </div>
      <div className="financial-totals">
        <div><span><ArrowDownLeft size={16}/>{copy('Поступления', 'Inflows', 'Încasări', '收入')}</span><strong className="financial-positive">{mixed ? '—' : money(income)}</strong></div>
        <div><span><ArrowUpRight size={16}/>{copy('Списания', 'Outflows', 'Ieșiri', '支出')}</span><strong>{mixed ? '—' : money(expense)}</strong></div>
      </div>
      {hasTrading && <p className="financial-trading-note"><ChartNoAxesCombined size={14}/>{copy('В итог включены торговые операции. План экономии учитывает только личные траты.', 'Totals include trading. The savings plan uses only personal spending.', 'Totalurile includ tranzacții. Planul include doar cheltuieli personale.', '总额包含交易，节省计划仅考虑个人支出。')}</p>}
    </section>

    {!mixed && count > 0 && <section className="financial-distribution">
      <div className="financial-section-heading"><h3>{copy('За цифрами', 'Behind the numbers', 'Dincolo de cifre', '数字背后')}</h3><div className="financial-direction" role="group" aria-label={copy('Распределение', 'Breakdown', 'Distribuție', '分布')}>
        {['expense', 'income'].map(value => <button key={value} type="button" aria-pressed={direction === value} onClick={() => setDirection(value)}>{value === 'expense' ? copy('Списания', 'Outflows', 'Ieșiri', '支出') : copy('Поступления', 'Inflows', 'Încasări', '收入')}</button>)}
      </div></div>
      <div key={direction} className="financial-category-list">
        {groups.slice(0, 3).map(([name, amount], index) => <button type="button" className="financial-category" key={name} onClick={() => onCategory(name, direction)}>
          <span className="financial-rank">{String(index + 1).padStart(2, '0')}</span><span className="financial-category-content"><span className="financial-category-name">{getMoneyCategoryLabel(name, language)}</span><span className="financial-category-track"><span style={{transform: `scaleX(${groupTotal > 0 ? amount / groupTotal : 0})`}}/></span></span><span className="financial-category-value"><strong>{money(amount)}</strong><small>{groupTotal > 0 ? Math.round(amount / groupTotal * 100) : 0}%</small></span><ArrowRight size={16}/>
        </button>)}
        {!groups.length && <p className="financial-quiet financial-empty">{copy('В этой части периода записей нет.', 'No entries in this part of the period.', 'Nu există înregistrări în această parte.', '此部分时段没有记录。')}</p>}
        {groups.length > 3 && <p className="financial-quiet">{copy(`Ещё ${groups.length - 3} разделов — в истории ниже`, `${groups.length - 3} more categories in the history below`, `Încă ${groups.length - 3} categorii în istoricul de mai jos`, `下方历史中还有 ${groups.length - 3} 个类别`)}</p>}
      </div>
    </section>}

    {!mixed && insights.previousAvailable && <div className="financial-comparison"><span>{copy('К прошлому периоду', 'vs previous period', 'Față de perioada anterioară', '相比上一时段')}</span>{[[copy('Поступления', 'Inflows', 'Încasări', '收入'), insights.incomeChange], [copy('Списания', 'Outflows', 'Ieșiri', '支出'), insights.expenseChange]].map(([label, change]) => <span key={label}>{label} <b>{change === null ? '—' : `${change > 0 ? '+' : ''}${change}%`}</b></span>)}</div>}
    {!mixed && insights.recurring && <div className="financial-insight"><span className="financial-eyebrow">{copy('Обратите внимание', 'Worth a look', 'Merită atenție', '值得关注')}</span><p>{getMoneyCategoryLabel(insights.recurring[0], language)} · {insights.recurring[1].count} {copy('повторных списаний', 'repeat outflows', 'ieșiri repetate', '笔重复支出')} · <strong>{money(insights.recurring[1].amount)}</strong></p><button type="button" onClick={() => onCategory(insights.recurring[0], 'expense')}>{copy('Посмотреть записи', 'Review entries', 'Vezi înregistrările', '查看记录')}<ArrowRight size={15}/></button></div>}
    {!mixed && insights.projectedExpense !== null && count > 0 && <div className="financial-comparison"><span>{copy('При текущем темпе к концу периода', 'At this pace by period end', 'În acest ritm până la final', '按当前速度到时段结束')}</span><strong>≈ {money(insights.projectedExpense)}</strong><small>{copy('Оценка по среднему темпу списаний', 'Estimate from average outflow pace', 'Estimare după ritmul mediu al ieșirilor', '按平均支出速度估算')}</small></div>}
    <div className="financial-plan">{children}</div>
  </div>;
}
