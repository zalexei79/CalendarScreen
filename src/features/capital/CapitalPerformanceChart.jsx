import React, { useMemo } from 'react';
import { calculateReturnPercent, formatMoney, MONEY_SCALE, parseScaled } from './decimal.js';
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
  const { linePath, areaPath, points, min, max } = useMemo(() => buildPortfolioChart(rows), [rows]);
  const gradientId = `capital-chart-fill-${currency}`;
  const firstValue = rows.length ? parseScaled(rows[0].portfolio_value, MONEY_SCALE) : 0n;
  const lastValue = rows.length ? parseScaled(rows.at(-1).portfolio_value, MONEY_SCALE) : 0n;
  const change = lastValue - firstValue;
  const trend = rows.length < 2 || change === 0n ? 'flat' : change < 0n ? 'down' : 'up';
  const changePercent = calculateReturnPercent(change, firstValue);
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
      <div><small>{t.chartLatest}</small><strong>{formatMoney(lastValue, currency, locale)}</strong></div>
      {rows.length > 1 && <div className="capital-chart-period-change" data-trend={trend}><small>{t.chartPeriodChange}</small><strong>{change > 0n ? '+' : ''}{formatMoney(change, currency, locale)} <span>({formatPercent(changePercent)})</span></strong></div>}
      <span className="capital-chart-points">{pointsText}{rows.length === 1 ? ` · ${t.chartOnePoint}` : ` · ${formatDate(rows[0].sampled_on)} — ${formatDate(rows.at(-1).sampled_on)}`}</span>
      {rows.length > 1&&<span className="capital-chart-scale">{t.chartScale}: {formatMoney(min,currency,locale)} — {formatMoney(max,currency,locale)}</span>}
    </div>}
    {linePath ? <>
      <svg className="capital-performance-chart" viewBox="0 0 320 124" role="img" aria-label={`${t.chart} · ${currency}`}>
        <defs><linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="currentColor" stopOpacity=".28"/><stop offset="100%" stopColor="currentColor" stopOpacity="0"/></linearGradient></defs>
        <path className="capital-chart-gridline" d="M12 30H308 M12 65H308 M12 100H308"/>
        <path className="capital-performance-area" d={areaPath} fill={`url(#${gradientId})`}/>
        <path className="capital-performance-line" d={linePath}/>
        {points.map(point=><circle key={point.date} className="capital-performance-point" cx={point.x} cy={point.y} r={points.length<4?4:2.8}><title>{`${formatDate(point.date)} · ${formatMoney(point.value, currency, locale)}`}</title></circle>)}
      </svg>
      <div className="capital-chart-dates"><span>{formatDate(rows[0].sampled_on)}</span><span>{formatDate(rows.at(-1).sampled_on)}</span></div>
    </> : <div className="capital-chart-empty">
      {rows.length === 1 && <div className="capital-chart-single-value"><span>{formatDate(rows[0].sampled_on)}</span><strong>{formatMoney(lastValue, currency, locale)}</strong></div>}
      <p>{t.chartEmpty}</p>
    </div>}
  </div>;
}
