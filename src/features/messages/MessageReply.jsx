import React,{useEffect,useRef,useState} from 'react';
import {supabase} from '../../supabaseClient';
import {cardLabels} from './messageCardModel.js';
export default function MessageReply({message,t,onBack,onClose,onBusy,onSent}){
 const c=cardLabels(message,t),[body,setBody]=useState(''),[sent,setSent]=useState(null),[previous,setPrevious]=useState([]),[busy,setBusy]=useState(false),[error,setError]=useState(false);
 const alive=useRef(true),request=useRef(null),locked=useRef(false);
 useEffect(()=>{alive.current=true;supabase.rpc('creator_own_replies',{p_id:message.id}).then(({data,error})=>{if(alive.current&&!error)setPrevious(data||[]);}).catch(()=>{});return()=>{alive.current=false;};},[message.id]);
 async function send(e){e.preventDefault();if(locked.current||!body.trim())return;locked.current=true;setBusy(true);onBusy(true);setError(false);
  if(request.current?.body!==body.trim())request.current={id:crypto.randomUUID(),body:body.trim()};
  try{const {data,error}=await supabase.rpc('creator_reply',{p_id:message.id,p_body:request.current.body,p_request_id:request.current.id});if(!alive.current)return;if(error)throw error;setSent(data);onSent();}
  catch{if(alive.current)setError(true);}finally{locked.current=false;if(alive.current){setBusy(false);onBusy(false);}}
 }
 return <section className="creator-reply-form"><h2 id="creator-inbox-title">{sent?c.replySentLabel:c.replyTitle}</h2>{sent?<><p className="creator-reply-sent">{sent.body}</p><button type="button" className="creator-thanks" onClick={onClose}>{c.button}</button></>:<form onSubmit={send}>
  {previous.length>0&&<details><summary>{c.replySentLabel} · {previous.length}</summary>{previous.map(r=><p className="creator-reply-sent" key={r.id}>{r.body}</p>)}</details>}
  <textarea aria-label={c.replyTitle} placeholder={c.replyPlaceholder} maxLength={2000} value={body} disabled={busy} onChange={e=>setBody(e.target.value)} required/>
  {error&&<p role="alert">{c.replyErrorLabel}</p>}
  <button className="creator-thanks" disabled={busy||!body.trim()}>{busy?c.savingLabel:c.sendReplyLabel}</button>
  <button className="creator-history-link" type="button" disabled={busy} onClick={onBack}>{c.backLabel}</button>
 </form>}</section>;
}
