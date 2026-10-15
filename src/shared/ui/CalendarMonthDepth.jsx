import React,{useEffect,useMemo,useRef,useState,useCallback} from 'react';
import {ChevronDown,X} from 'lucide-react';
import {summarizeCalendarEntries,monthBriefCopy} from './CalendarMonthBrief.jsx';
import {formatMoney} from '../../features/capital/decimal.js';
import './CalendarMonthDepth.css';
function useMonthValues(summary,currency,language){
 const locale=String(language).startsWith('zh')?'zh':['ro','md'].includes(language)?'ro':language==='en'?'en':'ru';
 const stats=useMemo(()=>summarizeCalendarEntries(summary?.entries||[]),[summary]);
 const money=value=>formatMoney(value,currency,locale);
 return {stats,money,c:monthBriefCopy[locale],result:stats.invalid?'—':`${stats.net>0n?'+':''}${money(stats.net)}`,sign:stats.net>0n?'positive':stats.net<0n?'negative':'neutral'};
}
export function MonthDepthTrigger({summary,currency,language,traderMode,open,onToggle}){
 const {stats,c,result,sign}=useMonthValues(summary,currency,language);
 return <button type="button" className="month-depth-trigger" data-sign={sign} aria-expanded={open} aria-controls="calendar-month-depth" aria-label={`${traderMode?c.result:c.title}: ${stats.count?result:c.empty}`} onClick={onToggle}><small>{traderMode?c.result:c.title}</small><span>{stats.count?result:'—'}<ChevronDown size={12} aria-hidden="true"/></span></button>;
}
export default function CalendarMonthDepth({summary,currency,language,traderMode,isLight,open,onClose,filtered,monthLabel,children}){
 const {stats,c,result,sign,money}=useMonthValues(summary,currency,language);
 const panel=useRef(null),previous=useRef(null),[changed,setChanged]=useState(false);
 const previousResult=useRef(result);
 const [goalState,setGoalState]=useState({progress:0,goal:0,achieved:false});
 const reportGoal=useCallback(value=>setGoalState(value),[]);
 useEffect(()=>{
  if(previousResult.current===result)return;
  previousResult.current=result;setChanged(true);const timer=setTimeout(()=>setChanged(false),850);return()=>clearTimeout(timer);
 },[result]);
 useEffect(()=>{
  if(!open)return;
  previous.current=document.activeElement;panel.current?.querySelector('button')?.focus({preventScroll:true});
  const key=event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();onClose();}};
  document.addEventListener('keydown',key,true);
  return()=>{document.removeEventListener('keydown',key,true);if(previous.current?.isConnected)previous.current.focus({preventScroll:true});};
 },[open,onClose]);
 return <div className="month-depth" data-open={open} data-empty={!stats.count} data-light={isLight} data-sign={sign} data-changed={changed}>
  {goalState.goal>0&&<div className="month-depth-track" aria-hidden="true"><i style={{width:`${goalState.progress}%`}} data-achieved={goalState.achieved}/></div>}
  {open&&<button className="month-depth-scrim" type="button" tabIndex={-1} aria-label={c.title} onClick={onClose}/>}
  <div className="month-depth-surface" ref={panel} id="calendar-month-depth" role={open?'region':undefined} aria-label={open?c.title:undefined}>
   {open&&<button type="button" className="month-depth-close" aria-label={language==='ru'?'Закрыть итог':language==='en'?'Close summary':['ro','md'].includes(language)?'Închide rezumatul':'关闭概览'} onClick={onClose}><X size={17}/></button>}
   <div className="month-depth-hero" aria-hidden={!open} style={{'--depth-digits':Math.max(8,result.length)}}><span>{monthLabel}</span><strong>{stats.count?result:'—'}</strong><small>{traderMode?c.result:c.title}</small></div>
   <div className="month-depth-content" inert={open?undefined:''} aria-hidden={!open}>
    <div className="month-depth-stats"><div><span>{traderMode?c.profit:c.income}</span><b>{traderMode?stats.wins:money(stats.income)}</b></div><div><span>{traderMode?c.loss:c.expense}</span><b>{traderMode?stats.losses:money(stats.expense)}</b></div></div>
    <p className="month-depth-scope">{c.scope} {currency} · {c.records}: {stats.count}{filtered?` · ${c.filtered}`:''}</p>
    {stats.invalid>0&&<p role="status">{c.incomplete}</p>}
    {React.isValidElement(children)?React.cloneElement(children,{onProgress:reportGoal}):children}
   </div>
  </div>
 </div>;
}
