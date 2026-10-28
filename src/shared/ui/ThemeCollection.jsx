import React,{useEffect,useId,useRef,useState} from 'react';
import {Check,Crown,Gem,LockKeyhole,X,ArrowUpRight} from 'lucide-react';
import {APPEARANCE_COPY} from './appearanceCopy.js';
import './ThemeCollection.css';
import GlassParallaxControl from './GlassParallaxControl.jsx';

function MaterialPreview({code}) {
  return <span className="theme-material-art" data-material={code} aria-hidden="true">
    <span className="theme-art-wordmark">DAYRIS<span>PRO</span></span>
    <span className="theme-art-calendar">{Array.from({length:14},(_,i)=><i key={i} data-tone={i===5?'income':i===8?'expense':undefined} data-today={i===6||undefined}>{i+1}</i>)}</span>
    <span className="theme-art-dock"><i/><i/><i/></span>
  </span>;
}

export default function ThemeCollection({language,theme,preference=theme,active=false,loading=false,onSelect,onPro,context='settings',children}) {
  const locale=language==='uk'?'uk':language?.startsWith('zh')?'zh':['ro','md'].includes(language)?'ro':language==='ru'?'ru':'en';
  const copy=APPEARANCE_COPY[locale];
  const basicPreference=['gold','emerald'].includes(preference)&&!active?theme:preference;
  const [preview,setPreview]=useState(null),dialog=useRef(null),id=useId();
  useEffect(()=>{
    if(!preview) return;
    const node=dialog.current;node.showModal();
    return ()=>{if(node.open)node.close();};
  },[preview]);
  function choose(code) {if(loading)return;if(active)onSelect(code);else setPreview(code);}
  function openPro() {setPreview(null);onPro?.();}
  return <section className={`theme-collection theme-collection-${context}`} data-current-theme={theme} aria-label={copy.title}>
    <div className="theme-basic-heading">{copy.basic}</div>
    <div className="theme-basics" role="group" aria-label={copy.basic}>
      {['light','dark','system','purple'].map(code=><button key={code} type="button" className="theme-basic-option" data-theme-option={code} aria-label={copy[code]} aria-pressed={basicPreference===code} onClick={()=>onSelect(code)}>
        <span className="theme-basic-sample" data-material={code} aria-hidden="true"><i/><i/><i/><i/>{basicPreference===code&&<Check size={12}/>}</span><span>{copy[code]}</span>
      </button>)}
    </div>
    <div className="theme-collection-heading"><div><span>DAYRIS · PRO</span><h3>{copy.collection}</h3></div><Crown size={20} aria-hidden="true"/></div>
    <p className="theme-collection-hint">{copy.hint}</p>
    <div className="theme-premium-options" role="group" aria-label={copy.collection}>
      {['gold','emerald'].map(code=><button key={code} type="button" className="theme-premium-card" data-theme-option={code} data-material={code} aria-label={copy[code]} aria-pressed={theme===code} aria-describedby={`${id}-${code}`} disabled={loading} onClick={()=>choose(code)}>
        <MaterialPreview code={code}/>
        <span className="theme-premium-state" aria-hidden="true">{theme===code?<Check size={14}/>:active?(code==='gold'?<Crown size={14}/>:<Gem size={14}/>):<LockKeyhole size={14}/>}</span>
        <span className="theme-premium-info"><strong>{copy[code]}</strong><span id={`${id}-${code}`}>{copy[`${code}Material`]}</span><small>{theme===code?copy.selected:'PRO'}</small></span>
      </button>)}
    </div>
    <p className="theme-collection-access" role={loading?'status':undefined}>{loading?copy.loading:active?copy.included:copy.exclusive}</p>
    {context!=='settings'&&<GlassParallaxControl language={language} theme={theme}/>}
    {children}
    {preview&&<dialog ref={dialog} className="theme-preview-dialog" data-material={preview} aria-labelledby={`${id}-preview-title`} onCancel={event=>{event.preventDefault();event.stopPropagation();setPreview(null);}} onKeyDown={event=>event.stopPropagation()}>
      <div className="theme-preview-toolbar"><span>DAYRIS · PRO</span><button type="button" aria-label={copy.close} onClick={()=>setPreview(null)}><X size={20}/></button></div>
      <MaterialPreview code={preview}/>
      <span className="theme-preview-eyebrow">{copy.preview}</span><h2 id={`${id}-preview-title`}>{copy[preview]}</h2><p>{copy[`${preview}Description`]}</p>
      <p className="theme-preview-access"><LockKeyhole size={14} aria-hidden="true"/>{active?copy.included:copy.exclusive}</p>
      {!onPro&&!active&&<p className="theme-preview-onboarding-note">{copy.onboarding}</p>}
      {active?<button type="button" className="theme-preview-primary" onClick={()=>{onSelect(preview);setPreview(null);}}>{copy.apply}<Check size={17}/></button>:onPro&&<button type="button" className="theme-preview-primary" onClick={openPro}>{copy.openPro}<ArrowUpRight size={17}/></button>}
      <button type="button" className="theme-preview-back" onClick={()=>setPreview(null)}>{copy.back}</button>
    </dialog>}
  </section>;
}
