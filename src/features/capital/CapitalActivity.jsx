import React,{useMemo,useState} from 'react';
import {ArrowDownLeft,ArrowUpRight,History,Search} from 'lucide-react';
import {activityRows,sectionCopy} from './portfolioSections.js';
import {formatMoney,formatUnitMoney,QUANTITY_SCALE,scaledToString} from './decimal.js';
import {displayQuantity,displayPrice} from './investorTools.js';

export default function CapitalActivity({assets,operations,locale,t,onSelect,loading=false}){
 const c=sectionCopy[locale], [kind,setKind]=useState('all'),[query,setQuery]=useState(''),[limit,setLimit]=useState(30);
 const rows=useMemo(()=>activityRows(assets,operations,{kind,query}),[assets,operations,kind,query]);
 const labels={buy:t.buy,sell:t.sell,dividend:t.dividend,revalue:t.revalue};
 let previousDay=null;
 return <section className="capital-activity" aria-label={c.history}>
  <div className="capital-section-title"><h2>{c.history}</h2><span className="capital-section-count">{rows.length}</span></div>
  <p className="capital-section-note">{c.historyHint}</p>
  <div className="capital-activity-tools"><label className="capital-search"><Search size={15}/><input value={query} aria-label={c.search} placeholder={c.search} onChange={e=>{setQuery(e.target.value);setLimit(30);}}/></label><select aria-label={t.operation} value={kind} onChange={e=>{setKind(e.target.value);setLimit(30);}}>{['all','sell','buy','dividend','revalue'].map(value=><option key={value} value={value}>{c[value]}</option>)}</select></div>
  {loading?<p role="status" className="capital-section-note">{t.loading}</p>:!rows.length?<div className="capital-empty"><History size={26}/><strong>{!operations.length?c.historyEmpty:kind==='sell'&&!query?c.noSales:c.notFound}</strong></div>:<div className="capital-activity-list">{rows.slice(0,limit).map(({row,asset,quantity,price,fee,total})=>{
   const day=row.occurred_on,heading=day!==previousDay;previousDay=day;
   const date=new Date(`${day}T12:00:00`),label=Number.isNaN(date.getTime())?day:date.toLocaleDateString(locale,{day:'numeric',month:'long',year:'numeric'});
   const code=row.currency||asset.currency;
   return <React.Fragment key={row.id}>{heading&&<h3 className="capital-activity-date"><time dateTime={day}>{label}</time></h3>}<article className="capital-activity-row" data-operation={row.operation}>
    <button type="button" className="capital-activity-main" onClick={()=>onSelect(asset)} aria-label={`${c.openAsset}: ${asset.name} · ${labels[row.operation]}`}><span className="capital-activity-icon">{row.operation==='sell'?<ArrowUpRight size={18}/>:<ArrowDownLeft size={18}/>}</span><span><strong>{asset.name}</strong><small>{labels[row.operation]} · {asset.symbol||code}</small></span><b>{formatMoney(total??price,code,locale)}</b></button>
    <details><summary>{row.operation==='revalue'?c.price:row.operation==='buy'?c.spent:c.received}</summary><dl>{row.operation!=='revalue'&&<div><dt>{c.quantity}</dt><dd>{scaledToString(displayQuantity(quantity,asset.display_unit),QUANTITY_SCALE)} {asset.display_unit==='gram'?({ru:'г',en:'g',ro:'g',zh:'克'}[locale]):asset.symbol}</dd></div>}<div><dt>{c.price}</dt><dd>{formatUnitMoney(displayPrice(price,asset.display_unit),code,locale)}</dd></div><div><dt>{c.fee}</dt><dd>{formatMoney(fee,code,locale)}</dd></div></dl></details>
   </article></React.Fragment>;
  })}</div>}
  {rows.length>limit&&<button type="button" className="capital-catalog-more" onClick={()=>setLimit(value=>value+30)}>{c.more} · {Math.min(limit,rows.length)} / {rows.length}</button>}
 </section>;
}
