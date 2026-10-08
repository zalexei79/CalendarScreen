export const VOICE_LAUNCH_KEY='dayris_voice_launch';
const maxAge=5*60*1000;
export function readVoiceLaunch(location,storage,now=Date.now()){
 let pending=null;
 try{pending=JSON.parse(storage?.getItem(VOICE_LAUNCH_KEY)||'null');}catch{}
 if(!pending||typeof pending.id!=='string'||!Number.isFinite(pending.createdAt)||pending.createdAt>now||now-pending.createdAt>maxAge)pending=null;
 const url=new URL(location.href);
 if(url.searchParams.get('voice')==='1'){
  // Keep the intent through Google sign-in. It contains no financial data.
  const request=pending||{id:String(now),createdAt:now};
  try{storage?.setItem(VOICE_LAUNCH_KEY,JSON.stringify(request));}catch{}
  return request;
 }
 if(!pending)try{storage?.removeItem(VOICE_LAUNCH_KEY);}catch{}
 return pending;
}
export function consumeVoiceLaunch(location,history,storage){
 try{storage?.removeItem(VOICE_LAUNCH_KEY);}catch{}
 const url=new URL(location.href);
 if(url.searchParams.get('voice')!=='1')return;
 url.searchParams.delete('voice');
 if(['android-widget','android-shortcut'].includes(url.searchParams.get('source')))url.searchParams.delete('source');
 history.replaceState(history.state,'',url.pathname+url.search+url.hash);
}
