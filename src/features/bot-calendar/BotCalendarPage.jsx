import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, CalendarDays, Check, ChevronLeft, ChevronRight, Copy, History, Menu, Share2, SlidersHorizontal, X } from 'lucide-react';
import CalendarDayCell from '../../../CalendarDayCell.jsx';
import BrandIcon from '../../shared/ui/BrandIcon.jsx';
import { copyText } from '../../shared/lib/copyText.js';
import { BOT_START_DATE, calendarCells, dateKey, dateLabel, money, publicCalendarUrl, shiftMonth, tradeCount } from './botCalendarModel.js';
import { BOT_PARAMETERS } from './botParameters.js';
import BotCalendarHistory from './BotCalendarHistory.jsx';
import './BotCalendarPage.css';

export default function BotCalendarPage({ client }) {
  const [month, setMonth] = useState(() => `${dateKey().slice(0, 7)}-01`);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [history, setHistory] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [copyFailed, setCopyFailed] = useState(false);
  const settings = useRef(null), menu = useRef(null), linkDialog = useRef(null);
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
    if (settingsOpen) settings.current?.showModal(); else settings.current?.close();
  }, [settingsOpen]);
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
        <div className="bot-top-actions">
          <button type="button" className="bot-icon-button" aria-label="Скопировать ссылку на календарь" title="Скопировать ссылку на календарь" onClick={copyCalendar}>{notice ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}</button>
          <details ref={menu} className="bot-menu">
            <summary role="button" aria-label="Меню календаря" className="bot-icon-button"><Menu aria-hidden="true" /></summary>
            <nav aria-label="Функции календаря">
              <button type="button" onClick={() => { closeMenu(); setSettingsOpen(true); }}><SlidersHorizontal aria-hidden="true" />Параметры бота</button>
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
          <span className="bot-symbol">XAUUSD · M1</span>
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
      <aside className="bot-create-invitation" aria-label="Создать свой календарь">
        <span className="bot-invitation-icon" aria-hidden="true"><CalendarDays /></span>
        <div><strong>Начни свою историю.</strong><p>Твои деньги, планы и сделки — в одном календаре.</p></div>
        <a href="/">Создать свой календарь<ArrowRight size={16} aria-hidden="true" /></a>
      </aside>
      <footer className="bot-calendar-footer"><span>{status}{ready && <> · {new Intl.DateTimeFormat('ru-RU', { timeZone: data.time_zone, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(data.last_sync_at))}</>}</span><span>Europe/Bucharest</span></footer>
    </div>
    {notice && <p className="bot-copy-notice" role="status"><Check size={16} aria-hidden="true" />{notice}</p>}
    {history && <BotCalendarHistory client={client} start={start} today={today} month={month} initialDay={history.day} initialMonth={history.month} onClose={() => setHistory(null)} />}
    <dialog ref={settings} className="bot-dialog bot-settings-dialog" onCancel={() => setSettingsOpen(false)} onClose={() => setSettingsOpen(false)} onClick={event => { if (event.target === settings.current) setSettingsOpen(false); }} aria-labelledby="bot-parameters-title">
      <div className="bot-dialog-inner">
        <header><div><p>{BOT_PARAMETERS.symbol} · M1</p><h2 id="bot-parameters-title">Параметры бота</h2></div><button type="button" aria-label="Закрыть параметры" onClick={() => setSettingsOpen(false)}><X aria-hidden="true" /></button></header>
        <p className="bot-settings-note">Из файла настроек, предоставленного 23.10.2026. Изменения в cTrader не обновляют этот список автоматически.</p>
        {BOT_PARAMETERS.groups.map(group => <section className="bot-settings-group" key={group.title}><h3>{group.title}</h3><dl>{group.rows.map(([key,label,value]) => <div key={key}><dt>{label}<small>{key}</small></dt><dd>{value}</dd></div>)}</dl></section>)}
        <p className="bot-settings-note">Единицы дневных лимитов в файле не указаны. Набор настроек не подтверждает параметры каждой прошлой сделки.</p>
      </div>
    </dialog>
    <dialog ref={linkDialog} className="bot-dialog bot-link-dialog" onCancel={() => setCopyFailed(false)} onClose={() => setCopyFailed(false)} aria-labelledby="bot-link-title">
      <div className="bot-dialog-inner"><header><h2 id="bot-link-title">Ссылка на календарь</h2><button type="button" aria-label="Закрыть ссылку" onClick={() => setCopyFailed(false)}><X aria-hidden="true" /></button></header>
        <p className="bot-settings-note">Скопируйте ссылку или нажмите и удерживайте её, чтобы отправить.</p>
        <input aria-label="Прямая ссылка на календарь" readOnly value={url} onFocus={event => event.target.select()} />
        <button className="bot-copy-link" type="button" onClick={async () => { try { await copyText(url, { container: linkDialog.current, preferSelection: true }); setCopyFailed(false); setNotice('Ссылка на календарь скопирована'); } catch { /* Keep the selectable link visible for manual copy. */ } }}>Скопировать ссылку</button>
      </div>
    </dialog>
  </main>;
}
