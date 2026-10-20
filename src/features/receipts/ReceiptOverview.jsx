import React from 'react';
import {CalendarDays,ChevronDown,Image,ReceiptText,ShoppingBag,Pencil} from 'lucide-react';
import {CURRENCIES,MONEY_CATEGORIES} from '../../shared/config/constants';
import {validReceiptDate} from './receiptModel.js';
import './ReceiptOverview.css';

export default function ReceiptOverview({draft,c,today,language,busy,update,metadataOpen,setMetadataOpen}){
 const amountPhoto=draft.kind==='amount',locale=String(language).startsWith('zh')?'zh-CN':['ro','md'].includes(language)?'ro-MD':language==='en'?'en-US':'ru-RU';
 const category=MONEY_CATEGORIES.find(item=>item.key===draft.category)||MONEY_CATEGORIES.at(-1);
 const categoryLabel=item=>String(language).startsWith('zh')?item['zh-CN']:language==='en'?item.en:['ro','md'].includes(language)?item.ro:item.key;
 const date=validReceiptDate(draft.dateKey,today)?draft.dateKey===today?c.today:new Intl.DateTimeFormat(locale,{day:'numeric',month:'short',year:'numeric'}).format(new Date(`${draft.dateKey}T12:00:00`)):c.chooseDate;
 return <section className="receipt-composer" data-amount-photo={amountPhoto}>
  <div className="receipt-composer-origin">{amountPhoto?<Image size={14}/>:<ReceiptText size={14}/>}<span>{amountPhoto?c.photoAmount:c.total}</span></div>
  <div className="receipt-total" data-empty={!draft.total}>
   <label><span className="receipt-sr-only">{c.total}</span><input aria-label={c.total} inputMode="decimal" autoComplete="off" placeholder="0.00" value={draft.total} disabled={busy} data-length={String(draft.total).length>9?'long':'short'} onChange={event=>update({total:event.target.value,...(amountPhoto?{expression:''}:{})})}/></label>
   <label className="receipt-currency-control"><span>{draft.currency||c.currencyShort}</span><ChevronDown size={13}/><select aria-label={c.currency} value={draft.currency} onChange={event=>update({currency:event.target.value})}><option value="">{c.choose}</option>{!CURRENCIES.some(item=>item.code===draft.currency)&&draft.currency&&<option value={draft.currency} disabled>{draft.currency}</option>}{CURRENCIES.map(item=><option key={item.code} value={item.code}>{item.code}</option>)}</select></label>
  </div>
  <p className="receipt-amount-caption">{draft.expression||(!draft.total?c.enterAmountHint:amountPhoto?c.expenseFromPhoto:c.receiptTotalHint)}</p>
  <div className="receipt-context">
   <label className="receipt-context-chip" data-empty={!validReceiptDate(draft.dateKey,today)}><CalendarDays size={15}/><span>{date}</span><ChevronDown size={12}/><input aria-label={c.date} type="date" max={today} value={draft.dateKey} onChange={event=>update({dateKey:event.target.value})}/></label>
   <label className="receipt-context-chip"><ShoppingBag size={15}/><span>{categoryLabel(category)}</span><ChevronDown size={12}/><select aria-label={c.category} value={draft.category} onChange={event=>update({category:event.target.value})}>{MONEY_CATEGORIES.filter(item=>item.type!=='plus').map(item=><option key={item.key} value={item.key}>{categoryLabel(item)}</option>)}</select></label>
  </div>
  <details className="receipt-metadata" open={metadataOpen}>
   <summary onClick={event=>{event.preventDefault();setMetadataOpen(!metadataOpen);}}><Pencil size={13}/><span>{draft.merchant|| (amountPhoto?c.addDescription:c.merchantOptional)}</span><ChevronDown size={12}/></summary>
   <label className="receipt-field receipt-description"><span>{amountPhoto?c.description:c.merchant}</span><input aria-label={amountPhoto?c.description:c.merchant} placeholder={amountPhoto?c.descriptionPlaceholder:c.merchant} maxLength={120} value={draft.merchant} onChange={event=>update({merchant:event.target.value})}/></label>
  </details>
 </section>;
}
