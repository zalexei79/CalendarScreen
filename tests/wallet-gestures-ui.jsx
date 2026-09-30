// Isolated interaction fixture: no accounts or network writes.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import WalletPanel from '../src/features/wallet/WalletPanel';
import { transitionView } from '../src/shared/ui/transitionView';

function Fixture() {
  const [returned,setReturned]=useState(false);
  const transactions=Array.from({length:24},(_,i)=>({id:String(i),currency:'USD',dateKey:'2026-09-30',kind:'income',amount:10,title:`Test entry ${i}`}));
  return returned ? <h1 id="calendar">Calendar</h1> : <WalletPanel language="en" currency="USD" transactions={transactions} balanceByCurrency={{USD:240}} onSave={async()=>{}} onDelete={()=>{}} onBackToCalendar={()=>transitionView(()=>setReturned(true))}/>;
}
createRoot(document.getElementById('root')).render(<Fixture/>);
