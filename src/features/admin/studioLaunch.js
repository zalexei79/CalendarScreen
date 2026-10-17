export const STUDIO_ORIGIN='http://127.0.0.1:5173';
export function allowedAdminOrigin(value){
  if(value==='https://ai-trade-journal-ejm8.onrender.com')return true;
  try{const url=new URL(value);return url.origin===value&&url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname)&&url.port==='5173';}catch{return false;}
}
export function studioLaunchURL(origin,nonce){
  const url=new URL('/project-desk.html',STUDIO_ORIGIN);
  if(allowedAdminOrigin(origin)&&/^[a-f0-9]{32}$/.test(nonce)){url.searchParams.set('adminOrigin',origin);url.searchParams.set('launch',nonce);}
  return url.href;
}
export function validStudioReply(event,popup,nonce){return Boolean(popup&&event.source===popup&&event.origin===STUDIO_ORIGIN&&event.data?.type==='dayris:studio-ready'&&event.data.nonce===nonce);}
export function notifyAdminOfStudio(){
  const params=new URLSearchParams(location.search),origin=params.get('adminOrigin'),nonce=params.get('launch');
  if(!window.opener||!allowedAdminOrigin(origin)||!/^[a-f0-9]{32}$/.test(nonce||''))return;
  window.opener.postMessage({type:'dayris:studio-ready',nonce},origin);
  window.opener=null;
}
