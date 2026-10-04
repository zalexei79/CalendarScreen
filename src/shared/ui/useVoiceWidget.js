import {useEffect,useRef,useState} from 'react';

export default function useVoiceWidget(onChange){
 const [host,setHost]=useState(null),[failed,setFailed]=useState(false),[opening,setOpening]=useState(false);
 const widget=useRef(null),mounted=useRef(true),callback=useRef(onChange),pending=useRef(false);
 callback.current=onChange;
 const returnToCalendar=()=>{const current=widget.current;widget.current=null;if(mounted.current){setHost(null);setFailed(false);}callback.current?.(false);current?.close();};
 useEffect(()=>{mounted.current=true;return ()=>{mounted.current=false;callback.current?.(false);const current=widget.current;widget.current=null;current?.close();};},[]);
 async function open(){
  if(widget.current){widget.current.focus();return;}if(pending.current)return;
  pending.current=true;setOpening(true);setFailed(false);let child;
  try{
   child=window.documentPictureInPicture?.requestWindow
    ?await window.documentPictureInPicture.requestWindow({width:430,height:590})
    :window.open('','dayris-voice-widget','popup=yes,width=430,height=590');
   if(!child)throw new Error('blocked');
   if(!mounted.current){child.close();return;}
   const doc=child.document;doc.title='DAYRIS · Voice';doc.documentElement.lang=document.documentElement.lang;
   doc.documentElement.style.fontFamily=window.getComputedStyle(document.body).fontFamily;
   // Transfer presentation only. The existing voice session and data stay in
   // the calendar; no second app, account, or microphone is initialized.
   for(const node of document.querySelectorAll('style,link[rel="stylesheet"]'))doc.head.appendChild(node.cloneNode(true));
   const base=doc.createElement('base');base.href=document.baseURI;doc.head.prepend(base);
   const style=doc.createElement('style');style.textContent='html,body{margin:0!important;padding:0!important;width:100%;height:100%;overflow:hidden;background:#141619;font-family:inherit}';doc.head.appendChild(style);
   widget.current=child;
   child.addEventListener('pagehide',()=>{if(widget.current!==child)return;widget.current=null;if(mounted.current)setHost(null);callback.current?.(false);},{once:true});
   callback.current?.(true);setHost(doc.body);child.focus();
  }catch{child?.close();if(mounted.current)setFailed(true);}
  finally{pending.current=false;if(mounted.current)setOpening(false);}
 }
 return {host,detached:Boolean(host),open,returnToCalendar,failed,opening};
}
