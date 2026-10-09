import React, { useRef, useMemo } from 'react';
import CalendarDayCell from './CalendarDayCell';
import { WEEKDAYS } from './src/shared/config/constants';
const weekdaysFor = language => language === 'zh-CN' ? ['周一', '周二', '周三', '周四', '周五', '周六', '周日'] : WEEKDAYS;
import { useWalletExitGesture } from './src/features/wallet/hooks/useWalletExitGesture';
import './src/features/wallet/WalletGestures.css';
import './src/shared/ui/CalendarMotion.css';
import './src/shared/ui/MotionSystem.css';
import { useCalendarFit } from './src/shared/ui/useCalendarFit';

const CalendarMonthPreview = React.memo(function CalendarMonthPreview({ preview, isLight, language, traderMode, proView, selectedKey, notes, noteLabel, tradesForDayFiltered, plansForDay, formatPlanAmount, totalPnlForDay, monthMaxAbsPnl, formatPnlDisplay }) {
  // Match the target month's heatmap before it becomes the active page.
  // Reusing the departing month's range caused a colour jump at commit.
  monthMaxAbsPnl = preview.cells.reduce((max, cell) => cell.inMonth ? Math.max(max, Math.abs(totalPnlForDay(cell.key))) : max, 0);
  return <div className="calendar-month-preview" aria-hidden="true" inert="" style={{ left: `${preview.direction * 100}%` }}>
    <div className="calendar-weekdays grid grid-cols-7 gap-1 sm:gap-2 mb-3">{weekdaysFor(language).map(day => <div key={day} className={`font-data text-[11px] sm:text-xs font-semibold tracking-wider text-center uppercase pb-1 ${isLight ? 'text-slate-600' : 'text-zinc-500'}`}>{day}</div>)}</div>
    <div className="calendar-days-grid calendar-preview-days grid grid-cols-7 gap-1 sm:gap-2" style={{ flex: 1, minHeight: 0, gridAutoRows: 'auto', gridTemplateRows: `repeat(${preview.cells.length / 7},minmax(0,1fr))` }}>
      {preview.cells.map((cell, index) => <CalendarDayCell key={cell.key} cell={cell} cellIndex={index} traderMode={traderMode} proView={proView} isLight={isLight} isSelected={cell.key === selectedKey} hasNote={!!notes[cell.key]} noteLabel={noteLabel} hasTrades={tradesForDayFiltered(cell.key).length > 0} plans={plansForDay?.(cell.key) || []} formatPlanAmount={formatPlanAmount} pnl={totalPnlForDay(cell.key)} monthMaxAbsPnl={monthMaxAbsPnl} formatPnlDisplay={formatPnlDisplay} onSelect={() => {}} />)}
    </div>
  </div>;
});

export default function CalendarGrid({
  traderMode = false,
  proView = false,
  notes = {},
  noteLabel,
  language = 'ru',
  firstEntryLabel,
  firstEntryDayLabel,
  lifeArrival = false,
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
  onOpenCapital,
  gesturesDisabled = false,
  slideDirection,
  onNextMonth,
  onPreviousMonth,
}) {
  const drag = useRef(null);
  const suppressClick = useRef(false);
  const arrivedFromLife = useRef(false);
  if (lifeArrival) arrivedFromLife.current = true;
  // A workspace return reveals the complete month, without replaying 35 cells.
  const animateCells = useRef(!slideDirection && (typeof document === 'undefined' || !document.documentElement.hasAttribute('data-workspace-transition')));
  const { surfaceRef, drag: touchDrag } = useWalletExitGesture({
    navigation: 'calendar', onExit: onOpenCapital, disabled: gesturesDisabled, onNextMonth, onPreviousMonth,
  });
  useCalendarFit(surfaceRef, cells.length);
  const swipeArrival = useRef(typeof document !== 'undefined' && document.documentElement.hasAttribute('data-calendar-swipe-arrival'));
  const adjacentMonths = useMemo(() => {
    const anchor = cells.find(cell => cell.inMonth)?.date;
    if (!anchor) return [];
    return [-1, 1].map(direction => {
      const first = new Date(anchor.getFullYear(), anchor.getMonth() + direction, 1);
      const offset = (first.getDay() + 6) % 7;
      const count = Math.ceil((offset + new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()) / 7) * 7;
      return { direction, cells: Array.from({ length: count }, (_, index) => {
        const date = new Date(first.getFullYear(), first.getMonth(), 1 - offset + index);
        return { date, key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`, inMonth: date.getMonth() === first.getMonth(), isToday: date.toDateString() === new Date().toDateString() };
      }) };
    });
  }, [cells]);
  const animClass = swipeArrival.current ? '' : slideDirection === 'next' ? 'animate-slide-next' : slideDirection === 'prev' ? 'animate-slide-prev' : '';
  return (
    <div className="calendar-pages-viewport" data-pro={proView} data-light={isLight}>
      <div className="calendar-motion-light" aria-hidden="true" />
    <section
      ref={surfaceRef}
      data-dragging={Boolean(touchDrag.axis) && !touchDrag.settling}
      data-settling={Boolean(touchDrag.settling)}
      data-calendar-fit="true"
      data-life-arrival={arrivedFromLife.current || undefined}
      data-cells-enter={animateCells.current}
      className={`calendar-section wallet-gesture-content flex-1 flex flex-col px-1.5 sm:px-8 pt-2.5 sm:pt-6 border-b relative transition-colors duration-200 ${animClass} ${isLight ? 'border-slate-200/90 bg-slate-50/40' : 'border-zinc-800'}`}
      onClick={(e) => { if (e.target === e.currentTarget) onEmptyClick(); }}
      onPointerDown={e => {
        if (gesturesDisabled || e.pointerType !== 'mouse' || e.button !== 0) return;
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
      style={{ userSelect: 'none', transform: touchDrag.axis ? `translate3d(${touchDrag.x}px,${touchDrag.y}px,0)` : 'none' }}
    >
      <div className="calendar-weekdays grid grid-cols-7 gap-1 sm:gap-2 mb-3" onClick={(e) => { if (e.target === e.currentTarget) onEmptyClick(); }}>
        {weekdaysFor(language).map((w) => <div key={w} className={`font-data text-[11px] sm:text-xs font-semibold tracking-wider text-center uppercase pb-1 ${isLight ? 'text-slate-600' : 'text-zinc-500'}`}>{w}</div>)}
      </div>
      <div className="calendar-days-grid grid flex-none grid-cols-7 auto-rows-[64px] gap-1 sm:flex-1 sm:auto-rows-auto sm:gap-2" onClick={(e) => { if (e.target === e.currentTarget) onEmptyClick(); }}>
        {cells.map((cell, cellIndex) => {
          const isSelected = cell.key === selectedKey;
          const hasTrades = tradesForDayFiltered(cell.key).length > 0;
          const plans = plansForDay?.(cell.key) || [];
          const pnl = totalPnlForDay(cell.key);
          return <CalendarDayCell key={cell.key} firstEntryLabel={firstEntryLabel} firstEntryDayLabel={firstEntryDayLabel} planLabel={language === 'en' ? 'Plans' : language === 'ro' || language === 'md' ? 'Planuri' : 'Планы'} hasNote={!!notes[cell.key]} noteLabel={noteLabel} traderMode={traderMode} proView={proView} cell={cell} cellIndex={cellIndex} isSelected={isSelected} hasTrades={hasTrades} plans={plans} formatPlanAmount={formatPlanAmount} pnl={pnl} monthMaxAbsPnl={monthMaxAbsPnl} isLight={isLight} formatPnlDisplay={formatPnlDisplay} onSelect={() => onSelectDay(isSelected ? null : cell.key)} />;
        })}
      </div>
      {touchDrag.axis === 'x' && adjacentMonths.map(preview => <CalendarMonthPreview key={preview.direction} preview={preview} isLight={isLight} language={language} traderMode={traderMode} proView={proView} selectedKey={selectedKey} notes={notes} noteLabel={noteLabel} tradesForDayFiltered={tradesForDayFiltered} plansForDay={plansForDay} formatPlanAmount={formatPlanAmount} totalPnlForDay={totalPnlForDay} monthMaxAbsPnl={monthMaxAbsPnl} formatPnlDisplay={formatPnlDisplay} />)}
    </section>
    </div>
  );
}
