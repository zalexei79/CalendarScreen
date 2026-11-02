import React, { useEffect, useId, useRef, useState } from 'react';
import {allowedBirthday,birthdayBounds,birthdayDayCount,MIN_BIRTHDAY_AGE} from './birthdayModel.js';
import './BirthdayField.css';

const COPY = {
  uk: ['День','Місяць','Рік народження','Виберіть місяць','Доступні роки: {min}–{max}.','Дата має відповідати віку від {age} років.'],
  ru: ['День','Месяц','Год рождения','Выберите месяц','Доступные годы: {min}–{max}.','Дата должна соответствовать возрасту от {age} лет.'],
  en: ['Day','Month','Year of birth','Choose a month','Available years: {min}–{max}.','Choose a birth date for age {age} or older.'],
  ro: ['Zi','Lună','Anul nașterii','Alege luna','Ani disponibili: {min}–{max}.','Data trebuie să corespundă vârstei de cel puțin {age} ani.'],
  zh: ['日','月','出生年份','选择月份','可选年份：{min}–{max}。','请选择年满{age}岁的出生日期。'],
};
const parts = value => value ? value.split('-') : ['', '', ''];

// Own localized fields avoid the device-language calendar in native date inputs.
export default function BirthdayField({ value, onChange, lang, label, invalid, describedBy }) {
  const hintId=useId();
  const [draft, setDraft] = useState(() => parts(value));
  const emitted = useRef(value);
  useEffect(() => {
    if (value !== emitted.current) { setDraft(parts(value)); emitted.current = value; }
  }, [value]);
  const locale = lang === 'uk' ? 'uk-UA' : lang === 'zh' ? 'zh-CN' : lang === 'ro' ? 'ro-RO' : lang === 'en' ? 'en-US' : 'ru-RU';
  const copy = COPY[lang]||COPY.en;
  const [year, month, day] = draft;
  const today = new Date();
  const bounds=birthdayBounds(today),validYear=year.length===4&&Number(year)>=bounds.minYear&&Number(year)<=bounds.maxYear;
  const days=birthdayDayCount(year||'2000',month,today),monthCount=Number(year)===bounds.maxYear?bounds.maxMonth:12;
  const complete=draft.every(Boolean),ownError=(year.length===4&&!validYear)||(complete&&!allowedBirthday(draft.join('-'),today));
  const description=[describedBy,hintId].filter(Boolean).join(' ');
  const number = value => String(value).padStart(2, '0');
  function change(index, selected) {
    const next = [...draft]; next[index] = selected;
    if(Number(next[0])===bounds.maxYear&&Number(next[1])>bounds.maxMonth){next[1]='';next[2]='';}
    const max=birthdayDayCount(next[0]||'2000',next[1],today);
    if (Number(next[2]) > max) next[2] = '';
    setDraft(next);
    emitted.current = next.every(Boolean)&&allowedBirthday(next.join('-'),today) ? next.join('-') : '';
    onChange(emitted.current);
  }
  const select = (index, title, options) => <label className={['birthday-year','birthday-month','birthday-day'][index]}><span>{title}</span><select aria-label={title} value={draft[index]} disabled={index!==0&&!validYear} aria-invalid={Boolean(invalid||ownError)} aria-describedby={description} autoComplete={['bday-year','bday-month','bday-day'][index]} onChange={event => change(index, event.target.value)}><option value="">{index===1?copy[3]:'—'}</option>{options.map(([code, text]) => <option key={code} value={code}>{text}</option>)}</select></label>;
  return <fieldset id="life-birthday" className="life-birthday-fields" lang={locale} aria-describedby={describedBy}>
    <legend>{label}</legend>
    <div>
      {select(0, copy[2], Array.from({length:bounds.maxYear-bounds.minYear+1},(_,i)=>{const value=String(bounds.maxYear-i);return [value,value];}))}
      {select(2, copy[0], Array.from({ length: days }, (_, i) => [number(i + 1), String(i + 1)]))}
      {select(1, copy[1], Array.from({ length: monthCount }, (_, i) => {const name=new Date(2000,i,1).toLocaleDateString(locale,{month:'long'});return [number(i+1),`${name.charAt(0).toLocaleUpperCase(locale)+name.slice(1)} (${number(i+1)})`];}))}
    </div>
    <p id={hintId} className="birthday-range" role={ownError?'alert':undefined}>{(ownError?copy[5]:copy[4]).replace('{min}',bounds.minYear).replace('{max}',bounds.maxYear).replace('{age}',MIN_BIRTHDAY_AGE)}</p>
  </fieldset>;
}
