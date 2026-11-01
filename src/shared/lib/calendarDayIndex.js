// One immutable source/filter snapshot; each viewed day is filtered only once.
// Keep all-currency records separate from the visible currency's numeric total.
export function createCalendarDayIndex(source,{platform='ALL',type='all',currency='USD'}={}){
 const days=new Map();
 function day(key){
  if(!days.has(key)){
   const records=(source[key]||[]).filter(row=>(platform==='ALL'||row.platform===platform)&&(type==='all'||(type==='income'?row.pnl>=0:row.pnl<0)));
   const trades=records.filter(row=>String(row.currency||'USD').trim().toUpperCase()===currency);
   days.set(key,{records,trades,total:trades.reduce((sum,row)=>sum+(Number(row.pnl)||0),0)});
  }
  return days.get(key);
 }
 return {calendarRecordsForDay:key=>day(key).records,tradesForDayFiltered:key=>day(key).trades,totalPnlForDay:key=>day(key).total};
}
