import React, { useEffect, useRef } from 'react';
import { ArrowDownLeft, ArrowUpRight, SlidersHorizontal, ChevronDown } from 'lucide-react';
import { intlLocale } from '../../shared/i18n/locale.js';
import { freeHistoryCopy, freeHistoryCount } from './freeHistoryCopy.js';
import './FreeHistoryOverview.css';

export default function FreeHistoryOverview({ summary, language, period, periodLabel, periodOptions, currency, currencies, scope, panel, visibleCount, filtersOpen, onPeriod, onCurrency, onScope, onPanel, onFilters }) {
  const copy = freeHistoryCopy(language);
  const card = useRef(null), balance = useRef(null), bounds = useRef(null), animation = useRef(null), previous = useRef(null);
  const money = value => new Intl.NumberFormat(intlLocale(language), { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(value));
  const amount = summary.mixed ? '—' : `${summary.total < 0 ? '−' : summary.total > 0 ? '+' : ''}${money(summary.total)}`;
  const label = period === 'Вся история' ? copy.allTime : periodLabel;
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const stop = () => { if (media.matches) animation.current?.cancel(); };
    media.addEventListener('change', stop);
    return () => { media.removeEventListener('change', stop); animation.current?.cancel(); };
  }, []);
  useEffect(() => {
    const key = `${amount}:${summary.currency}`;
    if (previous.current !== null && previous.current !== key && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      animation.current?.cancel();
      animation.current = balance.current?.animate?.([{ opacity: .5, transform: 'translateY(3px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 280, easing: 'cubic-bezier(.22,1,.36,1)' });
    }
    previous.current = key;
  }, [amount, summary.currency]);
  return <section className="free-history-overview">
    <section ref={card} className="free-history-card" aria-label={copy.result}
      onPointerEnter={event => { if (event.pointerType === 'mouse' && !matchMedia('(prefers-reduced-motion: reduce)').matches) bounds.current = card.current.getBoundingClientRect(); }}
      onPointerMove={event => { if (event.pointerType !== 'mouse' || !bounds.current || matchMedia('(prefers-reduced-motion: reduce)').matches) return; const x = Math.max(0, Math.min(1, (event.clientX - bounds.current.left) / bounds.current.width)); card.current.style.setProperty('--free-light-x', `${Math.round(x * 100)}%`); }}
      onPointerLeave={() => { bounds.current = null; card.current.style.removeProperty('--free-light-x'); }}>
      <p className="free-history-result-label">{copy.result}</p>
      <div ref={balance} className="free-history-balance" data-negative={!summary.mixed && summary.total < 0}>
        <strong className="free-history-amount" style={{ '--free-amount-fit': `${Math.min(14, 140 / Math.max(10, amount.length))}cqw` }}>{amount}</strong>
        {!summary.mixed && summary.currency !== 'ALL' && <span className="free-history-unit">{summary.currency}</span>}
      </div>
      <p className="free-history-context">{label} · {freeHistoryCount(summary.count, language)}</p>
      {summary.mixed && <p className="free-history-mixed">{copy.mixed}</p>}
      <div className="free-history-totals">
        <div><span><ArrowDownLeft size={14} aria-hidden="true"/>{copy.income}</span><strong>{summary.mixed ? '—' : money(summary.income)}</strong></div>
        <div><span><ArrowUpRight size={14} aria-hidden="true"/>{copy.expense}</span><strong>{summary.mixed ? '—' : money(summary.expense)}</strong></div>
      </div>
    </section>
    <div className="free-history-controls">
      <div className="free-history-select free-history-period-select"><select aria-label={copy.period} value={period} onChange={event => onPeriod(event.target.value)}>{periodOptions.map(option => <option key={option.value} value={option.value}>{option.value === 'Вся история' ? copy.allTime : option.label}</option>)}</select><ChevronDown size={14} aria-hidden="true"/></div>
      <div className="free-history-select free-history-currency-select"><select aria-label={copy.currency} value={currency} onChange={event => onCurrency(event.target.value)}><option value="ALL">{copy.allCurrencies}</option>{currencies.map(item => <option key={item.code} value={item.code}>{item.code}</option>)}</select><ChevronDown size={14} aria-hidden="true"/></div>
      <button type="button" className="free-history-filter-button" aria-label={copy.filters} aria-expanded={filtersOpen} onClick={onFilters}><SlidersHorizontal size={17}/></button>
    </div>
    <nav className="free-history-tabs" aria-label={copy.sections}>{[['records', copy.records], ['dynamics', copy.dynamics], ['analysis', copy.analysis]].map(([id, text]) => <button key={id} type="button" aria-pressed={(panel || 'records') === id} onClick={() => onPanel(id === 'records' ? null : id)}>{text}</button>)}</nav>
    {!panel && <>
      <div className="free-history-scopes" role="group" aria-label={copy.scope}>{[['all', copy.all], ['income', copy.income], ['expense', copy.expense]].map(([id, text]) => <button key={id} type="button" aria-pressed={scope === id} onClick={() => onScope(id)}>{text}</button>)}</div>
      <p className="free-history-list-count">{freeHistoryCount(visibleCount, language)}</p>
    </>}
    {panel === 'analysis' && !visibleCount && <p className="free-history-empty-analysis">{copy.empty}</p>}
  </section>;
}
