import React from 'react';
import {CalendarDays,LockKeyhole} from 'lucide-react';
import {chatLocale} from '../messages/chatCopy.js';
import {momentShareCopy} from './momentShareCopy.js';
import './SocialShare.css';

export default function DayHistoryCard({data,language}){
 const locale=chatLocale(language),t=momentShareCopy(language),date=new Date(data.day+'T12:00:00');
 const money=(value,currency)=>new Intl.NumberFormat(locale,{maximumFractionDigits:2,signDisplay:'exceptZero'}).format(Number(value||0))+' '+(currency||'');
 if(data.summary)return <article className="social-moment-card social-day-card">
  <header><span>DAYRIS</span><span>{t.dayTag}</span></header>
  <div className="social-day-date"><strong>{new Intl.NumberFormat(locale,{minimumIntegerDigits:2}).format(date.getDate())}</strong><span>{new Intl.DateTimeFormat(locale,{day:'numeric',month:'long'}).formatToParts(date).find(part=>part.type==='month')?.value}</span></div>
  <p className="social-day-weekday">{date.toLocaleDateString(locale,{weekday:'long'})} · {date.getFullYear()}</p>
  <div className="social-day-count"><span>{t.entries}</span><strong>{data.entries}</strong></div>
  {data.amountsVisible?<div className="social-day-amounts">{data.totals.map(total=><span key={total.currency}>{money(total.amount,total.currency)}</span>)}</div>:<footer><LockKeyhole size={12}/>{t.hidden}</footer>}
 </article>;
 return <section className="day-history-card"><header><CalendarDays size={20}/><div><small>DAYRIS · {t.day}</small><strong>{date.toLocaleDateString(locale,{day:'numeric',month:'long',year:'numeric'})}</strong></div><b>{data.entries}</b></header><div className="day-history-totals">{data.totals.map(total=><span key={total.currency}>{money(total.amount,total.currency)}</span>)}</div><div className="day-history-records">{data.records.map((record,index)=><article key={record.id||index}><div><time>{record.time?.slice(0,5)||'—'}</time><strong>{record.instrument||'DAYRIS'}</strong><b data-negative={Number(record.pnl)<0}>{money(record.pnl,record.currency)}</b></div>{record.comment&&<p>{record.comment}</p>}{record.direction&&<small>{record.direction} · {record.platform}</small>}</article>)}</div></section>;
}
