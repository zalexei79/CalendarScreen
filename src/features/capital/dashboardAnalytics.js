import { MONEY_SCALE, QUANTITY_SCALE, multiplyScaled, parseScaled } from './decimal.js';
import { calculateBasePortfolioResult, currencyRateOn } from './currencyRates.js';
export function dashboardAnalytics(assets, operations, priceFor, series, target, scope, range, today) {
 const date=today.toISOString().slice(0,10), days={week:7,month:30,quarter:90,year:365}[range];
 const start=new Date(date+'T00:00:00Z');if(days)start.setUTCDate(start.getUTCDate()-days+1);
 const cutoff=days?start.toISOString().slice(0,10):null;
 const included=assets.filter(a=>scope==='base'?a.currency!=='USDT':a.currency===scope);
 const groups=new Map();let total=0n,complete=true;
 const rows=included.map(asset=>{
  const price=priceFor(asset),rate=scope==='base'?currencyRateOn(series,asset.currency,target,date):10n**BigInt(MONEY_SCALE);
  const native=asset.quantity===0n?0n:price===null?null:multiplyScaled(asset.quantity,QUANTITY_SCALE,price,MONEY_SCALE);
  const value=native===null||rate===null?null:multiplyScaled(native,MONEY_SCALE,rate,MONEY_SCALE);
  const result=scope==='base'?calculateBasePortfolioResult([asset],series,target,date,priceFor):null;
  const pnl=scope==='base'?result.complete?result.pnl:null:native===null?null:native-asset.invested+asset.realized;
  if(value===null)complete=false;else {total+=value;groups.set(asset.category,(groups.get(asset.category)||0n)+value);}
  return {asset,value,pnl};
 });
 let income=0n,incomeComplete=true,count=0;
 const ids=new Set(included.map(a=>a.id));
 for(const row of operations){
  if(!ids.has(row.asset_id)||row.operation!=='dividend'||row.occurred_on>date||cutoff&&row.occurred_on<cutoff)continue;
  const rate=scope==='base'?currencyRateOn(series,row.currency,target,row.occurred_on):10n**BigInt(MONEY_SCALE);
  const net=multiplyScaled(parseScaled(row.quantity||'0',QUANTITY_SCALE),QUANTITY_SCALE,parseScaled(row.unit_price||'0',MONEY_SCALE),MONEY_SCALE)-parseScaled(row.fee||'0',MONEY_SCALE);
  count++;if(rate===null)incomeComplete=false;else income+=multiplyScaled(net,MONEY_SCALE,rate,MONEY_SCALE);
 }
 const allocation=[...groups].filter(([,value])=>value>0n).map(([category,value])=>({category,value,bps:complete&&total>0n?Number(value*10000n/total):null})).sort((a,b)=>a.value>b.value?-1:a.value<b.value?1:0);
 const positions=rows.filter(r=>r.asset.quantity>0n),largest=positions.filter(r=>r.value!==null).sort((a,b)=>a.value>b.value?-1:a.value<b.value?1:0)[0];
 return {rows,allocation,total:complete?total:null,complete,income:incomeComplete?income:null,incomeCount:count,largest,largestBps:complete&&total>0n&&largest?Number(largest.value*10000n/total):null};
}
