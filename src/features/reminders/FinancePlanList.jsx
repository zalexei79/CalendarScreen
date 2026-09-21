import React from 'react';
import { BellRing, CheckCircle2, Clock3, XCircle } from 'lucide-react';
import { getCurrencyMeta } from '../../shared/config/constants';
import { planDateKey, planTime } from './useFinancePlans';

function amount(plan) {
  if (plan.amount == null) return 'сумма позже';
  const symbol = getCurrencyMeta(plan.currency || 'USD').symbol;
  return `${plan.kind === 'income' ? '+' : '−'}${symbol}${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(Number(plan.amount) || 0)}`;
}

export default function FinancePlanList({ plans = [], todayKey, isLight, onResolve, busyId }) {
  if (!plans.length) return null;
  const panel = isLight ? 'border-amber-200 bg-amber-50/50' : 'border-amber-400/15 bg-amber-400/[0.04]';

  return <section className={`overflow-hidden rounded-2xl border ${panel}`}>
    <div className="flex items-center justify-between border-b border-inherit px-4 py-3">
      <div className="flex items-center gap-2"><BellRing className="h-4 w-4 text-amber-500" /><span className="text-sm font-semibold">Планы на этот день</span></div>
      <span className="font-data text-[11px] text-zinc-500">{plans.length}</span>
    </div>
    <div className="divide-y divide-zinc-500/10">
      {plans.map((plan) => {
        const active = plan.status === 'active' && plan.outcome === 'planned';
        const due = planDateKey(plan) <= todayKey;
        const overdue = active && planDateKey(plan) < todayKey;
        const completed = plan.outcome === 'completed';
        const missed = plan.outcome === 'missed';
        const repeat = { weekly: '· каждую неделю', monthly: '· каждый месяц', yearly: '· каждый год' }[plan.repeat_rule] || '';
        const remind = { '1_day': '· за 1 день', '3_days': '· за 3 дня', '1_week': '· за неделю' }[plan.remind_offset] || '';
        return <div key={plan.id} className="px-4 py-3.5">
          <div className="flex items-start gap-3">
            <span className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl ${completed ? 'bg-emerald-500/10 text-emerald-500' : missed ? 'bg-rose-500/10 text-rose-500' : 'bg-amber-400/15 text-amber-500'}`}>{completed ? <CheckCircle2 className="h-4 w-4" /> : missed ? <XCircle className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}</span>
            <div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><p className="truncate text-sm font-semibold">{plan.title}</p><span className={`shrink-0 font-data text-sm font-semibold ${plan.amount == null ? 'text-zinc-500' : plan.kind === 'income' ? 'text-emerald-500' : 'text-rose-500'}`}>{amount(plan)}</span></div><p className="mt-1 text-xs text-zinc-500">{planTime(plan)} {repeat} {remind} · {completed ? 'Подтверждено' : missed ? 'Не получилось' : overdue ? 'Просрочено' : active && due ? 'Ожидает результата' : 'Напоминание запланировано'}</p></div>
          </div>
          {active && due && <div className="mt-3 grid grid-cols-2 gap-2"><button type="button" disabled={busyId === plan.id} onClick={() => onResolve(plan, 'completed')} className="rounded-xl bg-emerald-500 px-3 py-2.5 text-xs font-bold text-white transition hover:bg-emerald-400 disabled:opacity-50">Подтвердилось</button><button type="button" disabled={busyId === plan.id} onClick={() => onResolve(plan, 'missed')} className={`rounded-xl border px-3 py-2.5 text-xs font-semibold transition ${isLight ? 'border-slate-200 bg-white text-slate-600 hover:border-rose-300 hover:text-rose-500' : 'border-white/[0.08] bg-white/[0.03] text-zinc-400 hover:border-rose-400/40 hover:text-rose-400'} disabled:opacity-50`}>{busyId === plan.id ? 'Сохраняю…' : 'Не получилось'}</button></div>}
        </div>;
      })}
    </div>
  </section>;
}
