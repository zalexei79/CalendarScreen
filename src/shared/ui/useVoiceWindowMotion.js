import {useLayoutEffect,useRef} from 'react';

// Animate the shell's real size so text and the microphone never stretch.
export default function useVoiceWindowMotion(sheetRef,{compact,detached,moved,dragging}) {
 const previous=useRef(null),animations=useRef([]),captured=useRef(null);
 const capture=()=>{const sheet=sheetRef.current;if(sheet)captured.current=sheet.getBoundingClientRect();};
 useLayoutEffect(()=>{
  const sheet=sheetRef.current;if(!sheet)return;
  const old=previous.current;
  const entering=!old||old.node!==sheet;
  const changed=entering||old&&(old.compact!==compact||old.detached!==detached||(old.moved&&!moved));
  const interrupted=animations.current.some(animation=>animation.playState==='running');
  const visual=captured.current||(interrupted?sheet.getBoundingClientRect():null);
  // Recognition updates can render during a transition. Keep its settled
  // geometry rather than mistaking an intermediate frame for the next origin.
  if(!changed&&interrupted&&!dragging)return;
  if(changed||dragging){animations.current.forEach(animation=>animation.cancel());animations.current=[];}
  const box=sheet.getBoundingClientRect();
  previous.current={box,compact,detached,moved,node:sheet};
  captured.current=null;
  if(!changed||dragging||detached||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const returning=entering||old.detached;
  const before=visual||old?.box||box;
  const duration=compact?260:400,easing='cubic-bezier(.22,1,.36,1)';
  const dy=sheet.style.top&&sheet.style.top!=='auto'?before.top-box.top:before.bottom-box.bottom;
  const start=returning?{opacity:0,transform:'translateY(12px)'}:{height:`${before.height}px`,transform:`translate(${before.left-box.left}px,${dy}px)`};
  animations.current.push(sheet.animate([start,{height:`${box.height}px`,opacity:1,transform:'none'}],{duration,easing}));
  if(!compact){
   const content=sheet.querySelector('.voice-workspace-scroll');
   if(content)animations.current.push(content.animate([{opacity:.35,transform:'translateY(8px)'},{opacity:1,transform:'none'}],{duration:300,delay:60,easing,fill:'backwards'}));
  }
 });
 useLayoutEffect(()=>()=>animations.current.forEach(animation=>animation.cancel()),[]);
 return capture;
}
