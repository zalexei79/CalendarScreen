import React, {useEffect, useId, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {Check, ChevronDown, Search, Star, X, Plus, Shapes, Smile, Settings2, Trash2} from 'lucide-react';
import {categoryLibrary, FAVORITE_LIMIT} from '../lib/categoryLibrary.js';
import {normalizeVoiceCategory} from '../lib/voiceCategory.js';
import {getMoneyCategoryMeta} from '../config/constants.js';
import {CATEGORY_ICON_CATALOG,CATEGORY_EMOJIS,categoryEmoji,validCategoryEmoji} from '../lib/categoryIconCatalog.js';
import {categoryIcon,categoryDefaultIcon,categoryIconTone} from './categoryIcons.js';
import {categoryPickerDesignCopy} from './categoryPickerDesignCopy.js';
import useCategoryPreferences from './useCategoryPreferences.js';
import './CategoryPicker.css';

const copy = {
 uk: {title:'Категорії',choose:'Вибрати категорію',search:'Знайти категорію',favorites:'Обрані',recent:'Нещодавні',all:'Усі категорії',empty:'Нічого не знайдено',tip:'Позначте часті категорії зірочкою — вони будуть під рукою.',limit:'Можна закріпити до 6 категорій. Приберіть одну зірочку, щоб додати іншу.',pin:'Закріпити',unpin:'Відкріпити',close:'Закрити категорії',create:'Створити',found:'Знайдено',long:'Назва — до 60 символів'},
 ru: {title:'Разделы',choose:'Выбрать раздел',search:'Найти раздел',favorites:'Избранное',recent:'Недавние',all:'Все разделы',empty:'Ничего не найдено',tip:'Закрепите частые разделы звёздочкой — они будут под рукой.',limit:'Можно закрепить до 6 разделов. Уберите одну звёздочку, чтобы добавить другой.',pin:'Закрепить',unpin:'Открепить',close:'Закрыть разделы',create:'Создать',found:'Найдено',long:'Название — до 60 символов'},
 en: {title:'Categories',choose:'Choose category',search:'Find a category',favorites:'Favorites',recent:'Recent',all:'All categories',empty:'No categories found',tip:'Star your frequent categories to keep them close.',limit:'Pin up to 6 categories. Unpin one to add another.',pin:'Pin',unpin:'Unpin',close:'Close categories',create:'Create',found:'Found',long:'Use up to 60 characters'},
 ro: {title:'Categorii',choose:'Alege categoria',search:'Caută o categorie',favorites:'Favorite',recent:'Recente',all:'Toate categoriile',empty:'Nicio categorie găsită',tip:'Marchează categoriile frecvente cu o stea.',limit:'Poți fixa până la 6 categorii. Elimină o stea pentru a adăuga alta.',pin:'Fixează',unpin:'Elimină',close:'Închide categoriile',create:'Creează',found:'Găsite',long:'Cel mult 60 de caractere'},
 zh: {title:'类别',choose:'选择类别',search:'搜索类别',favorites:'收藏',recent:'最近使用',all:'全部类别',empty:'未找到类别',tip:'点击星标，将常用类别放在手边。',limit:'最多收藏6个类别。请先取消一个收藏。',pin:'收藏',unpin:'取消收藏',close:'关闭类别',create:'创建',found:'找到',long:'名称最多60个字符'},
};
const managementCopy={
 uk:{add:'Додати категорію',name:'Назва категорії',manage:'Керувати категоріями',done:'Готово',remove:'Видалити категорію',cancel:'Скасувати',delete:'Видалити',confirm:'Записи, суми й дати збережуться. Категорію в цих записах буде замінено на «Інше».',hint:'Видаляйте категорії без видалення витрат і доходів.',duplicate:'Така категорія вже є.',failed:'Не вдалося змінити категорію. Спробуйте знову.',busy:'Зберігаємо…'},
 ru:{add:'Добавить раздел',name:'Название раздела',manage:'Управлять разделами',done:'Готово',remove:'Удалить раздел',cancel:'Отмена',delete:'Удалить',confirm:'Записи, суммы и даты сохранятся. Название раздела в этих записях заменится на «Другое».',hint:'Удаляйте разделы без удаления расходов и доходов.',duplicate:'Такой раздел уже есть.',failed:'Не удалось изменить раздел. Попробуйте ещё раз.',busy:'Сохраняю…'},
 en:{add:'Add category',name:'Category name',manage:'Manage categories',done:'Done',remove:'Delete category',cancel:'Cancel',delete:'Delete',confirm:'Entries, amounts and dates stay. Their category will become “Other”.',hint:'Remove categories while keeping expenses and income.',duplicate:'This category already exists.',failed:'Unable to change category. Try again.',busy:'Saving…'},
 ro:{add:'Adaugă categorie',name:'Numele categoriei',manage:'Gestionează categoriile',done:'Gata',remove:'Șterge categoria',cancel:'Anulează',delete:'Șterge',confirm:'Înregistrările, sumele și datele rămân. Categoria lor devine „Altele”.',hint:'Elimină categorii păstrând veniturile și cheltuielile.',duplicate:'Categoria există deja.',failed:'Nu s-a putut modifica categoria. Încearcă din nou.',busy:'Salvez…'},
 zh:{add:'添加类别',name:'类别名称',manage:'管理类别',done:'完成',remove:'删除类别',cancel:'取消',delete:'删除',confirm:'记录、金额和日期将保留。类别名称将改为“其他”。',hint:'删除类别时保留支出和收入记录。',duplicate:'此类别已存在。',failed:'无法修改类别，请重试。',busy:'正在保存…'},
};

function PickerSheet({options,managementOptions,value,language,isLight,preferences,onClose,onSelect,allowCreate,allOption,onCreate,onDelete}) {
 const locale = language.startsWith('zh') ? 'zh' : ['md','ro'].includes(language) ? 'ro' : language;
 const c = copy[locale] || copy.ru, m=managementCopy[locale]||managementCopy.ru, d=categoryPickerDesignCopy(language), titleId = useId(), formId=useId(), searchRef = useRef(null), panelRef = useRef(null), closeRef = useRef(null), timer = useRef(null),actionTimer=useRef(null),mounted=useRef(true),actionBusy=useRef(false);
 const [query,setQuery] = useState(''), [closing,setClosing] = useState(false), [limit,setLimit] = useState(false), [searchHeight,setSearchHeight] = useState(300);
 const [managing,setManaging]=useState(false),[creating,setCreating]=useState(false),[name,setName]=useState(''),[pendingDelete,setPendingDelete]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [editingCategory,setEditingCategory]=useState(null),[iconType,setIconType]=useState('symbol'),[symbolIcon,setSymbolIcon]=useState('shapes'),[emojiDraft,setEmojiDraft]=useState('✨');
 const {favorites,recent,all} = categoryLibrary(managing?managementOptions:options, preferences.profile, query, locale);
 const [filter,setFilter]=useState('all'),[icon,setIcon]=useState('shapes'),[iconGroup,setIconGroup]=useState('universal');
 const validIcon=iconType!=='emoji'||validCategoryEmoji(emojiDraft);
 const quick=[...favorites,...recent].slice(0,FAVORITE_LIMIT);
 const quickIds=new Set(quick.map(item=>normalizeVoiceCategory(item.value)));
 const custom=item=>!getMoneyCategoryMeta(item.value);
 const visible=all.filter(item=>(filter!=='mine'||custom(item))&&(query.trim()||managing||filter==='mine'||!quickIds.has(normalizeVoiceCategory(item.value))));
 const hasCustom=options.some(custom);
 const pinned = new Set(preferences.profile.favorites.map(normalizeVoiceCategory));
 const exact = managementOptions.some(item => [item.value,item.label].some(label => normalizeVoiceCategory(label) === normalizeVoiceCategory(query)));
 const canCreate = (allowCreate||onCreate) && query.trim() && !exact && query.trim().length <= 60;
 const close = (selected) => {
  if (closing || actionBusy.current) return;
  if(selected===undefined&&(pendingDelete||creating)){setPendingDelete(null);setCreating(false);setEditingCategory(null);setError('');requestAnimationFrame(()=>searchRef.current?.focus());return;}
  setClosing(true);
  timer.current = setTimeout(() => {onClose(); if (selected !== undefined) onSelect(selected);}, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 180);
 };
 const closeAction = useRef(close); closeAction.current = close;
 useEffect(() => {
  mounted.current=true;
  const returnFocus = document.activeElement, previousOverflow = document.body.style.overflow;
  const siblings = [...document.body.children].filter(item => !item.contains(panelRef.current));
  const inert = siblings.map(item => [item,item.inert]); siblings.forEach(item => {item.inert = true;});
  document.body.style.overflow = 'hidden';
  (window.matchMedia('(pointer: coarse)').matches ? closeRef.current : searchRef.current)?.focus();
  function keyboard(event) {
   if (event.key === 'Escape') {event.preventDefault();event.stopImmediatePropagation();closeAction.current();}
   if (event.key !== 'Tab') return;
   const focusable = [...panelRef.current.querySelectorAll('button:not(:disabled), input:not(:disabled)')].filter(item => item.getClientRects().length);
   const first = focusable[0], last = focusable.at(-1);
   if (!panelRef.current.contains(document.activeElement)) {event.preventDefault();first?.focus();}
   else if (event.shiftKey && document.activeElement === first) {event.preventDefault();last?.focus();}
   else if (!event.shiftKey && document.activeElement === last) {event.preventDefault();first?.focus();}
  }
  document.addEventListener('keydown',keyboard,true);
  const viewport = window.visualViewport;
  const fit = () => {if (!viewport) return;const layer=panelRef.current.parentElement;layer.style.height=`${viewport.height}px`;layer.style.top=`${viewport.offsetTop}px`;layer.style.bottom='auto';layer.style.setProperty('--cp-viewport',`${viewport.height}px`);};
  fit();viewport?.addEventListener('resize',fit);viewport?.addEventListener('scroll',fit);
  return () => {mounted.current=false;clearTimeout(timer.current);clearTimeout(actionTimer.current);document.removeEventListener('keydown',keyboard,true);viewport?.removeEventListener('resize',fit);viewport?.removeEventListener('scroll',fit);document.body.style.overflow = previousOverflow;inert.forEach(([item,previous]) => {item.inert = previous;});if (returnFocus?.isConnected) returnFocus.focus({preventScroll:true});};
 }, []);
 async function createCategory(raw){
  const next=raw.trim();if(actionBusy.current||!next||next.length>60||!validIcon)return;
  if(editingCategory){preferences.setIcon(editingCategory.value,icon);setEditingCategory(null);setCreating(false);setError('');requestAnimationFrame(()=>searchRef.current?.focus());return;}
  if(managementOptions.some(item=>[item.value,item.label].some(label=>normalizeVoiceCategory(label)===normalizeVoiceCategory(next)))){setError(m.duplicate);return;}
  if(!onCreate){close(next);return;}
  actionBusy.current=true;setBusy(true);setError('');
  try{const canonical=await onCreate(next);if(mounted.current){preferences.setIcon(canonical||next,icon);actionBusy.current=false;setBusy(false);close(canonical||next);}}
  catch{if(mounted.current){setBusy(false);setError(m.failed);}}
  finally{actionBusy.current=false;}
 }
 async function deleteCategory(){
  if(!pendingDelete||actionBusy.current)return;
  actionBusy.current=true;setBusy(true);setError('');
  try{
   await onDelete(pendingDelete.value);
   if(mounted.current){preferences.forget(pendingDelete.value);if(normalizeVoiceCategory(value)===normalizeVoiceCategory(pendingDelete.value))onSelect(allOption?'':'Другое');setPendingDelete(null);setQuery('');}
  }catch{if(mounted.current)setError(m.failed);}
  finally{
   // A second tap must not hit the creation button that replaces confirmation.
   if(mounted.current)actionTimer.current=setTimeout(()=>{actionBusy.current=false;setBusy(false);requestAnimationFrame(()=>{if(mounted.current)searchRef.current?.focus();});},220);
   else actionBusy.current=false;
  }
 }
 const select = item => {preferences.remember(item.value);close(item.value);};
 const startCreating=initial=>{setEditingCategory(null);setName(initial||'');setIcon('shapes');setSymbolIcon('shapes');setIconType('symbol');setEmojiDraft('✨');setIconGroup('universal');setCreating(true);setError('');};
 const editIcon=item=>{const selected=preferences.profile.icons[normalizeVoiceCategory(item.value)]||categoryDefaultIcon(item.value),emoji=categoryEmoji(selected);setEditingCategory(item);setName(item.label);setIcon(selected);setSymbolIcon(emoji?'shapes':selected);setIconType(emoji?'emoji':'symbol');setEmojiDraft(emoji||'✨');setIconGroup(CATEGORY_ICON_CATALOG.find(icon=>icon.id===selected)?.group||'universal');setCreating(true);setError('');};
 const pin=item=>{const favorite=pinned.has(normalizeVoiceCategory(item.value));if(!favorite&&pinned.size>=FAVORITE_LIMIT){setLimit(true);return;}setLimit(false);preferences.toggle(item.value);};
 const rows = (items, compact = false) => <div className={compact ? 'category-picker-quick' : 'category-picker-list'}>{items.map(item => {
  const active = normalizeVoiceCategory(item.value) === normalizeVoiceCategory(value), favorite = pinned.has(normalizeVoiceCategory(item.value)), iconId=preferences.profile.icons[normalizeVoiceCategory(item.value)], Icon = categoryIcon(iconId) || item.icon || Shapes;
  return <div key={item.value} className={`category-picker-row ${active ? 'is-selected' : ''}`} style={{'--ci-hue':categoryIconTone(iconId,item.value)}}>
   <button type="button" className="category-picker-choice" disabled={busy||!!pendingDelete||creating} onClick={() => managing?editIcon(item):select(item)} aria-pressed={active} aria-label={item.label}>
    <span className="category-picker-icon"><Icon size={21} strokeWidth={1.65} aria-hidden="true"/></span><span>{item.label}</span>{active && <Check size={14} className="category-picker-check" aria-hidden="true"/>}
   </button>
   {managing?<><button type="button" className="category-picker-pin" disabled={busy||!!pendingDelete} aria-label={`${favorite ? c.unpin : c.pin} ${item.label}`} aria-pressed={favorite} onClick={()=>pin(item)}><Star size={17} fill={favorite?'currentColor':'none'}/></button>{onDelete&&normalizeVoiceCategory(item.value)!==normalizeVoiceCategory('Другое')&&<button type="button" className="category-picker-pin category-picker-delete" disabled={busy||!!pendingDelete} aria-label={`${m.remove} ${item.label}`} onClick={()=>{setPendingDelete(item);setError('');}}><Trash2 size={17}/></button>}</>:favorite&&<Star size={10} className="category-picker-favorite" fill="currentColor" aria-hidden="true"/>}
  </div>;
 })}</div>;
 return createPortal(<div className={`category-picker-layer ${isLight ? 'is-light' : ''} ${closing ? 'is-closing' : ''}`} onClick={event => {if (event.target === event.currentTarget) close();}}>
  <section ref={panelRef} className={`category-picker-sheet ${query.trim() ? 'has-query' : ''} ${managing?'is-managing':''} ${creating?'is-creating':''}`} style={{'--cp-search-height':`${searchHeight}px`}} role="dialog" aria-modal="true" aria-labelledby={titleId}>
   <div className="category-picker-handle"/>
   <header><div><small>DAYRIS</small><h2 id={titleId}>{editingCategory?d.symbol:creating?m.add:c.title}</h2></div><div className="category-picker-header-actions">{!creating&&<button type="button" className="category-picker-close" disabled={busy||!!pendingDelete} aria-label={managing?m.done:m.manage} aria-pressed={managing} onClick={()=>{setManaging(!managing);setError('');setLimit(false);setFilter('all');}}>{managing?<Check size={19}/>:<Settings2 size={19}/>}</button>}<button ref={closeRef} type="button" className="category-picker-close" disabled={busy} aria-label={c.close} onClick={() => close()}><X size={21}/></button></div></header>
   {!creating&&<div className="category-picker-search"><Search size={18}/><input ref={searchRef} disabled={busy||!!pendingDelete} aria-label={c.search} placeholder={c.search} value={query} onChange={event => {if (!query.trim()) setSearchHeight(panelRef.current.offsetHeight);setQuery(event.target.value);setFilter('all');}} maxLength={120} autoComplete="off" enterKeyHint="search"/>{query && <button type="button" disabled={busy||!!pendingDelete} aria-label={`${c.search}: ×`} onClick={() => {setQuery('');searchRef.current?.focus();}}><X size={16}/></button>}</div>}
   <div className="category-picker-scroll">
    {creating?<form id={formId} className="category-picker-new" onSubmit={event=>{event.preventDefault();createCategory(name);}}>{!editingCategory&&<label>{m.name}<input autoFocus aria-label={m.name} placeholder={d.name} value={name} maxLength={60} disabled={busy} onChange={event=>{setName(event.target.value);setError('');}} enterKeyHint="done"/></label>}
      <div className="category-picker-preview" aria-label={d.preview} style={{'--ci-hue':categoryIconTone(icon)}}><span className="category-picker-icon">{React.createElement(categoryIcon(icon)||Shapes,{size:26,strokeWidth:1.5,'aria-hidden':true})}</span><span>{name.trim()||d.name}</span></div>
      <div className="category-picker-icon-types" role="group" aria-label={d.symbol}>{[['symbol',d.symbols],['emoji',d.emoji]].map(([type,label])=><button type="button" key={type} disabled={busy} aria-pressed={iconType===type} onClick={()=>{setIconType(type);if(type==='symbol')setIcon(symbolIcon);else{const next=validCategoryEmoji(emojiDraft)?emojiDraft:'✨';setEmojiDraft(next);setIcon('emoji:'+next);}}}>{type==='symbol'?<Shapes size={16}/>:<Smile size={16}/>} {label}</button>)}</div>
      {iconType==='symbol'?<><div className="category-picker-icon-groups" role="group" aria-label={d.symbol}>{['universal','daily','money'].map(group=><button type="button" key={group} disabled={busy} aria-pressed={iconGroup===group} onClick={()=>setIconGroup(group)}>{d[group]}</button>)}</div>
      <div className="category-picker-icon-library" role="group" aria-label={d[iconGroup]}>{CATEGORY_ICON_CATALOG.filter(item=>item.group===iconGroup).map(item=>{const Icon=categoryIcon(item.id);return <button type="button" key={item.id} disabled={busy} style={{'--ci-hue':categoryIconTone(item.id)}} aria-label={item.labels[locale]||item.labels.en} aria-pressed={icon===item.id} data-category-icon={item.id} onClick={()=>{setIcon(item.id);setSymbolIcon(item.id);}}><span className="category-picker-icon"><Icon size={23} strokeWidth={1.5} aria-hidden="true"/></span></button>;})}</div></>:<><label className="category-picker-emoji-field">{d.ownEmoji}<input aria-label={d.ownEmoji} aria-invalid={!validIcon} aria-describedby={`${formId}-emoji-help`} value={emojiDraft} maxLength={40} disabled={busy} autoComplete="off" spellCheck={false} onChange={event=>{const next=event.target.value.trim();setEmojiDraft(next);if(validCategoryEmoji(next))setIcon('emoji:'+next);}}/></label><p id={`${formId}-emoji-help`} className="category-picker-tip" role={validIcon?undefined:'alert'}>{validIcon?d.emojiHint:d.emojiError}</p><div className="category-picker-icon-library category-picker-emoji-library" role="group" aria-label={d.emoji}>{CATEGORY_EMOJIS.map(emoji=><button type="button" key={emoji} disabled={busy} aria-label={emoji} aria-pressed={validIcon&&icon==='emoji:'+emoji} data-category-icon={'emoji:'+emoji} onClick={()=>{setEmojiDraft(emoji);setIcon('emoji:'+emoji);}}><span className="category-picker-icon"><span className="category-icon-emoji" aria-hidden="true">{emoji}</span></span></button>)}</div></>}
    </form>:<>
    {managing&&<p className="category-picker-tip">{d.manageHint}</p>}
    {query.trim()||managing ? <><p className="category-picker-section-title" role="status">{query.trim()?c.found:c.all} · {all.length}</p>{all.length ? rows(all) : <p className="category-picker-empty">{c.empty}</p>}</> : <>
     {allOption && <button type="button" className="category-picker-all-option" onClick={() => close('')}>{allOption}{value === '' && <Check size={16}/>}</button>}
     {quick.length>0&&filter==='all'&&<section><h3 className="category-picker-section-title">{d.frequent}<span>{quick.length}</span></h3>{rows(quick,true)}</section>}
     <div className="category-picker-browse-heading"><h3 className="category-picker-section-title">{filter==='mine'?d.mine:c.all}<span>{visible.length}</span></h3>{hasCustom&&!creating&&<div className="category-picker-view-filter" role="group" aria-label={c.all}>{[['all',d.browse],['mine',d.shortMine]].map(([key,label])=><button type="button" key={key} aria-pressed={filter===key} onClick={()=>setFilter(key)}>{label}</button>)}</div>}</div>
     {visible.length>0?rows(visible):<p className="category-picker-empty">{c.empty}</p>}
    </>}
    </>}
   </div>
   {(onCreate||creating||pendingDelete||canCreate||limit||query.trim().length>60||error)&&<footer>
    {error&&<p role="alert">{error}</p>}
    {pendingDelete?<div className="category-picker-confirm"><strong>{m.remove} «{pendingDelete.label}»?</strong><p>{m.confirm}</p><div><button type="button" disabled={busy} onClick={()=>{setPendingDelete(null);setError('');searchRef.current?.focus();}}>{m.cancel}</button><button type="button" className="category-picker-confirm-delete" disabled={busy} onClick={deleteCategory}>{busy?m.busy:m.delete}</button></div></div>
    :creating?<div className="category-picker-create-actions"><button type="button" disabled={busy} onClick={()=>close()}>{m.cancel}</button><button type="submit" form={formId} disabled={busy||!name.trim()||!validIcon}>{busy?m.busy:editingCategory?d.save:c.create}</button></div>
    :<>{limit&&<p role="status">{c.limit}</p>}{query.trim().length>60&&<p role="status">{c.long}</p>}{canCreate?<button type="button" className="category-picker-create" disabled={busy} onClick={()=>startCreating(query)}><Plus size={18}/><span>{c.create} «{query.trim()}»</span></button>:onCreate&&<button type="button" className="category-picker-create" disabled={busy} onClick={()=>startCreating('')}><Plus size={18}/><span>{m.add}</span></button>}</>}
   </footer>}
  </section>
 </div>,document.body);
}

export default function CategoryPicker({options=[],managementOptions=options,value='',onChange,userId,language='ru',isLight=false,allowCreate=false,allOption,ariaLabel,className='',onOpen,onCreate,onDelete}) {
 const [open,setOpen] = useState(false), preferences = useCategoryPreferences(userId);
 const c = copy[language.startsWith('zh') ? 'zh' : ['md','ro'].includes(language) ? 'ro' : language] || copy.ru;
 const selected = options.find(item => normalizeVoiceCategory(item.value) === normalizeVoiceCategory(value));
 const Icon = categoryIcon(preferences.profile.icons[normalizeVoiceCategory(value)]) || selected?.icon || Shapes;
 return <div className={`category-picker ${isLight ? 'is-light' : ''} ${className}`} style={{'--ci-hue':categoryIconTone(preferences.profile.icons[normalizeVoiceCategory(value)],value)}}>
  <button type="button" className="category-picker-trigger" aria-label={ariaLabel || c.choose} aria-haspopup="dialog" aria-expanded={open} onClick={() => {onOpen?.();setOpen(true);}}><span className="category-picker-icon"><Icon size={19} strokeWidth={1.6}/></span><span>{selected?.label || value || allOption || c.choose}</span><ChevronDown size={17}/></button>
  {open && <PickerSheet key={userId || 'guest'} options={options} managementOptions={managementOptions} value={value} language={language} isLight={isLight} preferences={preferences} onClose={() => setOpen(false)} onSelect={onChange} allowCreate={allowCreate} allOption={allOption} onCreate={onCreate} onDelete={onDelete}/>}
 </div>;
}
