import React, { useEffect, useRef } from 'react';
import { CalendarDays, ChartCandlestick, ChevronDown, CircleDollarSign, Inbox, Mic, Pencil, Plus, Trash2 } from 'lucide-react';
import SwipeDismissSheet from './SwipeDismissSheet.jsx';
import SheetCloseButton from './SheetCloseButton.jsx';
import { calendarDayCopy } from '../i18n/calendarDay.js';
import { intlLocale } from '../i18n/locale.js';
import { getMoneyCategoryLabel } from '../config/constants';
import { formatMoney } from '../lib/formatters';
import { receiptFromEntry } from '../../features/receipts/receiptHistory.js';
import ReceiptHistoryCard from '../../features/receipts/ReceiptHistoryCard.jsx';
import './CalendarDayPanel.css';

export default function CalendarDayPanel({
  dateKey, todayKey, language, isLight, traderMode, currency, records = [], hasPlans,
  onClose, onAdd, onPlan, onVoice, onEdit, onDelete, getIcon, note, children,
}) {
  const panelRef = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const backdropPress = useRef(false);
  const copy = calendarDayCopy(language);
  const future = dateKey > todayKey;
  const locale = intlLocale(language);
  const date = new Date(`${dateKey}T12:00:00`);
  const title = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long' }).format(date);
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(date);
  const currencyRecords = records.filter(record => String(record.currency || 'USD').trim().toUpperCase() === currency);
  const income = currencyRecords.reduce((sum, record) => sum + Math.max(0, Number(record.pnl) || 0), 0);
  const expense = currencyRecords.reduce((sum, record) => sum + Math.max(0, -(Number(record.pnl) || 0)), 0);
  const total = income - expense;
  const winrate = currencyRecords.length ? Math.round(currencyRecords.filter(record => Number(record.pnl) >= 0).length / currencyRecords.length * 100) : 0;
  const mixedCurrencies = currencyRecords.length !== records.length;
  const tone = currencyRecords.length === 0 || total === 0 ? 'neutral' : total > 0 ? 'positive' : 'negative';

  useEffect(() => {
    const previousFocus = document.activeElement;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus({ preventScroll: true });
    function onKey(event) {
      if (event.key === 'Escape' && !event.defaultPrevented) {
        event.preventDefault();
        closeRef.current();
      }
      if (event.key !== 'Tab') return;
      const items = [...panelRef.current.querySelectorAll('button, input, select, textarea, summary, [tabindex="0"]')]
        .filter(item => !item.matches(':disabled') && item.getClientRects().length);
      const first = items[0], last = items.at(-1);
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || !items.includes(document.activeElement))) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !items.includes(document.activeElement))) {
        event.preventDefault(); first.focus();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener('keydown', onKey);
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, []);

  return <div className="calendar-day-backdrop fixed inset-0 z-40" data-light={Boolean(isLight)}
    onMouseDown={event => { backdropPress.current = event.target === event.currentTarget; }}
    onClick={event => { if (event.target === event.currentTarget && backdropPress.current) onClose(); }}>
    <SwipeDismissSheet ref={panelRef} as="section" role="dialog" aria-modal="true" aria-labelledby="calendar-day-title"
      tabIndex={-1} className="calendar-day-panel" data-mode={traderMode ? 'trader' : 'finance'}
      data-date-key={dateKey} isLight={isLight} onDismiss={onClose} handleClassName="calendar-day-handle">
      <header className="calendar-day-header">
        <div className="calendar-day-date">
          <p>{dateKey === todayKey ? `${copy.today} · ` : ''}{weekday} · {date.getFullYear()}</p>
          <h2 id="calendar-day-title"><time dateTime={dateKey}>{title}</time></h2>
        </div>
        <SheetCloseButton language={language} onClick={onClose}/>
      </header>

      {!future && <div className="calendar-day-overview">
        <p className="calendar-day-balance-label">{traderMode ? copy.result : copy.balance}</p>
        <div className="calendar-day-balance" data-tone={tone}>
          <strong>{currencyRecords.length ? `${total > 0 ? '+' : total < 0 ? '−' : ''}${formatMoney(total)}` : '—'}</strong>
          <span>{currency}</span>
        </div>
        {currencyRecords.length > 0 && <dl className="calendar-day-metrics">
          <div><dt><i data-tone="positive"/>{traderMode ? copy.profit : copy.income}</dt><dd data-tone="positive">+{formatMoney(income)}</dd></div>
          <div><dt><i data-tone="negative"/>{traderMode ? copy.loss : copy.expense}</dt><dd data-tone="negative">{expense ? '−' : ''}{formatMoney(expense)}</dd></div>
          {traderMode && <div><dt>{copy.winrate}</dt><dd>{winrate}%</dd></div>}
        </dl>}
        {mixedCurrencies && <p className="calendar-day-currency-hint">{copy.currencyHint.replace('{currency}', currency)}</p>}
      </div>}

      <div className="calendar-day-scroll">
        {children}
        {future ? !hasPlans && <div className="calendar-day-empty calendar-day-future">
          <span className="calendar-day-empty-icon"><CalendarDays size={22} strokeWidth={1.6}/></span>
          <div><h3>{copy.future}</h3><p>{copy.futureHint}</p></div>
        </div> : records.length > 0 ? <section className="calendar-day-records" aria-label={traderMode ? copy.trades : copy.records}>
          <div className="calendar-day-list-heading"><h3>{traderMode ? copy.trades : copy.records}</h3><span>{records.length}</span></div>
          <div className="calendar-day-record-list">{records.map(record => {
            const receipt = receiptFromEntry(record);
            if (receipt) return <ReceiptHistoryCard key={record.id} entry={record} receipt={receipt} language={language} isLight={isLight} showDate={false}
              onEdit={onEdit ? () => onEdit(record) : undefined} onDelete={onDelete ? () => onDelete(record) : undefined}/>;
            const category = traderMode ? record.instrument : getMoneyCategoryLabel(record.instrument, language);
            const Icon = getIcon?.(record.instrument) || (traderMode ? ChartCandlestick : CircleDollarSign);
            const content = <>
              <span className="calendar-day-record-icon" data-tone={record.pnl >= 0 ? 'positive' : 'negative'} aria-hidden="true"><Icon size={19} strokeWidth={1.7}/></span>
              <span className="calendar-day-record-description"><strong>{category}</strong><span>{record.time}{record.platform && record.platform !== 'Manual' ? ` · ${record.platform}` : ''}</span>
                {record.comment && <span className="calendar-day-record-comment">{record.comment}</span>}</span>
              <span className="calendar-day-record-amount" data-tone={record.pnl >= 0 ? 'positive' : 'negative'}>{record.pnl >= 0 ? '+' : '−'}{formatMoney(record.pnl)}<small>{record.currency || 'USD'}</small></span>
            </>;
            return <div className="calendar-day-record" key={record.id}>
              {onEdit ? <button type="button" className="calendar-day-record-main" onClick={() => onEdit(record)} aria-label={traderMode ? copy.editTrade : copy.editRecord}>{content}</button>
                : <div className="calendar-day-record-main">{content}</div>}
              {onDelete && <button type="button" className="calendar-day-record-delete" onClick={() => onDelete(record)} aria-label={traderMode ? copy.deleteTrade : copy.deleteRecord}><Trash2 size={16}/></button>}
            </div>;
          })}</div>
        </section> : !hasPlans && <div className="calendar-day-empty">
          <span className="calendar-day-empty-icon"><Inbox size={22} strokeWidth={1.6}/></span>
          <div><h3>{traderMode ? copy.emptyTrades : copy.empty}</h3><p>{traderMode ? copy.emptyTradesHint : copy.emptyHint}</p></div>
        </div>}
        {note && <details className="calendar-day-note"><summary><Pencil size={15}/><span>{copy.note}</span><ChevronDown size={15}/></summary>{note}</details>}
      </div>

      <footer className="calendar-day-actions">
        <button type="button" className="calendar-day-add" onClick={future ? onPlan : onAdd}><Plus size={19} strokeWidth={2.2}/>{future ? copy.schedule : copy.add}</button>
        {!future && <button type="button" className="calendar-day-voice" onClick={onVoice} aria-label={copy.voiceDay} title={copy.voice}><Mic size={20} strokeWidth={1.8}/></button>}
      </footer>
    </SwipeDismissSheet>
  </div>;
}
