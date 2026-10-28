import React, {useEffect, useId, useRef, useState} from 'react';
import {ArrowDownLeft, ArrowUpRight, ArrowLeft, ArrowRight, ChevronDown, ChevronRight, SlidersHorizontal, Wallet, ChartNoAxesCombined, X, Pencil} from 'lucide-react';
import {intlLocale} from '../../shared/i18n/locale.js';
import {getMoneyCategoryLabel} from '../../shared/config/constants.js';
import {freeHistoryCount} from './freeHistoryCopy.js';
import {premiumHistoryCopy, premiumHistoryTradeCount} from './premiumHistoryCopy.js';
import {premiumTradeFacts} from './premiumHistoryModel.mjs';
import {premiumHistoryChapterCopy} from './premiumHistoryChapterCopy.js';
import PremiumHistoryCurve from './PremiumHistoryCurve.jsx';
import './PremiumHistoryWorkspace.css';

export default function PremiumHistoryWorkspace({model, records, language, traderMode, trading, tab, onTab, onContext,
  period, periodLabel, periodOptions, onPeriod, currency, currencies, onCurrency, platform, onPlatform,
  scope, onScope, category, onCategory, onClearCategory, filtersOpen, onFilters, categoryPicker,
  dateFrom, dateTo, onDateFrom, onDateTo, onRecord, getIcon, renderReceipt, dynamics, analytics, plan, goal, reminders, tools, receiptCapture, onWallet, onCapital, children}) {
  const copy = premiumHistoryCopy(language), chapterCopy = premiumHistoryChapterCopy(language), {summary} = model;
  const chapterId = useId();
  const [riskMode,setRiskMode]=useState('quality'), [breakdownMode,setBreakdownMode]=useState('radar'), [graphMode,setGraphMode]=useState('cumulative');
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
  const activeChapter=({overview:'risk',trades:'records',analysis:'breakdown',analytics:'risk'})[tab] ?? tab;
  const groups = direction === 'expense' ? model.expenses : model.incomes, groupTotal = direction === 'expense' ? summary.expense : summary.income;
  const chapters=trading
    ? [['risk',chapterCopy.risk],['dynamics',chapterCopy.curve],['instruments',chapterCopy.instruments],['discipline',chapterCopy.discipline],['plan',chapterCopy.tradePlan],['records',chapterCopy.journal]]
    : [['dynamics',chapterCopy.dynamics],['categories',chapterCopy.categories],['breakdown',chapterCopy.breakdown],['plan',chapterCopy.plan],['records',chapterCopy.records]];
  const switcher=(value,onChange,options)=><div className="premium-history-subtabs" role="group" aria-label={copy.sections}>{options.map(([key,label])=><button type="button" key={key} aria-pressed={value===key} onClick={()=>onChange(key)}>{label}</button>)}</div>;
  function caption(id) {
    if(id==='records') return `${trading?premiumHistoryTradeCount(records.length,language):freeHistoryCount(records.length,language)} · ${trading?chapterCopy.journalHint:chapterCopy.recordsHint}`;
    if(id==='plan') return trading?chapterCopy.tradePlanHint:chapterCopy.planHint;
    if(id==='discipline') return chapterCopy.notesHint;
    if(summary.mixed) return chapterCopy.separate;
    if(id==='risk') return `${model.winrate===null?'—':model.winrate+'%'} · ${copy.factor} ${model.profitFactor===null?'—':model.profitFactor===Infinity?'∞':model.profitFactor.toFixed(2)}`;
    if(id==='categories') return `${model.expenses.length} ${chapterCopy.expenses} · ${model.incomes.length} ${chapterCopy.sources}`;
    if(id==='instruments') return `${new Set(model.rows.map(row=>row.instrument)).size} ${chapterCopy.instrumentsCount} · ${new Set(model.rows.map(row=>row.platform||'Manual')).size} ${chapterCopy.platforms}`;
    if(id==='breakdown') return chapterCopy.breakdownHint;
    return periodLabel;
  }
  const categories=()=>summary.mixed ? analytics?.('finance-radar') : <section className="financial-distribution">
    {switcher(direction,setDirection,[['expense',copy.expense],['income',copy.income]])}
    {groups.map(group=><button type="button" className="premium-history-category financial-category" key={group.name} onClick={()=>{onCategory(group.name,direction);chooseTab('records');}}><span><span>{getMoneyCategoryLabel(group.name,language)}</span><strong>{money(group.amount)} {unit}</strong></span><span className="premium-history-track"><span style={{width:`${groupTotal>0?group.amount/groupTotal*100:0}%`}}/></span><small><span>{freeHistoryCount(group.count,language)}</span><span>{groupTotal>0?Math.round(group.amount/groupTotal*100):0}% <ChevronRight size={12}/></span></small></button>)}
    {!groups.length && <p className="premium-history-empty">{copy.empty}</p>}
  </section>;
  const ticket=selectedRow && trading ? (()=>{const row=selectedRow,facts=premiumTradeFacts(row),code=row.currency||'USD';return <section className="premium-history-ticket">
        <button type="button" className="premium-history-back" onClick={()=>setSelected(null)}><ArrowLeft size={15}/>{copy.back}</button>
        <div className="premium-history-ticket-heading"><div><h3 ref={detailTitle} tabIndex={-1}>{row.instrument}</h3><p>{row.direction === 'LONG' ? 'Buy' : row.direction === 'SHORT' ? 'Sell' : row.direction || '—'} · {date(row.dateKey)} · {row.time}</p></div><div><strong data-negative={Number(row.pnl)<0}>{signed(Number(row.pnl))}</strong><small>{code}</small></div></div>
        <div className="premium-history-prices"><div><span>{copy.entry}</span><strong>{facts.entry === null ? '—' : money(facts.entry)}</strong></div><ArrowRight size={17} aria-hidden="true"/><div><span>{copy.exit}</span><strong>{facts.exit === null ? '—' : money(facts.exit)}</strong></div></div>
        {fact(copy.volume,facts.volume === null ? null : String(facts.volume))}{fact(copy.gross,facts.gross === null ? null : signed(facts.gross)+' '+code)}{fact(copy.commission,facts.commission === null ? null : signed(facts.commission)+' '+code)}{fact(copy.swap,facts.swap === null ? null : signed(facts.swap)+' '+code)}{fact(copy.net,signed(Number(row.pnl))+' '+code)}{fact(copy.platform,row.platform||'Manual')}{fact(copy.account,facts.account)}{facts.ticket && fact(copy.ticket,facts.ticket)}{facts.takeProfit !== null && fact(copy.takeProfit,money(facts.takeProfit))}{facts.stopLoss !== null && fact(copy.stopLoss,money(facts.stopLoss))}
        {[facts.entry,facts.exit,facts.volume,facts.commission,facts.swap].includes(null) && <p className="premium-history-hint">{copy.missing}</p>}{facts.note && <p className="premium-history-hint">{copy.note}: {facts.note}</p>}
        <button type="button" className="premium-history-more" onClick={()=>onRecord(row)}><Pencil size={14}/>{copy.edit}</button>
      </section>;})() : null;
  const selectedTotal=records.reduce((total,row)=>total+Number(row.pnl||0),0);
  function body(id) {
    switch(id) {
      case 'risk': return <>{switcher(riskMode,setRiskMode,[['quality',chapterCopy.quality],['stability',chapterCopy.stability]])}{analytics?.(`risk-${riskMode}`)}</>;
      case 'dynamics': return <>{!trading && !summary.mixed && switcher(graphMode,setGraphMode,[['cumulative',chapterCopy.cumulative],['cashflow',chapterCopy.cashflow]])}{summary.mixed&&!trading ? null : trading||graphMode==='cashflow' ? dynamics : <PremiumHistoryCurve key={`${period}:${currency}:${dateFrom}:${dateTo}`} model={model} language={language}/>} {analytics?.('comparison')}{trading && analytics?.('period-dynamics')}</>;
      case 'categories': return categories();
      case 'breakdown': return <>{switcher(breakdownMode,setBreakdownMode,[['radar',chapterCopy.radar],['habits',chapterCopy.habits]])}{analytics?.(`finance-${breakdownMode}`)}</>;
      case 'instruments': return <>{trading && <div className="premium-history-select premium-history-platform"><select aria-label={copy.platform} value={platform} onChange={event=>onPlatform(event.target.value)}><option value="ALL">{copy.allPlatforms}</option>{['cTrader','MT4','MT5','Manual'].map(value=><option key={value}>{value}</option>)}</select><ChevronDown size={13} aria-hidden="true"/></div>}{tools}{analytics?.('instruments')}</>;
      case 'discipline': return analytics?.('discipline');
      case 'plan': return <div className="premium-history-goals">{goal}{!trading && <div className="premium-history-plan-content">{plan}</div>}{reminders}</div>;
      case 'records': return ticket || <>
        {category && <div className="premium-history-category-filter"><span>{trading?category:getMoneyCategoryLabel(category,language)}</span><button type="button" aria-label={copy.clearCategory} onClick={onClearCategory}><X size={15}/></button></div>}
        {scopes}
        {(category||scope!=='all') && !summary.mixed && <p className="premium-history-selection">{chapterCopy.selection}<strong>{signed(selectedTotal)} {unit}</strong></p>}
        {rowList(records)}{!trading && receiptCapture}{children}
      </>;
      default:return null;
    }
  }
  return <section className="premium-history-workspace" data-context={trading ? 'trading' : 'finance'}>
    {traderMode && <div className="premium-history-context" role="group" aria-label={copy.sections}>{[[false,copy.finance,Wallet],[true,copy.trading,ChartNoAxesCombined]].map(([value,label,Icon]) => <button key={label} type="button" aria-pressed={trading === value} onClick={() => onContext(value)}><Icon size={15} aria-hidden="true"/>{label}</button>)}</div>}
    <section ref={card} className="premium-history-card financial-hero" aria-label={trading ? copy.tradeResult : copy.result}
      onPointerMove={event => {if(event.pointerType !== 'mouse' || matchMedia('(prefers-reduced-motion: reduce)').matches)return;const rect=card.current.getBoundingClientRect();card.current.style.setProperty('--premium-light-x',`${Math.round(100*Math.max(0,Math.min(1,(event.clientX-rect.left)/rect.width)))}%`);}}
      onPointerLeave={() => card.current.style.removeProperty('--premium-light-x')}>
      <p className="premium-history-result-label">{trading ? copy.tradeResult : copy.result}</p>
      <div ref={amountNode} className="premium-history-balance" data-negative={!summary.mixed && summary.total<0}>
        <strong className="premium-history-amount financial-amount" style={{'--premium-fit':`${Math.min(14,145/Math.max(10,amount.length))}cqw`}}>{amount}</strong>{unit && <span>{unit}</span>}
      </div>
      <p className="premium-history-caption">{periodLabel} · {trading ? premiumHistoryTradeCount(summary.count,language) : freeHistoryCount(summary.count,language)}</p>
      {summary.mixed && <p className="premium-history-hint">{copy.mixed}</p>}
      <div className="premium-history-totals"><div><span><ArrowDownLeft size={14} aria-hidden="true"/>{trading ? copy.winning : copy.income}</span><strong>{summary.mixed ? '—' : money(summary.income)}</strong></div><div><span><ArrowUpRight size={14} aria-hidden="true"/>{trading ? copy.losing : copy.expense}</span><strong>{summary.mixed ? '—' : money(summary.expense)}</strong></div></div>
      {model.comparison && <div className="premium-history-hero-delta"><strong>{signed(model.comparison.difference)} {unit}</strong><span>{copy.previous} · {date(model.comparison.range.from)} — {date(model.comparison.range.to)}</span></div>}
    </section>
    <div className="premium-history-controls">
      <div className="premium-history-select premium-history-period"><select aria-label={copy.period} value={period} onChange={event => onPeriod(event.target.value)}>{periodOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select><ChevronDown size={13} aria-hidden="true"/></div>
      <div className="premium-history-select premium-history-currency"><select aria-label={copy.currency} value={currency} onChange={event => onCurrency(event.target.value)}><option value="ALL">{copy.all}</option>{currencies.map(item => <option key={item.code} value={item.code}>{item.code}</option>)}</select><ChevronDown size={13} aria-hidden="true"/></div>
      <button type="button" className="premium-history-filter" aria-expanded={filtersOpen} aria-label={copy.filters} onClick={onFilters}><SlidersHorizontal size={17}/></button>
    </div>

    {filtersOpen && <div className="premium-history-filters">{period === 'custom' && <div className="premium-history-dates"><label>{copy.dateFrom}<input type="date" value={dateFrom} onChange={event=>onDateFrom(event.target.value)}/></label><label>{copy.dateTo}<input type="date" value={dateTo} onChange={event=>onDateTo(event.target.value)}/></label></div>}{categoryPicker}</div>}
    <div ref={panel} className="premium-history-chapters" aria-label={copy.sections}>
      {chapters.map(([id,title],index)=><HistoryChapter key={`${trading}:${id}`} id={`${chapterId}-${id}`} number={index+1} title={title} caption={caption(id)} open={activeChapter===id} onToggle={()=>chooseTab(activeChapter===id?'':id)}>{()=>body(id)}</HistoryChapter>)}
    </div>
    {!trading && (onWallet||onCapital) && <footer className="premium-history-shortcuts">{onWallet && <button type="button" onClick={onWallet}><Wallet size={15}/>{chapterCopy.wallet}</button>}{onCapital && <button type="button" onClick={onCapital}><ChartNoAxesCombined size={15}/>{chapterCopy.capital}</button>}</footer>}
  </section>;
}

function HistoryChapter({id,number,title,caption,open,onToggle,children}) {
  const [visited,setVisited]=useState(open);
  useEffect(()=>{if(open)setVisited(true);},[open]);
  return <section className="premium-history-chapter">
    <h3><button type="button" id={`${id}-heading`} className="premium-history-chapter-head" aria-expanded={open} aria-controls={id} onClick={onToggle}><span className="premium-history-step" aria-hidden="true">{String(number).padStart(2,'0')}</span><span><strong>{title}</strong><small>{caption}</small></span><ChevronDown size={14} aria-hidden="true"/></button></h3>
    <div id={id} role="region" aria-labelledby={`${id}-heading`} aria-hidden={!open} inert={open?undefined:''} className="premium-history-chapter-reveal" data-open={open}><div><div className="premium-history-chapter-body premium-history-panel">{(open||visited) && children()}</div></div></div>
  </section>;
}
