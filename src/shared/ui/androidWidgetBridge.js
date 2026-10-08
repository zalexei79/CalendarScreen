import {widgetSetupActive,readWidgetHandshake} from '../lib/widgetPairing.js';
let handshake=null;
const listeners=new Set();
// Capture the first transferred MessagePort before authentication/onboarding
// renders the configuration card. Later native messages may not transfer it.
if(typeof window!=='undefined')window.addEventListener('message',event=>{
 let storage;try{storage=window.sessionStorage;}catch{}
 if(event.origin===window.location.origin&&handshake){
  let data;try{data=JSON.parse(event.data);}catch{}
  if(data?.type==='dayris.widget.confirmed'&&data.nonce===handshake.nonce){handshake={...handshake,confirmed:true};for(const listener of listeners)listener(handshake);return;}
 }
 const next=readWidgetHandshake(event,window.location,widgetSetupActive(window.location,storage));
 if(!next)return;
 handshake=next;for(const listener of listeners)listener(next);
});
export function currentWidgetHandshake(){return handshake;}
export function watchWidgetHandshake(listener){listeners.add(listener);if(handshake)listener(handshake);return()=>listeners.delete(listener);}
export function clearWidgetHandshake(){handshake=null;}
