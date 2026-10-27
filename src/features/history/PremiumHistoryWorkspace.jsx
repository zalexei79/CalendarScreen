import React, {useEffect, useRef, useState} from 'react';
import {ArrowDownLeft, ArrowUpRight, ArrowLeft, ArrowRight, ChevronDown, ChevronRight, SlidersHorizontal, Wallet, ChartNoAxesCombined, Repeat2, X, Pencil} from 'lucide-react';
import {intlLocale} from '../../shared/i18n/locale.js';
import {getMoneyCategoryLabel} from '../../shared/config/constants.js';
import {freeHistoryCount} from './freeHistoryCopy.js';
import {premiumHistoryCopy, premiumHistoryTradeCount} from './premiumHistoryCopy.js';
import {premiumTradeFacts} from './premiumHistoryModel.mjs';
import './PremiumHistoryWorkspace.css';

export default function PremiumHistoryWorkspace({model, records, language, traderMode, trading, tab, onTab, onContext,
  period, periodLabel, periodOptions, onPeriod, currency, currencies, onCurrency, platform, onPlatform,
  scope, onScope, category, onCategory, onClearCategory, filtersOpen, onFilters, categoryPicker,
  dateFrom, dateTo, onDateFrom, onDateTo, onRecord, getIcon, renderReceipt, dynamics, plan, children}) {
  const copy = premiumHistoryCopy(language), {summary} = model;
  const [direction, setDirection] = useState('expense'), [expanded, setExpanded] = useState(false), [selected, setSelected] = useState(null);
  const card = useRef(null), amountNode = useRef(null), panel = useRef(null), detailTitle = useRef(null), previousAmount = useRef(null), animation = useRef(null);
  const money = value => new Intl.NumberFormat(intlLocale(language), {minimumFractionDigits:2,maximumFractionDigits:2}).format(Math.abs(value));
  const signed = value => `${value < 0 ? '−' : value > 0 ? '+' : ''}${money(value)}`;
  const date = value => new Intl.DateTimeFormat(intlLocale(language), {day:'numeric', month:'long', year:'numeric', timeZone:'UTC'}).format(new Date(value + 'T12:00:00Z'));
  const amount = summary.mixed ? '—' : signed(summary.total), unit = summary.mixed || summary.currency === 'ALL' ? '' : summary.currency;
  const selectedRow = selected && records.find(row => row.id === selected);
  useEffect(() => {setExpanded(false); setSelected(null);}, [trading, period, currency, platform, scope, category, dateFrom, dateTo]);
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const stop = () => {if (media.matches) {animation.current?.cancel(); panel.current?.getAnimations().forEach(item => item.cancel());}};
    media.addEventListener('change', stop); return () => {media.removeEventListener('change', stop); animation.current?.cancel();};
  }, []);
  useEffect(() => {
    if (previousAmount.current !== null && previousAmount.current !== amount && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      animation.current?.cancel(); animation.current = amountNode.current?.animate?.([{opacity:.5,transform:'translateY(3px)'},{opacity:1,transform:'translateY(0)'}], {duration:280,easing:'cubic-bezier(.22,1,.36,1)'});
    }
    previousAmount.current = amount;
  }, [amount]);
  useEffect(() => {if (selectedRow) detailTitle.current?.focus({preventScroll:true});}, [selectedRow]);
  const chooseTab = value => {setSelected(null); onTab(value);};
  const fact = (label, value) => <div className="premium-history-fact"><span>{label}</span><strong>{value ?? '—'}</strong></div>;
  const rowList = (rows, compact = false) => <>
    {rows.length ? (compact ? rows.slice(0,3) : expanded ? rows : rows.slice(0,trading ? 5 : 3)).map((row, index) => {
      const Icon = trading ? row.direction === 'SHORT' ? ArrowDownLeft : ArrowUpRight : getIcon(row.instrument);
      const receipt = !trading && renderReceipt?.(row);
      return <React.Fragment key={row.id}>
        {!trading && (index === 0 || rows[index-1].dateKey !== row.dateKey) && <h4 className="premium-history-record-date">{date(row.dateKey)}</h4>}
        {receipt || <button type="button" className={`premium-history-row ${trading ? 'premium-history-trade' : 'financial-record-row'}`} onClick={() => trading ? setSelected(row.id) : onRecord(row)}>
          <span className="premium-history-row-icon"><Icon size={17} aria-hidden="true"/></span>
          <span className="premium-history-row-copy"><span>{trading ? row.instrument : getMoneyCategoryLabel(row.instrument,language)} {trading && row.direction && <small>{row.direction === 'LONG' ? 'Buy' : row.direction === 'SHORT' ? 'Sell' : row.direction}</small>}</span><small>{trading ? `${date(row.dateKey)} · ${row.platform || 'Manual'}` : row.time}{!trading && row.comment && !row.comment.includes('[DAYRIS:') ? ` · ${row.comment}` : ''}</small></span>
          <span className="premium-history-row-amount" data-negative={Number(row.pnl)<0}>{signed(Number(row.pnl))}{currency === 'ALL' && <small>{row.currency || 'USD'}</small>}</span>
          {!trading && <Pencil size={14} className="premium-history-edit" aria-hidden="true"/>}
        </button>}
      </React.Fragment>;
    }) : <p className="premium-history-empty">{trading ? copy.emptyTrades : copy.empty}</p>}
    {!compact && rows.length > (trading ? 5 : 3) && <button type="button" className="premium-history-more" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>{expanded ? copy.less : `${copy.more} · ${rows.length - (trading ? 5 : 3)}`}</button>}
  </>;
  const scopes = <div className="premium-history-scopes" role="group" aria-label={copy.scope}>{[['all',copy.all],['win',trading ? copy.positive : copy.income],['loss',trading ? copy.negative : copy.expense]].map(([value,label]) => <button key={value} type="button" aria-pressed={scope === value} onClick={() => onScope(value)}>{label}</button>)}</div>;
  const tabs = trading ? [['overview',copy.overview],['dynamics',copy.dynamics],['trades',copy.trades],['analytics',copy.advanced]] : [['records',copy.records],['dynamics',copy.dynamics],['analysis',copy.analysis]];
  const groups = direction === 'expense' ? model.expenses : model.incomes, groupTotal = direction === 'expense' ? summary.expense : summary.income;
  return <section className="premium-history-workspace" data-context={trading ? 'trading' : 'finance'}>
    {traderMode && <div className="premium-history-context" role="group" aria-label={copy.sections}>{[[false,copy.finance,Wallet],[true,copy.trading,ChartNoAxesCombined]].map(([value,label,Icon]) => <button key={label} type="button" aria-pressed={trading === value} onClick={() => onContext(value)}><Icon size={15} aria-hidden="true"/>{label}</button>)}</div>}
    <section ref={card} className="premium-history-card financial-hero" aria-label={trading ? copy.tradeResult : copy.result}
      onPointerMove={event => {if(event.pointerType !== 'mouse' || matchMedia('(prefers-reduced-motion: reduce)').matches)return;const rect=card.current.getBoundingClientRect();card.current.style.setProperty('--premium-light-x',`${Math.round(Math.max(0,Math.min(1,(event.clientX-rect.left)/rect.width))*100)}%`);}}
      onPointerLeave={() => card.current.style.removeProperty('--premium-light-x')}>
      <p className="premium-history-result-label">{trading ? copy.tradeResult : copy.result}</p>
      <div ref={amountNode} className="premium-history-balance" data-negative={!summary.mixed && summary.total<0}>
        <strong className="premium-history-amount financial-amount" style={{'--premium-fit':`${Math.min(14,145/Math.max(10,amount.length))}cqw`}}>{amount}</strong>{unit && <span>{unit}</span>}
      </div>
      <p className="premium-history-caption">{periodLabel} · {trading ? premiumHistoryTradeCount(summary.count,language) : freeHistoryCount(summary.count,language)}</p>
      {summary.mixed && <p className="premium-history-hint">{copy.mixed}</p>}
      <div className="premium-history-totals"><div><span><ArrowDownLeft size={14} aria-hidden="true"/>{trading ? copy.winning : copy.income}</span><strong>{summary.mixed ? '—' : money(summary.income)}</strong></div><div><span><ArrowUpRight size={14} aria-hidden="true"/>{trading ? copy.losing : copy.expense}</span><strong>{summary.mixed ? '—' : money(summary.expense)}</strong></div></div>
    </section>
    <div className="premium-history-controls">
      <div className="premium-history-select premium-history-period"><select aria-label={copy.period} value={period} onChange={event => onPeriod(event.target.value)}>{periodOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select><ChevronDown size={13} aria-hidden="true"/></div>
      <div className="premium-history-select premium-history-currency"><select aria-label={copy.currency} value={currency} onChange={event => onCurrency(event.target.value)}><option value="ALL">{copy.all}</option>{currencies.map(item => <option key={item.code} value={item.code}>{item.code}</option>)}</select><ChevronDown size={13} aria-hidden="true"/></div>
      <button type="button" className="premium-history-filter" aria-expanded={filtersOpen} aria-label={copy.filters} onClick={onFilters}><SlidersHorizontal size={17}/></button>
    </div>
    {trading && <div className="premium-history-select premium-history-platform"><select aria-label={copy.platform} value={platform} onChange={event=>onPlatform(event.target.value)}><option value="ALL">{copy.allPlatforms}</option>{['cTrader','MT4','MT5','Manual'].map(value=><option key={value}>{value}</option>)}</select><ChevronDown size={13} aria-hidden="true"/></div>}
    {filtersOpen && <div className="premium-history-filters">{period === 'custom' && <div className="premium-history-dates"><label>{copy.dateFrom}<input type="date" value={dateFrom} onChange={event=>onDateFrom(event.target.value)}/></label><label>{copy.dateTo}<input type="date" value={dateTo} onChange={event=>onDateTo(event.target.value)}/></label></div>}{categoryPicker}</div>}
    <nav className="premium-history-tabs" aria-label={copy.sections}>{tabs.map(([value,label]) => <button key={value} type="button" aria-pressed={tab===value} onClick={()=>chooseTab(value)}>{label}</button>)}</nav>
    <div ref={panel} className="premium-history-panel" key={`${trading}:${tab}`}>
      {selectedRow && trading ? (()=>{const row=selectedRow,facts=premiumTradeFacts(row),code=row.currency||'USD';return <section className="premium-history-ticket">
        <button type="button" className="premium-history-back" onClick={()=>setSelected(null)}><ArrowLeft size={15}/>{copy.back}</button>
        <div className="premium-history-ticket-heading"><div><h3 ref={detailTitle} tabIndex={-1}>{row.instrument}</h3><p>{row.direction === 'LONG' ? 'Buy' : row.direction === 'SHORT' ? 'Sell' : row.direction || '—'} · {date(row.dateKey)} · {row.time}</p></div><div><strong data-negative={Number(row.pnl)<0}>{signed(Number(row.pnl))}</strong><small>{code}</small></div></div>
        <div className="premium-history-prices"><div><span>{copy.entry}</span><strong>{facts.entry === null ? '—' : money(facts.entry)}</strong></div><ArrowRight size={17} aria-hidden="true"/><div><span>{copy.exit}</span><strong>{facts.exit === null ? '—' : money(facts.exit)}</strong></div></div>
        {fact(copy.volume,facts.volume === null ? null : String(facts.volume))}{fact(copy.gross,facts.gross === null ? null : signed(facts.gross)+' '+code)}{fact(copy.commission,facts.commission === null ? null : signed(facts.commission)+' '+code)}{fact(copy.swap,facts.swap === null ? null : signed(facts.swap)+' '+code)}{fact(copy.net,signed(Number(row.pnl))+' '+code)}{fact(copy.platform,row.platform||'Manual')}{fact(copy.account,facts.account)}{facts.ticket && fact(copy.ticket,facts.ticket)}{facts.takeProfit !== null && fact(copy.takeProfit,money(facts.takeProfit))}{facts.stopLoss !== null && fact(copy.stopLoss,money(facts.stopLoss))}
        {[facts.entry,facts.exit,facts.volume,facts.commission,facts.swap].includes(null) && <p className="premium-history-hint">{copy.missing}</p>}{facts.note && <p className="premium-history-hint">{copy.note}: {facts.note}</p>}
        <button type="button" className="premium-history-more" onClick={()=>onRecord(row)}><Pencil size={14}/>{copy.edit}</button>
      </section>;})() : <>
        {!trading && tab==='records' && <>{category && <div className="premium-history-category-filter"><span>{getMoneyCategoryLabel(category,language)}</span><button type="button" aria-label={copy.clearCategory} onClick={onClearCategory}><X size={15}/></button></div>}{scopes}<p className="premium-history-list-count">{freeHistoryCount(records.length,language)}</p>{rowList(records)}{children}</>}
        {!trading && tab==='analysis' && <>
          {!summary.count && <p className="premium-history-empty">{copy.empty}</p>}
          {!summary.mixed && summary.count>0 && <section className="financial-distribution"><div className="premium-history-section-heading"><h3>{direction==='expense'?copy.categories:copy.sources}</h3><span>{unit}</span></div>
            <div className="premium-history-direction" role="group" aria-label={copy.analysis}>{[['expense',copy.expense],['income',copy.income]].map(([value,label])=><button key={value} type="button" aria-pressed={direction===value} onClick={()=>setDirection(value)}>{label}</button>)}</div>
            {summary.income>0 && <p className="premium-history-hint">{copy.saved} · {Math.round((summary.income-summary.expense)/summary.income*100)}%</p>}
            {groups.slice(0,3).map(group=><button type="button" className="premium-history-category financial-category" key={group.name} onClick={()=>onCategory(group.name,direction)}><span><span>{getMoneyCategoryLabel(group.name,language)}</span><strong>{money(group.amount)}</strong></span><span className="premium-history-track"><span style={{width:`${groupTotal>0?group.amount/groupTotal*100:0}%`}}/></span><small><span>{freeHistoryCount(group.count,language)}</span><span>{groupTotal>0?Math.round(group.amount/groupTotal*100):0}% <ChevronRight size={12}/></span></small></button>)}
            {!groups.length && <p className="premium-history-hint">{copy.empty}</p>}
          </section>}
          {summary.mixed && <p className="premium-history-hint">{copy.mixed}</p>}
          {model.hasTrading && <p className="premium-history-hint financial-trading-note">{copy.tradeNote}</p>}
          {model.comparison && <div className="premium-history-insight"><span>{copy.previous} · {date(model.comparison.range.from)} — {date(model.comparison.range.to)}</span><div>{[[copy.income,model.comparison.income],[copy.expense,model.comparison.expense]].map(([label,value])=><span key={label}>{label} <strong>{value===null?'—':`${value>0?'+':''}${value}%`}</strong></span>)}</div></div>}
          {model.recurring && !summary.mixed && <button type="button" className="premium-history-recurring" onClick={()=>onCategory(model.recurring.name,'expense')}><Repeat2 size={16} aria-hidden="true"/><span><strong>{getMoneyCategoryLabel(model.recurring.name,language)} · {model.recurring.count}</strong><small>{copy.repeated} · {copy.review}</small></span><ChevronRight size={14}/></button>}
          {model.projectedExpense!==null && <div className="premium-history-insight"><span>{copy.estimate}</span><strong>≈ {money(model.projectedExpense)} {unit}</strong><small>{copy.estimateHint}</small></div>}
          <details className="premium-history-plan"><summary><SlidersHorizontal size={15}/><span>{copy.plan}</span><ChevronDown size={14}/></summary><div>{plan}</div></details>
        </>}
        {trading && tab==='overview' && <><div className="premium-history-metrics"><div><span>{copy.winrate}</span><strong>{model.winrate===null?'—':`${model.winrate}%`}</strong><small>{model.winCount} / {summary.count}</small></div><div><span>{copy.factor}</span><strong>{model.profitFactor===null?'—':model.profitFactor===Infinity?'∞':model.profitFactor.toFixed(2)}</strong><small>{unit||copy.mixed}</small></div><div><span>{copy.drawdown}</span><strong>{model.maxDrawdown===null?'—':money(model.maxDrawdown)}</strong><small>{unit}</small></div></div><p className="premium-history-hint">{copy.closed}</p><div className="premium-history-section-heading"><h3>{copy.recent}</h3><span>{unit}</span></div>{rowList(records,true)}<button type="button" className="premium-history-more" onClick={()=>chooseTab('trades')}>{copy.journal} · {records.length}<ArrowUpRight size={14}/></button></>}
        {(tab==='dynamics' || trading && tab==='analytics' && summary.mixed) && (tab==='dynamics' && !summary.mixed ? dynamics : <p className="premium-history-hint">{copy.mixed}</p>)}
        {trading && tab==='trades' && <>{scopes}{rowList(records)}{children}</>}
      </>}
    </div>
  </section>;
}
