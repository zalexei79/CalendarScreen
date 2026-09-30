import React, { useRef } from 'react';
import { createPortal } from 'react-dom';
import { ArrowDown } from 'lucide-react';
import CalendarDayCell from './CalendarDayCell';
import { WEEKDAYS } from './src/shared/config/constants';
import { useWalletExitGesture } from './src/features/wallet/hooks/useWalletExitGesture';
import './src/features/wallet/WalletGestures.css';
import './src/shared/ui/CalendarMotion.css';

export default function CalendarGrid({
  traderMode = false,
  proView = false,
  notes = {},
  noteLabel,
  language = 'ru',
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
  onOpenWallet,
  gesturesDisabled = false,
  slideDirection,
  onNextMonth,
  onPreviousMonth,
}) {
  const drag = useRef(null);
  const suppressClick = useRef(false);
  // A workspace return reveals the complete month, without replaying 35 cells.
  const animateCells = useRef(!slideDirection && (typeof document === 'undefined' || !document.documentElement.hasAttribute('data-workspace-transition')));
  const { surfaceRef, drag: touchDrag } = useWalletExitGesture({
    navigation: 'calendar', onExit: onOpenWallet, disabled: gesturesDisabled, onNextMonth, onPreviousMonth,
  });
  const pulling = touchDrag.axis === 'y';
  const pullCopy = language === 'en' ? ['Pull to open wallet', 'Release to open wallet']
    : language === 'ro' || language === 'md' ? ['Trage pentru a deschide portofelul', 'Eliberează pentru a deschide portofelul']
    : ['Потяните вниз — в кошелёк', 'Отпустите — открыть кошелёк'];
  const animClass = slideDirection === 'next' ? 'animate-slide-next' : slideDirection === 'prev' ? 'animate-slide-prev' : '';
  return (
    <section
      ref={surfaceRef}
      data-dragging={pulling}
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
      style={{ userSelect: 'none', transform: pulling ? `translate3d(0,${touchDrag.y}px,0)` : 'none' }}
    >
      <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-3" onClick={(e) => { if (e.target === e.currentTarget) onEmptyClick(); }}>
        {WEEKDAYS.map((w) => <div key={w} className={`font-data text-[11px] sm:text-xs font-semibold tracking-wider text-center uppercase pb-1 ${isLight ? 'text-slate-600' : 'text-zinc-500'}`}>{w}</div>)}
      </div>
      <div className="calendar-days-grid grid flex-none grid-cols-7 auto-rows-[64px] gap-1 sm:flex-1 sm:auto-rows-auto sm:gap-2" onClick={(e) => { if (e.target === e.currentTarget) onEmptyClick(); }}>
        {cells.map((cell, cellIndex) => {
          const isSelected = cell.key === selectedKey;
          const hasTrades = tradesForDayFiltered(cell.key).length > 0;
          const plans = plansForDay?.(cell.key) || [];
          const pnl = totalPnlForDay(cell.key);
          return <CalendarDayCell key={cell.key} planLabel={language === 'en' ? 'Plans' : language === 'ro' || language === 'md' ? 'Planuri' : 'Планы'} hasNote={!!notes[cell.key]} noteLabel={noteLabel} traderMode={traderMode} proView={proView} cell={cell} cellIndex={cellIndex} isSelected={isSelected} hasTrades={hasTrades} plans={plans} formatPlanAmount={formatPlanAmount} pnl={pnl} monthMaxAbsPnl={monthMaxAbsPnl} isLight={isLight} formatPnlDisplay={formatPnlDisplay} onSelect={() => onSelectDay(isSelected ? null : cell.key)} />;
        })}
      </div>
      {pulling && createPortal(<div className="wallet-gesture-feedback" data-ready={touchDrag.ready} role="status"><ArrowDown aria-hidden="true" />{pullCopy[touchDrag.ready ? 1 : 0]}</div>, document.body)}
    </section>
  );
}
