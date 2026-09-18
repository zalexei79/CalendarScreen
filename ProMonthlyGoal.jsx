import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Pencil, Sparkles, Target, X } from 'lucide-react';

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

export default function ProMonthlyGoal({
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
  const [draft, setDraft] = useState(goal ? String(goal) : '');
  const [error, setError] = useState('');
  const [celebrating, setCelebrating] = useState(false);
  const celebrationTimerRef = useRef(null);

  useEffect(() => {
    const next = readGoal();
    setGoal(next);
    setDraft(next ? String(next) : '');
    setEditing(false);
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
    ? 'border-zinc-200 bg-white/90 text-zinc-900 shadow-sm'
    : 'border-white/10 bg-zinc-950/70 text-zinc-100 shadow-[0_16px_50px_rgba(0,0,0,.18)]';

  const mutedClass = isLight ? 'text-zinc-500' : 'text-zinc-400';
  const trackClass = isLight ? 'bg-zinc-100' : 'bg-white/10';

  return (
    <>
      <section className={`relative mx-auto mt-2 mb-3 overflow-hidden rounded-2xl border px-4 py-3 sm:px-5 sm:py-4 ${panelClass}`}>
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/60 to-transparent" />

        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${isLight ? 'bg-amber-50 text-amber-600' : 'bg-amber-400/10 text-amber-300'}`}>
              <Target className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <p className="text-sm font-semibold">{copy.title}</p>
                <span className={`font-data text-[10px] uppercase tracking-[0.18em] ${mutedClass}`}>
                  {monthKey}
                </span>
              </div>
              {goal > 0 && !editing && (
                <p className={`mt-0.5 text-[11px] ${mutedClass}`}>
                  {achieved ? copy.achieved : `${copy.remaining}: ${formatGoalNumber(remaining, language)} ${currency}`}
                </p>
              )}
            </div>
          </div>

          {!editing && (
            <button
              type="button"
              onClick={startEditing}
              className={`inline-flex min-h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition ${
                isLight
                  ? 'border-zinc-200 bg-white hover:border-amber-300'
                  : 'border-white/10 bg-white/5 hover:border-amber-400/40'
              }`}
            >
              <Pencil className="h-3.5 w-3.5" />
              {goal > 0 ? copy.editGoal : copy.setGoal}
            </button>
          )}
        </div>

        {editing ? (
          <form onSubmit={saveGoal} className="mt-4">
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative min-w-0 flex-1">
                <input
                  autoFocus
                  inputMode="decimal"
                  value={draft}
                  onChange={(event) => {
                    setDraft(event.target.value);
                    if (error) setError('');
                  }}
                  placeholder={copy.placeholder}
                  className={`h-11 w-full rounded-xl border px-3 pr-16 text-base outline-none transition focus:border-amber-400 ${
                    isLight ? 'border-zinc-200 bg-white' : 'border-white/10 bg-black/20'
                  }`}
                />
                <span className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-data text-xs ${mutedClass}`}>
                  {currency}
                </span>
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-amber-400 px-4 text-sm font-semibold text-zinc-950 transition hover:bg-amber-300 sm:flex-none"
                >
                  <Check className="h-4 w-4" />
                  {copy.save}
                </button>
                <button
                  type="button"
                  onClick={cancelEditing}
                  aria-label={copy.cancel}
                  title={copy.cancel}
                  className={`grid min-h-11 min-w-11 place-items-center rounded-xl border transition ${
                    isLight ? 'border-zinc-200 hover:bg-zinc-50' : 'border-white/10 hover:bg-white/5'
                  }`}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
          </form>
        ) : goal > 0 ? (
          <div className="mt-4">
            <div className="mb-2 flex min-w-0 items-end justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-data text-sm font-semibold sm:text-base">
                  {formatGoalNumber(netPnl, language)} / {formatGoalNumber(goal, language)} {currency}
                </p>
              </div>
              <p className={`shrink-0 font-data text-xs font-semibold ${achieved ? 'text-emerald-500' : 'text-amber-500'}`}>
                {Math.round(progress)}%
              </p>
            </div>

            <div className={`relative h-2.5 overflow-hidden rounded-full ${trackClass}`}>
              <div
                className={`absolute inset-y-0 left-0 rounded-full transition-[width] duration-700 ease-out ${
                  achieved
                    ? 'bg-gradient-to-r from-emerald-500 to-amber-400'
                    : 'bg-gradient-to-r from-amber-500 to-amber-300'
                }`}
                style={{ width: `${progress}%` }}
              />
              {progress > 0 && progress < 100 && (
                <div
                  className="absolute inset-y-0 w-10 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent opacity-60"
                  style={{ left: `${progress}%` }}
                />
              )}
            </div>

            <div className="mt-2 flex items-center justify-between gap-3">
              <span className={`text-[10px] uppercase tracking-[0.16em] ${mutedClass}`}>
                {Math.round(progress)}% {copy.progress}
              </span>
              {achieved && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-500">
                  <Sparkles className="h-3.5 w-3.5" />
                  {copy.achieved}
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className={`mt-3 rounded-xl border border-dashed px-3 py-2.5 text-xs ${isLight ? 'border-zinc-200 text-zinc-500' : 'border-white/10 text-zinc-400'}`}>
            {copy.setGoal}: 30 000 {currency}
          </div>
        )}
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
