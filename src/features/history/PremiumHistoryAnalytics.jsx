import React from 'react';
import {Pencil, ChevronRight} from 'lucide-react';
import {getMoneyCategoryLabel} from '../../shared/config/constants.js';
import PeriodDynamics from '../trades-sync/components/PeriodDynamics.jsx';
import NoteInsights from '../day-notes/NoteInsights.jsx';
import {PlatformHistoryActions} from '../platforms/PlatformConnections.jsx';
import {premiumHistoryCopy} from './premiumHistoryCopy.js';
import {premiumHistoryChapterCopy} from './premiumHistoryChapterCopy.js';

// Chapter boundaries change presentation only; every metric uses the overall
// period, platform, account and currency selection, never the journal's row filter.
export default function PremiumHistoryAnalytics({section, context}) {
  const {premiumHistory:model, validUserId, language, isLight,
    notesRevision, jumpToTradeDate, t, formatAmountInCurrency, formatMoney, formatDateLabel,
    displayMode, depositSize, handleEditDeposit, setDisplayMode, currencySymbol,
    openConnectModal, setHistoryCurrency, onInstrument}=context;
  const {summary, rows, dailyEntries}=model;
  const copy=premiumHistoryCopy(language), chapter=premiumHistoryChapterCopy(language);
  const money=value=>formatAmountInCurrency(value,summary.currency);
  const grid=items=><dl className="premium-history-stat-grid">{items.map(([label,value,hint])=><div key={label}><dt>{label}</dt><dd>{value}</dd>{hint && <small>{hint}</small>}</div>)}</dl>;
  if (section==='discipline') return <div className="premium-history-analytics" data-analytics="notes"><NoteInsights appearance="glass" userId={validUserId} trades={rows} revision={notesRevision} language={language} isLight={isLight} onDay={jumpToTradeDate}/></div>;
  if (section==='tools') return <div className="premium-analytics-tools"><PlatformHistoryActions language={language} isLight={isLight} onOpen={openConnectModal}/></div>;
  if (summary.mixed) {
    const currencies=new Map();
    for (const row of rows) {const code=row.currency||'USD', item=currencies.get(code)||{count:0,total:0};item.count++;item.total+=Number(row.pnl);currencies.set(code,item);}
    return <div className="premium-history-analytics" data-analytics="currency-groups"><p className="premium-history-hint">{chapter.separate}</p>{[...currencies].map(([code,item])=><button key={code} type="button" className="premium-history-row" onClick={()=>setHistoryCurrency(code)}><span className="premium-history-row-copy"><span>{code}</span><small>{item.count} · {copy.records}</small></span><span className="premium-history-row-amount" data-negative={item.total<0}>{formatAmountInCurrency(item.total,code)}</span><ChevronRight size={14}/></button>)}</div>;
  }
  if (section==='comparison') return <div className="premium-history-analytics" data-analytics="period-comparison">
    {model.comparison ? <div className="premium-history-comparison"><p className="premium-history-hint">{copy.previous} · {formatDateLabel(model.comparison.range.from,language)} — {formatDateLabel(model.comparison.range.to,language)}</p>
      {grid([[copy.income, model.comparison.income===null?'—':`${model.comparison.income>0?'+':''}${model.comparison.income}%`, money(model.comparison.previousIncome)],
        [copy.expense,model.comparison.expense===null?'—':`${model.comparison.expense>0?'+':''}${model.comparison.expense}%`,money(model.comparison.previousExpense)],
        [copy.net,money(model.comparison.difference),`${copy.previous}: ${money(model.comparison.previousTotal)}`]])}
    </div> : <p className="premium-history-hint">{chapter.comparisonMissing}</p>}
  </div>;
  if (section==='period-dynamics') return <div className="premium-history-analytics"><PeriodDynamics appearance="glass" trades={rows} language={language} isLight={isLight}/></div>;
  if (!rows.length) return <p className="premium-history-empty">{copy.empty}</p>;

  const days=dailyEntries.map(([key,value])=>({key,total:value.income-value.expense,...value}));
  const best=days.reduce((a,b)=>a.total>=b.total?a:b), worst=days.reduce((a,b)=>a.total<=b.total?a:b);
  const dayStats=()=>grid([[t('bestDay'),money(best.total),formatDateLabel(best.key,language)], [t('worstDay'),money(worst.total),formatDateLabel(worst.key,language)]]);
  const label=name=>getMoneyCategoryLabel(name,language);

  if (section==='finance-radar') return <div className="premium-history-analytics" data-analytics="financial-picture">
    <div className="premium-analytics-card" data-analytics="financial-radar"><h3>{chapter.radar}</h3>{grid([
      [chapter.coverage,summary.expense>0?`${(summary.income/summary.expense).toFixed(1)}×`:'—'],
      [chapter.retained,summary.income>0?`${Math.round(summary.total/summary.income*100)}%`:'—'],
      [t('mainSource'),model.incomes.length?label(model.incomes[0].name):'—'],
      [t('attentionZone'),model.expenses.length?label(model.expenses[0].name):'—'],
    ])}</div>{dayStats()}
    <p className="premium-history-hint">{summary.income>summary.expense?t('flowPositivePro'):summary.expense>0?t('flowNegativePro'):t('flowLittleData')}</p>
    {model.hasTrading && <p className="premium-history-hint">{copy.tradeNote}</p>}
  </div>;
  if (section==='finance-habits') {
    const expenses=rows.filter(row=>Number(row.pnl)<0).map(row=>Math.abs(Number(row.pnl))).sort((a,b)=>a-b);
    const middle=Math.floor(expenses.length/2), median=expenses.length ? expenses.length%2?expenses[middle]:(expenses[middle-1]+expenses[middle])/2 : null;
    const spendingDays=days.filter(day=>day.expense>0).length;
    return <div className="premium-history-analytics" data-analytics="financial-habits">{grid([
      [t('activity'),rows.length,copy.records], [chapter.activeDays,days.length],
      [chapter.typical,median===null?'—':money(median)], [chapter.averageExpense,expenses.length?money(summary.expense/expenses.length):'—'],
      [chapter.dailyExpense,spendingDays?money(summary.expense/spendingDays):'—'],
      [t('frequentIncome'),model.incomes.length?label(model.incomes[0].name):'—'],
      [t('expensePattern'),model.expenses.length?label(model.expenses[0].name):'—'],
    ])}
    <h3>{copy.repeated}</h3>{model.expenses.filter(group=>group.count>=2).map(group=><button type="button" className="premium-history-row" key={group.name} onClick={()=>context.onCategory?.(group.name,'expense')}><span className="premium-history-row-copy"><span>{label(group.name)}</span><small>{group.count} · {copy.records}</small></span><strong className="premium-history-row-amount" data-negative="true">{money(-group.amount)}</strong><ChevronRight size={14}/></button>)}
    {!model.expenses.some(group=>group.count>=2) && <p className="premium-history-hint">{chapter.noRepeats}</p>}
    {model.projectedExpense!==null && <div className="premium-history-insight"><span>{copy.estimate}</span><strong>≈ {money(model.projectedExpense)}</strong><small>{copy.estimateHint}</small></div>}
  </div>;
  if (section==='instruments') {
    const instruments=new Map();
    for (const row of rows) {const key=row.instrument||'—',item=instruments.get(key)||{count:0,total:0};item.count++;item.total+=Number(row.pnl);instruments.set(key,item);}
    return <div className="premium-history-analytics" data-analytics="instruments-toggle">{[...instruments].sort((a,b)=>b[1].count-a[1].count).map(([name,item])=><button type="button" key={name} className="premium-history-category" onClick={()=>onInstrument?.(name)}><span><span>{name}</span><strong>{money(item.total)}</strong></span><span className="premium-history-track"><span style={{width:`${item.count/rows.length*100}%`}}/></span><small><span>{item.count} · {copy.trades}</span><span>{Math.round(item.count/rows.length*100)}% <ChevronRight size={12}/></span></small></button>)}</div>;
  }

  const wins=rows.filter(row=>Number(row.pnl)>0), losses=rows.filter(row=>Number(row.pnl)<0);
  const profit=wins.reduce((total,row)=>total+Number(row.pnl),0), loss=-losses.reduce((total,row)=>total+Number(row.pnl),0);
  const pf=loss>0?profit/loss:profit>0?Infinity:0;
  const avgWin=wins.length?profit/wins.length:0, avgLoss=losses.length?loss/losses.length:0;
  const payoff=avgLoss>0?avgWin/avgLoss:0, winrate=Math.round(wins.length/rows.length*100);
  const chronological=[...rows].sort((a,b)=>a.dateKey.localeCompare(b.dateKey)||String(a.time||'').localeCompare(String(b.time||''))||String(a.id).localeCompare(String(b.id)));
  let streak=0, current=0, running=0, peak=0, peakDay=chronological[0].dateKey, episode=null, worstEpisode=null;
  for(const row of chronological) {
    current=Number(row.pnl)<0?current+1:0;streak=Math.max(streak,current);
    running+=Number(row.pnl);
    const drawdown=peak-running;
    if(drawdown>1e-8) {
      episode ||= {start:peakDay,recovered:null};
      if(!worstEpisode||drawdown>worstEpisode.amount)worstEpisode={amount:drawdown,episode};
    } else {
      if(episode)episode.recovered=row.dateKey;
      peak=Math.max(peak,running);peakDay=row.dateKey;episode=null;
    }
  }
  const recoveryDays=worstEpisode?.episode.recovered?Math.round((Date.parse(worstEpisode.episode.recovered)-Date.parse(worstEpisode.episode.start))/86400000):null;
  const score=Math.max(4,Math.min(99,Math.round(Math.min(pf===Infinity?3:pf,3)/3*40+winrate/100*35+Math.min(payoff,3)/3*15-Math.min(streak,6)*1.5+10)));
  const grade=score>=85?'S':score>=70?'A':score>=55?'B':score>=40?'C':'D';
  const scoreLabel=score>=85?t('traderElite'):score>=70?t('traderConfident'):score>=55?t('traderSteady'):score>=40?t('traderImprove'):t('traderDiscipline');
  const insight=streak>=3?t('insightLossStreak').replace('{0}',streak):payoff>0&&payoff<1&&winrate>=50?t('insightPayoff'):pf!==Infinity&&pf<1?t('insightProfitFactorLow'):pf>=1.5?t('insightProfitFactorHigh'):t('insightLittleData');
  const topInstrument=Object.entries(rows.reduce((counts,row)=>{counts[row.instrument||'—']=(counts[row.instrument||'—']||0)+1;return counts;},{})).sort((a,b)=>b[1]-a[1])[0]?.[0];
  if(section==='risk-stability') return <div className="premium-history-analytics" data-analytics="risk-stability">{grid([
    [copy.drawdown,money(model.maxDrawdown)], [t('lossStreak'),streak],
    [chapter.recovery,!worstEpisode?'—':recoveryDays===null?chapter.notRecovered:`${recoveryDays} ${chapter.days}`],
    [t('topInstrument'),topInstrument||'—'],
  ])}{dayStats()}<div className="premium-history-insight"><strong>{t('statsObservation')}</strong><span>{insight}</span><small>{t('statsObservationHint')}</small></div></div>;
  if(section==='risk-quality') return <div className="premium-history-analytics" data-analytics="scorecard">
    <div className="premium-history-score premium-analytics-card"><div className="premium-history-score-ring"><svg viewBox="0 0 96 96" aria-hidden="true"><circle cx="48" cy="48" r="38"/><circle cx="48" cy="48" r="38" style={{strokeDasharray:238.76,strokeDashoffset:238.76*(1-score/100)}}/></svg><strong>{score}</strong></div><div><small>PRO Scorecard · {t('scoreGrade')} {grade}</small><h3>{scoreLabel}</h3><p className="premium-history-hint">{t('scoreDescription')}</p></div></div>
    {grid([[copy.winrate,`${winrate}%`,`${wins.length} / ${rows.length}`], [copy.factor,pf===Infinity?'∞':pf.toFixed(2)], [t('payoff'),payoff>0?`1:${payoff.toFixed(2)}`:'—'],
      [chapter.average,money(summary.total/rows.length)], [t('avgWin'),wins.length?money(avgWin):'—'], [t('avgLoss'),losses.length?money(-avgLoss):'—']])}
    <div className="premium-history-distribution"><div className="premium-history-track" aria-hidden="true"><span style={{width:`${winrate}%`}}/><span style={{width:`${losses.length/rows.length*100}%`}}/></div><p><span>{copy.winning} · {wins.length}</span><span>{copy.losing} · {losses.length}</span><span>{chapter.breakeven} · {model.breakevenCount}</span></p></div>
    <p className="premium-history-hint">{copy.closed}</p>
    <div className="premium-analytics-tools premium-history-deposit"><button type="button" onClick={()=>{if(displayMode==='usd'&&depositSize<=0){handleEditDeposit();return;}setDisplayMode(value=>value==='usd'?'percent':'usd');}}>{displayMode==='usd'?currencySymbol:'%'}</button><button type="button" onClick={handleEditDeposit}><span>{t('deposit')}</span><strong>{depositSize>0?`${currencySymbol}${formatMoney(depositSize)}`:t('notSet')}</strong><Pencil size={13}/></button></div>
  </div>;
  return null;
}
