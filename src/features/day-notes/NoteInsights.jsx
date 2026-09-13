import React, { useMemo, useState } from 'react';
import { StickyNote, ChevronDown } from 'lucide-react';
import { useCurveNotes } from './useCurveNotes';
import { NOTE_TAGS, noteStats } from './noteStats.mjs';

const COPY = {
  ru: ['Торговля и мои отметки', 'По плану', 'Спешил', 'Устал', 'Нарушил правила', 'дней', 'прибыльных дней', 'Добавьте отметку в окне дня — здесь появится сравнение.', 'По текущим фильтрам. День с несколькими отметками входит в каждую группу. Совпадение не означает причину.', 'Загружаем отметки…', 'Не удалось загрузить отметки', 'Повторить', 'Мало данных — пока только наблюдаем', 'Войдите, чтобы видеть свои отметки.'],
  en: ['Trading and my notes', 'Followed plan', 'Rushed', 'Tired', 'Broke rules', 'days', 'profitable days', 'Add a tag in a day’s details to see comparisons here.', 'Uses current filters. Days with multiple tags appear in each group. Correlation does not imply causation.', 'Loading notes…', 'Could not load notes', 'Retry', 'Limited data — observations only', 'Sign in to see your notes.'],
  md: ['Tranzacțiile și notițele mele', 'După plan', 'M-am grăbit', 'Obosit', 'Am încălcat regulile', 'zile', 'zile profitabile', 'Adaugă o etichetă în detaliile zilei pentru comparații aici.', 'Conform filtrelor curente. Zilele cu mai multe etichete apar în fiecare grup. Corelația nu implică o cauză.', 'Se încarcă notițele…', 'Notițele nu au putut fi încărcate', 'Reîncearcă', 'Date limitate — doar observații', 'Autentifică-te pentru a vedea notițele.'],
};

export default function NoteInsights({ userId, trades, revision, language, isLight, onDay }) {
  const c = COPY[language === 'ro' ? 'md' : language] || COPY.en;
  const locale = language === 'ru' ? 'ru-RU' : ['ro', 'md'].includes(language) ? 'ro-RO' : 'en-US';
  const [retry, setRetry] = useState(0);
  const dates = useMemo(() => trades.map(t => t.dateKey).filter(Boolean).sort(), [trades]);
  const { notes, state } = useCurveNotes(userId, dates[0], dates.at(-1), `${revision}:${retry}`);
  const groups = useMemo(() => noteStats(trades, notes), [trades, notes]);
  const money = (value, currency) => `${value > 0 ? '+' : ''}${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value)} ${currency}`;
  return <section className={`mb-4 rounded-2xl border p-4 sm:p-5 ${isLight ? 'border-zinc-200 bg-gradient-to-br from-amber-50/60 to-white' : 'border-zinc-800 bg-zinc-900/30'}`}>
    <h3 className="flex items-center gap-2 text-sm font-semibold"><StickyNote className="h-4 w-4 text-amber-500" />{c[0]}</h3>
    {!userId || state === 'loading' || state === 'error' || !groups.length ? <div className="mt-3 text-xs text-zinc-500">
      {!userId ? c[13] : state === 'loading' ? c[9] : state === 'error' ? c[10] : c[7]}
      {state === 'error' && <button type="button" onClick={() => setRetry(v => v + 1)} className="ml-2 min-h-10 text-amber-600">{c[11]}</button>}
    </div> : <>
      <div className={`mt-3 divide-y ${isLight ? 'divide-zinc-200' : 'divide-zinc-800'}`}>
        {groups.map(group => <details key={`${group.tag}:${group.currency}`} className="group py-3">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
            <div><p className="text-xs font-medium">{c[NOTE_TAGS.indexOf(group.tag) + 1]}</p><p className="mt-1 text-[11px] text-zinc-500">{group.days.length} {c[5]} · {group.winRate}% {c[6]}</p></div>
            <div className="flex items-center gap-2"><span className={`text-xs font-data tabular-nums ${group.pnl > 0 ? 'text-emerald-600' : group.pnl < 0 ? 'text-rose-500' : 'text-zinc-500'}`}>{money(group.pnl, group.currency)}</span><ChevronDown className="h-3 w-3 text-zinc-500 transition-transform group-open:rotate-180" /></div>
          </summary>
          {group.days.length < 5 && <p className="mt-2 text-[10px] text-zinc-500">{c[12]}</p>}
          <div className="mt-2 max-h-52 overflow-y-auto">{group.days.map(day => <button type="button" key={day.date} onClick={() => onDay(day.date)} className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-2 text-left text-xs hover:bg-amber-400/10 focus-visible:outline-amber-400">
            <span>{new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${day.date}T12:00:00`))}<span className="mt-1 block max-w-48 truncate text-[10px] text-zinc-500">{notes[day.date]?.note}</span></span><span className="shrink-0 font-data">{money(day.pnl, day.currency)}</span>
          </button>)}</div>
        </details>)}
      </div>
      <p className="mt-2 text-[10px] leading-relaxed text-zinc-500">{c[8]}</p>
    </>}
  </section>;
}
