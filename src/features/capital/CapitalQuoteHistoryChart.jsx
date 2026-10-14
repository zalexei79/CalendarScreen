import React, { useEffect, useId, useMemo, useState, lazy, Suspense } from 'react';
import { fetchAssetQuoteHistory } from './assetQuoteHistory.js';
import { fetchUsEquityQuotes, isUsEquityAsset } from './usEquityQuotes.js';
import { formatMoney } from './decimal.js';
import { chartCopy } from './chartCopy.js';
import {Maximize2} from 'lucide-react';
const CapitalFullChart=lazy(()=>import('./CapitalFullChart.jsx'));
import { buildCandles, candleHistory } from './candleModel.js';

const labels = {
 ru:{daily:'Дневные свечи',closeOnly:'Источник пока передаёт только цены закрытия. Свечи появятся после обновления полной истории.',open:'Открытие',high:'Максимум',low:'Минимум',close:'Закрытие',range:'Период графика',month:'М'},
 en:{daily:'Daily candles',closeOnly:'Only closing prices are available. Candles require the full OHLC history.',open:'Open',high:'High',low:'Low',close:'Close',range:'Chart period',month:'M'},
 ro:{daily:'Lumânări zilnice',closeOnly:'Sunt disponibile doar prețurile de închidere. Lumânările necesită istoricul OHLC complet.',open:'Deschidere',high:'Maxim',low:'Minim',close:'Închidere',range:'Perioada graficului',month:'L'},
 zh:{daily:'日线蜡烛图',closeOnly:'目前只有收盘价，需要完整 OHLC 历史才能显示蜡烛图。',open:'开盘',high:'最高',low:'最低',close:'收盘',range:'图表时间范围',month:'月'},
};
export default function CapitalQuoteHistoryChart({ asset, quote, currency, locale, t, allowFetch = true, quoteError = '', quoteLoading = false, userId }) {
 const [rows,setRows]=useState([]),[loading,setLoading]=useState(false),[failed,setFailed]=useState(false);
 const [activeIndex,setActiveIndex]=useState(null),[period,setPeriod]=useState(3);
 const [expanded,setExpanded]=useState(false);
 const descriptionId=useId(), copy=labels[locale]||labels.en;
 useEffect(()=>{
  if(!asset || !['binance','moex','alphavantage'].includes(asset.quote_source)){setRows([]);return;}
  const controller=new AbortController();setRows([]);setActiveIndex(null);setLoading(true);setFailed(false);
  const history=isUsEquityAsset(asset)
   ? quote?.history?.length ? Promise.resolve(quote.history) : allowFetch ? fetchUsEquityQuotes([asset.symbol],controller.signal).then(result=>{if(result.errors[asset.symbol]&&!result.quotes[asset.symbol])throw new Error(result.errors[asset.symbol]);return result.quotes[asset.symbol]?.history||[];}) : Promise.resolve([])
   : fetchAssetQuoteHistory(asset,{signal:controller.signal});
  history.then(data=>{if(!controller.signal.aborted)setRows(data);}).catch(error=>{if(error.name!=='AbortError'&&!controller.signal.aborted)setFailed(true);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return()=>controller.abort();
 },[asset?.id,asset?.symbol,asset?.quote_source,asset?.category,quote?.history,allowFetch]);
 const candles=useMemo(()=>candleHistory(rows),[rows]);
 const visible=useMemo(()=>{
  const last=candles.at(-1);if(!last)return [];
  const from=new Date(`${last.date}T12:00:00Z`);from.setUTCMonth(from.getUTCMonth()-period);
  return candles.filter(row=>row.date>=from.toISOString().slice(0,10));
 },[candles,period]);
 const chart=useMemo(()=>buildCandles(visible),[visible]);
 const index=Math.max(0,Math.min(activeIndex??visible.length-1,visible.length-1)),current=visible[index],point=chart?.points[index];
 const dateLabel=value=>new Intl.DateTimeFormat(locale,{day:'numeric',month:'short',year:'numeric'}).format(new Date(`${value}T12:00:00`));
 const axis=value=>new Intl.NumberFormat(locale,{notation:Math.abs(value)>=10000?'compact':'standard',maximumFractionDigits:Math.abs(value)<1?5:2}).format(value);
 if(!asset||!['binance','moex','alphavantage'].includes(asset.quote_source))return null;
 return <section className="capital-market-history capital-candle-history" aria-label={t.marketHistory}>
  <div className="capital-market-history-head"><div><strong>{t.marketHistory}</strong><small>{copy.daily} · {asset.quote_source==='binance'?'Binance':asset.quote_source==='moex'?'MOEX': 'Alpha Vantage'} · {currency}</small></div>
   <div className="capital-candle-periods" role="group" aria-label={copy.range}>{[1,3,6].map(value=><button type="button" key={value} aria-pressed={period===value} onClick={()=>{setPeriod(value);setActiveIndex(null);}}>{value}{copy.month}</button>)}</div>
  </div>
  {chart ? <>
   <div className="capital-history-readout"><strong>{formatMoney(current.close,currency,locale)}</strong><span>{dateLabel(current.date)}</span></div>
   <div className="capital-candle-ohlc" id={descriptionId}>{['open','high','low','close'].map(key=><span key={key}><small>{copy[key]}</small><b>{axis(Number(current[key]))}</b></span>)}</div>
   <svg className="capital-market-history-svg capital-candle-svg" viewBox="0 0 400 156" role="img" tabIndex={0} onClick={()=>setExpanded(true)} aria-describedby={descriptionId} aria-label={`${copy.daily}: ${dateLabel(current.date)}, ${formatMoney(current.close,currency,locale)}`}
    onPointerMove={event=>{const rect=event.currentTarget.getBoundingClientRect();const x=(event.clientX-rect.left)/rect.width*400;setActiveIndex(Math.floor((x-12)/chart.step));}}
    onPointerLeave={()=>setActiveIndex(null)} onBlur={()=>setActiveIndex(null)}
    onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();setExpanded(true);return;}if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();setActiveIndex(event.key==='Home'?0:event.key==='End'?visible.length-1:Math.max(0,Math.min(visible.length-1,index+(event.key==='ArrowLeft'?-1:1))));}}}>
    {chart.ticks.map((value,i)=><g key={i}><path className="capital-chart-gridline" d={`M12 ${16+i*59}H340`}/><text className="capital-candle-axis" x="348" y={19+i*59}>{axis(value)}</text></g>)}
    {chart.points.map((candle,i)=><g key={visible[i].date} className={`capital-candle ${candle.up?'is-up':'is-down'}`} opacity={activeIndex===null||index===i?1:.65}>
      <path d={`M${candle.x} ${candle.high}V${candle.low}`} />
      <rect x={candle.x-Math.max(1,chart.step*.3)} y={Math.min(candle.open,candle.close)} width={Math.max(2,chart.step*.6)} height={Math.max(1,Math.abs(candle.close-candle.open))} rx=".3"/>
    </g>)}
    {activeIndex!==null&&point&&<path className="capital-candle-crosshair" d={`M${point.x} 12V140`}/>}
   </svg>
   <div className="capital-market-history-values"><span>{dateLabel(visible[0].date)}</span><span>{dateLabel(visible.at(-1).date)}</span></div>
  </> : <p>{loading||quoteLoading ? t.loading : failed||quoteError ? t.marketHistoryUnavailable : rows.length ? copy.closeOnly : t.marketHistoryEmpty}</p>}
  <button type="button" className="capital-chart-expand" onClick={()=>setExpanded(true)}><Maximize2 size={13}/>{(chartCopy[locale]||chartCopy.en).open}</button>
  {expanded&&<Suspense fallback={<p>{t.loading}</p>}><CapitalFullChart key={asset.quote_source+':'+asset.symbol} asset={asset} rows={rows} quote={quote} userId={userId} locale={locale} onClose={()=>setExpanded(false)}/></Suspense>}
 </section>;
}
