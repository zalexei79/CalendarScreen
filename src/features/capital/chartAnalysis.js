import { normalizeCandle } from './candleModel.js';
export const CRYPTO_INTERVALS=['1m','5m','15m','1h','4h','1d','1w','1M'];
export const DAILY_INTERVALS=['1d','1w','1M'];
export function normalizeBars(rows){return [...new Map((Array.isArray(rows)?rows:[]).map(normalizeCandle).filter(Boolean).map(row=>({...row,time:Number.isFinite(Number(row.time))?Number(row.time):Math.floor(Date.parse(row.date+'T00:00:00Z')/1000)})).map(row=>[row.time,row])).values()].sort((a,b)=>a.time-b.time);}
export function aggregateBars(rows,interval){
 if(interval==='1d')return normalizeBars(rows);
 const buckets=new Map();
 for(const row of normalizeBars(rows)){
  const d=new Date(row.time*1000);d.setUTCHours(0,0,0,0);
  if(interval==='1w')d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));else if(interval==='1M')d.setUTCDate(1);else throw new Error('Unsupported aggregation');
  const time=d.getTime()/1000,prev=buckets.get(time);
  if(prev){prev.high=String(Math.max(Number(prev.high),Number(row.high)));prev.low=String(Math.min(Number(prev.low),Number(row.low)));prev.close=row.close;prev.price=row.close;prev.volume=prev.volume!=null&&row.volume!=null&&Number.isFinite(Number(prev.volume))&&Number.isFinite(Number(row.volume))?Number(prev.volume)+Number(row.volume):undefined;}
  else buckets.set(time,{...row,time,date:d.toISOString().slice(0,10)});
 }
 return [...buckets.values()];
}
export function sma(rows,length){let sum=0;return rows.flatMap((row,i)=>{sum+=Number(row.close);if(i>=length)sum-=Number(rows[i-length].close);return i>=length-1?[{time:row.time,value:sum/length}]:[];});}
export function rsi(rows,length=14){
 if(rows.length<=length)return [];let gain=0,loss=0;const result=[];
 for(let i=1;i<rows.length;i++){const change=Number(rows[i].close)-Number(rows[i-1].close),g=Math.max(0,change),l=Math.max(0,-change);if(i<=length){gain+=g/length;loss+=l/length;}else{gain=(gain*(length-1)+g)/length;loss=(loss*(length-1)+l)/length;}
 if(i>=length)result.push({time:rows[i].time,value:loss===0?(gain===0?50:100):100-100/(1+gain/loss)});
 }return result;
}
export const defaultChartPreferences={timeframe:'1d',sma:false,rsi:false,volume:false};
export function cleanChartPreferences(value,source){const intervals=source==='binance'?CRYPTO_INTERVALS:DAILY_INTERVALS;return{timeframe:intervals.includes(value?.timeframe)?value.timeframe:'1d',sma:value?.sma===true,rsi:value?.rsi===true,volume:value?.volume===true};}
