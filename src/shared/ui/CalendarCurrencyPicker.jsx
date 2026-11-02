import React, { useId, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { CURRENCIES } from '../config/constants.js';
import './CalendarCurrencyPicker.css';
import { localeKey } from '../i18n/locale.js';
import CalendarAnchoredPopover from './CalendarAnchoredPopover.jsx';

const LABELS = {
  uk: ['Валюта календаря', 'У ваших записах', 'Інші валюти'],
  ru: ['Валюта календаря', 'В ваших записях', 'Другие валюты'],
  en: ['Calendar currency', 'In your records', 'Other currencies'],
  ro: ['Moneda calendarului', 'În înregistrările tale', 'Alte monede'],
  zh: ['日历货币', '记录中的货币', '其他货币'],
};

export default function CalendarCurrencyPicker({ currency, onChange, usedCurrencies = [], language = 'ru', isLight = false, onOpen }) {
  const locale = localeKey(language);
  const copy = LABELS[locale];
  const [open, setOpen] = useState(false);
  const trigger = useRef(null), id=useId();
  const used = new Set(usedCurrencies);
  const groups = [CURRENCIES.filter(item => used.has(item.code)), CURRENCIES.filter(item => !used.has(item.code))];
  function toggle() {
    setOpen(!open); if(!open)onOpen?.();
  }
  function keys(event,node){
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      if (!open) { toggle(); return; }
      const buttons = [...(node||document.getElementById(id)).querySelectorAll('.calendar-currency-option')];
      const index = buttons.indexOf(document.activeElement);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
      buttons[next]?.focus();
    }
  }
  return <div className="calendar-currency" data-light={isLight}>
    <button type="button" ref={trigger} className="calendar-currency-trigger" aria-label={`${copy[0]}: ${currency}`} aria-haspopup="dialog" aria-expanded={open} aria-controls={id} onClick={toggle} onKeyDown={event=>keys(event,null)}>
      <span>{currency}</span><ChevronDown size={12} aria-hidden="true"/>
    </button>
    <CalendarAnchoredPopover open={open} onClose={()=>setOpen(false)} anchorRef={trigger} id={id} label={copy[0]} className="calendar-currency-menu" isLight={isLight} width={208} onKeyDown={keys}>
      {groups.map((items, index) => items.length > 0 && <div key={index}>
        <p>{copy[index + 1]}</p>
        {items.map(item => <button type="button" className="calendar-currency-option" key={item.code} aria-pressed={currency === item.code} onClick={() => { if (item.code !== currency) onChange(item.code); setOpen(false); }}>
          <span className="calendar-currency-symbol">{item.symbol}</span><span>{item.code}</span>{currency === item.code && <Check size={14} aria-hidden="true"/>}
        </button>)}
      </div>)}
    </CalendarAnchoredPopover>
  </div>;
}
