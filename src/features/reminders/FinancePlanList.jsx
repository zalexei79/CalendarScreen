import React from 'react';
import { BellRing, CheckCircle2, Clock3, XCircle } from 'lucide-react';
import { getCurrencyMeta } from '../../shared/config/constants';
import { planDateKey, planTime } from './useFinancePlans';

const COPY = {
  ru: { title: 'Планы на этот день', later: 'сумма позже', confirmed: 'Подтверждено', missed: 'Не получилось', overdue: 'Просрочено', waiting: 'Ожидает результата', planned: 'Напоминание запланировано', weekly: 'каждую неделю', monthly: 'каждый месяц', yearly: 'каждый год', atTime: 'в момент события', day: 'за 1 день', days: 'за 3 дня', week: 'за неделю', edit: 'Изменить', addAmount: 'Указать сумму', success: 'Подтвердилось', saving: 'Сохраняю…', count: 'планов', until: 'до' },
  en: { title: 'Plans for this day', later: 'amount later', confirmed: 'Confirmed', missed: 'Did not happen', overdue: 'Overdue', waiting: 'Awaiting result', planned: 'Reminder scheduled', weekly: 'every week', monthly: 'every month', yearly: 'every year', atTime: 'at event time', day: '1 day before', days: '3 days before', week: '1 week before', edit: 'Edit', addAmount: 'Add amount', success: 'Confirmed', saving: 'Saving…', count: 'plans', until: 'until' },
  ro: { title: 'Planuri pentru această zi', later: 'sumă mai târziu', confirmed: 'Confirmat', missed: 'Nu s-a reușit', overdue: 'Expirat', waiting: 'Așteaptă rezultatul', planned: 'Memento programat', weekly: 'în fiecare săptămână', monthly: 'în fiecare lună', yearly: 'în fiecare an', atTime: 'la ora evenimentului', day: 'cu 1 zi înainte', days: 'cu 3 zile înainte', week: 'cu 1 săptămână înainte', edit: 'Editează', addAmount: 'Adaugă suma', success: 'Confirmat', saving: 'Se salvează…', count: 'planuri', until: 'până la' },
};

function resolveLanguage(language) {
  const code = String(language || '').toLowerCase();
  if (code === 'en' || code.startsWith('en-')) return 'en';
  if (code === 'ro' || code.startsWith('ro-') || code === 'md') return 'ro';
  return 'ru';
}

function amount(plan, localeCode, copy) {
  if (plan.amount == null) return copy.later;
  const symbol = getCurrencyMeta(plan.currency || 'USD').symbol;
  const locale = localeCode === 'en' ? 'en-US' : localeCode === 'ro' ? 'ro-RO' : 'ru-RU';
  return `${plan.kind === 'income' ? '+' : '−'}${symbol}${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(Number(plan.amount) || 0)}`;
}

function endDateLabel(value, localeCode) {
  const locale = localeCode === 'en' ? 'en-US' : localeCode === 'ro' ? 'ro-RO' : 'ru-RU';
  return new Date(`${value}T12:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function FinancePlanList({ plans = [], todayKey, language = 'ru', isLight, onResolve, onEdit, busyId }) {
  if (!plans.length) return null;
  const localeCode = resolveLanguage(language);
  const copy = COPY[localeCode];
  const panel = isLight ? 'border-slate-200 bg-slate-50/70' : 'border-white/[0.08] bg-white/[0.025]';

  return <section className={`overflow-hidden rounded-2xl border ${panel}`}>
    <div className="flex items-center justify-between border-b border-inherit px-4 py-3">
      <div className="flex items-center gap-2"><BellRing className="h-4 w-4 text-zinc-400" /><span className="text-sm font-semibold">{copy.title}</span></div>
      <span className="font-data text-[11px] text-zinc-500">{plans.length} {copy.count}</span>
    </div>
    <div className="divide-y divide-zinc-500/10">
      {plans.map((plan) => {
        const actionPlan = plan.sourcePlan || plan;
        const active = plan.status === 'active' && plan.outcome === 'planned';
        const due = planDateKey(plan) <= todayKey;
        const overdue = active && planDateKey(plan) < todayKey;
        const completed = plan.outcome === 'completed';
        const missed = plan.outcome === 'missed';
        const repeat = { weekly: copy.weekly, monthly: copy.monthly, yearly: copy.yearly }[plan.repeat_rule] || '';
        const remind = { '1_day': copy.day, '3_days': copy.days, '1_week': copy.week }[plan.remind_offset] || copy.atTime;
        const status = completed ? copy.confirmed : missed ? copy.missed : overdue ? copy.overdue : active && due ? copy.waiting : copy.planned;
        return <div key={plan.id} className="px-4 py-3.5">
          <div className="flex items-start gap-3">
            <span className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl ${completed ? 'bg-emerald-500/10 text-emerald-500' : missed ? 'bg-rose-500/10 text-rose-500' : 'bg-white/[0.05] text-zinc-400'}`}>{completed ? <CheckCircle2 className="h-4 w-4" /> : missed ? <XCircle className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}</span>
            <div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><p className="truncate text-sm font-semibold">{plan.title}</p><span className={`shrink-0 font-data text-sm font-semibold ${plan.amount == null ? 'text-zinc-500' : plan.kind === 'income' ? 'text-emerald-500' : 'text-rose-500'}`}>{amount(plan, localeCode, copy)}</span></div><p className="mt-1 text-xs text-zinc-500">{planTime(plan)} {repeat} {remind} · {status}{plan.repeat_until ? ` · ${copy.until} ${endDateLabel(plan.repeat_until, localeCode)}` : ''}</p></div>
          </div>
          {active && <div className={`mt-3 flex flex-wrap items-center gap-2 ${due ? 'justify-between' : 'justify-end'}`}>
            <button type="button" disabled={busyId === actionPlan.id} onClick={() => onEdit(actionPlan)} className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${isLight ? 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900' : 'border-white/[0.08] bg-white/[0.03] text-zinc-400 hover:border-white/[0.16] hover:text-zinc-100'} disabled:opacity-50`}>{plan.amount == null ? copy.addAmount : copy.edit}</button>
            {due && <div className="flex gap-2"><button type="button" disabled={busyId === actionPlan.id} onClick={() => onResolve(actionPlan, 'completed')} className="rounded-xl bg-emerald-500 px-3 py-2.5 text-xs font-bold text-white transition hover:bg-emerald-400 disabled:opacity-50">{copy.success}</button><button type="button" disabled={busyId === actionPlan.id} onClick={() => onResolve(actionPlan, 'missed')} className={`rounded-xl border px-3 py-2.5 text-xs font-semibold transition ${isLight ? 'border-slate-200 bg-white text-slate-600 hover:border-rose-300 hover:text-rose-500' : 'border-white/[0.08] bg-white/[0.03] text-zinc-400 hover:border-rose-400/40 hover:text-rose-400'} disabled:opacity-50`}>{busyId === actionPlan.id ? copy.saving : copy.missed}</button></div>}
          </div>}
        </div>;
      })}
    </div>
  </section>;
}
