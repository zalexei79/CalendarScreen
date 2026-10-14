import React,{useEffect,useMemo,useRef,useState} from 'react';
import {createChart,CandlestickSeries,HistogramSeries,LineSeries,LineStyle,ColorType} from 'lightweight-charts';
import {X,Plus,Minus,Maximize2,SlidersHorizontal} from 'lucide-react';
import {aggregateBars,normalizeBars,sma,rsi,CRYPTO_INTERVALS,DAILY_INTERVALS} from './chartAnalysis.js';
import {fetchCryptoCandles,openCryptoCandleStream,fetchEarlierCandles} from './chartMarketData.js';
import {useChartPreferences} from './useChartPreferences.js';
import {chartCopy,intervalLabel} from './chartCopy.js';
import {formatMoney,MONEY_SCALE} from './decimal.js';
import './fullChart.css';
import './historyNavigation.css';
import {historyCopy} from './historyCopy.js';

export default function CapitalFullChart({asset,rows,quote,locale,userId,onClose}){
 const h=historyCopy[locale]||historyCopy.en;
 const c=chartCopy[locale]||chartCopy.en,{preferences,change,status}=useChartPreferences(userId,asset);
 const dialog=useRef(null),host=useRef(null),api=useRef(null),previousRange=useRef(null);
 const [bars,setBars]=useState([]),[loading,setLoading]=useState(false),[error,setError]=useState(false),[connection,setConnection]=useState(''),[online,setOnline]=useState(navigator.onLine);
 const [analysis,setAnalysis]=useState(false),[hover,setHover]=useState(null);
 const [historyState,setHistoryState]=useState('');const barsRef=useRef(bars),rawHistory=useRef([]),pageRequest=useRef(null),historyEpoch=useRef(0),loadedFrame=useRef(null),pageBusy=useRef(false),pageCooldown=useRef(0),loadMoreRef=useRef(()=>{});barsRef.current=bars;
 const allowed=asset.quote_source==='binance'?CRYPTO_INTERVALS:DAILY_INTERVALS;
 useEffect(()=>{const d=dialog.current,previous=document.activeElement;const isolate=event=>event.stopPropagation();const events=['touchstart','touchmove','touchend','touchcancel','wheel','pointerdown','pointerup','pointercancel'];events.forEach(name=>d.addEventListener(name,isolate,{passive:true}));d.showModal();return()=>{events.forEach(name=>d.removeEventListener(name,isolate));d.close();previous?.focus?.();};},[]);
 useEffect(()=>{const update=()=>setOnline(navigator.onLine);window.addEventListener('online',update);window.addEventListener('offline',update);return()=>{window.removeEventListener('online',update);window.removeEventListener('offline',update);};},[]);
 useEffect(()=>{
  historyEpoch.current++;pageRequest.current?.abort();pageBusy.current=false;pageCooldown.current=0;setHistoryState('');setHover(null);setError(false);setLoading(true);setBars(previous=>!online&&loadedFrame.current===preferences.timeframe?previous:[]);previousRange.current=null;
  if(asset.quote_source!=='binance'){rawHistory.current=normalizeBars(rows);setBars(aggregateBars(rows,preferences.timeframe));setLoading(false);return;}
  if(!online){setLoading(false);setConnection('offline');return;}
  const controller=new AbortController();let stop,pending,flush;setConnection('connecting');
  fetchCryptoCandles(asset.symbol,preferences.timeframe,{signal:controller.signal}).then(data=>{
   if(controller.signal.aborted)return;loadedFrame.current=preferences.timeframe;setBars(normalizeBars(data));setLoading(false);
   stop=openCryptoCandleStream(asset.symbol,preferences.timeframe,bar=>{pending=bar;if(flush)return;flush=setTimeout(()=>{flush=null;if(controller.signal.aborted)return;setBars(prev=>normalizeBars([...prev.filter(row=>row.time!==pending.time),pending]).slice(-20000));},500);},state=>{if(!controller.signal.aborted)setConnection(state);});
  }).catch(e=>{if(!controller.signal.aborted){setError(true);setLoading(false);setConnection('offline');}});
  return()=>{controller.abort();pageRequest.current?.abort();stop?.();clearTimeout(flush);};
 },[asset.symbol,asset.quote_source,preferences.timeframe,rows,online]);
 useEffect(()=>()=>{historyEpoch.current++;pageRequest.current?.abort();},[]);
 loadMoreRef.current=async(force=false)=>{
  if(loading||pageBusy.current||!barsRef.current.length||!online)return;
  if(!force&&['stockLimit','beginning','memoryLimit','failed'].includes(historyState))return;
  if(Date.now()-pageCooldown.current<1200&&!force)return;
  if(asset.quote_source==='alphavantage'){setHistoryState('stockLimit');return;}
  if(barsRef.current.length>=20000||rawHistory.current.length>=20000){setHistoryState('memoryLimit');return;}
  const epoch=historyEpoch.current,base=asset.quote_source==='binance'?barsRef.current:rawHistory.current;
  const before=base[0]?.time;if(!before)return;
  pageBusy.current=true;pageCooldown.current=Date.now();setHistoryState('loading');const controller=new AbortController();pageRequest.current=controller;
  try{
   const received=await fetchEarlierCandles(asset,preferences.timeframe,before,{signal:controller.signal});if(controller.signal.aborted||epoch!==historyEpoch.current)return;
   const valid=normalizeBars(received);if(received.length&&!valid.length)throw new Error('Invalid historical candles');
   const earlier=valid.filter(row=>row.time<before).slice(-Math.max(0,20000-base.length));
   if(!earlier.length){setHistoryState('beginning');return;}
   if(asset.quote_source==='binance')setBars(previous=>normalizeBars([...earlier,...previous]));
   else {rawHistory.current=normalizeBars([...earlier,...rawHistory.current]);setBars(aggregateBars(rawHistory.current,preferences.timeframe));}
   setHistoryState('');
  }catch(error){if(!controller.signal.aborted&&epoch===historyEpoch.current)setHistoryState('failed');}
  finally{if(epoch===historyEpoch.current)pageBusy.current=false;}
 };
 const indicators=useMemo(()=>({sma20:sma(bars,20),sma50:sma(bars,50),rsi:rsi(bars)}),[bars]);
 useEffect(()=>{
  const node=host.current,styles=getComputedStyle(dialog.current),bg=styles.getPropertyValue('--cap-bg').trim()||'#08090c',text=styles.getPropertyValue('--cap-muted').trim()||'#8c909a',line=styles.getPropertyValue('--cap-line').trim()||'#ffffff10';
  const chart=createChart(node,{autoSize:true,layout:{background:{type:ColorType.Solid,color:bg},textColor:text,fontFamily:'Inter,system-ui,sans-serif',fontSize:11,attributionLogo:true,panes:{separatorColor:line,separatorHoverColor:'#edcd8730',enableResize:true}},grid:{vertLines:{color:line},horzLines:{color:line}},rightPriceScale:{borderColor:line},timeScale:{borderColor:line,timeVisible:preferences.timeframe.includes('m')||preferences.timeframe.includes('h'),secondsVisible:false,rightOffset:5},handleScale:{mouseWheel:true,pinch:true,axisPressedMouseMove:true},handleScroll:{mouseWheel:true,pressedMouseMove:true,horzTouchDrag:true,vertTouchDrag:false},localization:{locale,priceFormatter:price=>new Intl.NumberFormat(locale,{maximumFractionDigits:8}).format(price)}});
  const candles=chart.addSeries(CandlestickSeries,{upColor:'#67c7ac',downColor:'#d8989c',wickUpColor:'#67c7ac',wickDownColor:'#d8989c',borderVisible:false});
  const state={chart,candles,initialized:false,frame:preferences.timeframe};
  chart.timeScale().subscribeVisibleLogicalRangeChange(range=>{if(range){node.dataset.visibleBars=String(range.to-range.from);if(range.from<12)void loadMoreRef.current();}});
  if(preferences.sma){state.sma20=chart.addSeries(LineSeries,{color:'#e3c686',lineWidth:1,priceLineVisible:false,lastValueVisible:false,crosshairMarkerVisible:false});state.sma50=chart.addSeries(LineSeries,{color:'#889ece',lineWidth:1,priceLineVisible:false,lastValueVisible:false,crosshairMarkerVisible:false});}
  let pane=1;
  if(preferences.volume){state.volume=chart.addSeries(HistogramSeries,{priceFormat:{type:'volume'},priceLineVisible:false,lastValueVisible:false},pane++);}
  if(preferences.rsi){state.rsi=chart.addSeries(LineSeries,{color:'#b1a0dd',lineWidth:1,priceLineVisible:false,lastValueVisible:true,autoscaleInfoProvider:()=>({priceRange:{minValue:0,maxValue:100}})},pane++);for(const value of [30,70])state.rsi.createPriceLine({price:value,color:'#8c909a66',lineWidth:1,lineStyle:LineStyle.Dashed,axisLabelVisible:true});}
  if(Number(asset.averageCost)>0){candles.createPriceLine({price:Number(asset.averageCost)/10**MONEY_SCALE,color:'#edcd87',lineWidth:1,lineStyle:LineStyle.Dashed,axisLabelVisible:true,title:c.bought});}
  chart.panes().forEach((p,i)=>p.setStretchFactor(i===0?5:1));
  chart.subscribeCrosshairMove(param=>{const row=param.seriesData.get(candles);setHover(row&&'close'in row?row:null);});
  api.current=state;
  return()=>{previousRange.current=chart.timeScale().getVisibleLogicalRange();api.current=null;chart.remove();};
 },[preferences.sma,preferences.rsi,preferences.volume,asset.symbol,asset.averageCost,locale]);
 useEffect(()=>{
  const state=api.current;if(!state)return;
  if(state.frame!==preferences.timeframe){state.initialized=false;state.frame=preferences.timeframe;previousRange.current=null;}
  state.chart.applyOptions({timeScale:{timeVisible:preferences.timeframe.includes('m')||preferences.timeframe.includes('h')}});
  host.current.dataset.totalBars=String(bars.length);
  const previous=state.chart.timeScale().getVisibleLogicalRange(),added=state.firstTime?bars.findIndex(row=>row.time===state.firstTime):0;
  state.candles.setData(bars.map(row=>({time:row.time,open:Number(row.open),high:Number(row.high),low:Number(row.low),close:Number(row.close)})));
  if(state.initialized&&added>0&&previous)state.chart.timeScale().setVisibleLogicalRange({from:previous.from+added,to:previous.to+added});state.firstTime=bars[0]?.time;
  state.sma20?.setData(indicators.sma20);state.sma50?.setData(indicators.sma50);state.rsi?.setData(indicators.rsi);
  state.volume?.setData(bars.filter(row=>row.volume!=null&&/^\d+(?:\.\d+)?$/.test(String(row.volume))&&Number.isFinite(Number(row.volume))&&Number(row.volume)>=0).map(row=>({time:row.time,value:Number(row.volume),color:Number(row.close)>=Number(row.open)?'#67c7ac88':'#d8989c88'})));
  if(bars.length&&!state.initialized){state.initialized=true;if(previousRange.current)state.chart.timeScale().setVisibleLogicalRange(previousRange.current);else state.chart.timeScale().setVisibleLogicalRange({from:Math.max(0,bars.length-100),to:bars.length+5});}
 },[bars,indicators,preferences.sma,preferences.rsi,preferences.volume,preferences.timeframe]);
 const current=hover||bars.at(-1),intraday=['1m','5m','15m','1h','4h'].includes(preferences.timeframe),asOf=current?.time?(intraday?new Date(Number(current.time)*1000).toLocaleString(locale):new Date(Number(current.time)*1000).toLocaleDateString(locale)):'';
 function zoom(factor){const scale=api.current?.chart.timeScale(),range=scale?.getVisibleLogicalRange();if(!range)return;const size=(range.to-range.from)*factor;scale.setVisibleLogicalRange({from:range.to-size,to:range.to});}
 function reset(){if(bars.length)api.current?.chart.timeScale().setVisibleLogicalRange({from:Math.max(0,bars.length-100),to:bars.length+5});}
 return <dialog ref={dialog} className="capital-chart-modal" aria-label={c.title} onCancel={e=>{e.preventDefault();onClose();}} onKeyDown={e=>e.stopPropagation()}>
  <header><div><small>DAYRIS CAPITAL</small><h2>{asset.name}<span>{asset.symbol} · {asset.currency}</span></h2></div><button type="button" onClick={onClose} aria-label={c.close}><X size={20}/></button></header>
  <div className="capital-chart-topline"><div><strong>{current?formatMoney(current.close,asset.currency,locale):'—'}</strong><small>{asOf}</small></div><span data-state={online?connection:'offline'}>{!online?c.offline:asset.quote_source==='binance'?(c[connection]||c.connecting):asset.quote_source==='moex'?c.delayed:c.daily}{asset.quote_source==='alphavantage'&&quote?.asOf?' · '+quote.asOf:''}</span></div>
  <div className="capital-chart-toolbar"><div role="group" aria-label={c.interval}>{allowed.map(value=><button type="button" key={value} aria-pressed={value===preferences.timeframe} onClick={()=>change({timeframe:value})}>{intervalLabel(value,c)}</button>)}</div><button type="button" onClick={()=>setAnalysis(value=>!value)} aria-expanded={analysis}><SlidersHorizontal size={14}/>{c.analysis}</button></div>
  {analysis&&<section className="capital-chart-analysis" aria-label={c.analysis}><div>{['sma','rsi','volume'].map(key=><button type="button" key={key} aria-pressed={preferences[key]} onClick={()=>change({[key]:!preferences[key]})}>{c[key]}</button>)}</div><p>{c.indicatorHelp}</p><small>{c[status]||''}</small></section>}
  <div className="capital-chart-readout">{current&&['open','high','low','close'].map(key=><span key={key}>{key.toUpperCase().slice(0,1)} <b>{new Intl.NumberFormat(locale,{maximumFractionDigits:8}).format(Number(current[key]))}</b></span>)}{preferences.sma&&<span className="capital-chart-legend">SMA 20 · 50</span>}{preferences.rsi&&<span className="capital-chart-legend">RSI 14</span>}</div>
  <div className="capital-chart-stage"><div ref={host} className="capital-chart-canvas"/>{(loading||error||!bars.length)&&<div className="capital-chart-empty" role="status">{loading?c.loading:error?c.unavailable:c.unavailable}</div>}</div>
  {historyState&&<p className="capital-history-boundary" role="status" data-error={historyState==='failed'}>{h[historyState]}{historyState==='failed'&&<button type="button" onClick={()=>void loadMoreRef.current(true)}>{h.retry}</button>}</p>}
  <footer><div><button type="button" aria-label={c.zoomOut} onClick={()=>zoom(1.35)}><Minus size={16}/></button><button type="button" aria-label={c.zoomIn} onClick={()=>zoom(.75)}><Plus size={16}/></button><button type="button" aria-label={c.reset} onClick={reset}><Maximize2 size={16}/></button></div><small>{c.help}</small></footer>
  <div className="capital-chart-credit">TradingView Lightweight Charts™ © TradingView, Inc.</div>
 </dialog>;
}
