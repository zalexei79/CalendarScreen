import React from 'react';
import { createRoot } from 'react-dom/client';
import BotCalendarPage from '../src/features/bot-calendar/BotCalendarPage.jsx';
const days = [
  { date_key:'2026-10-05',pnl:120.4,count:2 },
  { date_key:'2026-10-06',pnl:-24.35,count:1 },
  { date_key:'2026-10-22',pnl:361.8,count:102 },
];
const params = new URLSearchParams(location.search);
let first = true;
const client = { rpc:async(name,args)=>{
  window.__botRequests = [...(window.__botRequests || []), { name,args }];
  if(params.get('state')==='error' && first){first=false;return {error:{message:'unavailable'}};}
  if(name==='get_bot_calendar') return {data:{slug:'bot',title:'Календарь бота',start_date:'2026-10-05',
    today:'2026-10-23',currency:'USD',time_zone:'Europe/Bucharest',
    last_sync_at:params.get('state')==='pending'?null:'2026-10-23T00:15:00Z',
    status:params.get('state')==='pending'?'pending':params.get('state')==='delayed'?'delayed':'ready',
    days:params.get('state')==='pending'?[]:days}};
  const total=args.p_day==='2026-10-22'?102:args.p_day==='2026-10-05'?2:args.p_day==='2026-10-06'?1:0;
  const trades=Array.from({length:Math.max(0,Math.min(100,total-args.p_offset))},(_,i)=>({
    deal_id:String(i+args.p_offset),time:`12:${String(i%60).padStart(2,'0')}:00`,instrument:'XAUUSD',direction:i%2?'SHORT':'LONG',pnl:i%2?-24.35:120.4,currency:'USD',
  }));
  return {data:{total,trades}};
}};
createRoot(document.getElementById('root')).render(<BotCalendarPage client={client}/>);
