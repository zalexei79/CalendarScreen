import React from 'react';

export default function CalendarDayCell({
  cell,
  cellIndex,
  isSelected,
  hasTrades,
  pnl,
  monthMaxAbsPnl,
  isLight,
  onSelect,
  formatPnlDisplay,
}) {
  const pnlTone = pnl > 0 ? 'profit' : pnl < 0 ? 'loss' : 'neutral';
  const pnlText = formatPnlDisplay(pnl, true);
  const intensity = monthMaxAbsPnl > 0 ? Math.min(Math.abs(pnl) / monthMaxAbsPnl, 1) : 0;
  const effectiveIntensity = (cell.isToday || isSelected) ? intensity : intensity * 0.7;
  const glowRgb = pnlTone === 'profit' ? '16,185,129' : '239,68,68';
  const adjacentBaseStyle = !cell.inMonth
    ? isLight
      ? { backgroundColor: '#f8fafc', borderColor: '#f1f5f9' }
      : { backgroundColor: '#111216', borderColor: '#1c1d23' }
    : {};
  const heatmapStyle =
    cell.inMonth && hasTrades && !isSelected
      ? {
          backgroundColor: isLight
            ? (pnlTone === 'profit' ? `rgba(16,185,129,${(0.20 + effectiveIntensity * 0.25).toFixed(2)})` : `rgba(239,68,68,${(0.20 + effectiveIntensity * 0.25).toFixed(2)})`)
            : `rgba(${glowRgb},${(0.08 + effectiveIntensity * 0.16).toFixed(2)})`,
          borderColor: isLight
            ? (pnlTone === 'profit' ? `rgba(5,150,105,${(0.40 + effectiveIntensity * 0.30).toFixed(2)})` : `rgba(225,29,72,${(0.40 + effectiveIntensity * 0.30).toFixed(2)})`)
            : `rgba(${glowRgb},${(0.28 + effectiveIntensity * 0.28).toFixed(2)})`,
          boxShadow: isLight
            ? `0 4px 14px rgba(${glowRgb},${(0.12 + effectiveIntensity * 0.16).toFixed(2)})`
            : `0 0 ${Math.round(4 + effectiveIntensity * 12)}px rgba(${glowRgb},${(0.12 + effectiveIntensity * 0.16).toFixed(2)})`,
          animation: 'cellGlowIn 0.35s ease-out both',
          animationDelay: `${cellIndex * 18}ms`,
        }
      : !cell.inMonth && hasTrades && !isSelected
      ? {
          ...adjacentBaseStyle,
          backgroundColor: isLight ? `rgba(${glowRgb},0.03)` : `rgba(${glowRgb},0.035)`,
          borderColor: isLight ? `rgba(${glowRgb},0.12)` : `rgba(${glowRgb},0.12)`,
          boxShadow: `0 0 6px rgba(${glowRgb},0.04)`,
          animation: 'cellGlowIn 0.35s ease-out both',
          animationDelay: `${cellIndex * 18}ms`,
        }
      : { ...adjacentBaseStyle, animation: 'cellGlowIn 0.35s ease-out both', animationDelay: `${cellIndex * 18}ms` };

  return (
    <button onClick={onSelect} style={heatmapStyle} className={[
      'relative rounded-xl border flex flex-col justify-between text-left transition-all duration-200 ease-out',
      'min-h-[64px] sm:min-h-[110px] p-2 sm:p-3.5',
      isLight
        ? (cell.inMonth ? (hasTrades ? 'bg-transparent' : 'bg-white shadow-[0_1px_3px_rgba(0,0,0,0.02)]') : 'bg-slate-50/60')
        : (cell.inMonth ? (hasTrades ? 'bg-zinc-900' : 'bg-zinc-900/20') : ''),
      isLight
        ? (cell.inMonth ? (hasTrades ? 'border-slate-300/80' : 'border-slate-200/90') : 'border-slate-100')
        : (cell.inMonth ? (hasTrades ? 'border-zinc-800' : 'border-zinc-800/30') : ''),
      isSelected
        ? `border-amber-400 ring-2 ring-amber-400/60 scale-[1.02] sm:scale-[1.03] shadow-lg shadow-amber-500/10 z-10 ${isLight ? 'bg-amber-50/60' : 'bg-zinc-800'}`
        : isLight ? 'hover:border-slate-300 hover:bg-slate-50 hover:shadow-sm' : 'hover:border-zinc-600 hover:bg-zinc-800/60',
    ].join(' ')}>
      {cell.isToday && <span className="absolute top-2 right-2 h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full bg-amber-500 ring-2 ring-white shadow-sm" />}
      <span className={`font-data text-xs sm:text-base font-semibold ${cell.inMonth ? (isLight ? 'text-slate-800' : 'text-zinc-300') : (isLight ? 'text-slate-400' : 'text-zinc-600')}`}>{cell.date.getDate()}</span>
      {hasTrades && <span className={`font-data text-[11px] sm:text-base font-extrabold tracking-tight whitespace-nowrap ${pnlTone === 'profit' ? (isLight ? 'text-emerald-950 [text-shadow:0_1px_0_rgba(255,255,255,.42)]' : 'text-emerald-500') : pnlTone === 'loss' ? (isLight ? 'text-rose-950 [text-shadow:0_1px_0_rgba(255,255,255,.42)]' : 'text-red-500') : (isLight ? 'text-slate-500' : 'text-zinc-500')}`}>{pnlText}</span>}
    </button>
  );
}
