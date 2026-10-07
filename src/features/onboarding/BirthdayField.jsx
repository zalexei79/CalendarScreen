import React, { useEffect, useRef, useState } from 'react';

const COPY = {
  ru: ['День', 'Месяц', 'Год'], en: ['Day', 'Month', 'Year'],
  ro: ['Zi', 'Lună', 'An'], zh: ['日', '月', '年'],
};
const parts = value => value ? value.split('-') : ['', '', ''];

// Own localized fields avoid the device-language calendar in native date inputs.
export default function BirthdayField({ value, onChange, lang, label, invalid, describedBy }) {
  const [draft, setDraft] = useState(() => parts(value));
  const emitted = useRef(value);
  useEffect(() => {
    if (value !== emitted.current) { setDraft(parts(value)); emitted.current = value; }
  }, [value]);
  const locale = lang === 'zh' ? 'zh-CN' : lang === 'ro' ? 'ro-RO' : lang === 'en' ? 'en-US' : 'ru-RU';
  const copy = COPY[lang];
  const [year, month, day] = draft;
  const today = new Date();
  const days = month ? new Date(Number(year || 2000), Number(month), 0).getDate() : 31;
  const number = value => String(value).padStart(2, '0');
  function change(index, selected) {
    const next = [...draft]; next[index] = selected;
    const max = next[1] ? new Date(Number(next[0] || 2000), Number(next[1]), 0).getDate() : 31;
    if (Number(next[2]) > max) next[2] = number(max);
    setDraft(next);
    emitted.current = next.every(Boolean) ? next.join('-') : '';
    onChange(emitted.current);
  }
  const select = (index, title, options) => <label><span>{title}</span><select aria-label={title} value={draft[index]} aria-invalid={invalid} aria-describedby={describedBy} onChange={event => change(index, event.target.value)}><option value="">—</option>{options.map(([code, text]) => <option key={code} value={code}>{text}</option>)}</select></label>;
  return <fieldset id="life-birthday" className="life-birthday-fields" lang={locale} aria-describedby={describedBy}>
    <legend>{label}</legend>
    <div>
      {select(2, copy[0], Array.from({ length: days }, (_, i) => [number(i + 1), String(i + 1)]))}
      {select(1, copy[1], Array.from({ length: 12 }, (_, i) => [number(i + 1), new Date(2000, i, 1).toLocaleDateString(locale, { month: 'long' })]))}
      {select(0, copy[2], Array.from({ length: 131 }, (_, i) => [String(today.getFullYear() - i), String(today.getFullYear() - i)]))}
    </div>
  </fieldset>;
}
