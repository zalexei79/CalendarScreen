import React, { useState } from 'react';

export default function HistoryChart({ entries, isLight, t, formatAmount }) {
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState(null);
  const end = Math.max(1, entries.length - Math.min(offset, Math.max(0, entries.length - 1)));
  const points = entries.slice(Math.max(0, end - 10), end);
  if (!points.length) return <p className="py-8 text-center text-xs text-zinc-500">{t('noRecords')}</p>;
  const active = points.find(([date]) => date === selected) || points[points.length - 1];
  const max = Math.max(1, ...points.flatMap(([, v]) => [v.income, v.expense]));
  const x = (i) => 20 + i * 360 / Math.max(1, points.length - 1);
  const y = (value) => 150 - value / max * 120;
  return <div className={`rounded-2xl border p-3 ${isLight ? 'border-zinc-200 bg-white' : 'border-zinc-800 bg-black/20'}`}>
    <div className="flex items-center justify-between gap-2 text-xs">
      <button type="button" disabled={end <= 10} onClick={() => setOffset(v => v + 10)} className="rounded-lg p-2 text-zinc-500 disabled:opacity-30">{t('earlier')}</button>
      <span className="font-data text-amber-500">{active[0]}</span>
      <button type="button" disabled={!offset} onClick={() => setOffset(v => Math.max(0, v - 10))} className="rounded-lg p-2 text-zinc-500 disabled:opacity-30">{t('later')}</button>
    </div>
    <div aria-live="polite" className="my-2 grid grid-cols-2 gap-3 text-xs">
      <div><span className="text-zinc-500">{t('incomeLabel')}</span><p className="mt-1 font-data text-emerald-600">{formatAmount(active[1].income)}</p></div>
      <div className="text-right"><span className="text-zinc-500">{t('expenseLabel')}</span><p className="mt-1 font-data text-red-500">{formatAmount(-active[1].expense)}</p></div>
    </div>
    <svg viewBox="0 0 400 175" className="w-full" role="img" aria-label={t('periodDynamics')}>
      {[30, 90, 150].map(v => <line key={v} x1="20" x2="380" y1={v} y2={v} stroke="currentColor" opacity="0.12" strokeDasharray="3 5" />)}
      {['income', 'expense'].map((key, k) => <polyline key={key} points={points.map(([, v], i) => `${x(i)},${y(v[key])}`).join(' ')} fill="none" stroke={k ? '#ef4444' : '#059669'} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />)}
      {points.map(([date, v], i) => <g key={date}>
        {date === active[0] && <line x1={x(i)} x2={x(i)} y1="20" y2="150" stroke="#f59e0b" opacity="0.5" />}
        {['income', 'expense'].map((key, k) => <circle key={key} cx={x(i)} cy={y(v[key])} r={date === active[0] ? 5 : 3} fill={k ? '#ef4444' : '#059669'} />)}
        {(i === 0 || i === points.length - 1) && <text x={x(i)} y="170" textAnchor={i ? 'end' : 'start'} fill="#71717a" fontSize="10">{date.slice(5)}</text>}
      </g>)}
    </svg>
    <div className="flex gap-1" role="group" aria-label={t('dateRange')}>
      {points.map(([date]) => <button key={date} type="button" onClick={() => setSelected(date)} onMouseEnter={() => setSelected(date)} onFocus={() => setSelected(date)} aria-pressed={active[0] === date} aria-label={date} className={`min-w-0 flex-1 rounded-lg py-3 text-[10px] transition-colors ${active[0] === date ? 'bg-amber-400/15 text-amber-500' : 'text-zinc-500 hover:bg-zinc-500/10'}`}>{date.slice(8)}</button>)}
    </div>
  </div>;
}
