import React, { useEffect, useState } from 'react';

export default function CalendarDayCell({
  traderMode = false,
  hasNote = false,
  noteLabel,
  cell,
  cellIndex,
  isSelected,
  hasTrades,
  plans = [],
  formatPlanAmount,
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
      window.setTimeout(() => setTodayPulse(false), 1000);
    };

    window.addEventListener('dk:today-pulse', handleTodayPulse);

    return () => {
      window.removeEventListener('dk:today-pulse', handleTodayPulse);
    };
  }, [cell.isToday]);

  const pnlTone = pnl > 0 ? 'profit' : pnl < 0 ? 'loss' : 'neutral';
  const hasPlans = plans.length > 0;
  const primaryPlan = plans[0];
  const paymentCounter = primaryPlan?.repeat_total ? `${primaryPlan.repeat_index || 1}/${primaryPlan.repeat_total}` : '';
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
            ? `rgba(${glowRgb},${(0.025 + effectiveIntensity * 0.035).toFixed(3)})`
            : `rgba(${glowRgb},${(0.045 + effectiveIntensity * 0.065).toFixed(3)})`,
          borderColor: isLight
            ? `rgba(${glowRgb},${(0.24 + effectiveIntensity * 0.14).toFixed(2)})`
            : `rgba(${glowRgb},${(0.20 + effectiveIntensity * 0.16).toFixed(2)})`,
          boxShadow: isLight
            ? `inset 0 -10px 22px -18px rgba(${glowRgb},${(0.18 + effectiveIntensity * 0.10).toFixed(2)}), 0 2px 8px rgba(15,23,42,.035)`
            : `inset 0 -12px 24px -20px rgba(${glowRgb},${(0.28 + effectiveIntensity * 0.12).toFixed(2)}), 0 7px 22px -18px rgba(${glowRgb},${(0.26 + effectiveIntensity * 0.10).toFixed(2)})`,
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
          backgroundColor: isLight ? `rgba(${proRgb},.025)` : '#101114',
          backgroundImage: 'none',
          borderColor: `rgba(${proRgb},${isLight ? 0.26 + proStrength * 0.10 : 0.22 + proStrength * 0.10})`,
          boxShadow: isLight
            ? `inset 0 -12px 24px -22px rgba(${proRgb},${0.30 + proStrength * 0.08}), 0 2px 8px rgba(15,23,42,.035)`
            : `inset 0 -14px 30px -24px rgba(${proRgb},${0.36 + proStrength * 0.08}), 0 10px 24px -20px rgba(${proRgb},${0.28 + proStrength * 0.08})`,
        }
    : {};

  return (
    <>
      <style>{`
        .today-calendar-cell {
          border-color: rgba(251, 191, 36, .58) !important;
          box-shadow:
            0 0 0 1px rgba(251, 191, 36, .12),
            0 0 18px rgba(245, 158, 11, .12) !important;
          animation: todayAmbientGlow 4s ease-in-out infinite;
          z-index: 3;
        }

        .today-calendar-cell:hover {
          border-color: rgba(251, 191, 36, .82) !important;
          box-shadow:
            0 0 0 1px rgba(251, 191, 36, .18),
            0 0 24px rgba(245, 158, 11, .20) !important;
        }

        .today-pulse-ring {
          position: absolute;
          inset: 2px;
          border: 1px solid rgba(251, 191, 36, .9);
          border-radius: inherit;
          pointer-events: none;
          z-index: 20;
          box-shadow: 0 0 0 4px rgba(251, 191, 36, .28), 0 0 22px rgba(245, 158, 11, .42);
          animation: todayPulse .5s ease-in-out 2;
        }

        .today-calendar-pulse {
          /* сама ячейка больше не масштабируется — мигает только кольцо выше */
        }

        @keyframes todayAmbientGlow {
          0%, 100% {
            box-shadow: 0 0 0 1px rgba(251, 191, 36, .10), 0 0 14px rgba(245, 158, 11, .08);
          }
          50% {
            box-shadow: 0 0 0 1px rgba(251, 191, 36, .18), 0 0 24px rgba(245, 158, 11, .18);
          }
        }

        @keyframes todayPulse {
          0%, 100% {
            opacity: 0;
          }

          50% {
            opacity: 1;
          }
        }

        .selected-calendar-cell {
          z-index: 12;
          transform: translateY(-1px) scale(1.006);
          border-color: rgba(245, 158, 11, .66) !important;
          box-shadow:
            inset 0 0 0 1px rgba(251, 191, 36, .08),
            inset 0 0 18px rgba(251, 191, 36, .035),
            0 8px 22px -17px rgba(245, 158, 11, .62) !important;
        }

        .selected-calendar-cell:active {
          transform: translateY(0) scale(.992);
        }

        @media (min-width: 640px) {
          .selected-calendar-cell {
            transform: translateY(-1px) scale(1.008);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .today-calendar-cell,
          .today-pulse-ring,
          .today-calendar-pulse {
            animation: none !important;
          }
        }
      `}</style>

      <button
        data-today-cell={cell.isToday ? 'true' : undefined}
        onClick={onSelect}
        style={{ ...heatmapStyle, ...proStyle }}
        className={[
          'relative overflow-hidden rounded-xl border flex flex-col justify-between text-left transition-all duration-200 ease-out',
          traderMode ? 'pro-calendar-day' : '',
          hasPlans ? 'has-calendar-plans' : '',
          cell.isToday ? 'today-calendar-cell' : '',
          todayPulse ? 'today-calendar-pulse' : '',
          isSelected ? 'selected-calendar-cell' : '',
          'min-h-[64px] sm:min-h-[110px] p-2 sm:p-3.5',
          isLight
            ? (cell.inMonth ? (hasTrades ? 'bg-transparent' : hasPlans ? 'bg-amber-50/35' : 'bg-white shadow-[0_1px_3px_rgba(0,0,0,0.02)]') : 'bg-slate-50/60')
            : (cell.inMonth ? (hasTrades ? 'bg-zinc-900' : 'bg-zinc-900/20') : ''),
          isLight
            ? (cell.inMonth ? (hasTrades ? 'border-slate-300/80' : hasPlans ? 'border-amber-300/60' : 'border-slate-200/90') : 'border-slate-100')
            : (cell.inMonth ? (hasTrades ? 'border-zinc-800' : hasPlans ? 'border-zinc-800/55' : 'border-zinc-800/30') : ''),
          isSelected
            ? `${isLight ? 'bg-white' : 'bg-zinc-900/85'}`
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
                  ? 'bg-amber-500 ring-2 ring-white'
                  : 'bg-amber-400 ring-2 ring-zinc-900'
              }`}
            />
          </>
        )}

        {traderMode && hasNote && (
          <span
            title={noteLabel}
            aria-label={noteLabel}
            role="img"
            className={`absolute right-2 ${cell.isToday ? 'top-6' : 'top-2'} h-1 w-1 sm:h-1.5 sm:w-1.5 rounded-full transition-opacity duration-200 ${
              isLight ? 'bg-slate-400/55' : 'bg-zinc-500/55'
            }`}
          />
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

        {(hasTrades || hasPlans) && (
          <div className="mt-auto min-w-0 space-y-1">
          {hasTrades && (
          <span
            title={formatPnlDisplay(pnl, false)}
            className={`day-amount block w-full min-w-0 max-w-full overflow-hidden text-ellipsis font-data text-[10px] sm:text-[15px] font-bold tracking-[-0.02em] whitespace-nowrap ${
              pnlTone === 'profit'
                ? (isLight
                  ? 'text-emerald-700'
                  : 'text-emerald-400')
                : pnlTone === 'loss'
                  ? (isLight
                    ? 'text-rose-700'
                    : 'text-rose-400')
                  : (isLight ? 'text-slate-500' : 'text-zinc-500')
            }`}
          >
            {traderMode ? (
              <>
                <span className="day-amount-short block min-w-0 overflow-hidden text-ellipsis">{pnlText}</span>
                <span className="day-amount-full min-w-0 overflow-hidden text-ellipsis">{formatPnlDisplay(pnl, false)}</span>
              </>
            ) : (
              pnlText
            )}
          </span>
          )}
          {hasPlans && (
            <span className={`flex min-w-0 items-center gap-1 overflow-hidden text-ellipsis whitespace-nowrap font-data text-[9px] font-semibold sm:text-[11px] ${isLight ? 'text-slate-500' : 'text-zinc-400'}`} title={plans.map((plan) => `${plan.title}: ${formatPlanAmount?.(plan) || plan.amount}`).join(', ')}>
              <span className={`shrink-0 ${isLight ? 'text-slate-400' : 'text-zinc-500'}`}>{plans[0]?.repeat_rule && plans[0].repeat_rule !== 'none' ? '↻' : '◷'}</span>
              <span className="truncate">{formatPlanAmount?.(primaryPlan) || primaryPlan.amount}</span>
              {paymentCounter && <span className="shrink-0 opacity-70">· {paymentCounter}</span>}
              {plans.length > 1 && <span className="shrink-0 opacity-60">+{plans.length - 1}</span>}
            </span>
          )}
          </div>
        )}
      </button>
    </>
  );
}
