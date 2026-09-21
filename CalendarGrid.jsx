import React, { useRef } from 'react';
import CalendarDayCell from './CalendarDayCell';
import { WEEKDAYS } from './src/shared/config/constants';

export default function CalendarGrid({
  traderMode = false,
  notes = {},
  noteLabel,
  cells,
  selectedKey,
  isLight,
  monthMaxAbsPnl,
  plansForDay,
  formatPlanAmount,
  tradesForDayFiltered,
  totalPnlForDay,
  formatPnlDisplay,
  onSelectDay,
  onEmptyClick,
  onTouchStart,
  onTouchEnd,
  slideDirection,
  onNextMonth,
  onPreviousMonth,
}) {
  const drag = useRef(null);
  const suppressClick = useRef(false);
  const animClass = slideDirection === 'next' ? 'animate-slide-next' : slideDirection === 'prev' ? 'animate-slide-prev' : '';
  return (
    <section
      className={`calendar-section flex-1 flex flex-col px-2 sm:px-8 pt-3 sm:pt-6 border-b relative transition-colors duration-200 ${animClass} ${isLight ? 'border-slate-200/90 bg-slate-50/40' : 'border-zinc-800'}`}
      onClick={(e) => { if (e.target === e.currentTarget) onEmptyClick(); }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onPointerDown={e => {
        if (e.pointerType !== 'mouse' || e.button !== 0) return;
        suppressClick.current = false;
        drag.current = { x: e.clientX, y: e.clientY, id: e.pointerId, moved: false };
      }}
      onPointerMove={e => {
        const start = drag.current;
        if (!start || start.id !== e.pointerId) return;
        if (Math.abs(e.clientX - start.x) > 8) {
          start.moved = true;
          suppressClick.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
        }
      }}
      onPointerUp={e => {
        const start = drag.current;
        drag.current = null;
        if (!start) return;
        const dx = e.clientX - start.x, dy = e.clientY - start.y;
        if (start.moved && Math.abs(dx) >= 64 && Math.abs(dx) > Math.abs(dy) * 1.5) {
          if (dx < 0) onNextMonth?.(); else onPreviousMonth?.();
        }
        if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
      }}
      onPointerCancel={() => { drag.current = null; }}
      onLostPointerCapture={() => { drag.current = null; }}
      onClickCapture={e => { if (suppressClick.current && e.detail !== 0) { e.preventDefault(); e.stopPropagation(); suppressClick.current = false; } }}
      onDragStart={e => e.preventDefault()}
      style={{ userSelect: 'none' }}
    >
      <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-3" onClick={(e) => { if (e.target === e.currentTarget) onEmptyClick(); }}>
        {WEEKDAYS.map((w) => <div key={w} className={`font-data text-[11px] sm:text-xs font-semibold tracking-wider text-center uppercase pb-1 ${isLight ? 'text-slate-600' : 'text-zinc-500'}`}>{w}</div>)}
      </div>
      <div className="calendar-days-grid grid flex-none grid-cols-7 auto-rows-[62px] gap-1 sm:flex-1 sm:auto-rows-auto sm:gap-2" onClick={(e) => { if (e.target === e.currentTarget) onEmptyClick(); }}>
        {cells.map((cell, cellIndex) => {
          const isSelected = cell.key === selectedKey;
          const hasTrades = tradesForDayFiltered(cell.key).length > 0;
          const plans = plansForDay?.(cell.key) || [];
          const pnl = totalPnlForDay(cell.key);
          return <CalendarDayCell key={cell.key} hasNote={!!notes[cell.key]} noteLabel={noteLabel} traderMode={traderMode} cell={cell} cellIndex={cellIndex} isSelected={isSelected} hasTrades={hasTrades} plans={plans} formatPlanAmount={formatPlanAmount} pnl={pnl} monthMaxAbsPnl={monthMaxAbsPnl} isLight={isLight} formatPnlDisplay={formatPnlDisplay} onSelect={() => onSelectDay(isSelected ? null : cell.key)} />;
        })}
      </div>
    </section>
  );
}
