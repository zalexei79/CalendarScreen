import React, { useMemo, useState } from 'react';
import { pnlCurve } from '../lib/pnlCurve.mjs';
import { comparePeriod, curveGroupKey, previousPeriod } from '../lib/periodComparison.mjs';
import { useCurveNotes } from '../../day-notes/useCurveNotes';

const detailsCopy = {
  ru: ['К предыдущему периоду', 'PnL', 'Просадка', 'Нет сделок для сравнения', 'Выберите период в фильтрах для сравнения', 'Заметка ко дню', 'Личная заметка ко всему дню, не только к выбранному счёту.', 'Точки на кривой — заметки к дням со сделками. Нажмите, чтобы прочитать.', 'Не удалось загрузить заметки. Переоткройте историю для повтора.', 'Загружаем заметки…', 'По плану', 'Спешил', 'Устал', 'Нарушил правила', 'Предыдущий период той же длины · те же фильтры', 'сделок'],
  en: ['Versus previous period', 'PnL', 'Drawdown', 'No trades to compare', 'Select a period in filters to compare', 'Day note', 'A personal note for the whole day, not just this account.', 'Dots on the curve mark notes on trading days. Tap to read.', 'Could not load notes. Reopen history to retry.', 'Loading notes…', 'Followed plan', 'Rushed', 'Tired', 'Broke rules', 'Previous equal-length period · same filters', 'trades'],
  md: ['Față de perioada precedentă', 'PnL', 'Declin', 'Nu există tranzacții pentru comparație', 'Selectează o perioadă în filtre pentru comparație', 'Notița zilei', 'Notiță personală pentru întreaga zi, nu doar pentru acest cont.', 'Punctele de pe curbă indică notițe din zilele cu tranzacții. Apasă pentru a citi.', 'Notițele nu au putut fi încărcate. Redeschide istoricul.', 'Se încarcă notițele…', 'După plan', 'M-am grăbit', 'Obosit', 'Am încălcat regulile', 'Perioadă precedentă de aceeași durată · aceleași filtre', 'tranzacții'],
};

const copy = {
  ru: ['Кривая результата', 'Накопленный PnL', 'Макс. просадка', 'Восстановление', 'Ещё не восстановлена', 'дн.', 'Нет сделок за этот период', 'Закрытый PnL по итогам дня, от нуля. По выбранным фильтрам; не баланс счёта и не внутридневная просадка.', 'День', 'Ручные записи', 'Счёт и валюта', 'Начало периода'],
  en: ['Performance curve', 'Cumulative PnL', 'Max drawdown', 'Recovery', 'Not recovered yet', 'days', 'No trades in this period', 'End-of-day realized PnL, starting at zero. Selected filters apply; not account equity or intraday drawdown.', 'Day', 'Manual entries', 'Account and currency', 'Period start'],
  md: ['Curba rezultatului', 'PnL cumulat', 'Declin maxim', 'Recuperare', 'Încă nerecuperat', 'zile', 'Nu există tranzacții în această perioadă', 'PnL realizat la sfârșitul zilei, pornind de la zero. Cu filtrele selectate; nu reprezintă soldul sau declinul intrazilnic.', 'Zi', 'Înregistrări manuale', 'Cont și valută', 'Începutul perioadei'],
};
export default function PnlCurve({ trades, comparisonTrades = [], dateFrom, dateTo, userId, accounts = [], language, isLight }) {
  const c = copy[language === 'ro' ? 'md' : language] || copy.en;
  const d = detailsCopy[language === 'ro' ? 'md' : language] || detailsCopy.en;
  const [selection, setSelection] = useState('');
  const [cursor, setCursor] = useState(null);
  const groups = useMemo(() => {
    const result = new Map();
    for (const trade of trades) {
      const key = curveGroupKey(trade);
      if (!result.has(key)) result.set(key, []);
      result.get(key).push(trade);
    }
    return [...result.entries()];
  }, [trades]);
  const group = groups.find(([key]) => key === selection) || groups[0];
  const curve = useMemo(() => pnlCurve(group?.[1] || []), [group]);
  const previous = useMemo(() => previousPeriod(dateFrom, dateTo), [dateFrom, dateTo]);
  const comparison = useMemo(() => comparePeriod(comparisonTrades, group?.[0], previous, curve), [comparisonTrades, group, previous, curve]);
  const { notes, state: notesState } = useCurveNotes(userId, curve.points[0]?.date, curve.points.at(-1)?.date);
  const currency = group?.[1][0]?.currency || 'USD';
  const money = value => `${new Intl.NumberFormat(language === 'md' ? 'ro' : language || 'en', { maximumFractionDigits: 2 }).format(value)} ${currency}`;
  const points = [{ date: c[11], total: 0, drawdown: 0 }, ...curve.points];
  const index = cursor == null ? points.length - 1 : Math.min(cursor, points.length - 1);
  const active = points[index];
  const activeNote = notes[active.date];
  const hasNotes = curve.points.some(point => notes[point.date]);
  const low = Math.min(0, ...points.map(p => p.total)), high = Math.max(0, ...points.map(p => p.total));
  const span = high - low || 1;
  const x = i => 14 + i / Math.max(1, points.length - 1) * 572;
  const y = total => 18 + (high - total) / span * 126;
  const line = points.map((p, i) => `${x(i)},${y(p.total)}`).join(' ');
  const dd = points.map((p, i) => `${x(i)},${173 + p.drawdown / (curve.maxDrawdown || 1) * 42}`).join(' ');
  return <section className={`my-4 rounded-2xl border p-4 sm:p-5 ${isLight ? 'border-zinc-200 bg-white' : 'border-zinc-800 bg-zinc-950/60'}`}>
    <h3 className="text-sm font-semibold">{c[0]}</h3>
    {!curve.points.length ? <p className="mt-3 text-xs opacity-60">{c[6]}</p> : <>
      <select aria-label={c[10]} value={group[0]} onChange={e => { setSelection(e.target.value); setCursor(null); }} className={`mt-3 w-full min-w-0 rounded-xl border p-2 text-xs ${isLight ? 'border-zinc-200 bg-zinc-50' : 'border-zinc-800 bg-zinc-900'}`}>
        {groups.map(([key, entries]) => {
          const t = entries[0], account = accounts.find(a => a.id === t.ctrader_account_id);
          const label = account ? `${account.broker_name || 'cTrader'} · ${account.account_id} · ${account.is_live ? 'Live' : 'Demo'}` : t.ctrader_account_id ? `cTrader · …${t.ctrader_account_id.slice(-8)}` : t.platform === 'Manual' ? c[9] : t.platform || c[9];
          return <option key={key} value={key}>{label} · {t.currency || 'USD'}</option>;
        })}
      </select>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[[c[1], money(curve.total), curve.total < 0 ? 'text-red-500' : 'text-emerald-500'], [c[2], money(curve.maxDrawdown), 'text-red-500'], [`${c[3]} · ${c[2].toLowerCase()}`, !curve.maxDrawdown ? '—' : curve.recoveryDays == null ? c[4] : `${curve.recoveryDays} ${c[5]}`, '']].map(([label, value, tone]) => <div key={label}><p className="text-[10px] opacity-60">{label}</p><p className={`mt-1 break-words text-sm font-semibold ${tone}`}>{value}</p></div>)}
      </div>
      <div className={`mt-4 border-t pt-3 ${isLight ? 'border-zinc-100' : 'border-white/5'}`}>
        <p className="text-[10px] opacity-50">{previous ? `${d[14]} · ${previous.from} — ${previous.to}` : d[4]}</p>
        {previous && (comparison ? <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-xs tabular-nums">
          {[[d[1], comparison.pnlDelta, comparison.pnlDelta > 0], [d[2], comparison.drawdownDelta, comparison.drawdownDelta < 0]].map(([label, delta, better]) => <p key={label}><span className="mr-2 opacity-60">{label}</span><span className={Math.abs(delta) < 0.005 ? 'opacity-60' : better ? 'text-emerald-500' : 'text-red-500'}>{delta > 0 ? '+' : ''}{money(delta)}</span></p>)}
          <span className="opacity-50">{comparison.count} {d[15]}</span>
        </div> : <p className="mt-2 text-xs opacity-50">{d[3]}</p>)}
      </div>
      <svg viewBox="0 0 600 230" className="mt-3 w-full touch-pan-y" role="group" aria-label={c[0]} onPointerMove={e => { const box = e.currentTarget.getBoundingClientRect(); setCursor(Math.max(0, Math.min(points.length - 1, Math.round(((e.clientX - box.left) / box.width * 600 - 14) / 572 * (points.length - 1))))); }}>
        <line x1="14" x2="586" y1={y(0)} y2={y(0)} stroke="currentColor" opacity=".15" strokeDasharray="4 4" />
        <polyline points={line} fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinejoin="round" />
        <polygon points={`14,173 ${dd} 586,173`} fill="#ef4444" opacity=".16" />
        <polyline points={dd} fill="none" stroke="#ef4444" strokeWidth="1.5" />
        <line x1={x(index)} x2={x(index)} y1="12" y2="219" stroke="currentColor" opacity=".2" />
        <circle cx={x(index)} cy={y(active.total)} r="4" fill="#f59e0b" />
        {points.map((point, i) => notes[point.date] && <g key={point.date} role="button" tabIndex={0} aria-label={`${d[5]} · ${point.date}`} onClick={() => setCursor(i)} onFocus={() => setCursor(i)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCursor(i); } }} className="cursor-pointer outline-none">
          <title>{`${d[5]} · ${point.date}`}</title>
          <circle cx={x(i)} cy={y(point.total)} r="14" fill="transparent" />
          <circle cx={x(i)} cy={y(point.total)} r={index === i ? 6 : 4.5} fill={isLight ? '#fff' : '#18181b'} stroke="#f59e0b" strokeWidth="2" />
        </g>)}
      </svg>
      <input type="range" aria-label={c[8]} min="0" max={points.length - 1} value={index} onChange={e => setCursor(Number(e.target.value))} className="w-full accent-amber-500" />
      <p className="mt-2 text-xs tabular-nums">{active.date} · {money(active.total)} <span className="text-red-500"> · −{money(active.drawdown)}</span></p>
      {activeNote && <div className={`mt-3 rounded-xl border p-3 ${isLight ? 'border-amber-200/60 bg-amber-50/40' : 'border-amber-400/15 bg-amber-400/[0.04]'}`}>
        <p className="text-[10px] font-medium text-amber-600">{d[5]} · {active.date}</p>
        {!!activeNote.tags?.length && <div className="mt-2 flex flex-wrap gap-1.5">{activeNote.tags.filter(tag => ['plan', 'rushed', 'tired', 'broke_rules'].includes(tag)).map(tag => <span key={tag} className="rounded-md bg-amber-400/10 px-2 py-1 text-[10px]">{d[10 + ['plan', 'rushed', 'tired', 'broke_rules'].indexOf(tag)]}</span>)}</div>}
        {activeNote.note && <p className="mt-2 whitespace-pre-wrap break-words text-xs leading-relaxed">{activeNote.note}</p>}
        <p className="mt-2 text-[10px] opacity-50">{d[6]}</p>
      </div>}
      {(hasNotes || notesState === 'error' || notesState === 'loading') && <p role="status" className="mt-2 text-[10px] opacity-50">{notesState === 'error' ? d[8] : notesState === 'loading' ? d[9] : d[7]}</p>}
      <p className="mt-3 text-[10px] leading-relaxed opacity-50">{c[7]}</p>
    </>}
  </section>;
}
