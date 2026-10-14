import React, { useEffect, useId, useMemo, useState } from 'react';
import { fetchAssetQuoteHistory } from './assetQuoteHistory.js';
import { fetchUsEquityQuotes, isUsEquityAsset } from './usEquityQuotes.js';
import { formatMoney } from './decimal.js';

function makePath(rows) {
  const values = rows.map(row => Number(row.price)).filter(Number.isFinite);
  if (values.length < 2) return null;
  const low = Math.min(...values), high = Math.max(...values), span = high - low || Math.max(Math.abs(high) * .01, 1);
  const points = values.map((value, index) => ({ x: 12 + index * 296 / (values.length - 1), y: 94 - (value - low) * 76 / span }));
  const path = points.map((point, index) => `${index ? 'L' : 'M'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ');
  return { path, area: `${path} L308 104 L12 104 Z`, first: values[0], last: values.at(-1), low, high, points };
}

export default function CapitalQuoteHistoryChart({ asset, quote, currency, locale, t, allowFetch = true }) {
  const [rows, setRows] = useState([]), [loading, setLoading] = useState(false), [failed, setFailed] = useState(false);
  const fillId = useId().replaceAll(':','');
  const [activeIndex,setActiveIndex] = useState(null);
  useEffect(() => {
    if (!asset || !['binance', 'moex', 'alphavantage'].includes(asset.quote_source)) { setRows([]); setFailed(false); return; }
    const controller = new AbortController();
    setRows([]); setActiveIndex(null);
    setLoading(true); setFailed(false);
    const history = isUsEquityAsset(asset)
      ? quote?.history?.length ? Promise.resolve(quote.history) : allowFetch ? fetchUsEquityQuotes([asset.symbol], controller.signal).then(result => result.quotes[asset.symbol]?.history || []) : Promise.resolve([])
      : fetchAssetQuoteHistory(asset, { signal: controller.signal });
    history.then(setRows)
      .catch(error => { if (error.name !== 'AbortError') setFailed(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [asset?.id, asset?.symbol, asset?.quote_source, asset?.category, quote?.history, allowFetch]);
  const chart = useMemo(() => makePath(rows), [rows]);
  const index = chart ? Math.max(0,Math.min(activeIndex ?? rows.length-1,rows.length-1)) : 0;
  const active = chart?.points[index];
  const dateLabel = value => {const date=new Date(`${value}T12:00:00`);return Number.isNaN(date.getTime())?value:new Intl.DateTimeFormat(locale,{day:'numeric',month:'short',year:'numeric'}).format(date);};
  if (!asset || !['binance', 'moex', 'alphavantage'].includes(asset.quote_source)) return null;
  return <section className="capital-market-history" data-direction={chart && chart.last<chart.first?'down':'up'} aria-label={t.marketHistory}>
    <div className="capital-market-history-head"><div><strong>{t.marketHistory}</strong><small>{asset.quote_source === 'binance' ? t.binanceHistorySource : asset.quote_source === 'moex' ? t.moexHistorySource : t.usEquityHistorySource} · {asset.currency}</small></div><span>{rows.at(-1)?.date ? dateLabel(rows.at(-1).date) : (loading ? t.loading : '')}</span></div>
    {chart ? <>
      <div className="capital-history-readout"><strong>{formatMoney(rows[index].price,currency,locale)}</strong><span>{dateLabel(rows[index].date)}</span></div>
      <svg className="capital-market-history-svg" viewBox="0 0 320 116" role="img" tabIndex={0} aria-label={`${t.marketHistory}: ${dateLabel(rows[index].date)}, ${formatMoney(rows[index].price, currency, locale)}`}
        onPointerMove={event=>{const rect=event.currentTarget.getBoundingClientRect();const x=(event.clientX-rect.left)/rect.width*320;setActiveIndex(Math.round((x-12)/296*(rows.length-1)));}}
        onPointerLeave={()=>setActiveIndex(null)} onBlur={()=>setActiveIndex(null)}
        onKeyDown={event=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();setActiveIndex(event.key==='Home'?0:event.key==='End'?rows.length-1:Math.max(0,Math.min(rows.length-1,index+(event.key==='ArrowLeft'?-1:1))));}}}>
        <defs><linearGradient id={fillId} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="currentColor" stopOpacity=".18"/><stop offset="100%" stopColor="currentColor" stopOpacity="0"/></linearGradient></defs>
        <path className="capital-chart-gridline" d="M12 18H308 M12 56H308 M12 94H308"/><path className="capital-market-history-area" style={{fill:`url(#${fillId})`}} d={chart.area}/><path className="capital-market-history-line" d={chart.path}/>
        {active && <g className="capital-history-cursor"><path d={`M${active.x} 12V104`}/><circle cx={active.x} cy={active.y} r="3.5"/></g>}
      </svg>
      <div className="capital-market-history-values"><span>{dateLabel(rows[0]?.date)}</span><span>{dateLabel(rows.at(-1)?.date)}</span></div>
    </> : <p>{loading ? t.loading : failed ? t.marketHistoryUnavailable : t.marketHistoryEmpty}</p>}
  </section>;
}
