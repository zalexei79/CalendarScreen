import React from 'react';
import CalendarDayCell from './CalendarDayCell';
import { WEEKDAYS } from './src/shared/config/constants';

export default function CalendarGrid({
  cells,
  selectedKey,
  isLight,
  monthMaxAbsPnl,
  tradesForDayFiltered,
  totalPnlForDay,
  formatPnlDisplay,
  onSelectDay,
  onEmptyClick,
  onTouchStart,
  onTouchEnd,
}) {
  return (
    <section
      className={`flex-1 min-h-0 flex flex-col px-2 sm:px-8 pt-2 sm:py-6 pb-20 sm:pb-6 border-b relative transition-colors duration-200 ${isLight ? 'border-zinc-300' : 'border-zinc-800'}`}
      onClick={(e) => { if (e.target === e.currentTarget) onEmptyClick(); }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2" onClick={(e) => { if (e.target === e.currentTarget) onEmptyClick(); }}>
        {WEEKDAYS.map((w) => <div key={w} className={`font-data text-[11px] tracking-wider text-center uppercase pb-1 ${isLight ? 'text-zinc-400' : 'text-zinc-600'}`}>{w}</div>)}
      </div>
      <div className="calendar-days-grid grid flex-none grid-cols-7 auto-rows-[62px] gap-1 sm:flex-1 sm:auto-rows-auto sm:gap-2" onClick={(e) => { if (e.target === e.currentTarget) onEmptyClick(); }}>
        {cells.map((cell, cellIndex) => {
          const isSelected = cell.key === selectedKey;
          const hasTrades = tradesForDayFiltered(cell.key).length > 0;
          const pnl = totalPnlForDay(cell.key);
          return <CalendarDayCell key={cell.key} cell={cell} cellIndex={cellIndex} isSelected={isSelected} hasTrades={hasTrades} pnl={pnl} monthMaxAbsPnl={monthMaxAbsPnl} isLight={isLight} formatPnlDisplay={formatPnlDisplay} onSelect={() => onSelectDay(isSelected ? null : cell.key)} />;
        })}
      </div>
    </section>
  );
}
