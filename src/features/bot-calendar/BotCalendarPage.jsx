import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, CalendarDays, ChevronLeft, ChevronRight, History, SlidersHorizontal, X } from 'lucide-react';
import { BOT_START_DATE, dateKey, dateLabel, money, monthCells, shiftMonth } from './botCalendarModel.js';
import { BOT_PARAMETERS } from './botParameters.js';
import './BotCalendarPage.css';

// Client injection is also used by isolated UI tests; production always passes
// Supabase. All public reads go through the two whitelist-only RPCs.
export default function BotCalendarPage({ client }) {
  const [month, setMonth] = useState(() => `${dateKey().slice(0, 7)}-01`);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [history, setHistory] = useState(false);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailError, setDetailError] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [offset, setOffset] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settings = useRef(null);
  const dialog = useRef(null);
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(false); setData(null);
    client.rpc('get_bot_calendar', { p_slug: 'bot', p_month: month }).then(({ data: result, error: failure }) => {
      if (cancelled) return;
      if (failure || !result) setError(true); else setData(result);
    }).catch(() => { if (!cancelled) setError(true); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [client, month, retry]);
  useEffect(() => {
    if (!history || !selected) { setDetail(null); return; }
    let cancelled = false;
    setDetailLoading(true); setDetailError(false); setDetail(null);
    client.rpc('get_bot_calendar_day', { p_slug: 'bot', p_day: selected, p_offset: offset }).then(({ data: result, error: failure }) => {
      if (cancelled) return;
      if (failure || !result) setDetailError(true); else setDetail(result);
    }).catch(() => { if (!cancelled) setDetailError(true); }).finally(() => { if (!cancelled) setDetailLoading(false); });
    return () => { cancelled = true; };
  }, [client, history, selected, offset, retry]);
  useEffect(() => {
    if (!dialog.current) return;
    if (history) dialog.current.showModal(); else dialog.current.close();
  }, [history]);
  useEffect(() => {
    if (settingsOpen) settings.current?.showModal(); else settings.current?.close();
  }, [settingsOpen]);
  const today = data?.today || dateKey();
  const start = data?.start_date || BOT_START_DATE;
  const days = data?.days || [];
  const byDate = new Map(days.map(day => [day.date_key, day]));
  const total = days.reduce((sum, day) => sum + Number(day.pnl), 0);
  const count = days.reduce((sum, day) => sum + Number(day.count), 0);
  const ready = Boolean(data?.last_sync_at);
  const currency = data?.currency || 'USD';
  const openHistory = (key = null) => { setSelected(key); setOffset(0); setDetail(null); setHistory(true); };
  const status = data?.status === 'delayed' ? 'Обновление задерживается' : ready ? 'Обновляется раз в сутки' : 'Ожидаем первую синхронизацию';
  const daySummary = selected && byDate.get(selected);
  return <main className="bot-page">
    <div className="bot-shell">
      <header className="bot-topbar">
        <a href="/" className="bot-brand" aria-label="DAYRIS — главная"><CalendarDays aria-hidden="true" /><span>DAYRIS</span></a>
        <a className="bot-create" href="/"><span>Создать свой календарь</span><ArrowRight size={17} aria-hidden="true" /></a>
      </header>
      <section className="bot-intro" aria-labelledby="bot-title">
        <div className="bot-eyebrow"><span /> ПУБЛИЧНЫЙ КАЛЕНДАРЬ</div>
        <h1 id="bot-title">Календарь бота<span>.</span></h1>
        <p>Торговля бота — день за днём.</p>
        <div className="bot-intro-bottom"><div className="bot-account"><span className="bot-demo">Demo</span><span>Spotware</span><span className="bot-account-number">47484897 · {currency}</span></div>
          <button className="bot-parameters-button" type="button" onClick={() => setSettingsOpen(true)}><SlidersHorizontal size={15} aria-hidden="true" />Параметры бота</button>
        </div>
      </section>
      <section className="bot-calendar" aria-label="Календарь результатов" aria-busy={loading}>
        <div className="bot-calendar-toolbar">
          <div className="bot-month-controls">
            <button type="button" aria-label="Предыдущий месяц" disabled={month.slice(0, 7) <= start.slice(0, 7) || loading} onClick={() => setMonth(shiftMonth(month, -1))}><ChevronLeft aria-hidden="true" /></button>
            <h2>{dateLabel(month, { month: 'long', year: 'numeric' }).replace(' г.', '')}</h2>
            <button type="button" aria-label="Следующий месяц" disabled={month.slice(0, 7) >= today.slice(0, 7) || loading} onClick={() => setMonth(shiftMonth(month, 1))}><ChevronRight aria-hidden="true" /></button>
          </div>
          <button type="button" className="bot-history-button" disabled={loading || error || !ready} onClick={() => openHistory()}><History size={17} aria-hidden="true" /><span>История</span></button>
        </div>
        <div className="bot-metrics" aria-live="polite">
          <div><span>Результат месяца</span><strong className={ready ? total > 0 ? 'bot-profit' : total < 0 ? 'bot-loss' : '' : ''}>{loading || !ready ? '—' : money(total, currency, true)}</strong></div>
          <div><span>Закрытых сделок</span><strong>{loading || !ready ? '—' : count}</strong></div>
          <div className="bot-update"><span>{status}</span><strong>{ready ? new Intl.DateTimeFormat('ru-RU', { timeZone: data.time_zone, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(data.last_sync_at)) : 'С 05.10.2026'}</strong></div>
        </div>
        {error ? <div className="bot-state" role="alert"><h3>Не удалось загрузить календарь</h3><p>Попробуйте открыть его ещё раз.</p><button type="button" onClick={() => setRetry(n => n + 1)}>Повторить</button></div> : <>
          <div className="bot-weekdays" aria-hidden="true">{['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(day => <span key={day}>{day}</span>)}</div>
          <div className="bot-grid">
            {monthCells(month).map((key, index) => {
              if (!key) return <div className="bot-cell bot-cell-blank" key={`blank-${index}`} />;
              const result = byDate.get(key);
              const available = key >= start && key <= today && ready && !loading;
              return <button type="button" key={key} className={`bot-cell${key === today ? ' bot-today' : ''}${result ? Number(result.pnl) >= 0 ? ' bot-day-profit' : ' bot-day-loss' : ''}`}
                disabled={!available} aria-label={`${dateLabel(key)}${available ? result ? `: ${money(result.pnl, currency, true)}, сделок: ${result.count}` : ': нет закрытых сделок' : ''}`}
                onClick={() => openHistory(key)}><span className="bot-day-number">{Number(key.slice(-2))}</span>
                {result && <><span className="bot-day-pnl">{money(result.pnl, currency, true)}</span><span className="bot-day-count">{result.count}<span> сделок</span></span></>}
                {!result && available && <span className="bot-day-empty" aria-hidden="true">—</span>}
              </button>;
            })}
          </div>
          {!loading && !ready && <p className="bot-pending" role="status">История появится после первой синхронизации счёта.</p>}
          {loading && <p className="bot-pending" role="status">Загружаем историю…</p>}
        </>}
        <footer className="bot-calendar-footer"><span>История с 5 октября 2026</span><span>Время: Europe/Bucharest</span></footer>
      </section>
      <p className="bot-footnote">Закрытые сделки с учётом комиссий и свопов. Результаты демосчёта.</p>
    </div>
    <dialog ref={dialog} className="bot-dialog" onCancel={() => setHistory(false)} onClose={() => setHistory(false)} onClick={event => { if (event.target === dialog.current) setHistory(false); }} aria-labelledby="bot-history-title">
      <div className="bot-dialog-inner">
        <header><div><p>ИСТОРИЯ СДЕЛОК</p><h2 id="bot-history-title">{selected ? dateLabel(selected) : dateLabel(month, { month: 'long', year: 'numeric' })}</h2></div><button type="button" aria-label="Закрыть историю" onClick={() => setHistory(false)}><X aria-hidden="true" /></button></header>
        {selected && <button className="bot-back" type="button" onClick={() => { setSelected(null); setOffset(0); }}><ChevronLeft size={16} aria-hidden="true" /> Все дни месяца</button>}
        {!selected ? <div className="bot-history-days">{days.length ? [...days].reverse().map(day => <button key={day.date_key} type="button" onClick={() => { setSelected(day.date_key); setOffset(0); }}><span>{dateLabel(day.date_key, { day: 'numeric', month: 'long' })}<small>{day.count} сделок</small></span><strong className={Number(day.pnl) >= 0 ? 'bot-profit' : 'bot-loss'}>{money(day.pnl, currency, true)}</strong><ChevronRight size={17} aria-hidden="true" /></button>) : <p className="bot-state">В этом месяце нет закрытых сделок.</p>}</div> : <>
          <div className="bot-detail-total"><span>Результат дня · {daySummary?.count || 0} сделок</span><strong className={Number(daySummary?.pnl || 0) >= 0 ? 'bot-profit' : 'bot-loss'}>{money(daySummary?.pnl || 0, currency, true)}</strong></div>
          <div className="bot-trades" aria-live="polite" aria-busy={detailLoading}>
            {detailLoading ? <p className="bot-state">Загружаем сделки…</p> : detailError ? <div className="bot-state" role="alert"><p>Не удалось загрузить сделки.</p><button type="button" onClick={() => setRetry(n => n + 1)}>Повторить</button></div> : detail?.trades?.length ? detail.trades.map(trade => <article key={trade.deal_id}><div><strong>{trade.instrument}</strong><span><time>{String(trade.time).slice(0, 5)}</time> · {trade.direction === 'LONG' ? 'Buy' : 'Sell'}</span></div><strong className={Number(trade.pnl) >= 0 ? 'bot-profit' : 'bot-loss'}>{money(trade.pnl, trade.currency, true)}</strong></article>) : <p className="bot-state">В этот день нет закрытых сделок.</p>}
          </div>
          {!detailLoading && !detailError && detail?.total > 100 && <nav className="bot-pagination" aria-label="Страницы истории"><button type="button" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 100))}>Назад</button><span>{offset + 1}–{Math.min(offset + 100, detail.total)} / {detail.total}</span><button type="button" disabled={offset + 100 >= detail.total} onClick={() => setOffset(offset + 100)}>Далее</button></nav>}
        </>}
      </div>
    </dialog>
    <dialog ref={settings} className="bot-dialog bot-settings-dialog" onCancel={() => setSettingsOpen(false)} onClose={() => setSettingsOpen(false)} onClick={event => { if (event.target === settings.current) setSettingsOpen(false); }} aria-labelledby="bot-parameters-title">
      <div className="bot-dialog-inner">
        <header><div><p>{BOT_PARAMETERS.symbol} · M1 · DEMO</p><h2 id="bot-parameters-title">Параметры бота</h2></div><button type="button" aria-label="Закрыть параметры" onClick={() => setSettingsOpen(false)}><X aria-hidden="true" /></button></header>
        <p className="bot-settings-note">Из файла настроек, предоставленного 23.10.2026. Изменения в cTrader не обновляют этот список автоматически.</p>
        {BOT_PARAMETERS.groups.map(group => <section className="bot-settings-group" key={group.title}><h3>{group.title}</h3><dl>{group.rows.map(([key,label,value]) => <div key={key}><dt>{label}<small>{key}</small></dt><dd>{value}</dd></div>)}</dl></section>)}
        <p className="bot-settings-note">Единицы дневных лимитов в файле не указаны. Набор настроек не подтверждает параметры каждой прошлой сделки.</p>
      </div>
    </dialog>
  </main>;
}
