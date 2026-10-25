import React from 'react';
import { createRoot } from 'react-dom/client';
import BotCalendarPage from '../src/features/bot-calendar/BotCalendarPage.jsx';
const days = [
  { date_key:'2026-10-05',pnl:120.4,count:2 },
  { date_key:'2026-10-06',pnl:-24.35,count:1 },
  { date_key:'2026-10-22',pnl:361.8,count:102 },
];
const params = new URLSearchParams(location.search);
if(params.has('maintenance_trade'))days.push({date_key:'2026-10-14',pnl:12.5,count:1});
window.__copyLog=[];window.__shareLog=[];
document.execCommand=()=>{if(params.get('clipboard')==='denied')return false;window.__copyLog.push(document.querySelector('[data-clipboard-temporary]')?.value);return true;};
Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{if(params.get('clipboard')==='denied')throw new Error('denied');window.__copyLog.push(text);}}});
Object.defineProperty(navigator,'share',{configurable:true,value:params.has('native')?async payload=>{
  window.__shareLog.push(payload);
  if(params.get('native')==='abort')throw new DOMException('cancelled','AbortError');
  if(params.get('native')==='fail')throw new Error('share failed');
}:undefined});
let first = true;
let firstAnalytics=true;
const client = { rpc:async(name,args)=>{
  window.__botRequests = [...(window.__botRequests || []), { name,args }];
  if(params.get('state')==='error' && first){first=false;return {error:{message:'unavailable'}};}
  if(name==='get_bot_calendar') return {data:{slug:'bot',title:'Календарь бота',start_date:'2026-10-05',
    today:'2026-10-23',currency:'USD',time_zone:'Europe/Bucharest',
    last_sync_at:params.get('state')==='pending'?null:'2026-10-23T00:15:00Z',
    status:params.get('state')==='pending'?'pending':params.get('state')==='delayed'?'delayed':'ready',
    days:params.get('state')==='pending'?[]:days}};
  if(name==='get_bot_calendar_history') {
    const included=days.filter(d=>(!args.p_from||d.date_key>=args.p_from)&&(!args.p_to||d.date_key<=args.p_to));
    const total=included.reduce((n,d)=>n+d.count,0);
    const rows=included.slice().reverse().flatMap(d=>Array.from({length:d.count},(_,i)=>({deal_id:`${d.date_key}-${i}`,date_key:d.date_key,time:`12:${String(i%60).padStart(2,'0')}:00`,instrument:'XAUUSD',direction:i%2?'SHORT':'LONG',pnl:d.pnl/d.count,currency:'USD'})));
    return {data:{total,all_total:105,pnl:included.reduce((n,d)=>n+d.pnl,0),currency:'USD',from:args.p_from||'2026-10-05',to:args.p_to||'2026-10-23',trades:rows.slice(args.p_offset,args.p_offset+100)}};
  }
  if(name==='get_bot_calendar_analytics') {
    if(params.has('analytics_error')&&firstAnalytics){firstAnalytics=false;return {error:{message:'unavailable'}};}
    const included=params.has('analytics_empty')?[]:days.filter(d=>(!args.p_from||d.date_key>=args.p_from)&&(!args.p_to||d.date_key<=args.p_to));
    const total=included.reduce((n,d)=>n+d.count,0),pnl=included.reduce((n,d)=>n+d.pnl,0);
    const positive=included.filter(d=>d.pnl>0),negative=included.filter(d=>d.pnl<0),wins=positive.reduce((n,d)=>n+d.count,0),losses=total-wins;
    const gross_profit=positive.reduce((n,d)=>n+d.pnl,0),gross_loss=-negative.reduce((n,d)=>n+d.pnl,0);
    const from=args.p_from||'2026-10-05',to=args.p_to||'2026-10-23';
    const curve=[];let running=0,peak=0,maxDrawdown=0;
    for(let date=new Date(from+'T12:00:00Z');date.toISOString().slice(0,10)<=to;date.setUTCDate(date.getUTCDate()+1)){
      const key=date.toISOString().slice(0,10),d=included.find(x=>x.date_key===key);running+=d?.pnl||0;peak=Math.max(peak,running);maxDrawdown=Math.max(maxDrawdown,peak-running);
      curve.push({date_key:key,pnl:d?.pnl||0,total:running,drawdown:peak-running,trades:d?.count||0});
    }
    return {data:{from,to,currency:'USD',curve,stats:{total,pnl,wins,losses,breakeven:0,gross_profit,gross_loss,win_rate:total?wins/total*100:null,profit_factor:gross_loss?gross_profit/gross_loss:null,avg_trade:total?pnl/total:0,avg_win:wins?gross_profit/wins:null,avg_loss:losses?gross_loss/losses:null,best_trade:total?Math.max(...included.map(d=>d.pnl/d.count)):null,worst_trade:total?Math.min(...included.map(d=>d.pnl/d.count)):null,max_drawdown:maxDrawdown,active_days:params.has('qualified')?6:included.length,positive_days:params.has('qualified')?5:positive.length}}};
  }
  return {error:{message:'Unexpected public RPC'}};
}};
createRoot(document.getElementById('root')).render(<BotCalendarPage client={client}/>);
