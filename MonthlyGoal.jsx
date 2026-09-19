import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Pencil, Sparkles, Target, X } from 'lucide-react';

const COPY = {
  ru: {
    title: 'Цель месяца',
    setGoal: 'Задать цель',
    editGoal: 'Изменить цель',
    remaining: 'Осталось',
    achieved: 'Цель достигнута',
    progress: 'прогресса',
    save: 'Сохранить',
    cancel: 'Отмена',
    placeholder: 'Например, 30000',
    invalid: 'Введите сумму больше 0',
    celebration: 'Цель месяца достигнута!',
  },
  en: {
    title: 'Monthly goal',
    setGoal: 'Set goal',
    editGoal: 'Edit goal',
    remaining: 'Remaining',
    achieved: 'Goal achieved',
    progress: 'progress',
    save: 'Save',
    cancel: 'Cancel',
    placeholder: 'For example, 30000',
    invalid: 'Enter an amount above 0',
    celebration: 'Monthly goal reached!',
  },
  ro: {
    title: 'Obiectiv lunar',
    setGoal: 'Setează obiectivul',
    editGoal: 'Modifică obiectivul',
    remaining: 'A rămas',
    achieved: 'Obiectiv atins',
    progress: 'progres',
    save: 'Salvează',
    cancel: 'Anulează',
    placeholder: 'De exemplu, 30000',
    invalid: 'Introdu o sumă mai mare de 0',
    celebration: 'Obiectivul lunar a fost atins!',
  },
};

function resolveLanguage(language) {
  const code = String(language || '').toLowerCase();
  if (code === 'en' || code.startsWith('en-')) return 'en';
  if (['ro', 'md', 'mo', 'ron', 'rum'].includes(code) || code.startsWith('ro-')) return 'ro';
  return 'ru';
}

function formatGoalNumber(value, language) {
  const locale = resolveLanguage(language) === 'ro'
    ? 'ro-RO'
    : resolveLanguage(language) === 'en'
      ? 'en-US'
      : 'ru-RU';

  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
}

export default function MonthlyGoal({
  year,
  month,
  currency,
  currencySymbol,
  currentPnl,
  language,
  isLight,
  userId,
}) {
  const copy = COPY[resolveLanguage(language)];
  const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
  const userKey = userId || 'guest';
  const goalStorageKey = `pro_month_goal_v1:${userKey}:${monthKey}:${currency}`;
  const celebrationStorageKey = `goal_celebrated_${monthKey}_${currency}:${userKey}`;

  const readGoal = () => {
    try {
      const value = Number(window.localStorage.getItem(goalStorageKey));
      return Number.isFinite(value) && value > 0 ? value : 0;
    } catch {
      return 0;
    }
  };

  const [goal, setGoal] = useState(readGoal);
  const [editing, setEditing] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [draft, setDraft] = useState(goal ? String(goal) : '');
  const [error, setError] = useState('');
  const [celebrating, setCelebrating] = useState(false);
  const [displayProgress, setDisplayProgress] = useState(0);
  const celebrationTimerRef = useRef(null);

  useEffect(() => {
    const next = readGoal();
    setGoal(next);
    setDraft(next ? String(next) : '');
    setEditing(false);
    setDetailsOpen(false);
    setError('');
  }, [goalStorageKey]);

  useEffect(() => () => {
    if (celebrationTimerRef.current) window.clearTimeout(celebrationTimerRef.current);
  }, []);

  const netPnl = Number(currentPnl) || 0;
  const positiveProgress = Math.max(0, netPnl);
  const progress = goal > 0 ? Math.min(100, Math.max(0, (positiveProgress / goal) * 100)) : 0;
  const remaining = goal > 0 ? Math.max(0, goal - netPnl) : 0;
  const achieved = goal > 0 && netPnl >= goal;

  useEffect(() => {
    let reduceMotion = false;
    try {
      reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;
    } catch {
      reduceMotion = false;
    }

    if (reduceMotion) {
      setDisplayProgress(progress);
      return undefined;
    }

    const frame = window.requestAnimationFrame(() => setDisplayProgress(progress));
    return () => window.cancelAnimationFrame(frame);
  }, [progress, monthKey]);

  useEffect(() => {
    if (!goal || !achieved) return;

    let alreadyCelebrated = false;
    try {
      alreadyCelebrated = window.localStorage.getItem(celebrationStorageKey) === String(goal);
    } catch {
      alreadyCelebrated = false;
    }
    if (alreadyCelebrated) return;

    let reduceMotion = false;
    try {
      reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;
    } catch {
      reduceMotion = false;
    }

    try {
      window.localStorage.setItem(celebrationStorageKey, String(goal));
    } catch {
      // ignore storage failures
    }

    if (reduceMotion) return;

    setCelebrating(true);
    if (celebrationTimerRef.current) window.clearTimeout(celebrationTimerRef.current);
    celebrationTimerRef.current = window.setTimeout(() => {
      setCelebrating(false);
      celebrationTimerRef.current = null;
    }, 2800);
  }, [goal, achieved, celebrationStorageKey]);

  const particles = useMemo(() => Array.from({ length: 52 }, (_, index) => ({
    id: index,
    left: (index * 37 + 7) % 100,
    delay: (index % 8) * 0.045,
    duration: 1.75 + (index % 6) * 0.13,
    drift: (index % 2 === 0 ? 1 : -1) * (24 + ((index * 17) % 72)),
    rotate: 180 + ((index * 73) % 540),
    size: 5 + (index % 4) * 2,
    tone: index % 5,
  })), []);

  function startEditing() {
    setDraft(goal ? String(goal) : '');
    setError('');
    setEditing(true);
    setDetailsOpen(true);
  }

  function cancelEditing() {
    setDraft(goal ? String(goal) : '');
    setError('');
    setEditing(false);
  }

  function saveGoal(event) {
    event?.preventDefault?.();

    const normalized = String(draft).replace(',', '.').trim();
    const nextGoal = Number(normalized);
    if (!Number.isFinite(nextGoal) || nextGoal <= 0) {
      setError(copy.invalid);
      return;
    }

    const previousGoal = goal;

    try {
      window.localStorage.setItem(goalStorageKey, String(nextGoal));

      // Changing a goal must not manufacture a celebration. If the new target
      // is already below today's PnL, mark it as already acknowledged.
      if (netPnl >= nextGoal) {
        window.localStorage.setItem(celebrationStorageKey, String(nextGoal));
      } else if (nextGoal > previousGoal) {
        window.localStorage.removeItem(celebrationStorageKey);
      }
    } catch {
      // localStorage can be unavailable in private/restricted contexts.
    }

    setGoal(nextGoal);
    setDraft(String(nextGoal));
    setError('');
    setEditing(false);
    setCelebrating(false);
  }

  const panelClass = isLight
    ? 'border-slate-200/90 bg-white/80 text-zinc-900 shadow-[0_10px_30px_-24px_rgba(15,23,42,.35)]'
    : 'border-white/[0.08] bg-zinc-950/48 text-zinc-100 shadow-[0_14px_34px_-26px_rgba(0,0,0,.75)]';

  const mutedClass = isLight ? 'text-slate-500' : 'text-zinc-500';
  const trackClass = isLight ? 'bg-slate-100' : 'bg-white/[0.07]';

  return (
    <>
      <section className={`relative mx-auto mt-1 mb-1.5 overflow-hidden rounded-2xl border px-3 py-2 sm:px-4 sm:py-2.5 ${panelClass}`}>
        <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/35 to-transparent" />

        <div className="flex min-w-0 items-center gap-2">
          <div className={`grid h-6 w-6 sm:h-7 sm:w-7 shrink-0 place-items-center rounded-lg ${
            isLight ? 'bg-amber-50/80 text-amber-600' : 'bg-amber-400/[0.08] text-amber-300'
          }`}>
            <Target className="h-3.5 w-3.5" />
          </div>

          <button
            type="button"
            onClick={() => setDetailsOpen((value) => !value)}
            className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2 text-left"
            aria-expanded={detailsOpen}
          >
            <span className="shrink-0 text-[11px] font-semibold sm:text-sm">{copy.title}</span>

            {goal > 0 ? (
              <span className={`min-w-0 truncate font-data text-[10px] font-semibold sm:text-xs ${mutedClass}`}>
                {formatGoalNumber(netPnl, language)} / {formatGoalNumber(goal, language)} {currency}
              </span>
            ) : (
              <span className={`min-w-0 truncate text-[11px] ${mutedClass}`}>{copy.setGoal}</span>
            )}

            {goal > 0 && (
              <span className={`ml-auto shrink-0 font-data text-[10px] font-bold sm:text-[11px] ${achieved ? 'text-emerald-500' : 'text-amber-500'}`}>
                {Math.round(progress)}%
              </span>
            )}

            <ChevronDown
              className={`h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0 transition-transform duration-200 ${mutedClass} ${detailsOpen ? 'rotate-180' : ''}`}
            />
          </button>
        </div>

        <div className={`relative mt-1.5 h-[3px] sm:h-1 overflow-hidden rounded-full ${trackClass}`}>
          <div
            className={`absolute inset-y-0 left-0 rounded-full transition-[width,filter] duration-1000 ease-[cubic-bezier(.22,1,.36,1)] ${
              achieved
                ? 'bg-gradient-to-r from-emerald-500 via-emerald-400 to-amber-400'
                : 'bg-gradient-to-r from-amber-500 to-amber-300'
            }`}
            style={{ width: `${displayProgress}%` }}
          />
          {displayProgress > 0 && (
            <span
              aria-hidden="true"
              className="absolute inset-y-0 w-10 -translate-x-full bg-gradient-to-r from-transparent via-white/35 to-transparent opacity-60 transition-[left] duration-1000 ease-[cubic-bezier(.22,1,.36,1)] motion-reduce:hidden"
              style={{ left: `${displayProgress}%` }}
            />
          )}
        </div>

        <div className={`grid transition-[grid-template-rows,opacity,margin] duration-200 ${
          detailsOpen || editing ? 'mt-2 grid-rows-[1fr] opacity-100' : 'mt-0 grid-rows-[0fr] opacity-0'
        }`}>
          <div className="min-h-0 overflow-hidden">
            {editing ? (
              <form onSubmit={saveGoal} className="flex flex-col gap-2 sm:flex-row sm:items-start">
                <div className="min-w-0 flex-1">
                  <div className="relative">
                    <input
                      autoFocus
                      inputMode="decimal"
                      value={draft}
                      onChange={(event) => {
                        setDraft(event.target.value);
                        if (error) setError('');
                      }}
                      placeholder={copy.placeholder}
                      className={`h-9 w-full rounded-lg border px-3 pr-16 text-base outline-none transition focus:border-amber-400 ${
                        isLight ? 'border-zinc-200 bg-white' : 'border-white/10 bg-black/20'
                      }`}
                    />
                    <span className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-data text-[10px] ${mutedClass}`}>
                      {currency}
                    </span>
                  </div>
                  {error && <p className="mt-1.5 text-[11px] text-red-500">{error}</p>}
                </div>

                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-amber-400 px-3 text-xs font-semibold text-zinc-950 transition hover:bg-amber-300 sm:flex-none"
                  >
                    <Check className="h-3.5 w-3.5" />
                    {copy.save}
                  </button>
                  <button
                    type="button"
                    onClick={cancelEditing}
                    aria-label={copy.cancel}
                    title={copy.cancel}
                    className={`grid h-9 w-9 place-items-center rounded-lg border transition ${
                      isLight ? 'border-zinc-200 hover:bg-zinc-50' : 'border-white/10 hover:bg-white/5'
                    }`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </form>
            ) : (
              <div className={`flex flex-wrap items-center justify-between gap-2 border-t pt-2.5 ${
                isLight ? 'border-zinc-200' : 'border-white/5'
              }`}>
                <p className={`text-[10px] ${mutedClass}`}>
                  {goal > 0
                    ? achieved
                      ? copy.achieved
                      : `${copy.remaining}: ${formatGoalNumber(remaining, language)} ${currency}`
                    : `${copy.setGoal}: 30 000 ${currency}`}
                </p>

                <button
                  type="button"
                  onClick={startEditing}
                  className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[10px] font-semibold transition ${
                    isLight
                      ? 'border-zinc-200 bg-white hover:border-amber-300'
                      : 'border-white/10 bg-white/5 hover:border-amber-400/40'
                  }`}
                >
                  <Pencil className="h-3 w-3" />
                  {goal > 0 ? copy.editGoal : copy.setGoal}
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {celebrating && (
        <div className="pointer-events-none fixed inset-0 z-[260] overflow-hidden" aria-hidden="true">
          <style>{`
            @keyframes proGoalConfettiFall {
              0% { transform: translate3d(0,-8vh,0) rotate(0deg); opacity:0; }
              8% { opacity:1; }
              100% { transform: translate3d(var(--goal-drift),105vh,0) rotate(var(--goal-rotate)); opacity:.95; }
            }
            @keyframes proGoalCelebratePop {
              0% { opacity:0; transform:translate(-50%,-50%) scale(.82); }
              18% { opacity:1; transform:translate(-50%,-50%) scale(1.03); }
              78% { opacity:1; transform:translate(-50%,-50%) scale(1); }
              100% { opacity:0; transform:translate(-50%,-50%) scale(.98); }
            }
            @media (prefers-reduced-motion: reduce) {
              .pro-goal-confetti-piece { display:none !important; }
              .pro-goal-celebration-card { animation:none !important; }
            }
          `}</style>

          {particles.map((particle) => (
            <span
              key={particle.id}
              className={`pro-goal-confetti-piece absolute -top-4 rounded-sm ${
                particle.tone === 0 ? 'bg-amber-400'
                  : particle.tone === 1 ? 'bg-emerald-400'
                  : particle.tone === 2 ? 'bg-sky-400'
                  : particle.tone === 3 ? 'bg-fuchsia-400'
                  : 'bg-white'
              }`}
              style={{
                left: `${particle.left}%`,
                width: `${particle.size}px`,
                height: `${Math.max(4, particle.size * 0.55)}px`,
                '--goal-drift': `${particle.drift}px`,
                '--goal-rotate': `${particle.rotate}deg`,
                animation: `proGoalConfettiFall ${particle.duration}s cubic-bezier(.18,.66,.34,1) ${particle.delay}s both`,
              }}
            />
          ))}

          <div
            className={`pro-goal-celebration-card absolute left-1/2 top-1/2 w-[min(88vw,430px)] rounded-3xl border px-6 py-5 text-center shadow-2xl ${
              isLight ? 'border-amber-200 bg-white/95 text-zinc-950' : 'border-amber-400/30 bg-zinc-950/95 text-white'
            }`}
            style={{ animation: 'proGoalCelebratePop 2.8s cubic-bezier(.16,1,.3,1) both' }}
          >
            <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-amber-400 text-zinc-950">
              <Sparkles className="h-6 w-6" />
            </div>
            <p className="font-display text-xl font-semibold">{copy.celebration}</p>
            <p className={`mt-1 font-data text-sm ${mutedClass}`}>
              {formatGoalNumber(netPnl, language)} / {formatGoalNumber(goal, language)} {currency}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
