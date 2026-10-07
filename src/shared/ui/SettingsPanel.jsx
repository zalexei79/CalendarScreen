import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight, Check, Sun, Moon, Monitor, Languages, CircleDollarSign, Mic, Play, Sparkles, User, LogOut, ShieldCheck, Info, RotateCcw } from 'lucide-react';
import SwipeDismissSheet from './SwipeDismissSheet.jsx';
import VoiceSettings from './VoiceSettings.jsx';
import BrandIcon from './BrandIcon.jsx';
import LoginButtons from '../../features/auth/LoginButtons.jsx';
import { CURRENCIES } from '../config/constants.js';
import './SettingsPanel.css';

const COPY = {
  ru: { app:'Приложение', personal:'Персонализация', account:'Аккаунт', about:'О приложении', theme:'Оформление', language:'Язык', currency:'Валюта новых записей',calendar:'Календарь',help:'Помощь и о DAYRIS',storyHint:'Короткий обзор ваших записей',currencyHint:'Используется для новых записей. Валюта просмотра меняется рядом с месяцем.', voice:'Голос и ввод', story:'Моя история', watch:'Посмотреть', restart:'Повторить знакомство', profile:'Профиль', active:'Активен', learn:'Подробнее', guest:'Знакомство с DAYRIS', guestHint:'Войди, чтобы сохранять свои записи.', light:'Светлое', system:'Системное', dark:'Тёмное', purple:'Фиолетовое', emerald:'Изумрудное', systemHint:'Следует оформлению устройства.', close:'Закрыть настройки', description:'Доходы, расходы и твой финансовый ритм — в одном календаре.', currencies:['Доллар США','Евро','Молдавский лей','Российский рубль','Китайский юань'] },
  en: { app:'Application', personal:'Personalization', account:'Account', about:'About', theme:'Appearance', language:'Language', currency:'New entry currency',calendar:'Calendar',help:'Help & DAYRIS',storyHint:'A quick overview of your records',currencyHint:'Used for new entries. Change the calendar currency beside the month.', voice:'Voice & input', story:'My story', watch:'Watch', restart:'Repeat introduction', profile:'Profile', active:'Active', learn:'Learn more', guest:'Discover DAYRIS', guestHint:'Sign in to save your own entries.', light:'Light', system:'System', dark:'Dark', purple:'Purple', emerald:'Emerald', systemHint:'Follows your device appearance.', close:'Close settings', description:'Income, expenses and your financial rhythm — in one calendar.', currencies:['US dollar','Euro','Moldovan leu','Russian ruble','Chinese yuan'] },
  ro: { app:'Aplicație', personal:'Personalizare', account:'Cont', about:'Despre aplicație', theme:'Aspect', language:'Limbă', currency:'Moneda înregistrărilor noi',calendar:'Calendar',help:'Ajutor și DAYRIS',storyHint:'O privire rapidă asupra înregistrărilor tale',currencyHint:'Folosită pentru înregistrări noi. Moneda calendarului se schimbă lângă lună.', voice:'Voce și introducere', story:'Povestea mea', watch:'Privește', restart:'Repetă introducerea', profile:'Profil', active:'Activ', learn:'Detalii', guest:'Descoperă DAYRIS', guestHint:'Autentifică-te pentru a salva înregistrările.', light:'Luminos', system:'Sistem', dark:'Întunecat', purple:'Violet', emerald:'Smarald', systemHint:'Urmează aspectul dispozitivului.', close:'Închide setările', description:'Venituri, cheltuieli și ritmul tău financiar — într-un calendar.', currencies:['Dolar american','Euro','Leu moldovenesc','Rublă rusească','Yuan chinezesc'] },
  zh: { app:'应用', personal:'个性化', account:'账户', about:'关于应用', theme:'外观', language:'语言', currency:'新记录货币',calendar:'日历',help:'帮助与 DAYRIS',storyHint:'你的记录概览',currencyHint:'用于新记录。在月份旁切换日历货币。', voice:'语音和输入', story:'我的故事', watch:'查看', restart:'重新查看介绍', profile:'个人资料', active:'已启用', learn:'了解更多', guest:'认识 DAYRIS', guestHint:'登录以保存你的记录。', light:'浅色', system:'跟随系统', dark:'深色', purple:'紫色', emerald:'翡翠绿', systemHint:'跟随设备的外观设置。', close:'关闭设置', description:'在一个日历中记录收入、支出和财务节奏。', currencies:['美元','欧元','摩尔多瓦列伊','俄罗斯卢布','人民币'] },
};
const LANGUAGES = [{code:'ru',label:'Русский'}, {code:'en',label:'English'}, {code:'md',label:'Română'}, {code:'zh-CN',label:'中文'}];

function Row({ icon: Icon, label, value, onClick }) {
  return <button type="button" className="settings-row" onClick={onClick}><Icon size={18} aria-hidden="true"/><span>{label}</span>{value && <small>{value}</small>}<ChevronRight size={15} aria-hidden="true"/></button>;
}
function Group({ title, children }) { return <section className="settings-group"><h3>{title}</h3>{children}</section>; }

export default function SettingsPanel({ t, language, setLanguage, currency, setCurrency, theme, themePreference = theme, setTheme, isLight, user, handleGoogleLogin, handleTelegramLogin, handleGoogleLogout, loginPending, loginError, proAccessActive, proAccessLoading, onPro, onStory, onRestart, onClose, visible, anchorRef }) {
  const locale = language.startsWith('zh') ? 'zh' : ['md','ro'].includes(language) ? 'ro' : language === 'en' ? 'en' : 'ru';
  const copy = COPY[locale];
  const [page, setPage] = useState('root');
  const [direction, setDirection] = useState('forward');
  const [position, setPosition] = useState({ top: 86, right: 20 });
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width: 767px)').matches);
  const panel = useRef(null);
  const heading = useRef(null);
  const name = user?.user_metadata?.nickname || user?.user_metadata?.full_name || user?.user_metadata?.name || user?.user_metadata?.preferred_username || user?.email || copy.guest;
  const parentPage = page === 'about' ? 'help' : 'root';
  const navigate = (next, back = false) => { setDirection(back || next === 'root' ? 'back' : 'forward'); setPage(next); };
  useLayoutEffect(() => {
    const place = () => { setMobile(window.matchMedia('(max-width: 767px)').matches); const rect = anchorRef?.current?.getBoundingClientRect(); if (rect) setPosition({ top: Math.min(rect.bottom + 12, 100), right: Math.max(16, innerWidth - rect.right) }); };
    place(); window.addEventListener('resize', place); return () => window.removeEventListener('resize', place);
  }, [anchorRef]);
  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    const appRoot = document.getElementById('root');
    const previousInert = appRoot?.inert;
    if (appRoot) appRoot.inert = true;
    document.body.style.overflow = 'hidden';
    panel.current?.querySelector('button')?.focus();
    return () => { document.body.style.overflow = previousOverflow; if (appRoot) appRoot.inert = previousInert; if (previousFocus?.isConnected) previousFocus.focus?.(); };
  }, []);
  useEffect(() => { heading.current?.focus(); panel.current?.querySelector('.settings-content')?.scrollTo(0, 0); }, [page]);
  function keyboard(event) {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); page === 'root' ? onClose() : navigate(parentPage, true); }
    if (event.key !== 'Tab') return;
    const focusable = [...panel.current.querySelectorAll('button:not(:disabled), a[href], select, input')].filter(el => el.getClientRects().length);
    const first = focusable[0], last = focusable.at(-1);
    if (event.shiftKey && (document.activeElement === first || document.activeElement === heading.current)) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && (document.activeElement === last || document.activeElement === heading.current)) { event.preventDefault(); first?.focus(); }
  }
  function action(callback) { onClose(); callback?.(); }
  const title = page === 'root' ? t('settings') : page === 'pro' ? 'DAYRIS PRO' : copy[page];
  const choices = page === 'language' ? LANGUAGES.map(item => ({...item, selected: language === item.code, choose: () => setLanguage(item.code)})) : page === 'currency' ? CURRENCIES.map((item,index) => ({code:item.code,label:`${item.code} — ${copy.currencies[index]}`,symbol:item.symbol,selected:currency===item.code,choose:()=>setCurrency(item.code)})) : page === 'theme' ? [{code:'light',label:copy.light,icon:Sun},{code:'system',label:copy.system,icon:Monitor},{code:'dark',label:copy.dark,icon:Moon},{code:'purple',label:copy.purple,icon:Sparkles},{code:'emerald',label:copy.emerald,icon:Sparkles}].map(item => ({...item,selected:themePreference===item.code,choose:()=>setTheme(item.code)})) : [];
  return createPortal(<div className={`settings-overlay${visible ? ' is-visible' : ''}`} data-dayris-settings onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <SwipeDismissSheet ref={panel} className="dayris-settings-panel settings-surface" style={{'--settings-top':`${position.top}px`,'--settings-right':`${position.right}px`}} isLight={isLight} onDismiss={onClose} disabled={!mobile} handleClassName="settings-drag-handle" role="dialog" aria-modal="true" aria-labelledby="settings-title" onKeyDown={keyboard}>
      <div className="settings-toolbar">{page !== 'root' ? <button type="button" className="settings-back" onClick={()=>navigate(parentPage,true)}><ChevronLeft size={18}/>{parentPage==='help'?copy.help:t('settings')}</button> : <span className="settings-wordmark">DAYRIS</span>}<button type="button" className="settings-close" aria-label={copy.close} onClick={onClose}><X size={19}/></button></div>
      <div className={`settings-content settings-view-${direction}`} key={page}>
        <h2 ref={heading} tabIndex={-1} id="settings-title">{title}</h2>
        {page === 'root' && <>

          {user ? <button type="button" className="settings-identity settings-account-card" aria-label={copy.profile} onClick={()=>navigate('profile')}><div className="settings-avatar">{name.charAt(0).toUpperCase()}</div><div><strong>{name}</strong><p>{user.email || copy.profile}</p><span className="settings-membership">{proAccessActive?'DAYRIS PRO':'DAYRIS FREE'}</span></div><ChevronRight size={16} aria-hidden="true"/></button> : <><div className="settings-identity"><div className="settings-avatar"><User size={22}/></div><div><strong>{copy.guest}</strong><p>{copy.guestHint}</p></div></div><div className="settings-auth"><LoginButtons t={t} handleGoogleLogin={handleGoogleLogin} handleTelegramLogin={handleTelegramLogin} loginPending={loginPending} loginError={loginError}/></div></>}
          <Group title={copy.theme}><div className="settings-theme-gallery" role="group" aria-label={copy.theme}>{['light','system','dark','purple','emerald'].map(code=><button type="button" key={code} className={'settings-theme-tile'+(themePreference===code?' is-selected':'')} aria-label={copy[code]} aria-pressed={themePreference===code} onClick={()=>setTheme(code)}><span className="settings-theme-sample" data-theme={code}><i/><i/><i/><i/>{themePreference===code&&<Check size={12}/>}</span><span>{copy[code]}</span></button>)}</div></Group>
          <Group title={copy.calendar}><Row icon={CircleDollarSign} label={copy.currency} value={currency} onClick={()=>navigate('currency')}/><Row icon={Languages} label={copy.language} value={LANGUAGES.find(item=>item.code===language)?.label} onClick={()=>navigate('language')}/><Row icon={Mic} label={copy.voice} onClick={()=>navigate('voice')}/></Group>
          {onStory && <button type="button" className="settings-story-card" onClick={()=>action(onStory)}><Play size={18} aria-hidden="true"/><span><strong>{copy.story}</strong><small>{copy.storyHint}</small></span><ChevronRight size={15} aria-hidden="true"/></button>}
          <Row icon={Info} label={copy.help} onClick={()=>navigate('help')}/>
          {!user && <Row icon={Sparkles} label="DAYRIS PRO" value={copy.learn} onClick={()=>action(onPro)}/>}
        </>}
        {choices.length > 0 && <div className="settings-choices" role="group" aria-label={title}>{choices.map(({code,label,icon:Icon,symbol,selected,choose})=><button type="button" key={code} className={`settings-choice${selected?' is-selected':''}`} aria-pressed={selected} onClick={choose}>{Icon && <Icon size={21}/>} {symbol && <span className="settings-choice-symbol">{symbol}</span>}<span>{label}</span>{selected && <Check size={19}/>}</button>)}{page==='theme' && <p className="settings-note">{copy.systemHint}</p>}</div>}
        {page==='voice' && <VoiceSettings language={language} isLight={isLight}/>}
        {page==='help' && <Group title={copy.help}><Row icon={RotateCcw} label={copy.restart} onClick={()=>action(onRestart)}/><Row icon={Info} label={locale==='ru'?'О DAYRIS':locale==='zh'?'关于 DAYRIS':locale==='ro'?'Despre DAYRIS':'About DAYRIS'} onClick={()=>navigate('about')}/><a className="settings-row" href={locale==='zh'?'/privacy-zh.html':'/privacy.html'} target="_blank" rel="noreferrer"><ShieldCheck size={18}/><span>{t('privacyPolicy')}</span><ChevronRight size={15}/></a></Group>}
        {page==='currency' && <p className="settings-note">{copy.currencyHint}</p>}
        {page==='profile' && <div className="settings-profile"><div className="settings-avatar">{name.charAt(0).toUpperCase()}</div><h3>{name}</h3>{user?.email && <p>{user.email}</p>}<Row icon={Sparkles} label="DAYRIS PRO" value={proAccessLoading?'…':proAccessActive?copy.active:copy.learn} onClick={()=>action(onPro)}/><button className="settings-row" onClick={()=>action(handleGoogleLogout)}><LogOut size={18}/>{t('signOut')}</button><a className="settings-delete" href={locale==='zh'?'/delete-account-zh.html':'/delete-account.html'} target="_blank" rel="noreferrer">{t('deleteAccountData')}</a></div>}
        {page==='about' && <div className="settings-about"><BrandIcon className="h-20 w-20"/><h3>DAYRIS</h3><p>{copy.description}</p></div>}
      </div>
    </SwipeDismissSheet>
  </div>, document.body);
}
