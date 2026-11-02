import {useEffect,useRef} from 'react';

// A backdrop tap must start and finish outside the dialog. Dragging out of a
// field or scrolling inside the panel must not dismiss it.
export default function useDialogBackdropDismiss(ref,active,onDismiss){
 const dismiss=useRef(onDismiss);dismiss.current=onDismiss;
 useEffect(()=>{
  const node=ref.current;if(!active||!node)return;
  let outsidePress=false;
  const outside=event=>{if(event.target!==node)return false;const rect=node.getBoundingClientRect();return event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom;};
  const down=event=>{outsidePress=event.button===0&&outside(event);};
  const cancel=()=>{outsidePress=false;};
  const click=event=>{const close=outsidePress&&outside(event);outsidePress=false;if(close&&node.open)dismiss.current?.();};
  node.addEventListener('pointerdown',down);node.addEventListener('pointercancel',cancel);node.addEventListener('click',click);
  return()=>{node.removeEventListener('pointerdown',down);node.removeEventListener('pointercancel',cancel);node.removeEventListener('click',click);};
 },[ref,active]);
}
