import React,{useState} from 'react';
import {ChevronDown,Search} from 'lucide-react';
import {productTypeById,productLocale,searchProductTypes} from './productCatalog.js';
import {receiptCopy} from './receiptCopy.js';
import './ProductTypePicker.css';

export default function ProductTypePicker({language,value,onChange}){
  const [query,setQuery]=useState(''),[open,setOpen]=useState(false),c=receiptCopy(language),locale=productLocale(language),selected=productTypeById(value);
  const matches=searchProductTypes(query,language);
  function choose(id){onChange(id);setOpen(false);setQuery('');}
  return <details className="receipt-type-picker" open={open}>
    <summary onClick={event=>{event.preventDefault();setOpen(!open);}}><span><small>{c.productType}</small><b>{selected?`${selected.symbol} ${selected.labels[locale]}`:c.automatic}</b></span><ChevronDown size={15}/></summary>
    <div className="receipt-type-search"><Search size={16}/><input type="search" aria-label={c.typeSearch} placeholder={c.typeSearch} value={query} onChange={event=>setQuery(event.target.value)}/></div>
    <div className="receipt-type-options"><button type="button" onClick={()=>choose('')}>{c.automatic}</button>{matches.slice(0,30).map(type=><button type="button" key={type.id} aria-pressed={type.id===value} onClick={()=>choose(type.id)}><span aria-hidden="true">{type.symbol}</span>{type.labels[locale]}</button>)}{!matches.length&&<p>{c.typeNotFound}</p>}</div>
    <p className="receipt-type-note">{c.typeMemory}</p>
  </details>;
}
