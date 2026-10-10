import React, { useMemo } from 'react';
import { formatMoney, MONEY_SCALE, parseScaled } from './decimal.js';
import { buildPortfolioChart, filterPortfolioSnapshots } from './portfolioHistory.js';

const RANGES = [
  ['week', 'rangeWeek'],
  ['month', 'rangeMonth'],
  ['quarter', 'rangeQuarter'],
  ['year', 'rangeYear'],
  ['all', 'rangeAll'],
];

export default function CapitalPerformanceChart({ snapshots, currency, range, onRangeChange, t, locale, showRanges = true }) {
  const rows = useMemo(
    () => filterPortfolioSnapshots(snapshots, range, new Date()),
    [snapshots, range],
  );
  const { linePath, areaPath } = useMemo(() => buildPortfolioChart(rows), [rows]);
  const gradientId = `capital-chart-fill-${currency}`;
  const trend = rows.length > 1 && parseScaled(rows.at(-1).portfolio_value, MONEY_SCALE) < parseScaled(rows[0].portfolio_value, MONEY_SCALE) ? 'down' : 'up';

  return <div className="capital-performance" data-trend={trend}>
    {showRanges&&<div className="capital-range-selector" role="group" aria-label={t.chart}>
      {RANGES.map(([value, label]) => <button
        type="button"
        key={value}
        aria-pressed={range === value}
        className={range === value ? 'is-active' : ''}
        onClick={() => onRangeChange(value)}
      >{t[label]}</button>)}
    </div>}
    {linePath ? <>
      <svg className="capital-performance-chart" viewBox="0 0 320 124" role="img" aria-label={`${t.chart} · ${currency}`}>
        <defs><linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="currentColor" stopOpacity=".28"/><stop offset="100%" stopColor="currentColor" stopOpacity="0"/></linearGradient></defs>
        <path className="capital-chart-gridline" d="M12 30H308 M12 65H308 M12 100H308"/>
        <path className="capital-performance-area" d={areaPath} fill={`url(#${gradientId})`}/>
        <path className="capital-performance-line" d={linePath}/>
      </svg>
      <div className="capital-chart-dates"><span>{rows[0].sampled_on}</span><span>{rows.at(-1).sampled_on}</span></div>
    </> : <div className="capital-chart-empty">
      {rows.length === 1 && <div className="capital-chart-single-value"><span>{rows[0].sampled_on}</span><strong>{formatMoney(parseScaled(rows[0].portfolio_value, MONEY_SCALE), currency, locale)}</strong></div>}
      <p>{t.chartEmpty}</p>
    </div>}
  </div>;
}
