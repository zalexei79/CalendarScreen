import React,{useLayoutEffect,useRef} from 'react';
import {createPortal} from 'react-dom';
import './CalendarAnchoredPopover.css';

// Top-layer menus stay outside the header's grid, transforms and clipping.
export default function CalendarAnchoredPopover({open,onClose,anchorRef,id,label,className='',isLight=false,width=304,children,onKeyDown}){
  const panel=useRef(null),lastAnchor=useRef(null),visible=useRef(open),close=useRef(onClose);close.current=onClose;visible.current=open;
  useLayoutEffect(()=>{
    const node=panel.current,sync=()=>{if(!node.matches(':popover-open')&&visible.current)close.current();};
    node.addEventListener('toggle',sync);return()=>node.removeEventListener('toggle',sync);
  },[]);
  useLayoutEffect(()=>{
    const node=panel.current;
    if(!open){
      if(node.matches(':popover-open')){
        const restore=node.contains(document.activeElement)||document.activeElement===document.body;
        node.hidePopover();
        if(restore)lastAnchor.current?.focus({preventScroll:true});
      }
      return;
    }
    function position(){
      const anchor=anchorRef.current?.getBoundingClientRect();if(!anchor)return;
      const viewport=window.visualViewport,left=viewport?.offsetLeft||0,top=viewport?.offsetTop||0;
      const availableWidth=viewport?.width||innerWidth,availableHeight=viewport?.height||innerHeight;
      const size=Math.min(width,availableWidth-24);
      Object.assign(node.style,{width:size+'px',maxHeight:Math.max(0,availableHeight-24)+'px'});
      const x=Math.max(left+12,Math.min(anchor.left,left+availableWidth-size-12));
      const height=node.offsetHeight;
      const y=anchor.bottom+8+height<=top+availableHeight-12?anchor.bottom+8:Math.max(top+12,Math.min(anchor.top-height-8,top+availableHeight-height-12));
      Object.assign(node.style,{left:x+'px',top:y+'px',transformOrigin:`${Math.max(16,Math.min(size-16,anchor.left+anchor.width/2-x))}px ${y<anchor.top?'100%':'0%'}`});
    }
    lastAnchor.current=anchorRef.current;
    node.style.visibility='hidden';if(!node.matches(':popover-open'))node.showPopover();position();node.style.visibility='';
    (node.querySelector('[aria-pressed="true"]')||node.querySelector('button:not(:disabled)'))?.focus({preventScroll:true});
    const scroll=event=>{
      if(event.target instanceof Node&&node.contains(event.target))return;
      const anchor=anchorRef.current?.getBoundingClientRect(),viewport=window.visualViewport;
      if(!anchor||anchor.bottom<=(viewport?.offsetTop||0)||anchor.top>=(viewport?.height||innerHeight)+(viewport?.offsetTop||0))close.current();
      else position();
    };
    // Commit dismissal before another header trigger receives its click.
    const outside=event=>{if(!node.contains(event.target)&&!anchorRef.current?.contains(event.target))close.current();};
    document.addEventListener('pointerdown',outside,true);
    window.addEventListener('resize',position);window.visualViewport?.addEventListener('resize',position);window.addEventListener('scroll',scroll,true);
    return()=>{document.removeEventListener('pointerdown',outside,true);window.removeEventListener('resize',position);window.visualViewport?.removeEventListener('resize',position);window.removeEventListener('scroll',scroll,true);};
  },[open,anchorRef,width]);
  return createPortal(<div ref={panel} id={id} popover="auto" role="dialog" aria-label={label} data-light={isLight} className={`calendar-anchored-popover ${className}`} onKeyDown={event=>{
    if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close.current();return;}
    onKeyDown?.(event,panel.current);
  }}>{children}</div>,document.body);
}
