import React,{useState} from 'react';
import {Pencil,Trash2,ReceiptText,ChevronDown} from 'lucide-react';
import {MONEY_CATEGORIES} from '../../shared/config/constants';
import {receiptFromEntry} from './receiptHistory.js';
import {receiptMoney,receiptLineTotal,receiptProduct} from './receiptModel.js';
import {productLocale} from './productCatalog.js';
import {receiptCopy} from './receiptCopy.js';
import './ReceiptHistoryCard.css';

export default function ReceiptHistoryCard({entry,receipt:provided,language='ru',isLight=false,onEdit,onDelete,previewLimit=5,showDate=true}){
  const [expanded,setExpanded]=useState(false),receipt=provided||receiptFromEntry(entry),c=receiptCopy(language),locale=productLocale(language);
  if(!receipt)return null;
  const numberLocale=['ru-RU','en-US','ro-MD','zh-CN'][locale];
  const money=value=>new Intl.NumberFormat(numberLocale,{minimumFractionDigits:2,maximumFractionDigits:2}).format((receiptMoney(value)||0)/100);
  const date=new Date(`${entry.dateKey}T12:00:00`),dateText=showDate&&!Number.isNaN(+date)?new Intl.DateTimeFormat(numberLocale,{day:'numeric',month:'short'}).format(date):'';
  const category=MONEY_CATEGORIES.find(item=>item.key.toUpperCase()===String(entry.instrument).toUpperCase());
  const categoryText=category?locale===0?category.key:locale===1?category.en:locale===2?category.ro:category['zh-CN']:entry.instrument;
  const visible=expanded?receipt.items:receipt.items.slice(0,previewLimit);
  return <article className="receipt-history" data-light={isLight} aria-label={`${c.receipt}: ${receipt.merchant||categoryText}`} onClick={event=>event.stopPropagation()}>
    <header className="receipt-history-header"><span className="receipt-history-mark"><ReceiptText size={19}/></span><div><h4>{receipt.merchant||c.receipt}</h4><p>{[c.receipt,dateText,entry.time].filter(Boolean).join(' · ')}</p></div></header>
    <div className="receipt-history-overview"><span>{categoryText}</span><strong>−{money(receipt.total)} <small>{receipt.currency}</small></strong></div>
    {receipt.items.length>0&&<ul className="receipt-history-items">{visible.map((item,index)=>{
      const product=receiptProduct(item.name,language,item.productType),mismatch=receiptMoney(receiptLineTotal(item.quantity,item.unitPrice))!==receiptMoney(item.total);
      return <li key={index}><span className="receipt-history-product-icon" aria-hidden="true">{product.symbol||'🛍️'}</span><span className="receipt-history-product"><b>{product.title||item.name}</b><span>{item.quantity.replace('.',locale===1||locale===3?'.':',')} {c[item.unit]||c.pcs} × {money(item.unitPrice)} {receipt.currency}</span>{mismatch&&<em>{c.checkItem}</em>}</span><span className="receipt-history-line-total">{money(item.total)}<small>{receipt.currency}</small></span></li>;
    })}</ul>}
    {receipt.items.length>previewLimit&&<button type="button" className="receipt-history-expand" aria-expanded={expanded} onClick={()=>setExpanded(!expanded)}>{expanded?c.showLess:`${c.showAll} (${receipt.items.length})`}<ChevronDown size={14}/></button>}
    {receipt.mismatch&&<div className="receipt-history-difference"><span>{c.itemSum}<b>{money(receipt.sum)} {receipt.currency}</b></span><span>{c.difference}<b>{money(receipt.difference)} {receipt.currency}</b></span></div>}
    {(onEdit||onDelete)&&<footer className="receipt-history-actions"><span>{receipt.items.length?`${c.items}: ${receipt.items.length}`:c.receipt}</span>{onEdit&&<button type="button" onClick={onEdit} aria-label={c.editRecord}><Pencil size={15}/><span>{c.editRecord}</span></button>}{onDelete&&<button type="button" onClick={onDelete} aria-label={c.deleteRecord}><Trash2 size={15}/></button>}</footer>}
  </article>;
}
