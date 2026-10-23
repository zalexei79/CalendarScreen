import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { dateLabel, money, shiftMonth, tradeCount } from './botCalendarModel.js';

export default function BotCalendarHistory({ client, start, today, month, initialDay, initialMonth, onClose }) {
  const [mode, setMode] = useState(initialDay || initialMonth ? 'period' : 'all');
  const [from, setFrom] = useState(initialDay || (month > start ? month : start));
  const lastDay = new Date(`${shiftMonth(month, 1)}T12:00:00Z`); lastDay.setUTCDate(0);
  const [to, setTo] = useState(initialDay || [lastDay.toISOString().slice(0, 10), today].sort()[0]);
  const [range, setRange] = useState(initialDay || initialMonth ? { from, to } : null);
  const [invalid, setInvalid] = useState(false);
  const [offset, setOffset] = useState(0);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const dialog = useRef(null);
  useEffect(() => { if (!dialog.current.open) dialog.current.showModal(); }, []);
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(false); setResult(null);
    client.rpc('get_bot_calendar_history', { p_slug: 'bot', p_from: range?.from || null,
      p_to: range?.to || null, p_offset: offset }).then(({ data, error: failure }) => {
      if (cancelled) return;
      if (failure || !data) setError(true); else setResult(data);
    }).catch(() => { if (!cancelled) setError(true); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [client, range, offset, retry]);
  const apply = event => {
    event.preventDefault();
    if (!from || !to || from < start || to > today || from > to) { setInvalid(true); return; }
    setInvalid(false); setOffset(0); setRange({ from, to });
  };
  const selectMode = value => {
    setMode(value); setInvalid(false); setOffset(0);
    if (value === 'all') setRange(null);
    else if (from && to && from >= start && to <= today && from <= to) setRange({ from, to });
  };
  return <dialog ref={dialog} className="bot-dialog bot-history-dialog" onCancel={onClose} onClose={onClose}
    onClick={event => { if (event.target === dialog.current) onClose(); }} aria-labelledby="bot-history-title">
    <div className="bot-dialog-inner">
      <header><div><p>КАЛЕНДАРЬ БОТА</p><h2 id="bot-history-title">История сделок</h2></div><button type="button" aria-label="Закрыть историю" onClick={onClose}><X aria-hidden="true" /></button></header>
      <div className="bot-history-modes" aria-label="Период истории">
        <button type="button" aria-pressed={mode === 'all'} onClick={() => selectMode('all')}>Вся история</button>
        <button type="button" aria-pressed={mode === 'period'} onClick={() => selectMode('period')}>Выбранный период</button>
      </div>
      {mode === 'period' && <form className="bot-date-filter" onSubmit={apply}>
        <label>С<input type="date" aria-label="Начало периода" min={start} max={today} value={from} onChange={event => setFrom(event.target.value)} required /></label>
        <label>По<input type="date" aria-label="Конец периода" min={start} max={today} value={to} onChange={event => setTo(event.target.value)} required /></label>
        <button type="submit">Показать</button>
        {invalid && <p role="alert">Укажите период с {dateLabel(start)} по {dateLabel(today)}: начало не позже конца.</p>}
      </form>}
      <div className="bot-history-totals" aria-live="polite">
        <div><span>{range ? 'Сделок за период' : 'Всего сделок'}</span><strong>{loading || error ? '—' : result?.total}</strong></div>
        <div><span>Результат</span><strong className={Number(result?.pnl) >= 0 ? 'bot-profit' : 'bot-loss'}>{loading || error ? '—' : money(result?.pnl || 0, result?.currency, true)}</strong></div>
      </div>
      {result && <p className="bot-history-caption">{dateLabel(result.from, { day: 'numeric', month: 'short', year: 'numeric' })} — {dateLabel(result.to, { day: 'numeric', month: 'short', year: 'numeric' })}<span>Всего в истории: {tradeCount(result.all_total)}</span></p>}
      <div className="bot-trades" aria-busy={loading}>
        {loading ? <p className="bot-state" role="status">Загружаем сделки…</p> : error ? <div className="bot-state" role="alert"><p>Не удалось загрузить сделки.</p><button type="button" onClick={() => setRetry(n => n + 1)}>Повторить</button></div> : result?.trades?.length ? result.trades.map((trade, i) => <React.Fragment key={trade.deal_id}>
          {result.trades[i - 1]?.date_key !== trade.date_key && <h3 className="bot-trades-date">{dateLabel(trade.date_key)}</h3>}
          <article><div><strong>{trade.instrument}</strong><span><time>{String(trade.time).slice(0, 5)}</time> · {trade.direction === 'LONG' ? 'Buy' : 'Sell'}</span></div><strong className={Number(trade.pnl) >= 0 ? 'bot-profit' : 'bot-loss'}>{money(trade.pnl, trade.currency, true)}</strong></article>
        </React.Fragment>) : <p className="bot-state">В выбранном периоде нет закрытых сделок.</p>}
      </div>
      {!loading && !error && result?.total > 100 && <nav className="bot-pagination" aria-label="Страницы истории"><button type="button" aria-label="Предыдущие сделки" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 100))}><ChevronLeft size={16} aria-hidden="true" />Назад</button><span>{offset + 1}–{Math.min(offset + 100, result.total)} / {result.total}</span><button type="button" aria-label="Следующие сделки" disabled={offset + 100 >= result.total} onClick={() => setOffset(offset + 100)}>Далее<ChevronRight size={16} aria-hidden="true" /></button></nav>}
    </div>
  </dialog>;
}
