import {useEffect,useRef,useState} from 'react';

const desktopQuery='(min-width: 768px) and (pointer: fine)';
const storageKey='dayris_voice_window_position';

export default function useFloatingVoiceWindow(detached=false){
 const sheetRef=useRef(null),headerRef=useRef(null),positionRef=useRef(null),gesture=useRef(null);
 const [desktop,setDesktop]=useState(false),[position,setPosition]=useState(null),[dragging,setDragging]=useState(false);
 function place(next){
  const sheet=sheetRef.current;if(!sheet)return;
  const clamped={x:Math.round(next.x),y:Math.round(next.y)};
  positionRef.current=clamped;setPosition(old=>old?.x===clamped.x&&old?.y===clamped.y?old:clamped);
 }
 function remember(){try{if(positionRef.current)sessionStorage.setItem(storageKey,JSON.stringify(positionRef.current));}catch{}}
 function reset(){gesture.current=null;positionRef.current=null;setPosition(null);setDragging(false);try{sessionStorage.removeItem(storageKey);}catch{}}
 useEffect(()=>{
  const media=window.matchMedia(desktopQuery),sheet=sheetRef.current,header=headerRef.current;
  const sync=()=>{setDesktop(media.matches&&!detached);if(!media.matches||detached){gesture.current=null;setDragging(false);}else if(positionRef.current)place(positionRef.current);};
  try{const saved=JSON.parse(sessionStorage.getItem(storageKey));if(saved&&Number.isFinite(saved.x)&&Number.isFinite(saved.y))positionRef.current=saved;}catch{}
  sync();
  function down(event){
   if(detached||!media.matches||event.button!==0||event.target.closest('button,input,select,a'))return;
   const box=sheet.getBoundingClientRect();
   gesture.current={id:event.pointerId,x:event.clientX,y:event.clientY,left:box.left,top:box.top};
   header.setPointerCapture(event.pointerId);event.preventDefault();setDragging(true);place({x:box.left,y:box.top});
  }
  function move(event){const current=gesture.current;if(!current||current.id!==event.pointerId)return;place({x:current.left+event.clientX-current.x,y:current.top+event.clientY-current.y});}
  function end(event){if(gesture.current?.id!==event.pointerId)return;gesture.current=null;setDragging(false);remember();}
  function key(event){
   if(detached||!media.matches||event.target!==header.querySelector('.voice-workspace-brand'))return;
   const delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[event.key];
   if(!delta)return;event.preventDefault();const box=sheet.getBoundingClientRect(),step=event.shiftKey?40:10;
   place({x:box.left+delta[0]*step,y:box.top+delta[1]*step});remember();
  }
  const refresh=()=>setPosition(old=>old?{...old}:old);
  const observer=new ResizeObserver(refresh);observer.observe(sheet);
  media.addEventListener('change',sync);window.addEventListener('resize',refresh);
  header.addEventListener('pointerdown',down);header.addEventListener('pointermove',move);header.addEventListener('pointerup',end);header.addEventListener('pointercancel',end);header.addEventListener('lostpointercapture',end);header.addEventListener('keydown',key);
  return ()=>{observer.disconnect();media.removeEventListener('change',sync);window.removeEventListener('resize',refresh);header.removeEventListener('pointerdown',down);header.removeEventListener('pointermove',move);header.removeEventListener('pointerup',end);header.removeEventListener('pointercancel',end);header.removeEventListener('lostpointercapture',end);header.removeEventListener('keydown',key);};
 },[detached]);
 const offscreen=desktop&&position&&(position.x+(sheetRef.current?.offsetWidth||410)<40||position.x>window.innerWidth-40||position.y+60<0||position.y>window.innerHeight-40);
 return {sheetRef,headerRef,offscreen,desktop,dragging,moved:desktop&&Boolean(position),reset,style:desktop&&position?{left:position.x,top:position.y,right:'auto',bottom:'auto',animation:'none'}:undefined};
}
