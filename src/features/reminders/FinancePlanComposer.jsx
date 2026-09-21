import React, { useEffect, useState } from 'react';
import { BellRing, CalendarClock, Check, CreditCard, TrendingUp, X } from 'lucide-react';
import { CURRENCIES } from '../../shared/config/constants';

const QUICK_PLANS = [
  ['Платёж по кредиту', 'expense'],
  ['Аренда', 'expense'],
  ['Зарплата', 'income'],
  ['Подписка', 'expense'],
];

function initialTime() {
  const date = new Date();
  date.setMinutes(date.getMinutes() + 10, 0, 0);
  return date.toTimeString().slice(0, 5);
}

export default function FinancePlanComposer({ open, dateKey, defaultCurrency, isLight, onClose, onCreate, busy, error }) {
  const [title, setTitle] = useState('Платёж по кредиту');
  const [amount, setAmount] = useState('');
  const [kind, setKind] = useState('expense');
  const [currency, setCurrency] = useState(defaultCurrency || 'USD');
  const [time, setTime] = useState(initialTime);
  const [repeatRule, setRepeatRule] = useState('none');
  const [remindOffset, setRemindOffset] = useState('at_time');

  useEffect(() => {
    if (!open) return;
    setTitle('Платёж по кредиту');
    setAmount('');
    setKind('expense');
    setCurrency(defaultCurrency || 'USD');
    setTime('09:00');
    setRepeatRule('none');
    setRemindOffset('at_time');
  }, [open, dateKey, defaultCurrency]);

  if (!open) return null;
  const dateLabel = new Date(`${dateKey}T12:00:00`).toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
  const panel = isLight ? 'border-slate-200 bg-white text-slate-950' : 'border-zinc-800 bg-zinc-950 text-zinc-100';
  const soft = isLight ? 'bg-slate-50 text-slate-600' : 'bg-white/[0.045] text-zinc-400';
  const field = isLight ? 'border-slate-200 bg-white text-slate-900 placeholder:text-slate-400' : 'border-white/[0.09] bg-black/25 text-zinc-100 placeholder:text-zinc-600';
  const select = isLight ? 'border-slate-200 bg-white text-slate-800' : 'border-white/[0.09] bg-zinc-950 text-zinc-200';

  function submit(event) {
    event.preventDefault();
    onCreate({
      id: globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
      title,
      amount,
      currency,
      kind,
      time,
      repeatRule,
      remindOffset,
    });
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/65 p-3 backdrop-blur-sm sm:items-center" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <form onSubmit={submit} className={`w-full max-w-md overflow-hidden rounded-[28px] border shadow-2xl ${panel}`}>
        <div className="bg-gradient-to-br from-amber-300/[0.18] via-transparent to-emerald-400/[0.08] px-5 pb-5 pt-4 sm:px-6">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-amber-400 text-zinc-950 shadow-lg shadow-amber-500/20"><CalendarClock className="h-5 w-5" /></span>
              <div>
                <p className="font-data text-[10px] uppercase tracking-[0.2em] text-amber-500">DAYRIS PLAN</p>
                <h2 className="mt-1 text-lg font-semibold tracking-tight">Запланировать день</h2>
              </div>
            </div>
            <button type="button" onClick={onClose} className={`grid h-10 w-10 place-items-center rounded-xl ${soft}`} aria-label="Закрыть"><X className="h-4 w-4" /></button>
          </div>
          <div className={`flex items-center gap-2 rounded-2xl px-3.5 py-3 text-sm ${soft}`}><CalendarClock className="h-4 w-4 text-amber-500" /><span className="capitalize">{dateLabel}</span><span className="ml-auto font-data text-xs">{time}</span></div>
        </div>

        <div className="space-y-4 px-5 py-5 sm:px-6">
          <div className={`grid grid-cols-2 gap-1 rounded-2xl p-1 ${isLight ? 'bg-slate-100' : 'bg-white/[0.05]'}`}>
            {[
              ['expense', 'Оплата', CreditCard],
              ['income', 'Получить', TrendingUp],
            ].map(([value, label, Icon]) => <button key={value} type="button" onClick={() => setKind(value)} className={`flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition ${kind === value ? (value === 'expense' ? 'bg-rose-500/15 text-rose-500 shadow-sm' : 'bg-emerald-500/15 text-emerald-500 shadow-sm') : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'}`}><Icon className="h-4 w-4" />{label}</button>)}
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-zinc-500">Что произойдёт?</label>
            <input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} className={`w-full rounded-2xl border px-4 py-3.5 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-400/10 ${field}`} placeholder="Например, платёж по кредиту" />
            <div className="mt-2 flex flex-wrap gap-1.5">{QUICK_PLANS.map(([label, value]) => <button type="button" key={label} onClick={() => { setTitle(label); setKind(value); }} className={`rounded-full border px-2.5 py-1 text-[11px] transition ${title === label ? 'border-amber-400/60 bg-amber-400/10 text-amber-600' : isLight ? 'border-slate-200 text-slate-500 hover:border-amber-300' : 'border-white/[0.08] text-zinc-500 hover:border-amber-400/40'}`}>{label}</button>)}</div>
          </div>

          <div className="grid grid-cols-[1fr_auto] gap-2">
            <label className={`rounded-2xl border px-4 py-3 ${field}`}><span className="block text-[10px] uppercase tracking-widest text-zinc-500">Сумма · необязательно</span><input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value.replace(',', '.').replace(/[^0-9.]/g, ''))} className="mt-1 w-full bg-transparent font-data text-3xl font-semibold outline-none" placeholder="позже" /></label>
            <div className={`flex items-end gap-1 rounded-2xl border p-1 ${field}`}>{CURRENCIES.map((item) => <button type="button" key={item.code} onClick={() => setCurrency(item.code)} className={`h-10 min-w-10 rounded-xl px-2 font-data text-xs ${currency === item.code ? 'bg-amber-400 text-zinc-950' : 'text-zinc-500 hover:bg-white/[0.06]'}`}>{item.symbol}</button>)}</div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className={`flex items-center justify-between rounded-2xl border px-3 py-3 ${field}`}><span className="flex items-center gap-2 text-xs"><BellRing className="h-4 w-4 text-amber-500" />Напомнить</span><select value={remindOffset} onChange={(event) => setRemindOffset(event.target.value)} className={`max-w-[100px] rounded-lg border px-1.5 py-1 text-[11px] outline-none ${select}`}><option value="at_time">В момент</option><option value="1_day">За 1 день</option><option value="3_days">За 3 дня</option><option value="1_week">За неделю</option></select></label>
            <label className={`flex items-center justify-between rounded-2xl border px-3 py-3 ${field}`}><span className="flex items-center gap-2 text-xs"><CalendarClock className="h-4 w-4 text-amber-500" />Повтор</span><select value={repeatRule} onChange={(event) => setRepeatRule(event.target.value)} className={`max-w-[100px] rounded-lg border px-1.5 py-1 text-[11px] outline-none ${select}`}><option value="none">Нет</option><option value="weekly">Каждую неделю</option><option value="monthly">Каждый месяц</option><option value="yearly">Каждый год</option></select></label>
          </div>
          <label className={`flex items-center justify-between rounded-2xl border px-4 py-3 ${field}`}><span className="text-sm">Время события</span><input required type="time" value={time} onChange={(event) => setTime(event.target.value)} className="bg-transparent font-data text-sm outline-none" /></label>
          <p className={`rounded-2xl px-3.5 py-3 text-xs leading-relaxed ${soft}`}>План появится в календаре сразу, но в статистику попадёт только после подтверждения.</p>
          {error && <p role="alert" className="rounded-xl bg-rose-500/10 px-3 py-2 text-xs text-rose-500">{error}</p>}
          <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-400 px-4 py-3.5 text-sm font-bold text-zinc-950 shadow-lg shadow-amber-500/20 transition hover:bg-amber-300 active:scale-[.99] disabled:opacity-60">{busy ? 'Сохраняю…' : <><Check className="h-4 w-4" />Создать план</>}</button>
        </div>
      </form>
    </div>
  );
}
