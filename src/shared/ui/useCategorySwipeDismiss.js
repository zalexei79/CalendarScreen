import {useEffect,useRef} from 'react';

// Keep the gesture outside the sheet's entrance animation and glass surface.
export default function useCategorySwipeDismiss(panelRef,motionRef,{disabled,onDismissStart,onDismiss}){
 const config=useRef();config.current={disabled,onDismissStart,onDismiss};
 useEffect(()=>{
  const panel=panelRef.current,motion=motionRef.current;
  let gesture=null,offset=0,frame=0,timer=0,suppressClickUntil=0,exiting=false;
  const reduced=()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const paint=()=>{frame=0;motion.style.setProperty('--cp-drag-y',`${offset}px`);};
  const move=value=>{offset=Math.max(0,value);if(!frame)frame=requestAnimationFrame(paint);};
  const reset=()=>{gesture=null;motion.classList.remove('is-dragging');motion.classList.add('is-settling');move(0);};
  const start=event=>{
   if(event.touches.length!==1){if(gesture?.active)reset();gesture=null;return;}
   if(exiting||config.current.disabled||!window.matchMedia('(max-width: 639px)').matches||event.target.closest('input,textarea,select,[contenteditable="true"]'))return;
   let node=event.target;
   while(node&&node!==panel){
    if(node.scrollHeight>node.clientHeight+1&&/(auto|scroll)/.test(getComputedStyle(node).overflowY)&&node.scrollTop>0)return;
    node=node.parentElement;
   }
   const touch=event.touches[0],rect=motion.getBoundingClientRect();
   gesture={x:touch.clientX,y:touch.clientY,started:performance.now(),active:false,exitY:(window.visualViewport?.height||window.innerHeight)-rect.top+24};
  };
  const drag=event=>{
   if(!gesture||exiting)return;
   if(event.touches.length!==1||config.current.disabled){reset();return;}
   const touch=event.touches[0],dx=touch.clientX-gesture.x,dy=touch.clientY-gesture.y;
   if(!gesture.active){
    if(Math.max(Math.abs(dx),Math.abs(dy))<8)return;
    if(dy<=0||Math.abs(dx)>Math.abs(dy)*1.1){gesture=null;return;}
    if(!event.cancelable){gesture=null;return;}
    gesture.active=true;motion.classList.remove('is-settling');motion.classList.add('is-dragging');
   }
   if(event.cancelable)event.preventDefault();
   event.stopPropagation();suppressClickUntil=performance.now()+450;move(dy);
  };
  const end=event=>{
   const current=gesture;gesture=null;
   if(!current?.active)return;
   event.stopPropagation();suppressClickUntil=performance.now()+450;
   const velocity=offset/Math.max(1,performance.now()-current.started);
   if(config.current.disabled||(offset<88&&(offset<24||velocity<.55))){reset();return;}
   exiting=true;motion.classList.remove('is-dragging');motion.classList.add('is-dismissing');
   config.current.onDismissStart?.();move(Math.max(current.exitY,offset+80));
   timer=window.setTimeout(()=>config.current.onDismiss?.(),reduced()?0:220);
  };
  const cancel=()=>{if(gesture?.active)reset();else gesture=null;};
  const click=event=>{if(performance.now()<suppressClickUntil){event.preventDefault();event.stopImmediatePropagation();}};
  panel.addEventListener('touchstart',start,{passive:true});
  panel.addEventListener('touchmove',drag,{passive:false});
  panel.addEventListener('touchend',end,{passive:true});
  panel.addEventListener('touchcancel',cancel,{passive:true});
  panel.addEventListener('click',click,true);
  return()=>{cancelAnimationFrame(frame);clearTimeout(timer);panel.removeEventListener('touchstart',start);panel.removeEventListener('touchmove',drag);panel.removeEventListener('touchend',end);panel.removeEventListener('touchcancel',cancel);panel.removeEventListener('click',click,true);};
 },[panelRef,motionRef]);
}
