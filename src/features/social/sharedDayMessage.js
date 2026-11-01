const PREFIX='DAYRIS_DAY_V1\n';
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
