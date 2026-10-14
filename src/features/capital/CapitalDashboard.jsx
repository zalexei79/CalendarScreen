import {investorCopy} from './investorCopy.js';
import React, { useMemo, useState } from 'react';
import { Plus, ArrowUpRight } from 'lucide-react';
import { dashboardAnalytics } from './dashboardAnalytics.js';
import { dashboardCopy } from './dashboardCopy.js';
import { calculatePortfolioPeriodResults, buildConsolidatedPortfolioSnapshots } from './portfolioHistory.js';
import { formatMoney, scaledToString } from './decimal.js';
import CapitalPerformanceChart from './CapitalPerformanceChart.jsx';
import './dashboard.css';
const colors=['#53c9ac','#91a9e8','#d9b675','#ab8dd5','#78adbe','#de9288','#9bba82','#b5bac6','#84978e'];
export default function CapitalDashboard({ assets, operations, snapshots, metrics, priceFor, fxSeries, baseCurrency, onCurrencyChange, currencies, range, onRangeChange, locale, t, stats, quoteSummary, quoteCoverage, online, fxLoading, fxError, fxDate, onAdd, onSelect }) {
 const beginner=investorCopy[locale];
 const c=dashboardCopy[locale], [view,setView]=useState('auto'),[historyOpen,setHistoryOpen]=useState(false);
 const historyLabel={ru:'История оценок',en:'Valuation history',ro:'Istoricul evaluărilor',zh:'估值历史'}[locale];
 const nativeCurrencies=Object.keys(metrics),scope=view==='auto'?(nativeCurrencies.length===1&&nativeCurrencies[0]==='USDT'?'USDT':'base'):view;
 const code=scope==='base'?baseCurrency:scope;
 const today=new Date(),day=today.toISOString().slice(0,10);
 const analytics=useMemo(()=>dashboardAnalytics(assets,operations,priceFor,fxSeries,baseCurrency,scope,range,new Date(day)),[assets,operations,priceFor,fxSeries,baseCurrency,scope,range,day]);
 const scopedSnapshots=useMemo(()=>snapshots.filter(row=>scope==='base'?row.currency!=='USDT':row.currency===scope),[snapshots,scope]);
 const scopedOperations=useMemo(()=>operations.filter(row=>scope==='base'?row.currency!=='USDT':row.currency===scope),[operations,scope]);
 const periods=useMemo(()=>calculatePortfolioPeriodResults(scopedSnapshots,scopedOperations,range,new Date(day),fxSeries,baseCurrency),[scopedSnapshots,scopedOperations,range,day,fxSeries,baseCurrency]);
 const period=scope==='base'?periods.consolidated:periods.byCurrency.find(row=>row.currency===scope);
 const periodValid=period?.result!==null&&period?.result!==undefined;
 const allPnl=analytics.rows.every(row=>row.pnl!==null)?analytics.rows.reduce((sum,row)=>sum+row.pnl,0n):null;
 const chartRows=scope==='base'?buildConsolidatedPortfolioSnapshots(scopedSnapshots,[...new Set(scopedSnapshots.map(row=>row.currency))],fxSeries,baseCurrency):scopedSnapshots;
 const winners=analytics.rows.filter(row=>row.pnl!==null&&row.pnl!==0n).sort((a,b)=>{const x=a.pnl<0n?-a.pnl:a.pnl,y=b.pnl<0n?-b.pnl:b.pnl;return x>y?-1:x<y?1:0;}).slice(0,4);
 const maxPnl=winners.reduce((m,row)=>{const n=row.pnl<0n?-row.pnl:row.pnl;return n>m?n:m;},0n);
 const money=value=>value===null?'—':formatMoney(value,code,locale);
 const signed=value=>value===null?'—':(value>0n?'+':'')+money(value);
 const share=value=>new Intl.NumberFormat(locale,{minimumFractionDigits:1,maximumFractionDigits:1}).format(Number(value)/100)+'%';
 const percent=value=>value==null?'—':new Intl.NumberFormat(locale,{signDisplay:'exceptZero',minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(value)/100)+'%';
 let angle=0;const segments=analytics.allocation.map((row,index)=>{const from=angle;angle+=row.bps===null?0:row.bps/100;return colors[index%colors.length]+' '+from+'% '+angle+'%';});
 return <>
 <section className="capital-dashboard" aria-label={c.overview}>
  <div className="dashboard-toolbar"><span>DAYRIS CAPITAL <i>PRO</i></span><button type="button" className="capital-add" onClick={onAdd}><Plus size={16}/>{t.add}</button></div>
  <div className="dashboard-view"><label>{c.choose}<select value={scope} onChange={e=>setView(e.target.value)}><option value="base">{c.base} · {baseCurrency}</option>{nativeCurrencies.map(currency=><option key={currency} value={currency}>{currency}</option>)}</select></label>{scope==='base'&&<label>{t.baseCurrencyChoice}<select value={baseCurrency} onChange={e=>onCurrencyChange(e.target.value)}>{currencies.map(currency=><option key={currency}>{currency}</option>)}</select></label>}</div>
  <div className="dashboard-hero"><p>{t.value} · {code}</p><h2>{money(analytics.total)}</h2><div className="dashboard-result"><span>{c.period}</span><strong className={periodValid&&period.result>0n?'positive':periodValid&&period.result<0n?'negative':''}>{periodValid?signed(period.result):'—'}</strong><b>{periodValid?percent(period.percent):'—'}</b></div>
  <div className="capital-range-selector" role="group" aria-label={c.period}>{[['week','rangeWeek'],['month','rangeMonth'],['quarter','rangeQuarter'],['year','rangeYear'],['all','rangeAll']].map(([key,label])=><button type="button" key={key} aria-pressed={range===key} className={range===key?'is-active':''} onClick={()=>onRangeChange(key)}>{t[label]}</button>)}</div>
  {periodValid&&period.start&&<p className="dashboard-note">{period.start.sampled_on} — {period.end.sampled_on}</p>}
  {!periodValid&&<p className="dashboard-note">{c.noHistory}</p>}
  {scope==='base'&&nativeCurrencies.includes('USDT')&&<p className="dashboard-note">{c.separate} · <button type="button" onClick={()=>setView('USDT')}>USDT <ArrowUpRight size={12}/></button></p>}
  {(!analytics.complete||allPnl===null)&&<p className="dashboard-note" role="status">{c.coverage}</p>}
  </div>
  <section className="dashboard-composition" aria-label={c.allocation}>
   <div className="dashboard-composition-heading"><h3>{c.allocation}</h3><small>{code}</small></div>
   {analytics.total!==null&&analytics.total>0n?<div className="dashboard-composition-body"><div className="dashboard-composition-ring"><svg viewBox="0 0 200 200" role="img" aria-label={analytics.allocation.map(row=>t.categories[t.cats.indexOf(row.category)]+' '+share(row.bps)).join(', ')}><circle className="composition-track" cx="100" cy="100" r="80"/>{(()=>{let offset=0;return analytics.allocation.map((row,index)=>{const weight=index===analytics.allocation.length-1?100-offset:row.bps/100,start=offset;offset+=weight;return <circle key={row.category} cx="100" cy="100" r="80" pathLength="100" fill="none" stroke={colors[index%colors.length]} strokeWidth="15" strokeDasharray={Math.max(0,weight-.8)+' '+(100-Math.max(0,weight-.8))} strokeDashoffset={-start} transform="rotate(-90 100 100)"/>;});})()}</svg><div><strong>{analytics.rows.filter(row=>row.asset.quantity>0n).length}</strong><small>{t.assets}</small></div></div>
    <div className="dashboard-composition-legend">{analytics.allocation.map((row,index)=><div key={row.category}><i style={{background:colors[index%colors.length]}}/><span>{t.categories[t.cats.indexOf(row.category)]}<small>{money(row.value)}</small></span><b>{share(row.bps)}</b></div>)}</div></div>:<p className="dashboard-note">{analytics.complete?t.emptyHint:c.coverage}</p>}
   {analytics.largestBps!==null&&<div className="dashboard-composition-foot"><span>{c.concentration} · {analytics.largest.asset.name}</span><b>{share(analytics.largestBps)}</b></div>}
  </section>
  <details className="dashboard-disclosure" onToggle={event=>setHistoryOpen(event.currentTarget.open)}><summary>{historyLabel}</summary>{historyOpen&&<><CapitalPerformanceChart snapshots={chartRows} operations={scopedOperations} fxSeries={fxSeries} currency={code} range={range} onRangeChange={onRangeChange} t={t} locale={locale} showRanges={false}/><p className="dashboard-note">{c.chartNote}</p></>}</details>
  <div className="dashboard-key-stats"><div><span>{beginner.closed}</span><strong className={analytics.closed>0n?'positive':analytics.closed<0n?'negative':''}>{signed(analytics.closed)}</strong><small>{beginner.allTime}</small></div><div><span>{beginner.open}</span><strong className={analytics.unrealized>0n?'positive':analytics.unrealized<0n?'negative':''}>{signed(analytics.unrealized)}</strong><small>{beginner.allTime}</small></div><div><span>{beginner.paid}</span><strong>{money(analytics.income)}</strong><small>{beginner.period}</small></div></div>
  <details className="dashboard-disclosure"><summary>{c.details}</summary><p>{c.method}</p><p>{c.incomeNote}</p>{periodValid&&period.start&&<p>{period.start.sampled_on} — {period.end.sampled_on}</p>}<div className="capital-result-breakdown">{nativeCurrencies.map(currency=><div key={currency}><b>{currency}</b><span>{stats.realized}: {formatMoney(metrics[currency].realized,currency,locale)}</span><span>{stats.unrealized}: {metrics[currency].unrealized===null?'—':formatMoney(metrics[currency].unrealized,currency,locale)}</span></div>)}</div></details>
  <details className="dashboard-disclosure"><summary><span className={online?'capital-online-dot':'capital-offline-dot'}/>{c.quote}<small>{quoteCoverage}</small></summary><p>{quoteSummary}</p><p>{fxLoading?t.fxLoading:fxError?t.fxUnavailable:fxDate?t.fxAsOf+' '+fxDate:t.globalCoverage}</p></details>
 </section>
 {assets.length>0&&<section className="dashboard-insights dashboard-insights-single">
 <article><h2>{c.contribution}</h2><p>{c.contributionNote}</p>{winners.length?winners.map(row=><button type="button" className="dashboard-contributor" key={row.asset.id} onClick={()=>onSelect(row.asset)}><span>{row.asset.name}<small>{row.asset.symbol}</small></span><strong className={row.pnl>0n?'positive':'negative'}>{signed(row.pnl)}</strong><i><span style={{width:maxPnl?Number((row.pnl<0n?-row.pnl:row.pnl)*10000n/maxPnl)/100+'%':'0%',background:row.pnl>0n?'#53c9ac':'#ef8b91'}}/></i></button>):<p>{c.emptyContributors}</p>}</article>

 </section>}
 </>;
}
