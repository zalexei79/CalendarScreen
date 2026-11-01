const PREFIX='DAYRIS_DAY_V1\n';
const STREAK_PREFIX='DAYRIS_STREAK_V1\n';
export function sharedStreakMessage(state){return STREAK_PREFIX+JSON.stringify({days:state.currentStreak,paused:Boolean(state.paused),day:state.serverDate});}
export function readSharedStreak(body){
 if(typeof body!=='string'||!body.startsWith(STREAK_PREFIX)||body.length>400)return null;
 try{const v=JSON.parse(body.slice(STREAK_PREFIX.length));return Number.isInteger(v.days)&&v.days>0&&v.days<=36500&&typeof v.paused==='boolean'&&/^\d{4}-\d{2}-\d{2}$/.test(v.day)?v:null;}catch{return null;}
}
export function sharedDayMessage(data,amounts=false){
 return PREFIX+JSON.stringify({day:data.day,entries:data.entries,totals:amounts?data.totals.map(({currency,amount})=>({currency,amount})):[],amountsVisible:amounts});
}
export function readSharedDay(body){
 if(typeof body!=='string'||!body.startsWith(PREFIX)||body.length>2000)return null;
 try{
  const value=JSON.parse(body.slice(PREFIX.length));
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value.day)||!Number.isFinite(new Date(value.day+'T12:00:00').getTime())||!Number.isInteger(value.entries)||value.entries<0||!Array.isArray(value.totals)||value.totals.length>20||typeof value.amountsVisible!=='boolean')return null;
  if(value.totals.some(t=>!t||typeof t.currency!=='string'||t.currency.length>12||!Number.isFinite(Number(t.amount))))return null;
  return {day:value.day,entries:value.entries,totals:value.amountsVisible?value.totals:[],records:[],summary:true,amountsVisible:value.amountsVisible};
 }catch{return null;}
}
