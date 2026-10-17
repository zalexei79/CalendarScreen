import React,{useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Eye,Save,Upload,ArrowLeft,RefreshCw,ShieldCheck} from 'lucide-react';
import LocalProjectTools from './LocalProjectTools.jsx';
import {canPreparePreview} from './previewModel.js';
import './StudioPreviewWindow.css';

export default function StudioPreviewWindow({popup,snapshot,currentSignature,dirty,sourceDirty,busy,connected,savedPath,status,saveReview,onSave,onConnect,onRefresh,onClose}){
  const [mount,setMount]=useState(null),[device,setDevice]=useState(snapshot.device),[scale,setScale]=useState(1),[interactive,setInteractive]=useState(false),[reviewed,setReviewed]=useState(false),[release,setRelease]=useState(false),[reviewedProject,setReviewedProject]=useState(null),[reviewing,setReviewing]=useState(false),[reviewNotice,setReviewNotice]=useState('');
  const frame=useRef(null),area=useRef(null),latest=useRef(null),reviewRequest=useRef(0);
  const stale=snapshot.signature!==currentSignature;
  const canPublish=canPreparePreview({snapshot,currentSignature,dirty,sourceDirty,reviewed:reviewed&&Boolean(reviewedProject)&&!reviewing});
  latest.current={snapshot,interactive,scale,onSave,canSave:!stale&&!sourceDirty&&!busy&&dirty,canReview:!stale&&!sourceDirty&&!busy&&!dirty};
  useEffect(()=>{
    popup.document.title='DAYRIS · Посмотреть мою версию';popup.document.documentElement.lang='ru';popup.document.body.style.margin='0';
    const styles=[...document.querySelectorAll('style,link[rel="stylesheet"]')].map(node=>node.cloneNode(true));styles.forEach(node=>popup.document.head.append(node));
    const host=popup.document.createElement('div');popup.document.body.replaceChildren(host);setMount(host);
    const close=()=>onClose();popup.addEventListener('pagehide',close);
    return()=>{popup.removeEventListener('pagehide',close);styles.forEach(n=>n.remove());if(!popup.closed)popup.close();};
  },[popup]);
  useEffect(()=>{reviewRequest.current++;setReviewed(false);setRelease(false);setReviewedProject(null);setReviewing(false);setReviewNotice('');},[snapshot.signature,snapshot.createdAt,currentSignature,savedPath,sourceDirty]);
  async function acknowledge(checked){
    const request=++reviewRequest.current;setReviewed(checked);setReviewedProject(null);setReviewNotice('');if(!checked)return;
    setReviewing(true);
    try{const response=await fetch('/__dayris_desk/status',{headers:{'X-Dayris-Desk-Token':window.__DAYRIS_DESK_TOKEN__}});const value=await response.json();if(!response.ok)throw new Error(value.error||'Не удалось проверить файлы проекта.');if(request===reviewRequest.current&&latest.current.canReview){setReviewedProject(value);setReviewed(true);}}
    catch(error){if(request===reviewRequest.current){setReviewNotice(error.message);setReviewed(false);}}
    finally{if(request===reviewRequest.current)setReviewing(false);}
  }
  useEffect(()=>{const key=e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();if(!stale&&!sourceDirty&&!busy&&dirty)onSave();}};popup.addEventListener('keydown',key);return()=>popup.removeEventListener('keydown',key);},[popup,stale,sourceDirty,busy,dirty,onSave]);
  function send(){const value=latest.current;frame.current?.contentWindow?.postMessage({type:'dayris:preview',config:value.snapshot.config,localCSS:value.snapshot.css,inspect:!value.interactive,previewOnly:true,selected:'global'},location.origin);}
  useEffect(()=>{
    const message=e=>{if(e.origin!==location.origin||e.source!==frame.current?.contentWindow)return;if(e.data?.type==='dayris:preview-ready')send();if(e.data?.type==='dayris:save-request'&&latest.current.canSave)latest.current.onSave();if(e.data?.type==='dayris:zoom'&&Number.isFinite(e.data.delta))setScale(previous=>Math.max(.25,Math.min(2.5,previous*Math.exp(-Math.max(-120,Math.min(120,e.data.delta))*.0025))));};
    popup.addEventListener('message',message);return()=>popup.removeEventListener('message',message);
  },[popup]);
  useEffect(()=>{send();},[snapshot,interactive]);
  useEffect(()=>{if(!area.current)return;const node=area.current;const wheel=e=>{if(!(e.ctrlKey||e.metaKey)||e.shiftKey)return;e.preventDefault();setScale(previous=>Math.max(.25,Math.min(2.5,previous*Math.exp(-Math.max(-120,Math.min(120,e.deltaY))*.0025))));};node.addEventListener('wheel',wheel,{passive:false});return()=>node.removeEventListener('wheel',wheel);},[mount]);
  if(!mount)return null;
  return createPortal(<main className="dayris-admin studio-result">
    <header className="studio-result-header"><div><small>ЛОКАЛЬНЫЙ ПРЕДПРОСМОТР</small><h1><Eye size={24}/> Моя версия календаря</h1><p>Черновик от {new Date(snapshot.createdAt).toLocaleTimeString('ru')} · не опубликован</p></div><button onClick={()=>{window.focus();popup.close();}}><ArrowLeft size={16}/> К редактору</button></header>
    <nav className="studio-result-actions" aria-label="Сохранение и выпуск"><button className="admin-primary" disabled={busy||stale||sourceDirty||!dirty} onClick={onSave}><Save size={17}/> {dirty?'Сохранить локально':'Сохранено локально'}</button>{!connected&&<button onClick={()=>onConnect(popup)}>Подключить папку проекта</button>}<button disabled={!canPublish} onClick={()=>setRelease(true)}><Upload size={17}/> Подготовить push</button><button disabled={sourceDirty} onClick={onRefresh}><RefreshCw size={16}/> Обновить просмотр</button></nav>
    <section className="studio-result-status" aria-live="polite">{stale?<p role="alert">В редакторе есть новая версия. Обновите просмотр перед сохранением и push.</p>:<p>Показаны оформление и команды этого черновика. Код берётся из сохранённых файлов проекта; Vite обновляет его при изменении файлов.</p>}{sourceDirty&&<p role="alert">Сначала сохраните исходник в редакторе: несохранённый код не выполняется.</p>}{status&&<p>{status}</p>}</section>
    {saveReview}
    <div className="studio-result-controls"><div className="admin-tabs" role="group" aria-label="Размер результата"><button aria-pressed={device==='mobile'} onClick={()=>setDevice('mobile')}>Телефон</button><button aria-pressed={device==='desktop'} onClick={()=>setDevice('desktop')}>ПК</button></div><button onClick={()=>setScale(Math.max(.25,scale-.1))} aria-label="Уменьшить результат">−</button><button onClick={()=>setScale(1)}>{Math.round(scale*100)}%</button><button onClick={()=>setScale(Math.min(2.5,scale+.1))} aria-label="Увеличить результат">+</button><small>Колесо — прокрутка · Ctrl+колесо — масштаб</small></div>
    <label className="admin-check studio-result-permission"><input type="checkbox" checked={interactive} onChange={e=>setInteractive(e.target.checked)}/>Разрешить действия в моём аккаунте: кнопки могут изменять реальные данные</label><p className="studio-result-status">Это приложение в вашей сессии, не копия базы. По умолчанию заблокированы нажатия; фоновые запросы продолжают работать.</p>
    <div className="studio-result-canvas" ref={area}><div style={{width:(device==='mobile'?390:1280)*scale,height:780*scale,position:'relative',margin:'0 auto'}}><iframe key={snapshot.createdAt} ref={frame} title="Моя версия DAYRIS" src="/?adminPreview=1&localStudio=1" allow="microphone" onLoad={send} style={{width:device==='mobile'?390:1280,height:780,transform:`scale(${scale})`,transformOrigin:'top left',position:'absolute',border:0}}/></div></div>
    <label className="admin-check studio-result-reviewed"><input type="checkbox" disabled={stale||sourceDirty||dirty||reviewing} checked={reviewed} onChange={e=>acknowledge(e.target.checked)}/><ShieldCheck size={18}/>Я проверил эту версию. После локального сохранения можно подготовить push.</label>
    {reviewing&&<p className="studio-result-status" role="status">Сверяем сохранённые файлы проекта…</p>}{reviewNotice&&<p className="studio-result-status" role="alert">{reviewNotice}</p>}
    {release&&<LocalProjectTools local savedPath={savedPath} dirty={!canPublish} reviewedProject={reviewedProject} hidePreview/>}
  </main>,mount);
}
