import React from 'react';
import {Gift,Mail,ChevronRight} from 'lucide-react';
import {cardHeading,cardLabels} from './messageCardModel.js';
export default function MessageCard({message,t,dateLabel,saving=false,onPrimary,onReply,onHistory,titleId='creator-inbox-title',onSelect}){
 const c=cardLabels(message,t),gift=Boolean(message.pro_until),icon=c.icon==='auto'?(gift?'gift':'mail'):c.icon;
 const dateText=message.pro_until==='infinity'?c.foreverLine:c.giftLine.replaceAll('{date}',dateLabel||'');
 return <article className={`creator-letter creator-accent-${c.accent}`} onClick={onSelect?e=>{const field=e.target.closest('[data-card-field]')?.dataset.cardField;if(field)onSelect(field);}:undefined}>
  {icon!=='none'&&<div data-card-field="icon" className={`creator-letter-icon${icon==='gift'?' creator-letter-icon-gift':''}`} aria-hidden="true">{icon==='gift'?<Gift size={28} strokeWidth={1.5}/>:<Mail size={27} strokeWidth={1.5}/>}</div>}
  {c.sender&&<span data-card-field="sender" className="creator-letter-from">{c.sender}</span>}
  <h2 data-card-field="title" id={titleId}>{cardHeading(message,t)}</h2>
  {gift&&c.showExpiry&&dateText&&<p data-card-field="giftLine" className="creator-letter-access">{dateText}</p>}
  <div className="creator-letter-text"><p data-card-field="body">{message.body}</p></div>
  <button type="button" data-card-field={gift?'giftButton':'button'} className="creator-thanks" disabled={saving} onClick={onPrimary}>{saving?c.savingLabel:gift?c.giftButton:c.button}</button>
  {c.allowReply&&onReply&&<button type="button" data-card-field="replyButton" className="creator-reply-action" disabled={saving} onClick={onReply}>{c.replyButton}</button>}
  {onHistory&&<button type="button" data-card-field="historyLabel" className="creator-history-link" disabled={saving} onClick={onHistory}>{c.historyLabel}<ChevronRight size={14}/></button>}
  {c.footer&&<p data-card-field="footer" className="creator-letter-saved">{c.footer}</p>}
 </article>;
}
