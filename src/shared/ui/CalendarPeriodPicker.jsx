import React,{useEffect,useId,useRef,useState} from 'react';
import {ChevronLeft,ChevronRight} from 'lucide-react';
import AnimatedMonthLabel from './AnimatedMonthLabel.jsx';
import CalendarAnchoredPopover from './CalendarAnchoredPopover.jsx';
import {monthsFor} from '../i18n';
import {localeKey} from '../i18n/locale.js';

const COPY={
  ru:{month:'Выберите месяц',year:'Выберите год',previousYear:'Предыдущий год',nextYear:'Следующий год',previousPage:'Предыдущие 12 лет',nextPage:'Следующие 12 лет'},
  uk:{month:'Виберіть місяць',year:'Виберіть рік',previousYear:'Попередній рік',nextYear:'Наступний рік',previousPage:'Попередні 12 років',nextPage:'Наступні 12 років'},
  en:{month:'Choose a month',year:'Choose a year',previousYear:'Previous year',nextYear:'Next year',previousPage:'Previous 12 years',nextPage:'Next 12 years'},
  ro:{month:'Alege luna',year:'Alege anul',previousYear:'Anul precedent',nextYear:'Anul următor',previousPage:'Precedenții 12 ani',nextPage:'Următorii 12 ani'},
  zh:{month:'选择月份',year:'选择年份',previousYear:'上一年',nextYear:'下一年',previousPage:'前12年',nextPage:'后12年'},
};
export default function CalendarPeriodPicker({month,year,language,isLight,monthMenuOpen,yearMenuOpen,setMonthMenuOpen,setYearMenuOpen,monthMenuRef,yearMenuRef,setViewMonth,setViewYear,setSelectedKey}){
  const copy=COPY[localeKey(language)],months=monthsFor(language),id=useId();
  const monthAnchor=useRef(null),yearAnchor=useRef(null),gesture=useRef(null),suppressClick=useRef(false);
  const [browseYear,setBrowseYear]=useState(year),[firstYear,setFirstYear]=useState(Math.max(1,year-5)),[direction,setDirection]=useState(1);
  useEffect(()=>{if(monthMenuOpen)setBrowseYear(year);},[monthMenuOpen,year]);
  useEffect(()=>{if(yearMenuOpen)setFirstYear(Math.max(1,Math.min(9988,year-5)));},[yearMenuOpen,year]);
  const lastKind=useRef('month');
  if(monthMenuOpen)lastKind.current='month';else if(yearMenuOpen)lastKind.current='year';
  const kind=lastKind.current;
  function page(delta){setDirection(delta);if(kind==='month')setBrowseYear(value=>Math.max(1,Math.min(9999,value+delta)));else setFirstYear(value=>Math.max(1,Math.min(9988,value+delta*12)));}
  function select(value){if(kind==='month'){setViewYear(browseYear);setViewMonth(value);setMonthMenuOpen(false);}else{setViewYear(value);setYearMenuOpen(false);}setSelectedKey(null);}
  const open=monthMenuOpen||yearMenuOpen;
  useEffect(()=>{if(open&&document.activeElement===document.body){const panel=document.getElementById(id);(panel?.querySelector('.calendar-picker-options [aria-pressed="true"]')||panel?.querySelector('.calendar-picker-options button'))?.focus({preventScroll:true});}},[open,browseYear,firstYear,id]);
  function finishSwipe(event){
    const start=gesture.current;gesture.current=null;
    if(start&&Math.abs(event.clientX-start.x)>48&&Math.abs(event.clientX-start.x)>Math.abs(event.clientY-start.y)*1.4){suppressClick.current=true;page(event.clientX<start.x?1:-1);}
  }
  function keys(event,node){
    const buttons=[...node.querySelectorAll('.calendar-picker-options button')],index=buttons.indexOf(document.activeElement),columns=kind==='month'?3:4;
    const movement={ArrowLeft:-1,ArrowRight:1,ArrowUp:-columns,ArrowDown:columns};
    if(event.key==='PageUp'||event.key==='PageDown'){event.preventDefault();page(event.key==='PageUp'?-1:1);return;}
    if(event.key in movement||event.key==='Home'||event.key==='End'){
      event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?buttons.length-1:(Math.max(0,index)+movement[event.key]+buttons.length)%buttons.length;buttons[next]?.focus();
    }
  }
  return <div className="dayris-month-title flex items-baseline gap-1.5 sm:gap-2 min-w-0">
    <div className="relative" ref={monthMenuRef}><button type="button" ref={monthAnchor} className={`dayris-month-trigger font-display font-semibold transition-colors ${isLight?'text-zinc-900':'text-zinc-50'}`} aria-label={`${copy.month}: ${months[month]}`} aria-haspopup="dialog" aria-expanded={monthMenuOpen} aria-controls={open?id:undefined} onClick={()=>{setMonthMenuOpen(!monthMenuOpen);setYearMenuOpen(false);}}><AnimatedMonthLabel year={year} month={month} label={months[month]}/></button></div>
    <div className="relative" ref={yearMenuRef}><button type="button" ref={yearAnchor} className={`dayris-year-trigger font-display font-semibold transition-colors ${isLight?'text-zinc-600':'text-zinc-500'}`} aria-label={`${copy.year}: ${year}`} aria-haspopup="dialog" aria-expanded={yearMenuOpen} aria-controls={open?id:undefined} onClick={()=>{setYearMenuOpen(!yearMenuOpen);setMonthMenuOpen(false);}}>{year}</button></div>
    <CalendarAnchoredPopover open={open} onClose={()=>{setMonthMenuOpen(false);setYearMenuOpen(false);}} anchorRef={monthMenuOpen?monthAnchor:yearAnchor} id={id} label={copy[kind]} className="calendar-period-menu" isLight={isLight} onKeyDown={keys}>
      <div className="calendar-picker-heading"><div><span>{copy[kind]}</span><strong aria-live="polite">{kind==='month'?browseYear:`${firstYear} – ${firstYear+11}`}</strong></div>
        <button type="button" aria-label={kind==='month'?copy.previousYear:copy.previousPage} disabled={kind==='month'?browseYear<=1:firstYear<=1} onClick={()=>page(-1)}><ChevronLeft size={17}/></button>
        <button type="button" aria-label={kind==='month'?copy.nextYear:copy.nextPage} disabled={kind==='month'?browseYear>=9999:firstYear>=9988} onClick={()=>page(1)}><ChevronRight size={17}/></button>
      </div>
      <div key={`${kind}-${kind==='month'?browseYear:firstYear}`} className="calendar-picker-options" data-kind={kind} style={{'--picker-direction':direction}} onPointerDown={event=>{gesture.current={x:event.clientX,y:event.clientY};suppressClick.current=false;}} onPointerUp={finishSwipe} onPointerCancel={()=>{gesture.current=null;}} onClickCapture={event=>{if(suppressClick.current&&event.detail!==0){event.preventDefault();event.stopPropagation();suppressClick.current=false;}}}>
        {Array.from({length:12},(_,index)=>kind==='month'?<button key={index} type="button" data-month={index} aria-pressed={year===browseYear&&month===index} onClick={()=>select(index)}><span>{months[index]}</span><small>{String(index+1).padStart(2,'0')}</small></button>:<button key={index+firstYear} type="button" data-year={index+firstYear} aria-pressed={year===index+firstYear} onClick={()=>select(index+firstYear)}>{index+firstYear}</button>)}
      </div>
    </CalendarAnchoredPopover>
  </div>;
}
