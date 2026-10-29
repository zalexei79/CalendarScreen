import React, { useEffect, useState } from 'react';
import { Maximize2, RotateCcw, Type } from 'lucide-react';
import { DISPLAY_PREFERENCES_EVENT, readDisplayPreferences, setDisplayPreferences } from '../lib/displayPreferences.js';
import './DisplayScaleSettings.css';

const COPY = {
  ru: { title:'Масштаб и текст', interface:'Интерфейс', interfaceHint:'Размер кнопок, карточек и всех элементов', text:'Размер текста', textHint:'Увеличивает текст отдельно от интерфейса', small:'Меньше', large:'Больше', reset:'Вернуть 100%', note:'Настройки сохраняются на этом устройстве.' },
  en: { title:'Size & text', interface:'Interface', interfaceHint:'Size of buttons, cards and all controls', text:'Text size', textHint:'Adjust text separately from the interface', small:'Smaller', large:'Larger', reset:'Reset to 100%', note:'Saved on this device.' },
  ro: { title:'Dimensiune și text', interface:'Interfață', interfaceHint:'Dimensiunea butoanelor, cardurilor și elementelor', text:'Dimensiunea textului', textHint:'Ajustează textul separat de interfață', small:'Mai mic', large:'Mai mare', reset:'Revino la 100%', note:'Setările se salvează pe acest dispozitiv.' },
  uk: { title:'Масштаб і текст', interface:'Інтерфейс', interfaceHint:'Розмір кнопок, карток та всіх елементів', text:'Розмір тексту', textHint:'Змінює текст окремо від інтерфейсу', small:'Менше', large:'Більше', reset:'Повернути 100%', note:'Налаштування зберігаються на цьому пристрої.' },
  zh: { title:'界面与文字大小', interface:'界面大小', interfaceHint:'调整按钮、卡片及所有界面元素的大小', text:'文字大小', textHint:'独立调整文字大小', small:'较小', large:'较大', reset:'恢复为 100%', note:'设置保存在此设备上。' },
};

export function displayScaleCopy(language = 'ru') {
  const locale = language === 'uk' ? 'uk' : language.startsWith('zh') ? 'zh' : ['md','ro'].includes(language) ? 'ro' : language === 'en' ? 'en' : 'ru';
  return COPY[locale];
}

function ScaleControl({ id, icon: Icon, label, hint, value, min, max, copy, onChange }) {
  return <section className="display-scale-control">
    <div className="display-scale-heading"><span className="display-scale-icon"><Icon size={18} aria-hidden="true"/></span><label htmlFor={id}>{label}</label><output htmlFor={id}>{value}%</output></div>
    <p id={`${id}-hint`}>{hint}</p>
    <input id={id} type="range" min={min} max={max} step="5" value={value} onChange={event=>onChange(Number(event.target.value))} aria-describedby={`${id}-hint`} aria-valuetext={`${value}%`} style={{'--scale-progress':`${(value-min)/(max-min)*100}%`}}/>
    <div className="display-scale-limits" aria-hidden="true"><span>{copy.small}</span><span>{copy.large}</span></div>
  </section>;
}

export default function DisplayScaleSettings({ language }) {
  const copy = displayScaleCopy(language);
  const [preferences, setPreferences] = useState(readDisplayPreferences);
  useEffect(()=>{
    const refresh=()=>setPreferences(readDisplayPreferences());
    window.addEventListener(DISPLAY_PREFERENCES_EVENT,refresh);
    window.addEventListener('storage',refresh);
    return()=>{window.removeEventListener(DISPLAY_PREFERENCES_EVENT,refresh);window.removeEventListener('storage',refresh);};
  },[]);
  function change(patch) {
    setPreferences(current=>({...current,...patch}));
    setDisplayPreferences(patch);
  }
  const standard=preferences.interfaceScale===100&&preferences.textScale===100;
  return <div className="display-scale-settings">
    <ScaleControl id="display-interface-scale" icon={Maximize2} label={copy.interface} hint={copy.interfaceHint} value={preferences.interfaceScale} min={90} max={115} copy={copy} onChange={interfaceScale=>change({interfaceScale})}/>
    <ScaleControl id="display-text-scale" icon={Type} label={copy.text} hint={copy.textHint} value={preferences.textScale} min={90} max={130} copy={copy} onChange={textScale=>change({textScale})}/>
    <button type="button" className="display-scale-reset" disabled={standard} onClick={()=>change({interfaceScale:100,textScale:100})}><RotateCcw size={15} aria-hidden="true"/>{copy.reset}</button>
    <p className="display-scale-note">{copy.note}</p>
  </div>;
}
