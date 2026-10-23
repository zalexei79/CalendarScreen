import React from 'react';
import { createRoot } from 'react-dom/client';
import BotCalendarPage from '../src/features/bot-calendar/BotCalendarPage.jsx';
const days = [
  { date_key:'2026-10-05',pnl:120.4,count:2 },
  { date_key:'2026-10-06',pnl:-24.35,count:1 },
  { date_key:'2026-10-22',pnl:361.8,count:102 },
];
const params = new URLSearchParams(location.search);
window.__copyLog=[];window.__shareLog=[];
document.execCommand=()=>{if(params.get('clipboard')==='denied')return false;window.__copyLog.push(document.querySelector('[data-clipboard-temporary]')?.value);return true;};
Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{if(params.get('clipboard')==='denied')throw new Error('denied');window.__copyLog.push(text);}}});
Object.defineProperty(navigator,'share',{configurable:true,value:params.has('native')?async payload=>{
  window.__shareLog.push(payload);
  if(params.get('native')==='abort')throw new DOMException('cancelled','AbortError');
  if(params.get('native')==='fail')throw new Error('share failed');
}:undefined});
let first = true;
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
  return {error:{message:'Unexpected public RPC'}};
}};
createRoot(document.getElementById('root')).render(<BotCalendarPage client={client}/>);
