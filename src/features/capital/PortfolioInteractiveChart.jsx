import React,{useEffect,useRef,useState} from 'react';
import {createChart,AreaSeries,ColorType} from './marketCanvas.js';
import {Plus,Minus,Maximize2} from 'lucide-react';
import {historyCopy} from './historyCopy.js';
import './historyNavigation.css';
export default function PortfolioInteractiveChart({rows,currency,mode,locale,onSelect,firstAvailable}){
 const host=useRef(null),state=useRef(null),onSelectRef=useRef(onSelect),[atStart,setAtStart]=useState(false);onSelectRef.current=onSelect;const c=historyCopy[locale]||historyCopy.en;
 useEffect(()=>{
  const element=host.current,styles=getComputedStyle(element),muted=styles.getPropertyValue('--cap-muted').trim()||'#8c909a',line=styles.getPropertyValue('--cap-line').trim()||'#ffffff10';
  const format=value=>mode==='return'?new Intl.NumberFormat(locale,{maximumFractionDigits:2}).format(value-100)+'%':new Intl.NumberFormat(locale,{style:'currency',currency:currency==='USDT'?'USD':currency,maximumFractionDigits:2}).format(value).replace('$',currency==='USDT'?'USDT':'$');
  const chart=createChart(element,{autoSize:true,layout:{background:{type:ColorType.Solid,color:'transparent'},textColor:muted,fontSize:10,fontFamily:'Inter,system-ui,sans-serif',attributionLogo:true},grid:{vertLines:{visible:false},horzLines:{color:line}},rightPriceScale:{borderVisible:false},timeScale:{borderVisible:false,timeVisible:false,rightOffset:1,minBarSpacing:.5},handleScale:{pinch:true,mouseWheel:true,axisPressedMouseMove:true},handleScroll:{pressedMouseMove:true,horzTouchDrag:true,vertTouchDrag:false,mouseWheel:true},localization:{locale,priceFormatter:format}});
  const area=chart.addSeries(AreaSeries,{lineColor:'#67c7ac',topColor:'#67c7ac25',bottomColor:'#67c7ac00',lineWidth:2,pointMarkersVisible:true,pointMarkersRadius:3,priceLineVisible:false,lastValueVisible:true});
  chart.subscribeCrosshairMove(param=>{if(typeof param.time==='string')onSelectRef.current(param.time);else if(param.time&&typeof param.time==='object')onSelectRef.current(param.time.year+'-'+String(param.time.month).padStart(2,'0')+'-'+String(param.time.day).padStart(2,'0'));});
  chart.timeScale().subscribeVisibleLogicalRangeChange(range=>{if(range){setAtStart(range.from<=.5);element.dataset.visibleBars=String(range.to-range.from);}});
  state.current={chart,area};
  return()=>{state.current=null;chart.remove();};
 },[mode,currency,locale]);
 useEffect(()=>{if(!state.current)return;const data=[...new Map(rows.map(row=>[row.sampled_on,row])).values()].sort((a,b)=>a.sampled_on.localeCompare(b.sampled_on)).map(row=>({time:row.sampled_on,value:Number(row.portfolio_value)})).filter(row=>Number.isFinite(row.value));state.current.area.setData(data);state.current.chart.timeScale().fitContent();},[rows,mode,currency,locale]);
 function zoom(factor){const scale=state.current?.chart.timeScale(),range=scale?.getVisibleLogicalRange();if(range){const middle=(range.from+range.to)/2,size=(range.to-range.from)*factor;scale.setVisibleLogicalRange({from:middle-size/2,to:middle+size/2});}}
 const date=value=>new Date(value+'T00:00:00Z').toLocaleDateString(locale,{timeZone:'UTC',year:'numeric',month:'short',day:'numeric'});
 return <div className="capital-portfolio-interactive-wrap"><div className="capital-history-caption"><span>{c.saved(rows.length)} · {c.earliest} {date(rows[0].sampled_on)}</span><span>{date(rows.at(-1).sampled_on)}</span></div><div ref={host} className="capital-portfolio-interactive" role="img" aria-label={c.gesture} tabIndex={0} onKeyDown={event=>{if(event.key==='+'||event.key==='='){event.preventDefault();zoom(.75);}else if(event.key==='-'){event.preventDefault();zoom(1.35);}else if(event.key==='Home'){event.preventDefault();state.current?.chart.timeScale().fitContent();}}}/><div className="capital-history-tools"><small>{c.gesture}</small><div><button type="button" aria-label={c.zoomOut} onClick={()=>zoom(1.35)}><Minus size={13}/></button><button type="button" aria-label={c.zoomIn} onClick={()=>zoom(.75)}><Plus size={13}/></button><button type="button" aria-label={c.reset} onClick={()=>state.current?.chart.timeScale().fitContent()}><Maximize2 size={13}/></button></div></div>{atStart&&<p className="capital-history-boundary" role="status">{rows[0]?.sampled_on>firstAvailable?c.periodStart:c.portfolioStart(date(firstAvailable||rows[0].sampled_on))}</p>}</div>;
}
