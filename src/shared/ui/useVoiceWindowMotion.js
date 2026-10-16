import {useLayoutEffect,useRef} from 'react';

// Size changes belong to task stages, never individual recognition events.
// Animate real height (no text scaling) so the bottom-anchored mic stays still.
export default function useVoiceWindowMotion(sheetRef,{layout,helpOpen,detached,moved,dragging}) {
 const previous=useRef(null),animations=useRef([]),captured=useRef(null);
 const capture=()=>{const sheet=sheetRef.current;if(sheet)captured.current=sheet.getBoundingClientRect();};
 useLayoutEffect(()=>{
  const sheet=sheetRef.current;if(!sheet)return;
  const old=previous.current;
  const entering=!old||old.node!==sheet;
  const resized=old&&old.layout!==layout;
  const repositioned=old&&(old.detached!==detached||(old.moved&&!moved));
  const contentChanged=old&&old.helpOpen!==helpOpen;
  const changed=entering||resized||repositioned||contentChanged;
  const interrupted=animations.current.some(animation=>animation.playState==='running');
  const visual=captured.current||(interrupted?sheet.getBoundingClientRect():old?.box);
  // Recognition updates can render during a transition. Keep its settled
  // geometry rather than mistaking an intermediate frame for the next origin.
  if(!changed&&interrupted&&!dragging)return;
  if(changed||dragging){animations.current.forEach(animation=>animation.cancel());animations.current=[];}
  const box=sheet.getBoundingClientRect();
  previous.current={box,layout,helpOpen,detached,moved,node:sheet};
  captured.current=null;
  if(!changed||dragging||detached||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const returning=entering||old.detached;
  const before=visual||old?.box||box;
  const duration=420,easing='cubic-bezier(.22,1,.36,1)';
  const dy=sheet.style.top&&sheet.style.top!=='auto'?before.top-box.top:before.bottom-box.bottom;
  const start=returning?{opacity:0,transform:'translateY(14px)'}:{opacity:1,transform:repositioned?`translate(${before.left-box.left}px,${dy}px)`:'none'};
  const end={opacity:1,transform:'none'};
  if(!returning&&Math.abs(before.height-box.height)>1){start.height=`${before.height}px`;end.height=`${box.height}px`;}
  // No forwards fill: CSS always owns the final height, including on resize.
  // Rapid guide/back actions resume from the currently painted frame.
  const frames=[start,end];
  if(start.height&&!repositioned&&Math.abs(before.height-box.height)>window.innerHeight/3)frames.splice(1,0,{height:`${(before.height+box.height)/2}px`,opacity:1,transform:'none',offset:.5});
  if(returning||repositioned||start.height)animations.current.push(sheet.animate(frames,{duration:entering?360:duration,easing}));
  const content=sheet.querySelector(helpOpen?'.voice-workspace-command-catalog':resized&&layout==='expanded'?'.voice-workspace-result:not([hidden])':'.voice-workspace-scroll');
  if(content&&(entering||resized||returning||contentChanged))animations.current.push(content.animate([{opacity:.4,transform:'translateY(6px)'},{opacity:1,transform:'none'}],{duration:320,delay:entering?40:70,easing,fill:'backwards'}));
 });
 useLayoutEffect(()=>()=>animations.current.forEach(animation=>animation.cancel()),[]);
 return capture;
}
