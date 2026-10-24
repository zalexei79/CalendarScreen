import React, { useId, useState } from 'react';
import { dateLabel, money, tradeCount } from './botCalendarModel.js';
import { plotGeometry } from './botAnalyticsModel.js';

export default function BotPerformanceChart({ data, mini = false, mode = 'total' }) {
  const id = useId().replace(/:/g, '');
  const [cursor, setCursor] = useState(null);
  const curve = data?.curve || [];
  const values = mode === 'drawdown' ? curve.map(p => ({ ...p, drawdown: -Number(p.drawdown) })) : curve;
  const g = plotGeometry(values, mode);
  const index = Math.max(0, Math.min(curve.length, cursor ?? curve.length));
  const active = index ? curve[index - 1] : null;
  const point = mode === 'pnl' && index > 0 ? { ...g.points[index], x: (g.points[index - 1].x + g.points[index].x) / 2 } : g.points[index];
  const activeValue = active ? mode === 'drawdown' ? -Number(active.drawdown) : Number(active[mode]) : 0;
  const color = mode === 'drawdown' || Number(data?.stats?.pnl) < 0 ? '#f19baa' : '#80dfb8';
  const title = mode === 'pnl' ? 'Результат по дням' : mode === 'drawdown' ? 'Просадка по закрытым сделкам' : 'Накопленный результат';
  const last = g.points.at(-1);
  return <div className={`bot-performance-chart${mini ? ' is-mini' : ''}`}>
    {!mini && <div className="bot-chart-readout"><span>{active ? dateLabel(active.date_key) : 'Начало периода'}</span><strong>{money(activeValue, data.currency, true)}</strong><small>{active ? tradeCount(active.trades) : 'Отсчёт от нуля'}</small></div>}
    <svg viewBox={`0 0 ${g.width} ${g.height}`} preserveAspectRatio="none" role="img" aria-label={title}
      onPointerMove={mini ? undefined : event => { const box = event.currentTarget.getBoundingClientRect(); setCursor(Math.max(0, Math.min(curve.length, Math.round(((event.clientX - box.left) / box.width * g.width - 18) / (g.width - 36) * curve.length)))); }}>
      <defs><linearGradient id={`bot-area-${id}`} x1="0" y1="0" x2="0" y2="1"><stop stopColor={color} stopOpacity=".22" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      {!mini && [g.height*.25,g.height*.5,g.height*.75].map(y=><line key={y} x1="18" x2={g.width-18} y1={y} y2={y} stroke="#ffffff0a" />)}
      <line x1="18" x2={g.width-18} y1={g.zero} y2={g.zero} stroke="#a5b8ad45" strokeDasharray="4 5" />
      {mode === 'pnl' ? g.points.slice(1).map((p,i)=><rect key={i} x={(g.points[i].x+p.x)/2-Math.max(2,Math.min(12,300/g.points.length))} y={Math.min(p.y,g.zero)} width={Math.max(3,Math.min(24,600/g.points.length))} height={Math.max(1,Math.abs(g.zero-p.y))} rx="2" fill={p.value>=0?'#80dfb8':'#f19baa'} opacity=".85" />) : <>
        <path d={`${g.line} L${last.x},${g.zero} L18,${g.zero} Z`} fill={`url(#bot-area-${id})`} />
        <path d={g.line} fill="none" stroke={color} strokeWidth={mini?3.5:2.8} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </>}
      {!mini && <><line x1={point.x} x2={point.x} y1="10" y2={g.height-10} stroke="#e2d4ad70" strokeDasharray="3 4" /><circle cx={point.x} cy={point.y} r="5" fill="#151b1a" stroke={color} strokeWidth="2" /></>}
    </svg>
    {!mini && <>
      <input className="bot-chart-slider" type="range" aria-label="День графика" min="0" max={curve.length} value={index} onChange={event=>setCursor(Number(event.target.value))} />
      <div className="bot-chart-axis"><span>{dateLabel(data.from,{day:'numeric',month:'short'})}</span><span>{title} · {data.currency}</span><span>{dateLabel(data.to,{day:'numeric',month:'short'})}</span></div>
    </>}
  </div>;
}
