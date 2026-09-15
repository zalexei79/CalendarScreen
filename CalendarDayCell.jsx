import React, { useEffect, useState } from 'react';
import { StickyNote } from 'lucide-react';

export default function CalendarDayCell({
  traderMode = false,
  hasNote = false,
  noteLabel,
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
  const [todayPulse, setTodayPulse] = useState(false);

  useEffect(() => {
    if (!cell.isToday) return undefined;

    const handleTodayPulse = () => {
      setTodayPulse(true);
      window.setTimeout(() => setTodayPulse(false), 1500);
    };

    window.addEventListener('dk:today-pulse', handleTodayPulse);

    return () => {
      window.removeEventListener('dk:today-pulse', handleTodayPulse);
    };
  }, [cell.isToday]);

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

  // Pro: jewel-toned light under the surface, never a flashing animation.
  const proRgb = pnl > 0 ? '16,155,115' : '190,35,75';
  const proStrength = Math.sqrt(intensity);
  const proStyle = traderMode && cell.inMonth && hasTrades && !isSelected
    ? pnl === 0
      ? { backgroundColor: isLight ? '#f8fafc' : '#131418', borderColor: isLight ? '#e2e8f0' : '#292a30', boxShadow: 'none' }
      : {
          backgroundColor: isLight ? '#fff' : '#101114',
          backgroundImage: 'none',
          borderColor: `rgba(${proRgb},${isLight ? 0.45 + proStrength * 0.12 : 0.25 + proStrength * 0.12})`,
          boxShadow: isLight
            ? `0 2px 0 rgba(${proRgb},0.18), 0 5px 10px -3px rgba(${proRgb},${0.32 + proStrength * 0.12}), 0 12px 22px -9px rgba(${proRgb},${0.38 + proStrength * 0.12}), 0 1px 3px rgba(15,23,42,0.04)`
            : `0 9px ${22 + Math.round(proStrength * 14)}px -5px rgba(${proRgb},${0.30 + proStrength * 0.10}), 0 0 12px -3px rgba(${proRgb},0.16)`,
        }
    : {};

  return (
    <>
      <style>{`
        .today-calendar-cell {
          border-color: rgba(56, 189, 248, .62) !important;
          box-shadow:
            0 0 0 1px rgba(56, 189, 248, .16),
            0 0 18px rgba(56, 189, 248, .14) !important;
          z-index: 3;
        }

        .today-calendar-cell:hover {
          border-color: rgba(56, 189, 248, .82) !important;
        }

        .today-pulse-ring {
          position: absolute;
          inset: 2px;
          border: 1px solid rgba(56, 189, 248, .9);
          border-radius: inherit;
          pointer-events: none;
          z-index: 20;
          animation: todayPulse .5s ease-in-out 3;
        }

        .today-calendar-pulse {
          animation: todayCellPulse .5s ease-in-out 3 !important;
        }

        @keyframes todayPulse {
          0% {
            opacity: 0;
            transform: scale(.94);
            box-shadow: 0 0 0 0 rgba(56, 189, 248, 0);
          }

          35% {
            opacity: 1;
            transform: scale(1.015);
            box-shadow:
              0 0 0 4px rgba(56, 189, 248, .38),
              0 0 26px rgba(125, 211, 252, .55);
          }

          100% {
            opacity: 0;
            transform: scale(1.03);
            box-shadow:
              0 0 0 9px rgba(56, 189, 248, 0),
              0 0 0 rgba(56, 189, 248, 0);
          }
        }

        @keyframes todayCellPulse {
          0%, 100% {
            transform: scale(1);
          }

          35% {
            transform: scale(1.022);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .today-pulse-ring,
          .today-calendar-pulse {
            animation: none !important;
          }
        }
      `}</style>

      <button
        onClick={onSelect}
        style={{ ...heatmapStyle, ...proStyle }}
        className={[
          'relative rounded-xl border flex flex-col justify-between text-left transition-all duration-200 ease-out',
          traderMode ? 'pro-calendar-day' : '',
          cell.isToday ? 'today-calendar-cell' : '',
          todayPulse ? 'today-calendar-pulse' : '',
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
        ].join(' ')}
      >
        {cell.isToday && (
          <>
            {todayPulse && (
              <span
                className="today-pulse-ring"
                aria-hidden="true"
              />
            )}

            <span
              className={`absolute top-2 right-2 h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full shadow-sm ${
                isLight
                  ? 'bg-sky-600 ring-2 ring-white'
                  : 'bg-sky-400 ring-2 ring-zinc-900'
              }`}
            />
          </>
        )}

        {traderMode && hasNote && (
          <span
            title={noteLabel}
            className={`absolute right-2 ${cell.isToday ? 'top-6' : 'top-2'} text-amber-600/80`}
          >
            <StickyNote
              aria-label={noteLabel}
              role="img"
              className="h-3 w-3 sm:h-3.5 sm:w-3.5"
            />
          </span>
        )}

        <span
          className={`font-data text-xs sm:text-base font-semibold ${
            cell.inMonth
              ? (isLight ? 'text-slate-800' : 'text-zinc-300')
              : (isLight ? 'text-slate-400' : 'text-zinc-600')
          }`}
        >
          {cell.date.getDate()}
        </span>

        {hasTrades && (
          <span
            title={formatPnlDisplay(pnl, false)}
            className={`day-amount font-data text-[11px] sm:text-base font-extrabold tracking-tight whitespace-nowrap ${
              pnlTone === 'profit'
                ? (isLight
                  ? 'text-emerald-950 [text-shadow:0_1px_0_rgba(255,255,255,.42)]'
                  : 'text-emerald-500')
                : pnlTone === 'loss'
                  ? (isLight
                    ? 'text-rose-950 [text-shadow:0_1px_0_rgba(255,255,255,.42)]'
                    : 'text-red-500')
                  : (isLight ? 'text-slate-500' : 'text-zinc-500')
            }`}
          >
            {traderMode ? (
              <>
                <span className="day-amount-short">{pnlText}</span>
                <span className="day-amount-full">{formatPnlDisplay(pnl, false)}</span>
              </>
            ) : (
              pnlText
            )}
          </span>
        )}
      </button>
    </>
  );
}
