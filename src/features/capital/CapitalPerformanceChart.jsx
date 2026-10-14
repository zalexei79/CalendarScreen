import React, { useMemo, useState, lazy, Suspense } from 'react';
import { calculateReturnPercent, divideScaled, formatMoney, MONEY_SCALE, parseScaled, scaledToString } from './decimal.js';
import { buildPortfolioChart, buildPortfolioReturnSeries, filterPortfolioSnapshots } from './portfolioHistory.js';

const PortfolioInteractiveChart=lazy(()=>import('./PortfolioInteractiveChart.jsx'));

const RANGES = [
  ['week', 'rangeWeek'],
  ['month', 'rangeMonth'],
  ['quarter', 'rangeQuarter'],
  ['year', 'rangeYear'],
  ['all', 'rangeAll'],
];

export default function CapitalPerformanceChart({ snapshots, operations = [], fxSeries = {}, currency, range, onRangeChange, t, locale, showRanges = true }) {
  const [mode,setMode]=useState('value');
  const [activeDate,setActiveDate]=useState(null);
  const sourceRows=useMemo(()=>mode==='return'?buildPortfolioReturnSeries(snapshots,operations,fxSeries,currency):snapshots,[mode,snapshots,operations,fxSeries,currency]);
  const rows = useMemo(() => {
    const filtered=filterPortfolioSnapshots(sourceRows,range,new Date());
    if(mode!=='return'||filtered.length<2)return filtered;
    const base=parseScaled(filtered[0].portfolio_value,MONEY_SCALE),returnBase=100n*10n**BigInt(MONEY_SCALE);
    if(!base)return filtered;
    return filtered.map(row=>({...row,portfolio_value:scaledToString(divideScaled(parseScaled(row.portfolio_value,MONEY_SCALE)*returnBase,MONEY_SCALE*2,base,MONEY_SCALE,MONEY_SCALE),MONEY_SCALE)}));
  },[sourceRows,range,mode]);
  const { linePath, areaPath, points, min, max } = useMemo(() => buildPortfolioChart(rows), [rows]);
  const gradientId = `capital-chart-fill-${currency}`;
  const firstValue = rows.length ? parseScaled(rows[0].portfolio_value, MONEY_SCALE) : 0n;
  const lastValue = rows.length ? parseScaled(rows.at(-1).portfolio_value, MONEY_SCALE) : 0n;
  const change = lastValue - firstValue;
  const trend = rows.length < 2 || change === 0n ? 'flat' : change < 0n ? 'down' : 'up';
  const returnBase=100n*10n**BigInt(MONEY_SCALE);
  const changePercent = calculateReturnPercent(change, mode==='return'?returnBase:firstValue);
  const displayValue=value=>mode==='return'?formatPercent(calculateReturnPercent(value-returnBase,returnBase)):formatMoney(value,currency,locale);
  const formatPercent = value => {
    if (value === null) return '—';
    const negative = value < 0n, digits = (negative ? -value : value).toString().padStart(3, '0');
    const whole = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(BigInt(digits.slice(0, -2)));
    const decimal = new Intl.NumberFormat(locale).formatToParts(1.1).find(part => part.type === 'decimal')?.value || '.';
    return `${negative ? '−' : '+'}${whole}${decimal}${digits.slice(-2)}%`;
  };
  const formatDate = value => new Date(`${value}T00:00:00Z`).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  const pointsText = rows.length > 0 ? t.chartSavedPoints(rows.length) : '';

  return <div className="capital-performance" data-trend={trend}>
    <div className="capital-chart-modes" role="group" aria-label={t.chart}><button type="button" aria-pressed={mode==='value'} className={mode==='value'?'is-active':''} onClick={()=>setMode('value')}>{t.chartValueMode}</button><button type="button" aria-pressed={mode==='return'} className={mode==='return'?'is-active':''} onClick={()=>setMode('return')}>{t.chartReturnMode}</button></div>
    {showRanges&&<div className="capital-range-selector" role="group" aria-label={t.chart}>
      {RANGES.map(([value, label]) => <button
        type="button"
        key={value}
        aria-pressed={range === value}
        className={range === value ? 'is-active' : ''}
        onClick={() => onRangeChange(value)}
      >{t[label]}</button>)}
    </div>}
    {rows.length > 0 && <div className="capital-chart-summary">
      <div><small>{mode==='return'?t.chartReturnLatest:t.chartLatest}</small><strong>{displayValue(lastValue)}</strong></div>
      {rows.length > 1 && <div className="capital-chart-period-change" data-trend={trend}><small>{mode==='return'?t.chartReturnChange:t.chartPeriodChange}</small><strong>{mode==='return'?formatPercent(changePercent):`${change > 0n ? '+' : ''}${formatMoney(change, currency, locale)}`} <span>({formatPercent(changePercent)})</span></strong></div>}
      <span className="capital-chart-points">{pointsText}{rows.length === 1 ? ` · ${t.chartOnePoint}` : ` · ${formatDate(rows[0].sampled_on)} — ${formatDate(rows.at(-1).sampled_on)}`}</span>
      {rows.length > 1&&<span className="capital-chart-scale">{t.chartScale}: {mode==='return'?`${formatPercent(calculateReturnPercent(min-returnBase,returnBase))} — ${formatPercent(calculateReturnPercent(max-returnBase,returnBase))}`:`${formatMoney(min,currency,locale)} — ${formatMoney(max,currency,locale)}`}</span>}
    </div>}
    {linePath ? <>
      <Suspense fallback={<p>{t.loading}</p>}><PortfolioInteractiveChart rows={rows} currency={currency} mode={mode} locale={locale} onSelect={setActiveDate} firstAvailable={sourceRows.map(row=>row.sampled_on).sort()[0]}/></Suspense>
      <div className="capital-chart-readout">{(()=>{const point=points.find(p=>p.date===activeDate)||points.at(-1);return point?<span>{formatDate(point.date)} · <b>{displayValue(point.value)}</b></span>:null;})()}</div>
      <div className="capital-chart-dates"><span>{formatDate(rows[0].sampled_on)}</span><span>{formatDate(rows.at(-1).sampled_on)}</span></div>
    </> : <div className="capital-chart-empty">
      {rows.length === 1 && <div className="capital-chart-single-value"><span>{formatDate(rows[0].sampled_on)}</span><strong>{displayValue(lastValue)}</strong></div>}
      <p>{t.chartEmpty}</p>
    </div>}
  </div>;
}
