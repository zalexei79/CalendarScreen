import React,{useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {BadgeCheck} from 'lucide-react';
import useProfileVerification from './useProfileVerification.js';
import './VerifiedBadge.css';
const copy={ru:['Официальный профиль','DAYRIS подтвердил подлинность этого профиля.'],uk:['Офіційний профіль','DAYRIS підтвердив справжність цього профілю.'],md:['Profil oficial','DAYRIS a confirmat autenticitatea acestui profil.'],'zh-CN':['官方认证资料','DAYRIS 已确认此资料的真实性。'],en:['Official profile','DAYRIS has confirmed this profile’s authenticity.']};
export function VerifiedMark(){return <BadgeCheck className="dayris-verified-mark" size={19} aria-hidden="true"/>;}
export default function VerifiedBadge({userId,viewerId,language}){
 const verified=useProfileVerification(userId,viewerId),[position,setPosition]=useState(null),button=useRef(null),popup=useRef(null),t=copy[language==='ro'?'md':language]||copy.en;
 useEffect(()=>{if(!position)return;const close=e=>{if(!button.current?.contains(e.target)&&!popup.current?.contains(e.target))setPosition(null);};const escape=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();setPosition(null);button.current?.focus();}};const hide=()=>setPosition(null);document.addEventListener('pointerdown',close,true);document.addEventListener('click',close,true);document.addEventListener('keydown',escape,true);window.addEventListener('resize',hide);window.addEventListener('scroll',hide,true);return()=>{document.removeEventListener('pointerdown',close,true);document.removeEventListener('click',close,true);document.removeEventListener('keydown',escape,true);window.removeEventListener('resize',hide);window.removeEventListener('scroll',hide,true);};},[position]);
 if(!verified)return null;
 return <><button ref={button} type="button" className="dayris-verified-badge" aria-label={t[0]} aria-expanded={Boolean(position)} onClick={e=>{e.stopPropagation();const r=button.current.getBoundingClientRect();setPosition(position?null:{left:Math.max(8,Math.min(innerWidth-268,r.left-120)),top:r.bottom+125>innerHeight?Math.max(8,r.top-115):r.bottom+9});}}><VerifiedMark/></button>{position&&createPortal(<div ref={popup} className="dayris-verified-info" role="status" onClick={e=>e.stopPropagation()} style={position}><VerifiedMark/><div><strong>{t[0]}</strong><p>{t[1]}</p></div></div>,button.current?.closest('dialog')||document.body)}</>;
}
