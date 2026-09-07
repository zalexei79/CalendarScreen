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
      ? { backgroundColor: '#eee8e1', borderColor: '#dfd6cb' }
      : { backgroundColor: '#111216', borderColor: '#1c1d23' }
    : {};
  const heatmapStyle =
    cell.inMonth && hasTrades && !isSelected
      ? {
          backgroundColor: `rgba(${glowRgb},${(0.08 + effectiveIntensity * 0.16).toFixed(2)})`,
          borderColor: `rgba(${glowRgb},${(0.28 + effectiveIntensity * 0.28).toFixed(2)})`,
          boxShadow: `0 0 ${Math.round(4 + effectiveIntensity * 12)}px rgba(${glowRgb},${(0.12 + effectiveIntensity * 0.16).toFixed(2)})`,
          animation: 'cellGlowIn 0.35s ease-out both',
          animationDelay: `${cellIndex * 18}ms`,
        }
      : !cell.inMonth && hasTrades && !isSelected
      ? {
          ...adjacentBaseStyle,
          backgroundColor: `rgba(${glowRgb},0.035)`,
          borderColor: `rgba(${glowRgb},0.12)`,
          boxShadow: `0 0 6px rgba(${glowRgb},0.06)`,
          animation: 'cellGlowIn 0.35s ease-out both',
          animationDelay: `${cellIndex * 18}ms`,
        }
      : { ...adjacentBaseStyle, animation: 'cellGlowIn 0.35s ease-out both', animationDelay: `${cellIndex * 18}ms` };

  return (
    <button onClick={onSelect} style={heatmapStyle} className={[
      'relative rounded-md border flex flex-col justify-between text-left transition-all duration-150',
      'min-h-[62px] sm:min-h-[110px] p-1.5 sm:p-4',
      isLight ? (cell.inMonth ? (hasTrades ? 'bg-white' : 'bg-zinc-50') : '') : (cell.inMonth ? (hasTrades ? 'bg-zinc-900' : 'bg-zinc-900/20') : ''),
      isLight ? (cell.inMonth ? (hasTrades ? 'border-zinc-300' : 'border-zinc-200') : '') : (cell.inMonth ? (hasTrades ? 'border-zinc-800' : 'border-zinc-800/30') : ''),
      isSelected ? `border-amber-400 ring-2 ring-amber-400/60 scale-[1.03] shadow-lg shadow-amber-500/10 z-10 ${isLight ? 'bg-amber-50' : 'bg-zinc-800'}` : isLight ? 'hover:border-zinc-400 hover:bg-zinc-100' : 'hover:border-zinc-600 hover:bg-zinc-800/60',
    ].join(' ')}>
      {cell.isToday && <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-amber-400" />}
      <span className={`font-data text-sm sm:text-base ${cell.inMonth ? (isLight ? 'text-zinc-700' : 'text-zinc-300') : (isLight ? 'text-zinc-400' : 'text-zinc-600')}`}>{cell.date.getDate()}</span>
      {hasTrades && <span className={`font-data text-[11px] sm:text-lg font-medium whitespace-nowrap ${pnlTone === 'profit' ? (cell.inMonth ? 'text-emerald-500' : 'text-emerald-600/75') : pnlTone === 'loss' ? (cell.inMonth ? 'text-red-500' : 'text-red-600/75') : cell.inMonth ? 'text-zinc-500' : 'text-zinc-500/70'}`}>{pnlText}</span>}
    </button>
  );
}
