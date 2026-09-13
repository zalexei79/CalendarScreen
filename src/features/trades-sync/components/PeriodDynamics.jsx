import React, { useMemo, useState } from 'react';

const copy = {
  ru: ['Динамика периода', '10 дней до последней сделки в выборке', 'Прибыль', 'Убытки', 'Нет сделок', 'торговых дней', 'сделок', 'Нажмите на день — ниже точные суммы', 'Результат', 'Валюта', 'По выбранным фильтрам'],
  en: ['Period dynamics', '10 days ending with the latest selected trade', 'Profit', 'Losses', 'No trades', 'trading days', 'trades', 'Tap a day for exact amounts below', 'Result', 'Currency', 'Selected filters apply'],
  md: ['Dinamica perioadei', '10 zile până la ultima tranzacție selectată', 'Profit', 'Pierderi', 'Fără tranzacții', 'zile de tranzacționare', 'tranzacții', 'Apasă o zi pentru sumele exacte de mai jos', 'Rezultat', 'Valută', 'Conform filtrelor selectate'],
};

export default function PeriodDynamics({ trades, language, isLight }) {
  const locale = language === 'md' || language === 'ro' ? 'ro' : language || 'en';
  const c = copy[locale === 'ro' ? 'md' : locale] || copy.en;
  const [currencyChoice, setCurrencyChoice] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const currencies = [...new Set(trades.map(t => t.currency || 'USD'))].sort();
  const currency = currencies.includes(currencyChoice) ? currencyChoice : currencies[0];
  const days = useMemo(() => {
    const filtered = trades.filter(t => (t.currency || 'USD') === currency && /^\d{4}-\d{2}-\d{2}$/.test(t.dateKey));
    const end = filtered.map(t => t.dateKey).sort().at(-1);
    if (!end) return [];
    const daily = new Map();
    for (const t of filtered) {
      if (!Number.isFinite(Number(t.pnl))) continue;
      const day = daily.get(t.dateKey) || { profit: 0, loss: 0, count: 0 };
      const pnl = Number(t.pnl);
      day.profit += Math.max(0, pnl); day.loss += Math.max(0, -pnl); day.count++;
      daily.set(t.dateKey, day);
    }
    return Array.from({ length: 10 }, (_, i) => {
      const date = new Date(`${end}T00:00:00Z`);
      date.setUTCDate(date.getUTCDate() - 9 + i);
      const key = date.toISOString().slice(0, 10);
      return { date: key, ...(daily.get(key) || { profit: 0, loss: 0, count: 0 }) };
    });
  }, [trades, currency]);
  const active = days.find(day => day.date === selectedDate) || days.at(-1);
  const total = days.reduce((sum, day) => sum + day.profit - day.loss, 0);
  const max = Math.max(1, ...days.flatMap(day => [day.profit, day.loss]));
  const money = value => `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value)} ${currency}`;
  const dateLabel = (date, full = false) => new Intl.DateTimeFormat(locale, { day: 'numeric', month: full ? 'long' : 'short', ...(full ? { year: 'numeric' } : {}), timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`));
  return <section className={`mb-4 rounded-2xl border p-3 sm:p-4 ${isLight ? 'border-zinc-200 bg-white' : 'border-zinc-800 bg-black/20'}`}>
    <div className="flex items-start justify-between gap-3">
      <div><h3 className="text-sm font-semibold">{c[0]}</h3><p className="mt-1 text-[10px] text-zinc-500">{c[1]} · {c[10]}</p></div>
      {currencies.length > 1 && <select aria-label={c[9]} value={currency} onChange={e => { setCurrencyChoice(e.target.value); setSelectedDate(''); }} className={`rounded-lg border p-2 text-xs ${isLight ? 'border-zinc-200 bg-white' : 'border-zinc-700 bg-zinc-900'}`}>{currencies.map(code => <option key={code}>{code}</option>)}</select>}
    </div>
    {!active ? <p className="py-8 text-center text-xs text-zinc-500">{c[4]}</p> : <>
      <p className={`mt-4 text-xl font-semibold tabular-nums tracking-tight ${total < 0 ? 'text-red-500' : 'text-emerald-500'}`}>{total > 0 ? '+' : ''}{money(total)}</p>
      <p className="mt-1 text-[10px] text-zinc-500">{dateLabel(days[0].date)} — {dateLabel(days.at(-1).date)} · {days.filter(day => day.count).length} {c[5]}</p>
      <div className="mt-4 flex gap-3 text-[10px]"><span className="text-emerald-500">● {c[2]}</span><span className="text-red-500">● {c[3]}</span></div>
      <div className="mt-3 grid grid-cols-5 gap-1.5 sm:grid-cols-10">
        {days.map(day => <button type="button" key={day.date} aria-pressed={active.date === day.date} aria-label={`${dateLabel(day.date, true)} · ${day.count ? `${money(day.profit - day.loss)} · ${day.count} ${c[6]}` : c[4]}`} onClick={() => setSelectedDate(day.date)} className={`min-w-0 rounded-lg px-1 pb-2 pt-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${active.date === day.date ? 'bg-amber-400/10 ring-1 ring-amber-400/30' : isLight ? 'hover:bg-zinc-50' : 'hover:bg-white/5'}`}>
          <div aria-hidden="true" className="flex h-20 items-end justify-center gap-1 border-b border-zinc-500/15">
            {day.count ? <><span className="w-2.5 rounded-t bg-emerald-500/80" style={{ height: day.profit ? `${Math.max(3, day.profit / max * 100)}%` : 0 }} /><span className="w-2.5 rounded-t bg-red-500/75" style={{ height: day.loss ? `${Math.max(3, day.loss / max * 100)}%` : 0 }} /></> : <span className="pb-2 text-[9px] text-zinc-500">{c[4]}</span>}
          </div>
          <span className="mt-2 block text-[9px] leading-tight opacity-70">{dateLabel(day.date)}</span>
        </button>)}
      </div>
      <p className="mt-3 text-[10px] text-zinc-500">{c[7]}</p>
      <div aria-live="polite" className={`mt-3 rounded-xl border p-3 ${isLight ? 'border-zinc-200 bg-zinc-50/70' : 'border-white/5 bg-white/[0.02]'}`}>
        <p className="text-xs font-medium">{dateLabel(active.date, true)} <span className="text-zinc-500">· {active.count ? `${active.count} ${c[6]}` : c[4]}</span></p>
        {active.count > 0 && <><p className={`mt-2 text-base font-semibold tabular-nums ${active.profit - active.loss < 0 ? 'text-red-500' : 'text-emerald-500'}`}>{c[8]} · {active.profit - active.loss > 0 ? '+' : ''}{money(active.profit - active.loss)}</p><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] tabular-nums"><span className="text-emerald-500">{c[2]} +{money(active.profit)}</span><span className="text-red-500">{c[3]} −{money(active.loss)}</span></div></>}
      </div>
    </>}
  </section>;
}
