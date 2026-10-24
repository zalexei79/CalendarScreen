import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, ArrowUpRight, ChartNoAxesCombined, Check, ChevronLeft, ChevronRight, Copy, History, Menu, Share2, X } from 'lucide-react';
import CalendarDayCell from '../../../CalendarDayCell.jsx';
import BrandIcon from '../../shared/ui/BrandIcon.jsx';
import { copyText } from '../../shared/lib/copyText.js';
import { BOT_START_DATE, calendarCells, dateKey, dateLabel, money, publicCalendarUrl, shiftMonth, tradeCount } from './botCalendarModel.js';
import BotCalendarHistory from './BotCalendarHistory.jsx';
import BotAnalyticsDialog from './BotAnalyticsDialog.jsx';
import BotPerformanceChart from './BotPerformanceChart.jsx';
import './BotCalendarPage.css';

export default function BotCalendarPage({ client }) {
  const [month, setMonth] = useState(() => `${dateKey().slice(0, 7)}-01`);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [history, setHistory] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [analytics, setAnalytics] = useState({ data: null, loading: true, error: false });
  const [analyticsRetry, setAnalyticsRetry] = useState(0);
  const [notice, setNotice] = useState('');
  const [copyFailed, setCopyFailed] = useState(false);
  const menu = useRef(null), linkDialog = useRef(null);
  const url = publicCalendarUrl();
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
    let cancelled = false;
    setAnalytics({ data: null, loading: true, error: false });
    client.rpc('get_bot_calendar_analytics', { p_slug: 'bot', p_from: null, p_to: null }).then(({ data, error }) => {
      if (!cancelled) setAnalytics({ data, loading: false, error: Boolean(error || !data) });
    }).catch(() => { if (!cancelled) setAnalytics({ data: null, loading: false, error: true }); });
    return () => { cancelled = true; };
  }, [client, analyticsRetry]);
  useEffect(() => {
    if (copyFailed) linkDialog.current?.showModal(); else linkDialog.current?.close();
  }, [copyFailed]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 4000);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    const outside = event => { if (!menu.current?.contains(event.target) && menu.current) menu.current.open = false; };
    const escape = event => { if (event.key === 'Escape' && menu.current?.open) { menu.current.open = false; menu.current.querySelector('summary')?.focus(); } };
    document.addEventListener('pointerdown', outside); document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, []);
  const closeMenu = () => { if (menu.current) menu.current.open = false; };
  async function copyCalendar() {
    // Keep the synchronous Safari selection fallback inside the user's gesture.
    const promise = copyText(url, { preferSelection: true });
    closeMenu();
    try { await promise; setNotice('Ссылка на календарь скопирована'); }
    catch { setCopyFailed(true); }
  }
  async function shareCalendar() {
    if (!navigator.share) { copyCalendar(); return; }
    try {
      const request = navigator.share({ title: 'Календарь бота · DAYRIS', url });
      closeMenu(); await request;
    } catch (failure) {
      closeMenu();
      if (failure?.name !== 'AbortError') setCopyFailed(true);
    }
  }
  const today = data?.today || dateKey(), start = data?.start_date || BOT_START_DATE;
  const days = data?.days || [], byDate = new Map(days.map(day => [day.date_key, day]));
  const total = days.reduce((sum, day) => sum + Number(day.pnl), 0);
  const count = days.reduce((sum, day) => sum + Number(day.count), 0);
  const maxPnl = Math.max(0, ...days.map(day => Math.abs(Number(day.pnl))));
  const ready = Boolean(data?.last_sync_at), currency = data?.currency || 'USD';
  const cells = calendarCells(month, today);
  const openHistory = (key = null) => { closeMenu(); setSelectedDay(key); setHistory({ day: key }); };
  const changeMonth = offset => { setSelectedDay(null); setMonth(shiftMonth(month, offset)); };
  const status = data?.status === 'delayed' ? 'Обновление задерживается' : ready ? 'Обновляется ежедневно' : 'Ожидаем первую синхронизацию';

  return <main className="bot-page" style={{ '--bot-weeks': cells.length / 7 }}>
    <div className="bot-shell">
      <header className="bot-topbar">
        <a href="/" className="bot-brand" aria-label="DAYRIS — главная"><BrandIcon /><span><b>DAYRIS</b><strong>Календарь бота</strong></span></a>
        <a className="bot-top-create" href="/">Создать свой календарь<ArrowRight size={16} aria-hidden="true" /></a>
        <div className="bot-top-actions">
          <button type="button" className="bot-icon-button" aria-label="Скопировать ссылку на календарь" title="Скопировать ссылку на календарь" onClick={copyCalendar}>{notice ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}</button>
          <details ref={menu} className="bot-menu">
            <summary role="button" aria-label="Меню календаря" className="bot-icon-button"><Menu aria-hidden="true" /></summary>
            <nav aria-label="Функции календаря">
              <button type="button" onClick={() => { closeMenu(); setAnalyticsOpen(true); }}><ChartNoAxesCombined aria-hidden="true" />Аналитика бота</button>
              <button type="button" disabled={loading || error || !ready} onClick={() => openHistory()}><History aria-hidden="true" />История</button>
              <button type="button" onClick={shareCalendar}><Share2 aria-hidden="true" />Поделиться календарём</button>
              <a href="/"><ArrowRight aria-hidden="true" />Создать свой календарь</a>
            </nav>
          </details>
        </div>
      </header>
      <section className="bot-calendar" aria-label="Календарь результатов" aria-busy={loading}>
        <div className="bot-calendar-toolbar">
          <div className="bot-month-controls">
            <button type="button" aria-label="Предыдущий месяц" disabled={month.slice(0, 7) <= start.slice(0, 7) || loading} onClick={() => changeMonth(-1)}><ChevronLeft aria-hidden="true" /></button>
            <h1>{dateLabel(month, { month: 'long', year: 'numeric' }).replace(' г.', '')}</h1>
            <button type="button" aria-label="Следующий месяц" disabled={month.slice(0, 7) >= today.slice(0, 7) || loading} onClick={() => changeMonth(1)}><ChevronRight aria-hidden="true" /></button>
          </div>
          <span className="bot-symbol">XAUUSD</span>
        </div>
        <div className="bot-metrics" aria-live="polite">
          <div><span>Результат месяца</span><strong className={total > 0 ? 'bot-profit' : total < 0 ? 'bot-loss' : ''}>{loading || !ready ? '—' : money(total, currency, true)}</strong></div>
          <button type="button" disabled={loading || error || !ready} aria-label="История за месяц" onClick={() => { closeMenu(); setHistory({ month: true }); }}><span>Закрытых сделок</span><strong>{loading || !ready ? '—' : count}<ChevronRight size={13} aria-hidden="true" /></strong></button>
        </div>
        {error ? <div className="bot-state" role="alert"><h3>Не удалось загрузить календарь</h3><p>Попробуйте открыть его ещё раз.</p><button type="button" onClick={() => setRetry(n => n + 1)}>Повторить</button></div> : <>
          <div className="bot-weekdays" aria-hidden="true">{['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(day => <span key={day}>{day}</span>)}</div>
          <div className="bot-grid" style={{ gridTemplateRows: `repeat(${cells.length / 7},minmax(0,1fr))` }}>
            {cells.map((cell, i) => {
              const result = byDate.get(cell.key), available = cell.inMonth && cell.key >= start && cell.key <= today && ready && !loading;
              return <CalendarDayCell key={cell.key} cell={cell} cellIndex={i} traderMode proView isLight={false}
                disabled={!available} isSelected={selectedDay === cell.key} hasTrades={Boolean(result)} pnl={Number(result?.pnl || 0)} monthMaxAbsPnl={maxPnl}
                milestone={cell.inMonth && cell.key === start ? 'Начало учёта' : undefined}
                ariaLabel={`${dateLabel(cell.key)}${cell.inMonth && cell.key === start ? ', Начало учёта' : ''}${available ? result ? `: ${money(result.pnl, currency, true)}, ${tradeCount(result.count)}` : ': нет закрытых сделок' : ''}`}
                formatPnlDisplay={(value, compact) => compact ? new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2, notation: Math.abs(value) >= 1000 ? 'compact' : 'standard', signDisplay: 'exceptZero' }).format(value) : money(value, currency, true)} onSelect={() => openHistory(cell.key)}
                caption={result ? <span className="bot-cell-count">{tradeCount(result.count)}</span> : null} />;
            })}
          </div>
          {!loading && !ready && <p className="bot-pending" role="status">История появится после первой синхронизации.</p>}
          {loading && <p className="bot-pending" role="status">Загружаем историю…</p>}
        </>}
      </section>
      <section className="bot-bottom-workspace" aria-label="История и аналитика">
        <button className="bot-history-entry" type="button" disabled={loading || error || !ready} onClick={() => openHistory()}>
          <span className="bot-workspace-icon"><History aria-hidden="true" /></span><strong>История сделок</strong>
          <span>Все сделки или выбранный период</span><span className="bot-workspace-action">Открыть историю<ArrowRight size={15} aria-hidden="true" /></span>
        </button>
        {analytics.error ? <div className="bot-analytics-preview bot-preview-error"><p>Не удалось загрузить график</p><button type="button" onClick={() => setAnalyticsRetry(n => n + 1)}>Повторить аналитику</button></div> : <button className="bot-analytics-preview" type="button" aria-label="Открыть аналитику бота" disabled={analytics.loading || !ready} onClick={() => setAnalyticsOpen(true)}>
          <div className="bot-preview-heading"><div><span>Результат бота · за всё время</span><strong className={Number(analytics.data?.stats?.pnl)>=0?'bot-profit':'bot-loss'}>{analytics.loading || !ready ? '—' : money(analytics.data?.stats?.pnl || 0, analytics.data?.currency, true)}</strong></div><ArrowUpRight size={20} aria-hidden="true" /></div>
          {analytics.loading ? <span className="bot-preview-loading">Загружаем график…</span> : Number(analytics.data?.stats?.total)>0 ? <BotPerformanceChart data={analytics.data} mini /> : <span className="bot-preview-loading">График появится после первых закрытых сделок</span>}
          <span className="bot-preview-footer">Кривая результата, скор и статистика<ArrowRight size={14} aria-hidden="true" /></span>
        </button>}
      </section>
      <footer className="bot-calendar-footer"><span>{status}{ready && <> · {new Intl.DateTimeFormat('ru-RU', { timeZone: data.time_zone, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(data.last_sync_at))}</>}</span><span>Europe/Bucharest</span></footer>
    </div>
    {notice && <p className="bot-copy-notice" role="status"><Check size={16} aria-hidden="true" />{notice}</p>}
    {history && <BotCalendarHistory client={client} start={start} today={today} month={month} initialDay={history.day} initialMonth={history.month} onClose={() => setHistory(null)} />}
    {analyticsOpen && <BotAnalyticsDialog client={client} overview={analytics.data} start={start} today={today} month={month} onClose={() => setAnalyticsOpen(false)} />}
    <dialog ref={linkDialog} className="bot-dialog bot-link-dialog" onCancel={() => setCopyFailed(false)} onClose={() => setCopyFailed(false)} aria-labelledby="bot-link-title">
      <div className="bot-dialog-inner"><header><h2 id="bot-link-title">Ссылка на календарь</h2><button type="button" aria-label="Закрыть ссылку" onClick={() => setCopyFailed(false)}><X aria-hidden="true" /></button></header>
        <p className="bot-settings-note">Скопируйте ссылку или нажмите и удерживайте её, чтобы отправить.</p>
        <input aria-label="Прямая ссылка на календарь" readOnly value={url} onFocus={event => event.target.select()} />
        <button className="bot-copy-link" type="button" onClick={async () => { try { await copyText(url, { container: linkDialog.current, preferSelection: true }); setCopyFailed(false); setNotice('Ссылка на календарь скопирована'); } catch { /* Keep the selectable link visible for manual copy. */ } }}>Скопировать ссылку</button>
      </div>
    </dialog>
  </main>;
}
