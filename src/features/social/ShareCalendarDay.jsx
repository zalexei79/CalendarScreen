import React,{useEffect,useLayoutEffect,useRef,useState} from 'react';
import {CalendarDays,Flame,LockKeyhole,ArrowUpRight,Send,Check,X,RotateCcw,LoaderCircle} from 'lucide-react';
import {supabase} from '../../supabaseClient';
import {syncAccountActivityStreak} from '../../shared/lib/accountActivityStreak.js';
import {chatLocale} from '../messages/chatCopy.js';
import DayHistoryCard from './DayHistoryCard.jsx';
import StreakShareCard from './StreakShareCard.jsx';
import {momentShareCopy} from './momentShareCopy.js';
import './SocialShare.css';

export const dayShareCopy=language=>[momentShareCopy(language).title];
export default function ShareCalendarDay({userId,language,onCancel,onSend,initialKind='day',sending=false,sent=false,recipientName,onExternalShare}){
 const t=momentShareCopy(language),now=new Date(),[kind,setKind]=useState(initialKind==='streak'?'streak':'day'),[mode,setMode]=useState('private');
 const [day,setDay]=useState(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`),[revision,setRevision]=useState(0);
 const [state,setState]=useState({key:'',data:null,error:false}),card=useRef(null),animation=useRef(null);
 const key=kind==='day'?'day:'+day:'streak';
 useEffect(()=>{setKind(initialKind==='streak'?'streak':'day');},[initialKind]);
 useEffect(()=>{
  if(kind==='day'&&!/^\d{4}-\d{2}-\d{2}$/.test(day))return;
  let alive=true;const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
  async function load(){
   try{
    let data;
    if(kind==='streak')data=await syncAccountActivityStreak({client:supabase,storage:localStorage,ownerId:userId,signal:controller.signal});
    else{const response=await supabase.rpc('social_day_history',{p_day:day,p_owner:userId}).abortSignal(controller.signal);if(response.error)throw response.error;data=response.data;if(data?.owner_id!==userId)throw new Error('Owner changed');}
    if(alive)setState({key,data,error:false});
   }catch{if(alive)setState({key,data:null,error:true});}finally{clearTimeout(timer);}
  }
  load();return()=>{alive=false;controller.abort();clearTimeout(timer);};
 },[userId,kind,day,key,revision]);
 useLayoutEffect(()=>{
  animation.current?.cancel();
  if(card.current&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches)animation.current=card.current.animate([{transform:'translateY(8px) scale(.985)',opacity:.65},{transform:'translateY(0) scale(1)',opacity:1}],{duration:340,easing:'cubic-bezier(.2,.7,.2,1)'});
  return()=>animation.current?.cancel();
 },[kind,mode,state.data]);
 const data=state.key===key?state.data:null,failed=state.key===key&&state.error,streak=kind==='streak',disabled=sending||sent;
 const preview=data&&!streak&&(mode==='details'?data:{...data,totals:mode==='amounts'?data.totals:[],records:[],summary:true,amountsVisible:mode==='amounts'});
 const canSend=Boolean(data&&(!streak||data.currentStreak>0)&&!disabled);
 const formattedDay=/^\d{4}-\d{2}-\d{2}$/.test(day)?new Date(day+'T12:00:00').toLocaleDateString(chatLocale(language),{day:'numeric',month:'long'}):t.date;
 function send(){if(canSend)onSend(streak?{kind:'streak'}:{...data,shareDetails:mode==='details',shareAmounts:mode==='amounts'});}
 return <section className={`social-share-panel${sent?' is-sent':''}`} aria-label={t.title} aria-busy={sending}>
  <div className="social-share-top"><div><span className="social-share-eyebrow">DAYRIS · {t.title}</span>{recipientName&&<p><strong>{recipientName}</strong></p>}</div><button type="button" className="social-share-close" onClick={onCancel} disabled={disabled} aria-label={t.close}><X size={18}/></button></div>
  <div className="social-share-kind" role="group" aria-label={t.title} data-kind={kind}><span className="social-share-kind-highlight"/>{[['day',CalendarDays,t.day],['streak',Flame,t.streak]].map(([id,Icon,label])=><button type="button" key={id} aria-pressed={kind===id} disabled={disabled} onClick={()=>setKind(id)}><Icon size={17}/>{label}</button>)}</div>
  <div className="social-share-scroll">
   {!streak&&<label className="social-share-date"><CalendarDays size={15}/><span>{formattedDay}</span><ArrowUpRight size={13}/><input aria-label={t.date} type="date" min="1900-01-01" max="2200-12-31" value={day} disabled={disabled} onChange={e=>setDay(e.target.value)}/></label>}
   <div className="social-share-preview" ref={card}>
    {data?streak?<StreakShareCard data={{days:data.currentStreak,paused:data.paused,day:data.serverDate}} language={language}/>:<DayHistoryCard data={preview} language={language}/>:<div className="social-share-placeholder" role="status">{failed?<><RotateCcw size={25}/><p>{t.loadError}</p><button type="button" onClick={()=>{setState({key:'',data:null,error:false});setRevision(n=>n+1);}}>{t.retry}</button></>:<><span className="social-share-skeleton"/><LoaderCircle size={22} className="social-share-spinner"/></>}</div>}
   </div>
   {!streak&&<><div className="social-share-modes" role="group" aria-label={t.title}>{[['private',LockKeyhole],['amounts',CalendarDays],['details',ArrowUpRight]].map(([id,Icon])=><button type="button" key={id} aria-pressed={mode===id} disabled={disabled} onClick={()=>setMode(id)}><Icon size={14}/><span>{t[id]}</span></button>)}</div><p className="social-share-disclosure" aria-live="polite">{t[mode+'Hint']}</p></>}
   {streak&&data?.currentStreak===0&&<p className="social-share-disclosure">{t.streakEmpty}</p>}
   {streak&&onExternalShare&&<button type="button" className="social-share-outside" disabled={disabled} onClick={onExternalShare}>{t.outside}<ArrowUpRight size={14}/></button>}
  </div>
  <footer className="social-share-footer"><button type="button" className="social-share-submit" disabled={!canSend} onClick={send}>{sent?<Check size={19}/>:sending?<LoaderCircle size={19} className="social-share-spinner"/>:<Send size={18}/>}<span>{sent?t.sent:sending?t.sending:t.send}</span></button><span className="social-share-footer-note"><LockKeyhole size={11}/>{recipientName||'DAYRIS'}</span></footer>
 </section>;
}
