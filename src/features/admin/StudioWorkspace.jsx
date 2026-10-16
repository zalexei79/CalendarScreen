import React, {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {Pin,X,GripVertical,LayoutGrid} from 'lucide-react';
import {openStudioWindow,restoreStudioLayout,windowKey} from './studioWindows.js';
import {configElements} from './siteConfig.js';
import './StudioWorkspace.css';

const LAYOUT_KEY='dayris:studio:window-layout:v1';
function loadLayout(){try{return restoreStudioLayout(localStorage.getItem(LAYOUT_KEY));}catch{return restoreStudioLayout(null);}}
export default function StudioWorkspace({selected,view,meta,open,label,renderEditor,onActivate,onClose,frameRef,calendarWidth,toolbar,config,children}) {
  const [windows,setWindows]=useState([]),[layout,setLayout]=useState(loadLayout),[links,setLinks]=useState([]),[notice,setNotice]=useState('');
  const surface=useRef(null),world=useRef(null),drag=useRef(null),pan=useRef(null),top=useRef(10),positions=useRef(layout.positions);
  const active=windowKey(selected,meta);
  const knownIds=configElements(config).map(item=>item.id).join('|');
  useEffect(()=>{const allowed=new Set(['global',...knownIds.split('|')]);setWindows(previous=>{const next=previous.filter(p=>allowed.has(p.id));return next.length===previous.length?previous:next;});},[knownIds]);
  useEffect(()=>{
    if(!open)return;
    setWindows(previous=>{
      let next=openStudioWindow(previous,{id:selected,view,meta,label});
      if(next===previous){setNotice('Открыто 8 закреплённых окон. Закройте одно, чтобы добавить новое.');return previous;}
      const saved=positions.current.find(p=>p.key===active);
      if(!previous.some(p=>p.key===active))next=next.map(p=>p.key===active?{...p,x:saved?.x ?? calendarWidth+76+(previous.filter(item=>item.pinned).length%2)*450,y:saved?.y ?? (surface.current?.scrollTop || 0)+54}:p);
      return next;
    });
  },[selected,view,meta,open,label,active,calendarWidth]);
  useEffect(()=>{if(!open)setWindows(previous=>previous.filter(p=>p.key!==active||p.pinned));},[open,active]);
  function persist(calendar=layout.calendar,next=windows){positions.current=next.map(({key,x,y})=>({key,x,y}));try{localStorage.setItem(LAYOUT_KEY,JSON.stringify({calendar,positions:positions.current}));}catch{/* Layout persistence must not block editing. */}}
  function moveStart(event,key){
    if(event.button!==0||event.target.closest('button,input,textarea,select,a')||matchMedia('(max-width:900px)').matches)return;
    const item=key==='calendar'?layout.calendar:windows.find(p=>p.key===key);
    const node=event.currentTarget.closest('[data-studio-window]');node.style.zIndex=String(++top.current);
    drag.current={key,x:event.clientX,y:event.clientY,startX:item.x,startY:item.y,scrollX:surface.current.scrollLeft,scrollY:surface.current.scrollTop};
    event.currentTarget.setPointerCapture(event.pointerId);event.preventDefault();
  }
  function move(event){const d=drag.current;if(!d)return;const x=Math.max(16,d.startX+event.clientX-d.x+surface.current.scrollLeft-d.scrollX),y=Math.max(16,d.startY+event.clientY-d.y+surface.current.scrollTop-d.scrollY);if(d.key==='calendar')setLayout(previous=>({...previous,calendar:{x,y}}));else setWindows(previous=>previous.map(p=>p.key===d.key?{...p,x,y}:p));}
  function moveEnd(){if(!drag.current)return;drag.current=null;persist();}
  function arrange(){const calendar={x:24,y:54};const next=windows.map((p,i)=>({...p,x:calendarWidth+76+(i%2)*450,y:54+Math.floor(i/2)*520}));setLayout(previous=>({...previous,calendar}));setWindows(next);persist(calendar,next);surface.current.scrollTo({left:0,top:0});}
  function activate(p,nextView=p.view){return onActivate(p.id,nextView,p.meta);}
  function close(p){if(p.key===active&&!onClose())return;setWindows(previous=>previous.filter(item=>item.key!==p.key));}
  useLayoutEffect(()=>{
    let raf;
    const draw=()=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(()=>{
      const wr=world.current?.getBoundingClientRect(),frame=frameRef.current;if(!wr||!frame)return;
      const fr=frame.getBoundingClientRect(),scale=fr.width/frame.offsetWidth;
      setLinks(windows.map(p=>{
        const target=[...world.current.querySelectorAll('[data-editor-key]')].find(n=>n.dataset.editorKey===p.key);if(!target)return null;
        let anchor;
        try {const selector=p.meta?.selector || configElements(config).find(item=>item.id===p.id)?.selector;anchor=selector?frame.contentDocument?.querySelector(selector)?.getBoundingClientRect():null;}catch{/* Real application can navigate away while testing. */}
        const tr=target.getBoundingClientRect(),x=anchor?fr.left+anchor.right*scale-wr.left:layout.calendar.x+calendarWidth,y=anchor?fr.top+(anchor.top+anchor.height/2)*scale-wr.top:layout.calendar.y+32;
        if(anchor&&(anchor.top<0||anchor.top>frame.offsetHeight))return null;
        const tx=tr.left-wr.left,ty=tr.top-wr.top+25;
        return {key:p.key,d:`M ${x} ${y} C ${x+70} ${y}, ${tx-70} ${ty}, ${tx} ${ty}`};
      }).filter(Boolean));
    });};
    draw();const ro=new ResizeObserver(draw);if(world.current)ro.observe(world.current);frameRef.current?.addEventListener('load',draw);let doc;try{doc=frameRef.current?.contentDocument;doc?.addEventListener('scroll',draw,true);}catch{}
    return()=>{cancelAnimationFrame(raf);ro.disconnect();frameRef.current?.removeEventListener('load',draw);doc?.removeEventListener('scroll',draw,true);};
  },[windows,layout.calendar,calendarWidth,frameRef,config]);
  const width=Math.max(1400,layout.calendar.x+calendarWidth+40,...windows.map(p=>p.x+(p.view==='sources'||p.view==='release'?740:420)+40));
  const height=Math.max(1250,layout.calendar.y+1100,...windows.map(p=>p.y+850));
  return <section className="studio-workspace" aria-label="Песочница DAYRIS">
    <div className="studio-workspace-tools">{toolbar}</div>
    <div className="studio-workspace-bar"><span>Календарь → элемент → окно редактора</span><button onClick={arrange}><LayoutGrid size={16}/> Собрать окна</button><small>За заголовок — переместить · булавка — оставить открытым</small></div>
    {notice&&<p role="status">{notice}</p>}
    <div className="studio-surface" ref={surface} aria-label="Полотно песочницы" onPointerDown={event=>{if(event.button!==0||event.target.closest('[data-studio-window]')||matchMedia('(max-width:900px)').matches)return;pan.current={x:event.clientX,y:event.clientY,left:surface.current.scrollLeft,top:surface.current.scrollTop};surface.current.setPointerCapture(event.pointerId);event.preventDefault();}} onPointerMove={event=>{if(!pan.current)return;surface.current.scrollLeft=pan.current.left+pan.current.x-event.clientX;surface.current.scrollTop=pan.current.top+pan.current.y-event.clientY;}} onPointerUp={()=>{pan.current=null;}} onPointerCancel={()=>{pan.current=null;}}>
      <div className="studio-world" ref={world} style={{width,height}}>
        <svg className="studio-links" width={width} height={height} aria-hidden="true">{links.map(p=><path key={p.key} d={p.d}/>)}</svg>
        <section className="studio-calendar-window" data-studio-window="calendar" style={{left:layout.calendar.x,top:layout.calendar.y,width:calendarWidth}}>
          <header className="studio-window-header" onPointerDown={e=>moveStart(e,'calendar')} onPointerMove={move} onPointerUp={moveEnd} onPointerCancel={moveEnd}><GripVertical size={16}/><strong>Календарь · живой предпросмотр</strong></header>
          {children}
        </section>
        {windows.map(p=><section key={p.key} data-studio-window={p.id} data-editor-key={p.key} data-pinned={p.pinned} className={`studio-element-window${p.view==='sources'||p.view==='release'?' studio-window-wide':''}${p.key===active?' studio-window-active':''}`} style={{left:p.x,top:p.y}} aria-label={`Редактор · ${p.label}`} onPointerDownCapture={e=>{e.currentTarget.style.zIndex=String(++top.current);}}>
          <header className="studio-window-header" onPointerDown={e=>moveStart(e,p.key)} onPointerMove={move} onPointerUp={moveEnd} onPointerCancel={moveEnd}><GripVertical size={16}/><strong>{p.label}</strong><button aria-label={`Закрепить окно ${p.label}`} aria-pressed={p.pinned} title="Оставить открытым при выборе другого элемента" onClick={()=>setWindows(previous=>previous.map(item=>item.key===p.key?{...item,pinned:!item.pinned}:item))}><Pin size={16}/>{p.pinned&&<span>Закреплено</span>}</button><button aria-label="Закрыть редактор элемента" onClick={()=>close(p)}><X size={18}/></button></header>
          <div className="studio-window-body">{renderEditor({...p,active:p.key===active,onView:next=>activate(p,next),onSelect:(id,nextMeta)=>onActivate(id,'design',nextMeta)})}</div>
        </section>)}
      </div>
    </div>
  </section>;
}
