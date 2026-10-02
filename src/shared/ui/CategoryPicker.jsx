import React, {useEffect, useId, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {Check, ChevronDown, Search, Star, X, Plus, Shapes} from 'lucide-react';
import {categoryLibrary, FAVORITE_LIMIT} from '../lib/categoryLibrary.js';
import {normalizeVoiceCategory} from '../lib/voiceCategory.js';
import useCategoryPreferences from './useCategoryPreferences.js';
import './CategoryPicker.css';

const copy = {
 ru: {title:'Разделы',choose:'Выбрать раздел',search:'Найти раздел',favorites:'Избранное',recent:'Недавние',all:'Все разделы',empty:'Ничего не найдено',tip:'Закрепите частые разделы звёздочкой — они будут под рукой.',limit:'Можно закрепить до 6 разделов. Уберите одну звёздочку, чтобы добавить другой.',pin:'Закрепить',unpin:'Открепить',close:'Закрыть разделы',create:'Создать',found:'Найдено',long:'Название — до 60 символов'},
 en: {title:'Categories',choose:'Choose category',search:'Find a category',favorites:'Favorites',recent:'Recent',all:'All categories',empty:'No categories found',tip:'Star your frequent categories to keep them close.',limit:'Pin up to 6 categories. Unpin one to add another.',pin:'Pin',unpin:'Unpin',close:'Close categories',create:'Create',found:'Found',long:'Use up to 60 characters'},
 ro: {title:'Categorii',choose:'Alege categoria',search:'Caută o categorie',favorites:'Favorite',recent:'Recente',all:'Toate categoriile',empty:'Nicio categorie găsită',tip:'Marchează categoriile frecvente cu o stea.',limit:'Poți fixa până la 6 categorii. Elimină o stea pentru a adăuga alta.',pin:'Fixează',unpin:'Elimină',close:'Închide categoriile',create:'Creează',found:'Găsite',long:'Cel mult 60 de caractere'},
 zh: {title:'类别',choose:'选择类别',search:'搜索类别',favorites:'收藏',recent:'最近使用',all:'全部类别',empty:'未找到类别',tip:'点击星标，将常用类别放在手边。',limit:'最多收藏6个类别。请先取消一个收藏。',pin:'收藏',unpin:'取消收藏',close:'关闭类别',create:'创建',found:'找到',long:'名称最多60个字符'},
};

function PickerSheet({options,value,language,isLight,preferences,onClose,onSelect,allowCreate,allOption}) {
 const locale = language.startsWith('zh') ? 'zh' : ['md','ro'].includes(language) ? 'ro' : language;
 const c = copy[locale] || copy.ru, titleId = useId(), searchRef = useRef(null), panelRef = useRef(null), closeRef = useRef(null), timer = useRef(null);
 const [query,setQuery] = useState(''), [closing,setClosing] = useState(false), [limit,setLimit] = useState(false), [searchHeight,setSearchHeight] = useState(300);
 const {favorites,recent,all} = categoryLibrary(options, preferences.profile, query, locale);
 const [expanded,setExpanded] = useState(() => !favorites.length && !recent.length);
 const pinned = new Set(preferences.profile.favorites.map(normalizeVoiceCategory));
 const exact = options.some(item => [item.value,item.label].some(label => normalizeVoiceCategory(label) === normalizeVoiceCategory(query)));
 const canCreate = allowCreate && query.trim() && !exact && query.trim().length <= 60;
 const close = (selected) => {
  if (closing) return;
  setClosing(true);
  timer.current = setTimeout(() => {onClose(); if (selected !== undefined) onSelect(selected);}, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 180);
 };
 const closeAction = useRef(close); closeAction.current = close;
 useEffect(() => {
  const returnFocus = document.activeElement, previousOverflow = document.body.style.overflow;
  const siblings = [...document.body.children].filter(item => !item.contains(panelRef.current));
  const inert = siblings.map(item => [item,item.inert]); siblings.forEach(item => {item.inert = true;});
  document.body.style.overflow = 'hidden';
  (window.matchMedia('(pointer: coarse)').matches ? closeRef.current : searchRef.current)?.focus();
  function keyboard(event) {
   if (event.key === 'Escape') {event.preventDefault();event.stopImmediatePropagation();closeAction.current();}
   if (event.key !== 'Tab') return;
   const focusable = [...panelRef.current.querySelectorAll('button:not(:disabled), input')].filter(item => item.getClientRects().length);
   const first = focusable[0], last = focusable.at(-1);
   if (!panelRef.current.contains(document.activeElement)) {event.preventDefault();first?.focus();}
   else if (event.shiftKey && document.activeElement === first) {event.preventDefault();last?.focus();}
   else if (!event.shiftKey && document.activeElement === last) {event.preventDefault();first?.focus();}
  }
  document.addEventListener('keydown',keyboard,true);
  const viewport = window.visualViewport;
  const fit = () => {if (!viewport) return;const layer=panelRef.current.parentElement;layer.style.height=`${viewport.height}px`;layer.style.top=`${viewport.offsetTop}px`;layer.style.bottom='auto';layer.style.setProperty('--cp-viewport',`${viewport.height}px`);};
  fit();viewport?.addEventListener('resize',fit);viewport?.addEventListener('scroll',fit);
  return () => {clearTimeout(timer.current);document.removeEventListener('keydown',keyboard,true);viewport?.removeEventListener('resize',fit);viewport?.removeEventListener('scroll',fit);document.body.style.overflow = previousOverflow;inert.forEach(([item,previous]) => {item.inert = previous;});if (returnFocus?.isConnected) returnFocus.focus({preventScroll:true});};
 }, []);
 const select = item => {preferences.remember(item.value);close(item.value);};
 const rows = (items, compact = false) => <div className={compact ? 'category-picker-quick' : 'category-picker-list'}>{items.map(item => {
  const active = normalizeVoiceCategory(item.value) === normalizeVoiceCategory(value), favorite = pinned.has(normalizeVoiceCategory(item.value)), Icon = item.icon || Shapes;
  return <div key={item.value} className={`category-picker-row ${active ? 'is-selected' : ''}`}>
   <button type="button" className="category-picker-choice" onClick={() => select(item)} aria-pressed={active} aria-label={item.label}>
    <span className="category-picker-icon"><Icon size={18} strokeWidth={1.6}/></span><span>{item.label}</span>{active && <Check size={16} className="category-picker-check"/>}
   </button>
   <button type="button" className="category-picker-pin" aria-label={`${favorite ? c.unpin : c.pin} ${item.label}`} aria-pressed={favorite} onClick={() => {
    if (!favorite && pinned.size >= FAVORITE_LIMIT) {setLimit(true);return;}setLimit(false);preferences.toggle(item.value);
   }}><Star size={17} fill={favorite ? 'currentColor' : 'none'}/></button>
  </div>;
 })}</div>;
 return createPortal(<div className={`category-picker-layer ${isLight ? 'is-light' : ''} ${closing ? 'is-closing' : ''}`} onClick={event => {if (event.target === event.currentTarget) close();}}>
  <section ref={panelRef} className={`category-picker-sheet ${query.trim() ? 'has-query' : ''}`} style={{'--cp-search-height':`${searchHeight}px`}} role="dialog" aria-modal="true" aria-labelledby={titleId}>
   <div className="category-picker-handle"/>
   <header><div><small>DAYRIS</small><h2 id={titleId}>{c.title}</h2></div><button ref={closeRef} type="button" className="category-picker-close" aria-label={c.close} onClick={() => close()}><X size={21}/></button></header>
   <div className="category-picker-search"><Search size={18}/><input ref={searchRef} aria-label={c.search} placeholder={c.search} value={query} onChange={event => {if (!query.trim()) setSearchHeight(panelRef.current.offsetHeight);setQuery(event.target.value);}} maxLength={120} autoComplete="off" enterKeyHint="search"/>{query && <button type="button" aria-label={`${c.search}: ×`} onClick={() => {setQuery('');searchRef.current?.focus();}}><X size={16}/></button>}</div>
   <div className="category-picker-scroll">
    {query.trim() ? <><p className="category-picker-section-title" role="status">{c.found} · {all.length}</p>{all.length ? rows(all) : <p className="category-picker-empty">{c.empty}</p>}</> : <>
     {allOption && <button type="button" className="category-picker-all-option" onClick={() => close('')}>{allOption}{value === '' && <Check size={16}/>}</button>}
     {favorites.length > 0 && <section><h3 className="category-picker-section-title">{c.favorites}<span>{favorites.length}/{FAVORITE_LIMIT}</span></h3>{rows(favorites,true)}</section>}
     {recent.length > 0 && <section><h3 className="category-picker-section-title">{c.recent}</h3>{rows(recent)}</section>}
     {!favorites.length && <p className="category-picker-tip">{c.tip}</p>}
     <button type="button" className="category-picker-expand" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{c.all}<span>{options.length}</span><ChevronDown size={17} className={expanded ? 'is-expanded' : ''}/></button>
     {expanded && <div className="category-picker-expanded">{rows(all)}</div>}
    </>}
   </div>
   {(canCreate || limit || query.trim().length > 60) && <footer>{limit && <p role="status">{c.limit}</p>}{query.trim().length > 60 && <p role="status">{c.long}</p>}{canCreate && <button type="button" className="category-picker-create" onClick={() => close(query.trim())}><Plus size={18}/><span>{c.create} «{query.trim()}»</span></button>}</footer>}
  </section>
 </div>,document.body);
}

export default function CategoryPicker({options=[],value='',onChange,userId,language='ru',isLight=false,allowCreate=false,allOption,ariaLabel,className='',onOpen}) {
 const [open,setOpen] = useState(false), preferences = useCategoryPreferences(userId);
 const c = copy[language.startsWith('zh') ? 'zh' : ['md','ro'].includes(language) ? 'ro' : language] || copy.ru;
 const selected = options.find(item => normalizeVoiceCategory(item.value) === normalizeVoiceCategory(value));
 const Icon = selected?.icon || Shapes;
 return <div className={`category-picker ${isLight ? 'is-light' : ''} ${className}`}>
  <button type="button" className="category-picker-trigger" aria-label={ariaLabel || c.choose} aria-haspopup="dialog" aria-expanded={open} onClick={() => {onOpen?.();setOpen(true);}}><span className="category-picker-icon"><Icon size={19} strokeWidth={1.6}/></span><span>{selected?.label || value || allOption || c.choose}</span><ChevronDown size={17}/></button>
  {open && <PickerSheet key={userId || 'guest'} options={options} value={value} language={language} isLight={isLight} preferences={preferences} onClose={() => setOpen(false)} onSelect={onChange} allowCreate={allowCreate} allOption={allOption}/>}
 </div>;
}
