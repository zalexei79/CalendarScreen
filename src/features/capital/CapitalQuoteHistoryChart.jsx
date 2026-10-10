import React, { useEffect, useMemo, useState } from 'react';
import { fetchAssetQuoteHistory } from './assetQuoteHistory.js';
import { formatMoney } from './decimal.js';

function makePath(rows) {
  const values = rows.map(row => Number(row.price)).filter(Number.isFinite);
  if (values.length < 2) return null;
  const low = Math.min(...values), high = Math.max(...values), span = high - low || Math.max(Math.abs(high) * .01, 1);
  const points = values.map((value, index) => ({ x: 12 + index * 296 / (values.length - 1), y: 94 - (value - low) * 76 / span }));
  const path = points.map((point, index) => `${index ? 'L' : 'M'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ');
  return { path, area: `${path} L308 104 L12 104 Z`, first: values[0], last: values.at(-1) };
}

export default function CapitalQuoteHistoryChart({ asset, currency, locale, t }) {
  const [rows, setRows] = useState([]), [loading, setLoading] = useState(false), [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!asset || !['binance', 'moex'].includes(asset.quote_source)) { setRows([]); setFailed(false); return; }
    const controller = new AbortController();
    setLoading(true); setFailed(false);
    fetchAssetQuoteHistory(asset, { signal: controller.signal }).then(setRows)
      .catch(error => { if (error.name !== 'AbortError') setFailed(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [asset?.id, asset?.symbol, asset?.quote_source, asset?.category]);
  const chart = useMemo(() => makePath(rows), [rows]);
  if (!asset || !['binance', 'moex'].includes(asset.quote_source)) return null;
  return <section className="capital-market-history" aria-label={t.marketHistory}>
    <div className="capital-market-history-head"><div><strong>{t.marketHistory}</strong><small>{asset.quote_source === 'binance' ? t.binanceHistorySource : t.moexHistorySource} · {asset.currency}</small></div><span>{rows.at(-1)?.date || (loading ? t.loading : '')}</span></div>
    {chart ? <>
      <svg className="capital-market-history-svg" viewBox="0 0 320 116" role="img" aria-label={`${t.marketHistory}: ${formatMoney(chart.last, currency, locale)}`}>
        <defs><linearGradient id="capital-market-history-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="currentColor" stopOpacity=".23"/><stop offset="100%" stopColor="currentColor" stopOpacity="0"/></linearGradient></defs>
        <path className="capital-chart-gridline" d="M12 18H308 M12 56H308 M12 94H308"/><path className="capital-market-history-area" d={chart.area}/><path className="capital-market-history-line" d={chart.path}/>
      </svg>
      <div className="capital-market-history-values"><span>{rows[0]?.date} · {formatMoney(chart.first, currency, locale)}</span><span>{rows.at(-1)?.date} · {formatMoney(chart.last, currency, locale)}</span></div>
    </> : <p>{loading ? t.loading : failed ? t.marketHistoryUnavailable : t.marketHistoryEmpty}</p>}
  </section>;
}
