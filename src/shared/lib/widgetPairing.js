const setupKey='dayris_widget_setup';
export function widgetSetupActive(location,storage,now=Date.now()){
 const requested=new URL(location.href).searchParams.get('widgetSetup')==='1';
 let started=0;try{started=Number(storage.getItem(setupKey));if(requested){started=now;storage.setItem(setupKey,String(now));}}catch{}
 return requested||(started>0&&now>=started&&now-started<5*60*1000);
}
export function finishWidgetSetup(location,history,storage){
 try{storage.removeItem(setupKey);}catch{}
 const url=new URL(location.href);url.searchParams.delete('widgetSetup');history.replaceState(history.state,'',url.pathname+url.search+url.hash);
}
export function readWidgetHandshake(event,location,active){
 if(!active||event.origin!==location.origin||!event.ports?.[0])return null;
 let data;try{data=JSON.parse(event.data);}catch{return null;}
 if(data.type!=='dayris.widget.hello'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(data.nonce))return null;
 return {port:event.ports[0],nonce:data.nonce};
}
