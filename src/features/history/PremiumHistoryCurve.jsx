import React, {useState} from 'react';
import {intlLocale} from '../../shared/i18n/locale.js';
import {premiumHistoryCopy} from './premiumHistoryCopy.js';
import {premiumHistoryChapterCopy} from './premiumHistoryChapterCopy.js';

export default function PremiumHistoryCurve({model,language}) {
  const [offset,setOffset]=useState(0), [selected,setSelected]=useState('');
  const copy=premiumHistoryCopy(language), chapter=premiumHistoryChapterCopy(language);
  let running=0;
  const all=model.dailyEntries.map(([key,value])=>{running+=value.income-value.expense;return {key,...value,total:running};});
  const end=Math.max(1,all.length-Math.min(offset,Math.max(0,all.length-1))), points=all.slice(Math.max(0,end-14),end);
  if(!points.length)return <p className="premium-history-empty">{copy.empty}</p>;
  const active=points.find(day=>day.key===selected)||points.at(-1);
  const low=Math.min(0,...points.map(point=>point.total)), high=Math.max(0,...points.map(point=>point.total)), spread=high-low||1;
  const x=index=>18+index*364/Math.max(1,points.length-1), y=value=>148-(value-low)/spread*120;
  const number=value=>`${new Intl.NumberFormat(intlLocale(language),{maximumFractionDigits:2}).format(value)} ${model.summary.currency}`;
  const date=value=>new Intl.DateTimeFormat(intlLocale(language),{day:'numeric',month:'short',timeZone:'UTC'}).format(new Date(value+'T12:00:00Z'));
  const line=points.map((point,index)=>`${x(index)},${y(point.total)}`).join(' ');
  return <section className="premium-analytics-card premium-history-curve" data-analytics="cumulative-result">
    <div className="premium-history-curve-heading"><button type="button" disabled={end<=14} onClick={()=>{setOffset(value=>value+14);setSelected('');}} aria-label={copy.previous}>←</button><span>{date(points[0].key)} — {date(points.at(-1).key)}</span><button type="button" disabled={!offset} onClick={()=>{setOffset(value=>Math.max(0,value-14));setSelected('');}} aria-label={copy.more}>→</button></div>
    <div className="premium-history-curve-value" aria-live="polite"><small>{chapter.cumulative} · {date(active.key)}</small><strong data-negative={active.total<0}>{number(active.total)}</strong></div>
    <svg viewBox="0 0 400 170" role="img" aria-label={chapter.cumulative}>
      {[28,88,148].map(v=><line key={v} x1="18" x2="382" y1={v} y2={v} className="premium-history-grid-line"/>)}
      <polygon points={`18,148 ${line} ${x(points.length-1)},148`} className="premium-history-curve-area"/>
      <line x1="18" x2="382" y1={y(0)} y2={y(0)} className="premium-history-zero-line"/>
      <polyline points={line} className="premium-history-curve-line"/>
      {points.map((point,index)=><circle key={point.key} cx={x(index)} cy={y(point.total)} r={point.key===active.key?4.5:2.5} className="premium-history-curve-dot"/>)}
    </svg>
    <div className="premium-history-curve-days" role="group" aria-label={copy.dateFrom}>{points.map(point=><button type="button" key={point.key} aria-pressed={active.key===point.key} aria-label={`${date(point.key)} · ${number(point.total)}`} onClick={()=>setSelected(point.key)}>{point.key.slice(8)}</button>)}</div>
    <div className="premium-history-curve-day"><span>{copy.income}<strong>{number(active.income)}</strong></span><span>{copy.expense}<strong>{number(-active.expense)}</strong></span></div>
  </section>;
}
