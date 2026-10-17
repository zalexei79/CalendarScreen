import React, {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {Pin,X,GripVertical,LayoutGrid} from 'lucide-react';
import {openStudioWindow,restoreStudioLayout,windowKey} from './studioWindows.js';
import {configElements} from './siteConfig.js';
import {initialViewport,zoomViewport,homeViewport} from './studioViewport.js';
import './StudioWorkspace.css';

const LAYOUT_KEY='dayris:studio:window-layout:v1';
function loadLayout(){try{return restoreStudioLayout(localStorage.getItem(LAYOUT_KEY));}catch{return restoreStudioLayout(null);}}
export default function StudioWorkspace({selected,view,meta,open,label,renderEditor,onActivate,onClose,frameRef,calendarWidth,toolbar,config,children}) {
  const [windows,setWindows]=useState([]),[layout,setLayout]=useState(loadLayout),[links,setLinks]=useState([]),[notice,setNotice]=useState('');
  const surface=useRef(null),world=useRef(null),drag=useRef(null),pan=useRef(null),top=useRef(10),positions=useRef(layout.positions);
  const active=windowKey(selected,meta);
  const [viewport,setViewport]=useState(initialViewport);
  const camera=useRef(viewport);camera.current=viewport;
  useEffect(()=>{
    const node=surface.current;
    function wheel(event){
      if(event.target.closest('[data-studio-window]')||matchMedia('(max-width:900px)').matches)return;
      event.preventDefault();
      const rect=node.getBoundingClientRect();
      const delta=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?node.clientHeight:1);
      setViewport(v=>zoomViewport(v,{x:event.clientX-rect.left,y:event.clientY-rect.top},Math.exp(-Math.max(-300,Math.min(300,delta))*.002)));
    }
    node.addEventListener('wheel',wheel,{passive:false});return()=>node.removeEventListener('wheel',wheel);
  },[]);
  const knownIds=configElements(config).map(item=>item.id).join('|');
  useEffect(()=>{const allowed=new Set(['global',...knownIds.split('|')]);setWindows(previous=>{const next=previous.filter(p=>allowed.has(p.id));return next.length===previous.length?previous:next;});},[knownIds]);
  useEffect(()=>{
    if(!open)return;
    setWindows(previous=>{
      let next=openStudioWindow(previous,{id:selected,view,meta,label});
      if(next===previous){setNotice('Открыто 8 закреплённых окон. Закройте одно, чтобы добавить новое.');return previous;}
      const saved=positions.current.find(p=>p.key===active);
      const v=camera.current;
      const x=(Math.min(calendarWidth+76+(previous.filter(item=>item.pinned).length%2)*450,Math.max(24,(surface.current?.clientWidth||1200)-440))-v.x)/v.scale;
      if(!previous.some(p=>p.key===active))next=next.map(p=>p.key===active?{...p,x:saved?.x ?? x,y:saved?.y ?? (54-v.y)/v.scale}:p);
      return next;
    });
  },[selected,view,meta,open,label,active,calendarWidth]);
  useEffect(()=>{if(!open)setWindows(previous=>previous.filter(p=>p.key!==active||p.pinned));},[open,active]);
  function persist(calendar=layout.calendar,next=windows){positions.current=next.map(({key,x,y})=>({key,x,y}));try{localStorage.setItem(LAYOUT_KEY,JSON.stringify({calendar,positions:positions.current}));}catch{/* Layout persistence must not block editing. */}}
  function moveStart(event,key){
    if(event.button!==0||event.target.closest('button,input,textarea,select,a')||matchMedia('(max-width:900px)').matches)return;
    const item=key==='calendar'?layout.calendar:windows.find(p=>p.key===key);
    const node=event.currentTarget.closest('[data-studio-window]');node.style.zIndex=String(++top.current);
    drag.current={key,x:event.clientX,y:event.clientY,startX:item.x,startY:item.y,scale:viewport.scale};
    event.currentTarget.setPointerCapture(event.pointerId);event.preventDefault();
  }
  function move(event){const d=drag.current;if(!d)return;const x=d.startX+(event.clientX-d.x)/d.scale,y=d.startY+(event.clientY-d.y)/d.scale;if(d.key==='calendar')setLayout(previous=>({...previous,calendar:{x,y}}));else setWindows(previous=>previous.map(p=>p.key===d.key?{...p,x,y}:p));}
  function moveEnd(){if(!drag.current)return;drag.current=null;persist();}
  function arrange(){const calendar={x:24,y:54};const next=windows.map((p,i)=>({...p,x:calendarWidth+76+(i%2)*450,y:54+Math.floor(i/2)*520}));setLayout(previous=>({...previous,calendar}));setWindows(next);persist(calendar,next);setViewport(initialViewport);}
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
        const zoom=matchMedia('(max-width:900px)').matches?1:viewport.scale;
        const tr=target.getBoundingClientRect(),x=anchor?(fr.left+anchor.right*scale-wr.left)/zoom:layout.calendar.x+calendarWidth,y=anchor?(fr.top+(anchor.top+anchor.height/2)*scale-wr.top)/zoom:layout.calendar.y+32;
        if(anchor&&(anchor.top<0||anchor.top>frame.offsetHeight))return null;
        const tx=(tr.left-wr.left)/zoom,ty=(tr.top-wr.top)/zoom+25;
        return {key:p.key,d:`M ${x} ${y} C ${x+70} ${y}, ${tx-70} ${ty}, ${tx} ${ty}`};
      }).filter(Boolean));
    });};
    draw();const ro=new ResizeObserver(draw);if(world.current)ro.observe(world.current);frameRef.current?.addEventListener('load',draw);let doc;try{doc=frameRef.current?.contentDocument;doc?.addEventListener('scroll',draw,true);}catch{}
    return()=>{cancelAnimationFrame(raf);ro.disconnect();frameRef.current?.removeEventListener('load',draw);doc?.removeEventListener('scroll',draw,true);};
  },[windows,layout.calendar,calendarWidth,frameRef,config,viewport]);
  const width=Math.max(1400,layout.calendar.x+calendarWidth+40,...windows.map(p=>p.x+(p.view==='sources'||p.view==='release'?740:420)+40));
  const height=Math.max(1250,layout.calendar.y+1100,...windows.map(p=>p.y+850));
  return <section className="studio-workspace" aria-label="Песочница DAYRIS">
    <div className="studio-workspace-tools">{toolbar}</div>
    <div className="studio-workspace-bar"><span>Календарь → элемент → окно редактора</span><button onClick={()=>setViewport(homeViewport(layout.calendar))}>К календарю</button><div className="studio-canvas-zoom"><button aria-label="Отдалить полотно" onClick={()=>setViewport(v=>zoomViewport(v,{x:surface.current.clientWidth/2,y:surface.current.clientHeight/2},1/1.2))}>−</button><output aria-label="Масштаб полотна">{Math.round(viewport.scale*100)}%</output><button aria-label="Приблизить полотно" onClick={()=>setViewport(v=>zoomViewport(v,{x:surface.current.clientWidth/2,y:surface.current.clientHeight/2},1.2))}>+</button></div><button onClick={arrange}><LayoutGrid size={16}/> Собрать окна</button><small>Колесо на фоне — масштаб · тянуть фон — перемещение · заголовок — переместить окно</small></div>
    {notice&&<p role="status">{notice}</p>}
    <div className="studio-surface" ref={surface} aria-label="Полотно песочницы" style={{backgroundPosition:`${viewport.x}px ${viewport.y}px`,backgroundSize:`${22*viewport.scale}px ${22*viewport.scale}px`}} onPointerDown={event=>{if(event.button!==0||event.target.closest('[data-studio-window]')||matchMedia('(max-width:900px)').matches)return;pan.current={x:event.clientX,y:event.clientY,left:viewport.x,top:viewport.y};surface.current.setPointerCapture(event.pointerId);surface.current.classList.add('studio-panning');event.preventDefault();}} onPointerMove={event=>{if(!pan.current)return;const p=pan.current;setViewport(v=>({...v,x:p.left+event.clientX-p.x,y:p.top+event.clientY-p.y}));}} onPointerUp={()=>{pan.current=null;surface.current.classList.remove('studio-panning');}} onPointerCancel={()=>{pan.current=null;surface.current.classList.remove('studio-panning');}}>
      <div className="studio-world" ref={world} style={{width,height,transform:`translate(${viewport.x}px,${viewport.y}px) scale(${viewport.scale})`}}>
        <svg className="studio-links" width="1" height="1" aria-hidden="true">{links.map(p=><path key={p.key} d={p.d}/>)}</svg>
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
