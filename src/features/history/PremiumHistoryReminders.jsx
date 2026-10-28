import React, {useState} from 'react';
import {Plus} from 'lucide-react';
import FinancePlanList from '../reminders/FinancePlanList.jsx';
import {planDateKey} from '../reminders/useFinancePlans.js';
import {intlLocale} from '../../shared/i18n/locale.js';
import {premiumHistoryChapterCopy} from './premiumHistoryChapterCopy.js';
import {premiumHistoryCopy} from './premiumHistoryCopy.js';

export default function PremiumHistoryReminders({plans, currency, todayKey, language, isLight, onAdd, onEdit, onDelete, onResolve, loading, error}) {
  const [expanded,setExpanded]=useState(false), c=premiumHistoryChapterCopy(language), copy=premiumHistoryCopy(language);
  const active=plans.filter(plan=>plan.status==='active' && plan.outcome==='planned' && (currency==='ALL'||!plan.currency||plan.currency===currency)).sort((a,b)=>planDateKey(a).localeCompare(planDateKey(b)));
  const groups=new Map();
  for(const plan of expanded?active:active.slice(0,3)) {const key=planDateKey(plan),items=groups.get(key)||[];items.push(plan);groups.set(key,items);}
  const date=key=>new Intl.DateTimeFormat(intlLocale(language),{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(key+'T12:00:00Z'));
  return <section className="premium-history-reminders"><h3>{c.reminders}</h3>
    {(loading||error) && <p className="premium-history-hint" role={error?'alert':'status'}>{error||'…'}</p>}
    {!loading&&!error&&!active.length && <p className="premium-history-hint">{c.noReminders}</p>}
    {[...groups].map(([key,items])=><React.Fragment key={key}><h4>{date(key)}</h4><FinancePlanList plans={items} todayKey={todayKey} language={language} isLight={isLight} onEdit={onEdit} onDelete={onDelete} onResolve={onResolve}/></React.Fragment>)}
    {active.length>3 && <button type="button" className="premium-history-more" aria-expanded={expanded} onClick={()=>setExpanded(value=>!value)}>{expanded?copy.less:`${copy.more} · ${active.length-3}`}</button>}
    <button type="button" className="premium-history-more" onClick={onAdd}><Plus size={15}/>{c.addReminder}</button>
  </section>;
}
