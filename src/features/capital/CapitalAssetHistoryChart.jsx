import React, { useMemo, useState } from 'react';
import { formatMoney, MONEY_SCALE } from './decimal.js';
import { buildAssetHistoryPath, buildAssetOperationHistory } from './assetHistory.js';

export default function CapitalAssetHistoryChart({ rows, currency, locale, t, formatQuantity }) {
  const [mode, setMode] = useState('cost');
  const history = useMemo(() => buildAssetOperationHistory(rows), [rows]);
  const chart = useMemo(() => buildAssetHistoryPath(history, mode), [history, mode]);
  const first = history[0];
  const last = history.at(-1);
  const value = point => mode === 'quantity'
    ? `${formatQuantity(point.quantity, locale)} ${t.quantityUnit}`
    : formatMoney(point.costBasis, currency, locale);

  return <section className="capital-asset-history" aria-label={t.assetHistory}>
    <div className="capital-asset-history-head">
      <div><strong>{t.assetHistory}</strong><small>{t.assetHistoryNote}</small></div>
      <div className="capital-asset-history-modes" role="group" aria-label={t.assetHistory}>
        <button type="button" aria-pressed={mode === 'cost'} onClick={() => setMode('cost')}>{t.costMode}</button>
        <button type="button" aria-pressed={mode === 'quantity'} onClick={() => setMode('quantity')}>{t.quantityMode}</button>
      </div>
    </div>
    {history.length ? <>
      <svg className="capital-asset-history-svg" viewBox="0 0 320 124" role="img" aria-label={`${mode === 'cost' ? t.costMode : t.quantityMode}: ${value(last)}`}>
        <defs><linearGradient id="capital-asset-history-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="currentColor" stopOpacity=".26"/><stop offset="100%" stopColor="currentColor" stopOpacity="0"/></linearGradient></defs>
        <path className="capital-chart-gridline" d="M12 30H308 M12 65H308 M12 100H308"/>
        {chart.area&&<path className="capital-asset-history-area" d={chart.area}/>}
        {chart.path&&<path className="capital-asset-history-line" d={chart.path}/>}
        {history.length===1&&<circle className="capital-asset-history-dot" cx="160" cy="100" r="4"/>}
      </svg>
      <div className="capital-asset-history-values"><span>{first.date} · {value(first)}</span><span>{last.date} · {value(last)}</span></div>
    </> : <p className="capital-asset-history-empty">{t.assetHistoryEmpty}</p>}
  </section>;
}
