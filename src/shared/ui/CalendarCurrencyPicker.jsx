import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { CURRENCIES } from '../config/constants.js';
import './CalendarCurrencyPicker.css';

const LABELS = {
  ru: ['Валюта календаря', 'В ваших записях', 'Другие валюты'],
  en: ['Calendar currency', 'In your records', 'Other currencies'],
  ro: ['Moneda calendarului', 'În înregistrările tale', 'Alte monede'],
  zh: ['日历货币', '记录中的货币', '其他货币'],
};

export default function CalendarCurrencyPicker({ currency, onChange, usedCurrencies = [], language = 'ru', isLight = false, onOpen }) {
  const locale = language.startsWith('zh') ? 'zh' : ['md', 'ro'].includes(language) ? 'ro' : language === 'en' ? 'en' : 'ru';
  const copy = LABELS[locale];
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const root = useRef(null), trigger = useRef(null), timer = useRef(null);
  const used = new Set(usedCurrencies);
  const groups = [CURRENCIES.filter(item => used.has(item.code)), CURRENCIES.filter(item => !used.has(item.code))];
  function close(restoreFocus = false) {
    setClosing(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { setOpen(false); setClosing(false); }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 150);
    if (restoreFocus) trigger.current?.focus();
  }
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    if (!open) return;
    const outside = event => { if (!root.current?.contains(event.target)) close(); };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  function toggle() {
    if (open && !closing) { close(); return; }
    clearTimeout(timer.current); setClosing(false); setOpen(true); onOpen?.();
  }
  return <div className="calendar-currency" data-light={isLight} ref={root} onKeyDown={event => {
    if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); close(true); }
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      if (!open) { toggle(); return; }
      const buttons = [...root.current.querySelectorAll('.calendar-currency-option')];
      const index = buttons.indexOf(document.activeElement);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
      buttons[next]?.focus();
    }
  }}>
    <button type="button" ref={trigger} className="calendar-currency-trigger" aria-label={`${copy[0]}: ${currency}`} aria-expanded={open && !closing} aria-controls={open ? 'calendar-currency-options' : undefined} onClick={toggle}>
      <span>{currency}</span><ChevronDown size={12} aria-hidden="true"/>
    </button>
    {open && <div id="calendar-currency-options" className={`calendar-currency-menu${closing ? ' is-closing' : ''}`} role="group" aria-label={copy[0]} inert={closing ? '' : undefined}>
      {groups.map((items, index) => items.length > 0 && <div key={index}>
        <p>{copy[index + 1]}</p>
        {items.map(item => <button type="button" className="calendar-currency-option" key={item.code} aria-pressed={currency === item.code} onClick={() => { if (item.code !== currency) onChange(item.code); close(true); }}>
          <span className="calendar-currency-symbol">{item.symbol}</span><span>{item.code}</span>{currency === item.code && <Check size={14} aria-hidden="true"/>}
        </button>)}
      </div>)}
    </div>}
  </div>;
}
