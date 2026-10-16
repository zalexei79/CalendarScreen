import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { configElements, EMPTY_CONFIG, normalizeConfig, safeLink } from './siteConfig.js';
import './AdminPanel.css';
import { featureFor } from './featureRegistry.js';
import VoiceCommandsEditor from './VoiceCommandsEditor.jsx';
import InspectorDialog from './InspectorDialog.jsx';
import StudioWorkspace from './StudioWorkspace.jsx';
import AdminProject from './AdminProject.jsx';
import LocalProjectTools from './LocalProjectTools.jsx';
import localDesign from '../appearance/siteDesign.json';
import localCSS from '../appearance/calendar-custom.css?raw';
import { DESIGN_PATH, STYLE_PATH, WINTER_CSS, validLocalCSS } from '../appearance/designModel.js';
import { readProjectFile, saveProjectFile, validateProjectRoot } from './projectFiles.js';
import catalog from './projectCatalog.generated.json';
import { matchSource } from './componentSource.js';

const LOCAL_DRAFT = 'dayris:site-admin:local-draft:v1';
const clone = value => JSON.parse(JSON.stringify(value));
const fields = [
  ['width', 'Ширина', 32, 1200], ['height', 'Высота', 32, 500],
  ['fontSize', 'Размер текста', 10, 64], ['radius', 'Скругление', 0, 100],
  ['x', 'Сдвиг вправо / влево', -200, 200], ['y', 'Сдвиг вниз / вверх', -200, 200],
  ['order', 'Порядок внутри ряда', -20, 20],
];
function errorText(error) {
  if (error?.code === '40001') return 'Черновик изменён в другом окне. Экспортируйте свои изменения и перезагрузите редактор.';
  if (error?.code === '42501') return 'Нет прав администратора. Проверьте аккаунт и назначение роли.';
  return 'Не удалось выполнить операцию. Проверьте подключение и установку миграции админки.';
}

export default function AdminPanel({ onOpenSource, onDirtyChange, localProject } = {}) {
  const local = Boolean(localProject && import.meta.env.DEV && window.__DAYRIS_DESK_TOKEN__ && ['localhost','127.0.0.1'].includes(location.hostname));
  const [config, setConfig] = useState(() => normalizeConfig(local ? localDesign : EMPTY_CONFIG));
  const [saved, setSaved] = useState(() => JSON.stringify(normalizeConfig(local ? localDesign : EMPTY_CONFIG)));
  const [css, setCSS] = useState(localCSS), [savedCSS, setSavedCSS] = useState(localCSS);
  const [disk, setDisk] = useState(null), [savedPath,setSavedPath] = useState('');
  const [inspectorOpen, setInspectorOpen] = useState(false), [sourcePath,setSourcePath] = useState('');
  const [sourceDirty,setSourceDirty] = useState(false), [consoleLines,setConsoleLines] = useState([]);
  const [localReview,setLocalReview] = useState(false);
  const [targetMeta,setTargetMeta] = useState(null);
  const [version, setVersion] = useState(null);
  const [access, setAccess] = useState('loading');
  const [identity, setIdentity] = useState('');
  const [device, setDevice] = useState('mobile');
  const [selected, setSelected] = useState('global');
  const [inspect, setInspect] = useState(true);
  const [view, setView] = useState('design');
  const [zoom, setZoom] = useState(local ? 'actual' : 'fit');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [releases, setReleases] = useState([]);
  const [past, setPast] = useState([]);
  const [future, setFuture] = useState([]);
  const [localAvailable, setLocalAvailable] = useState(false);
  const frame = useRef(null);
  const canvas = useRef(null);
  const controls = useRef(null);
  const [canvasWidth, setCanvasWidth] = useState(390);
  const [canvasHeight, setCanvasHeight] = useState(null);
  const file = useRef(null);
  const latest = useRef({ config, inspect, selected });
  const zoomActions = useRef(null), historyActions = useRef(null), selectionActions = useRef(null);
  const loadedRoot = useRef(null), unsavedDesign = useRef(false);
  latest.current = { config, inspect, selected, sourceDirty, ...(local ? {localCSS:css} : {}) };
  const designDirty = JSON.stringify(config) !== saved;
  const dirty = designDirty || (local && css !== savedCSS) || sourceDirty;
  unsavedDesign.current = designDirty || (local && css !== savedCSS);
  useEffect(() => { onDirtyChange?.(dirty); return () => onDirtyChange?.(false); }, [dirty, onDirtyChange]);
  const canWrite = access === 'admin' && version !== null;
  const elements = configElements(config);
  const element = elements.find(item => item.id === selected);
  const previewWidth = device === 'mobile' ? 390 : 1280;
  const fitScale = Math.min(1, Math.max(0.1, (canvasWidth - 32) / previewWidth), canvasHeight === null ? 1 : Math.max(0.1, (canvasHeight - 32) / 780));
  const scale = typeof zoom === 'number' ? zoom : zoom === 'actual' ? 1 : fitScale;
  useEffect(() => {
    if (!local || !localProject.root) return;
    if(loadedRoot.current === localProject.root && unsavedDesign.current){setStatus('Исходник обновлён извне. Несохранённый черновик оставлен в редакторе; сохранение проверит конфликт с диском.');return;}
    let alive = true;
    Promise.all([readProjectFile(localProject.root,DESIGN_PATH),readProjectFile(localProject.root,STYLE_PATH)]).then(([design,style])=>{
      const value = JSON.parse(design.text); if (value.schema !== 1 || !value.mobile || !value.desktop) throw new Error('Неверный файл оформления.');
      validLocalCSS(style.text);
      if (!alive) return;
      setConfig(normalizeConfig(value)); setSaved(JSON.stringify(normalizeConfig(value))); setCSS(style.text); setSavedCSS(style.text); setDisk({design,style}); setPast([]); setFuture([]);
      loadedRoot.current=localProject.root;
      setStatus('Оформление открыто из папки проекта. Сохранение будет локальным.');
    }).catch(error=>{if(alive)setStatus(`Не удалось открыть оформление: ${error.message}`);});
    return ()=>{alive=false;};
  },[local,localProject?.root]);

  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => {
      setCanvasWidth(entry.contentRect.width);
      setCanvasHeight(matchMedia('(min-width:901px)').matches ? entry.contentRect.height : null);
    });
    if (canvas.current) observer.observe(canvas.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (selected !== 'global' && !elements.some(item => item.id === selected)) setSelected('global');
  }, [config, selected]);

  useEffect(() => {
    if (local) { setAccess('admin'); setVersion(0); setIdentity('Локальная рабочая копия · сохранение в Git, не в Supabase'); return; }
    let alive = true;
    let generation = 0;
    let checkedUser;
    async function check(session) {
      const userId = session?.user?.id || null;
      if (checkedUser === userId) return;
      checkedUser = userId;
      const current = ++generation;
      setAccess('loading'); setVersion(null); setReleases([]);
      setIdentity(session?.user?.email || session?.user?.id || '');
      if (!session) { setAccess('guest'); return; }
      try {
        const role = await supabase.rpc('is_site_admin');
        if (!alive || current !== generation) return;
        if (role.error) { setAccess('unavailable'); return; }
        if (!role.data) { setAccess('denied'); return; }
        const [draft, history] = await Promise.all([
          supabase.from('site_config_draft').select('config,version').eq('id', 1).single(),
          supabase.from('site_config_releases').select('id,config,published_at').order('id', { ascending: false }).limit(20),
        ]);
        if (!alive || current !== generation) return;
        if (draft.error || history.error) { setAccess('unavailable'); return; }
        const normalized = normalizeConfig(draft.data.config);
        setConfig(normalized); setSaved(JSON.stringify(normalized));
        setVersion(draft.data.version); setReleases(history.data || []); setPast([]); setFuture([]);
        setAccess('admin');
      } catch { if (alive && current === generation) setAccess('unavailable'); }
    }
    // Defer DB requests outside the auth callback's internal lock.
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (_event === 'TOKEN_REFRESHED') return;
      queueMicrotask(() => { if (alive) check(session); });
    });
    try { setLocalAvailable(Boolean(localStorage.getItem(LOCAL_DRAFT))); } catch { /* optional */ }
    return () => { alive = false; generation++; data.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    const message = event => {
      if (event.origin !== location.origin || event.source !== frame.current?.contentWindow) return;
      if (event.data?.type === 'dayris:select' && (event.data.id === 'global' || configElements(latest.current.config).some(item => item.id === event.data.id))) {
        selectionActions.current?.(event.data.id,['design','logic','sources'].includes(event.data.view) ? event.data.view : (local ? 'design' : null),event.data.meta || null);
      }
      if (event.data?.type === 'dayris:preview-ready') sendPreview();
      if (event.data?.type === 'dayris:zoom' && Number.isFinite(event.data.delta) && Number.isFinite(event.data.x) && Number.isFinite(event.data.y)) zoomActions.current?.(event.data.delta,event.data.x,event.data.y);
      if (event.data?.type === 'dayris:history') historyActions.current?.[event.data.redo ? 'redo' : 'undo']?.();
      if (local && event.data?.type === 'dayris:console' && typeof event.data.message === 'string') setConsoleLines(previous=>[...previous.slice(-39),`${event.data.level === 'warn' ? 'warn' : 'error'}: ${event.data.message.slice(0,2000)}`]);
    };
    window.addEventListener('message', message);
    return () => window.removeEventListener('message', message);
  }, []);
  useEffect(() => { sendPreview(); }, [config, inspect, selected, css]);
  useEffect(() => {
    if (!dirty) return;
    const warn = event => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  function sendPreview() {
    frame.current?.contentWindow?.postMessage({ type: 'dayris:preview', ...latest.current }, location.origin);
  }
  function resumeEditing() {
    setInspect(true);
    try {
      const url = new URL(frame.current.contentWindow.location.href);
      if (url.origin === location.origin && url.pathname === '/' && url.searchParams.get('adminPreview') === '1') return;
    } catch { /* An external preview link may be cross-origin. */ }
    if (frame.current) frame.current.src = local ? '/?adminPreview=1&localStudio=1' : '/?adminPreview=1';
  }
  function change(next, nextCSS = css) {
    const normalized = normalizeConfig(next);
    if (JSON.stringify(normalized) === JSON.stringify(config) && nextCSS === css) return;
    setPast(previous => [...previous.slice(-49), {config,css}]); setFuture([]);
    setConfig(normalized); setCSS(nextCSS); setStatus('Есть несохранённые изменения.'); setLocalReview(false);
  }
  function editElement(key, value, id = selected) {
    const next = clone(config);
    const target = id === 'global' ? next[device].global : (next[device].elements[id] ||= {});
    if (value === '' || value === undefined) delete target[key]; else target[key] = value;
    change(next);
  }
  function editCustom(key, value, id = selected) {
    const next = clone(config);
    const button=next.buttons.find(item => item.id === id); if(!button)return; button[key] = value;
    change(next);
  }
  function addButton() {
    if(sourceDirty && !window.confirm('В исходнике есть несохранённый текст. Создать кнопку без сохранения исходника?'))return;
    setSourceDirty(false);setSourcePath('');setTargetMeta(null);
    const id = `button-${Array.from(crypto.getRandomValues(new Uint8Array(12)), value => value.toString(16).padStart(2, '0')).join('')}`;
    const next = clone(config);
    (next.buttons ||= []).push({ id, label: 'Новая кнопка', href: '', placement: 'header' });
    change(next); setSelected(id); setInspect(true); if(local){setView('design');setInspectorOpen(true);}
    setStatus('Кнопка добавлена в черновик. Задайте название, переход и расположение. До публикации пользователи её не увидят.');
  }
  function removeCustom(id = selected) {
    if(sourceDirty && !window.confirm('В исходнике есть несохранённый текст. Продолжить без сохранения?'))return;
    setSourceDirty(false);setSourcePath('');setTargetMeta(null);
    const next = clone(config);
    next.buttons = next.buttons.filter(item => item.id !== id);
    for (const target of ['mobile', 'desktop']) delete next[target].elements[id];
    change(next); setSelected('global');
  }
  function undo() {
    if (!past.length || busy || sourceDirty) return;
    setFuture(previous => [{config,css}, ...previous]); setConfig(past.at(-1).config); setCSS(past.at(-1).css); setPast(past.slice(0, -1)); setLocalReview(false);
  }
  function redo() {
    if (!future.length || busy || sourceDirty) return;
    setPast(previous => [...previous, {config,css}]); setConfig(future[0].config); setCSS(future[0].css); setFuture(future.slice(1)); setLocalReview(false);
  }
  historyActions.current = {undo,redo};
  useEffect(()=>{
    const key = event=>{
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.target.closest?.('input,textarea,select,[contenteditable=true],.project-embedded')) return;
      if (event.key.toLowerCase() === 'z' || event.key.toLowerCase() === 'y') { event.preventDefault(); (event.shiftKey || event.key.toLowerCase() === 'y' ? redo : undo)(); }
    };
    window.addEventListener('keydown',key); return()=>window.removeEventListener('keydown',key);
  },[past,future,config,css,busy]);
  function wheelZoom(delta,x,y,fromFrame=true) {
    if (!Number.isFinite(delta) || !frame.current || !canvas.current) return;
    const old = frame.current.getBoundingClientRect();
    const point = fromFrame ? {x:old.left+x*scale,y:old.top+y*scale} : {x,y};
    const ratio = {x:(point.x-old.left)/scale,y:(point.y-old.top)/scale};
    const next = Math.max(.25,Math.min(2.5,scale*Math.exp(-Math.max(-120,Math.min(120,delta))*.0025)));
    setZoom(next);
    requestAnimationFrame(()=>{const box=frame.current?.getBoundingClientRect();if(box && canvas.current){canvas.current.scrollLeft+=box.left+ratio.x*next-point.x;canvas.current.scrollTop+=box.top+ratio.y*next-point.y;}});
  }
  zoomActions.current = wheelZoom;
  useEffect(()=>{
    const node=canvas.current;if(!node)return;
    const wheel=event=>{if(event.shiftKey || (!latest.current.inspect && !event.ctrlKey && !event.metaKey))return;event.preventDefault();zoomActions.current?.(event.deltaY,event.clientX,event.clientY,false);};
    node.addEventListener('wheel',wheel,{passive:false});return()=>node.removeEventListener('wheel',wheel);
  },[]);
  async function connectLocal() {
    if (dirty && !window.confirm('Открыть оформление из папки и потерять несохранённый черновик?')) return;
    try { const root=await window.showDirectoryPicker({id:'dayris-project',mode:'readwrite'});await validateProjectRoot(root,window.__DAYRIS_DESK_WORKSPACE__);localProject.onRootChange(root); }
    catch(error){if(error.name !== 'AbortError')setStatus(error.message || 'Нужен Edge или Chrome на ПК.');}
  }
  async function saveProject() {
    if (!local || !disk || !localProject.root || busy || sourceDirty) return;
    setBusy(true); let written=[];
    try {
      validLocalCSS(css);
      if(designDirty){const result=await saveProjectFile(localProject.root,DESIGN_PATH,disk.design,JSON.stringify({...normalizeConfig(config),overrideCloud:true},null,2)+'\n');setDisk(previous=>({...previous,design:result.snapshot}));setSaved(JSON.stringify(config));written.push(DESIGN_PATH);}
      if(css !== savedCSS){const result=await saveProjectFile(localProject.root,STYLE_PATH,disk.style,css);setDisk(previous=>({...previous,style:result.snapshot}));setSavedCSS(css);written.push(STYLE_PATH);}
      setSavedPath(String(Date.now()));setLocalReview(false);setStatus(`Сохранено локально с резервными копиями: ${written.join(', ')}. Теперь проверьте сборку и выберите эти файлы для Git-публикации. Локальное оформление после выпуска имеет приоритет над облачным.`);
    } catch(error){setStatus(`${written.length ? `Уже сохранено: ${written.join(', ')}. ` : ''}Остановлено: ${error.message}. Остальные изменения остаются в черновике.`);}
    finally{setBusy(false);}
  }
  async function persist(publish) {
    if (!canWrite || busy) return;
    setBusy(true); setStatus('Сохранение…');
    try {
      let current = version;
      if (dirty) {
        const result = await supabase.rpc('save_site_config', { p_config: normalizeConfig(config), p_version: current });
        if (result.error) throw result.error;
        current = result.data; setVersion(current); setSaved(JSON.stringify(config));
      }
      if (publish) {
        const result = await supabase.rpc('publish_site_config', { p_version: current });
        if (result.error) throw result.error;
        setVersion(result.data);
        const history = await supabase.from('site_config_releases').select('id,config,published_at').order('id', { ascending: false }).limit(20);
        if (!history.error) setReleases(history.data || []);
      }
      setStatus(publish ? 'Опубликовано. Открытые приложения получат оформление в течение минуты или при возвращении во вкладку.' : 'Черновик сохранён в облаке.');
    } catch (error) { setStatus(errorText(error)); }
    finally { setBusy(false); }
  }
  function saveLocal() {
    try { localStorage.setItem(LOCAL_DRAFT, JSON.stringify(config)); setLocalAvailable(true); setStatus('Черновик сохранён только на этом устройстве.'); }
    catch { setStatus('Не удалось сохранить на устройстве. Используйте экспорт JSON.'); }
  }
  function restoreLocal() {
    try { change(JSON.parse(localStorage.getItem(LOCAL_DRAFT))); } catch { setStatus('Локальный черновик повреждён.'); }
  }
  function exportConfig() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'dayris-design.json'; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function importConfig(event) {
    const selectedFile = event.target.files?.[0]; event.target.value = '';
    if (!selectedFile) return;
    try {
      if (selectedFile.size > 65536) throw new Error();
      const input = JSON.parse(await selectedFile.text());
      if (input?.schema !== 1 || !input.mobile || !input.desktop) throw new Error();
      change(input);
    } catch { setStatus('Нужен файл конфигурации DAYRIS версии 1 размером до 64 КБ.'); }
  }
  function closeInspector() {
    if (sourceDirty && !window.confirm('В исходнике есть несохранённый текст. Закрыть и потерять его?')) return;
    setSourceDirty(false); setInspectorOpen(false); return true;
  }
  function openSourceFile(path) {
    if (!local) { if(onOpenSource)onOpenSource(path);else window.dispatchEvent(new CustomEvent('dayris:open-project',{detail:{path}}));return; }
    if(sourceDirty && !window.confirm('Открыть другой файл без сохранения текущего?'))return;
    setSourceDirty(false);setSourcePath(path);setView('sources');setInspectorOpen(true);
  }
  const renderControls = content => inspectorOpen ? <InspectorDialog title={`${view === 'logic' ? 'Логика и команды' : view === 'sources' ? 'Исходники' : view === 'theme' ? 'Тема и CSS' : view === 'release' ? 'Сборка и публикация' : 'Редактор вида'} · ${element?.label || 'Всё приложение'}`} onClose={closeInspector} actions={<><button disabled={busy || !past.length || sourceDirty} onClick={undo}>Отменить оформление</button><button disabled={busy || !future.length || sourceDirty} onClick={redo}>Вернуть оформление</button>{local && <button disabled={busy || !disk || !dirty || sourceDirty} onClick={()=>{setInspectorOpen(false);setLocalReview(true);}}>Сохранить оформление</button>}</>}>{content}</InspectorDialog> : content;


  function activateSelection(id, nextView, meta = null) {
    if(latest.current.sourceDirty && !window.confirm('В исходнике есть несохранённый текст. Перейти без сохранения?'))return false;
    const nextMeta=local && typeof meta?.selector==='string' ? {...meta,selector:meta.selector.slice(0,600)} : null;
    setSourceDirty(false);setSourcePath('');setSelected(id);setTargetMeta(nextMeta);
    if(nextView){setView(nextView);setInspectorOpen(true);}return true;
  }
  selectionActions.current=activateSelection;
  const activeSelected=selected,activeView=view,activeMeta=targetMeta,updateView=setView,updateSelected=setSelected;
  function renderEditor(panel = null) {
    const selected=panel?.id ?? activeSelected,view=panel?.view ?? activeView,targetMeta=panel ? panel.meta : activeMeta;
    const element=elements.find(item=>item.id===selected),feature=featureFor(selected);
    const custom=config.buttons?.find(item=>item.id===selected);
    const values=selected==='global'?config[device].global:config[device].elements[selected] || {};
    const debugSource=local && matchSource(targetMeta?.sources,catalog.files.map(file=>file.path));
    const featureFiles=[...new Set([...(debugSource?[debugSource.path]:[]),...feature.files])];
    const setView=panel?panel.onView:updateView;
    const setSelected=panel?id=>panel.onSelect(id,null):updateSelected;
    const edit=(key,value)=>editElement(key,value,selected);
    const editButton=(key,value)=>editCustom(key,value,selected);
    const removeButton=()=>removeCustom(selected);
    const openSource=path=>{if(panel&&!panel.active&&!activateSelection(selected,'sources',targetMeta))return;openSourceFile(path);};
  function colorField(key, label) {
    return <label className="admin-field" key={key}><span>{label}</span><div className="admin-color"><input aria-label={label} type="color" value={values[key] || '#ffffff'} onChange={event => edit(key, event.target.value)}/><code>{values[key] || 'Как в приложении'}</code><button onClick={() => edit(key, undefined)} disabled={!values[key]}>Сброс</button></div></label>;
  }

    return (<aside ref={panel ? undefined : controls} className={`admin-controls${(local || inspectorOpen) ? ' admin-controls-popup' : ''}`} aria-label="Параметры оформления">
        <div className="admin-tabs" role="group" aria-label="Устройство">{[['mobile', 'Телефон'], ['desktop', 'ПК']].map(([id, label]) => <button key={id} aria-pressed={device === id} onClick={() => setDevice(id)}>{label}</button>)}</div>
        <p className="admin-hint">Настройки телефона и ПК независимы. В предпросмотре нажмите на элемент или выберите его ниже.</p>
        <button className="admin-add" onClick={addButton} disabled={busy || !canWrite || (config.buttons?.length || 0) >= 20}>+ Добавить кнопку</button>
        <label className="admin-field"><span>Элемент</span><select aria-label="Элемент" value={selected} disabled={busy} onChange={event => { setSelected(event.target.value); setTargetMeta(null);setSourcePath('');setInspect(true); }}><option value="global">Фон приложения</option>{elements.map(item => <option value={item.id} key={item.id}>{item.custom ? '↳ ' : ''}{item.label}</option>)}</select></label>
        <div className="admin-tabs admin-inspector-tabs" role="group" aria-label="Редактор выбранного элемента">{[['design','Вид'],['logic','Логика'],['sources','Связи']].map(([id,label]) => <button key={id} aria-pressed={view === id} onClick={() => {if(panel){panel.onView(id);return;}if(sourceDirty && !window.confirm('Перейти без сохранения исходника?'))return;setSourceDirty(false);setView(id);setInspectorOpen(true);}}>{label}</button>)}</div>
        <details className="admin-module-details" open={!inspectorOpen || view !== 'design'}><summary>Как работает · {feature.title}</summary>
        <section className="admin-feature-card"><small>ВЫБРАННЫЙ МОДУЛЬ</small><h2>{feature.title}</h2><p>{feature.description}</p><ol>{feature.steps.map(step => <li key={step}>{step}</li>)}</ol></section>
        {local && targetMeta && <section className="admin-dom-source"><h3>Выбрано: {String(targetMeta.label || 'DOM-элемент').slice(0,100)}</h3><code>{String(targetMeta.selector).slice(0,600)}</code><p>{debugSource ? `Исходник React: ${debugSource.path}${debugSource.line ? ':'+debugSource.line : ''}` : 'Точная привязка к исходнику не найдена. Ниже — зарегистрированные связи модуля.'}</p>{debugSource && <button onClick={()=>openSource(debugSource.path)}>Редактировать исходник элемента</button>}<button onClick={()=>{change(config,css+'\n/* Выбранный DOM-элемент; проверьте селектор при перестройке DOM. */\n'+String(targetMeta.selector).slice(0,600)+' {\n  /* Ваши стили */\n}\n');setView('theme');setInspectorOpen(true);}}>Добавить CSS выбранного элемента</button>{targetMeta.registered === false && <p>Этот узел не зарегистрирован в настройках. Поля «Фон приложения» меняют весь фон, не этот узел. Для него используйте CSS или исходник.</p>}</section>}
        </details>
        {view === 'logic' && (feature.voice ? <VoiceCommandsEditor commands={config.voiceCommands} disabled={busy || !canWrite} onChange={commands => { const next = clone(config); next.voiceCommands = commands; change(next); }}/> : <section className="admin-feature-logic"><h3>Как работает модуль</h3><p>{feature.description}</p><p>«Выполнить действие» в меню элемента открывает настоящий экран, не выключая инспектор. Внутри можно выбрать следующий зарегистрированный элемент.</p><button onClick={() => {setView('sources');setInspectorOpen(true);}}>Открыть связанные файлы</button><p className="admin-hint">Поведение этого модуля меняется в связанных исходниках; права и финансовые проверки нельзя отключить визуальными настройками.</p></section>)}
        {view === 'sources' && <section className="admin-feature-sources"><h3>Связанные исходники</h3>{featureFiles.map(path => <button key={path} className="admin-source-link" onClick={() => openSource(path)}>{path} ↗</button>)}<p className="admin-hint">Ниже — назначение, связи и локальный редактор. Содержимое читается с ПК после подключения папки. Сохранение исходника не публикует сайт.</p>{local && inspectorOpen && (!panel || panel.active) && <AdminProject key={sourcePath || featureFiles[0]} compact initialPath={sourcePath || featureFiles[0]} rootHandle={localProject.root} onRootChange={root=>{if((designDirty || css !== savedCSS)&&!window.confirm('Подключение папки заново откроет оформление с диска. Продолжить без сохранения?'))return;localProject.onRootChange(root);}} onDirtyChange={setSourceDirty}/>}{local && panel && !panel.active && <button onClick={()=>panel.onView('sources')}>Открыть редактор этого исходника</button>}</section>}
        {local && view === 'theme' && <section className="admin-global-code"><h3>Общее оформление календаря</h3><p>Файл: <code>{STYLE_PATH}</code>. Вставьте CSS от GPT сюда или откройте этот файл в любом редакторе. Не JavaScript, не HTML. CSS доверенный: может скрывать элементы и загружать внешние изображения; проверьте код перед выпуском. Админка не оформляется этим файлом.</p><div className="admin-actions"><button onClick={()=>{if(window.confirm('Заменить текущий CSS зимним примером? Отмена доступна через кнопку «Отменить».'))change(config,WINTER_CSS);}}>Вставить зимний пример</button><button onClick={()=>change(config,'')}>Очистить CSS</button><button disabled={!past.length} onClick={undo}>Отменить правку CSS</button><button disabled={!future.length} onClick={redo}>Вернуть правку CSS</button></div><label className="project-source"><span>Общий CSS календаря</span><textarea aria-label="Общий CSS календаря" value={css} spellCheck={false} onChange={event=>{try{change(config,validLocalCSS(event.target.value));}catch(error){setStatus(error.message);}}}/></label><p>Предпросмотр обновляется сразу. Календарь остаётся доступен рядом с этим окном. Затем «Сохранить в проект» → сборка → выбранные файлы → push.</p><button onClick={()=>{setInspectorOpen(false);}}>Посмотреть календарь</button></section>}
        {local && view === 'release' && <LocalProjectTools local savedPath={savedPath} dirty={dirty} hidePreview/>}
        <div className="admin-design-fields" hidden={view !== 'design'}>
        <fieldset disabled={busy || access === 'loading'}><legend>{selected === 'global' ? 'Фон приложения' : element?.label}</legend>
          {selected === 'global' ? <>
            {colorField('background', 'Цвет фона')}{colorField('accent', 'Акцент PRO')}
            <label className="admin-field"><span>Фоновое изображение</span><LinkInput value={values.image || ''} placeholder="https://… или /images/…" onChange={value => edit('image', value)} onError={() => setStatus('Изображение: используйте полный HTTPS-адрес или путь от / .')}/></label>
            <p className="admin-hint">Изображение по ссылке. Загрузка файлов и библиотека медиа ещё не подключены.</p>
          </> : <>
            {custom && <>
              <label className="admin-field"><span>Название кнопки</span><input value={custom.label} maxLength={80} onChange={event => editButton('label', event.target.value)}/></label>
              <label className="admin-field"><span>Расположение кнопки</span><select aria-label="Расположение кнопки" value={custom.placement} onChange={event => editButton('placement', event.target.value)}><option value="header">Под шапкой календаря</option><option value="bottom">Закрепить внизу экрана</option></select></label>
              <p className="admin-hint">Название, ссылка и расположение общие для телефона и ПК. Размеры, цвета и видимость настраиваются отдельно.</p>
            </>}
            {colorField('color', 'Цвет текста и иконки')}{colorField('background', 'Цвет элемента')}
            {fields.map(([key, label, min, max]) => <label className="admin-field" key={key}><span>{label}</span><input type="number" min={min} max={max} step="1" placeholder="Как в приложении" value={values[key] ?? ''} onChange={event => edit(key, event.target.value === '' ? undefined : Number(event.target.value))}/></label>)}
            <label className="admin-check"><input type="checkbox" checked={values.hidden === true} onChange={event => edit('hidden', event.target.checked)}/>Скрыть элемент</label>
            {element?.action && <label className="admin-field"><span>Переход по кнопке</span><LinkInput label="Переход по кнопке" key={selected} value={(custom ? custom.href : values.href) || ''} placeholder={custom ? 'https://… или /privacy.html' : 'Штатное действие'} onChange={value => custom ? editButton('href', value) : edit('href', value)} onError={() => setStatus('Укажите HTTPS-ссылку или внутренний путь, начинающийся с / .')}/><small>{custom ? 'Без ссылки кнопка не выполняет переход. Можно указать страницу сайта или внешний HTTPS-адрес.' : 'Пусто — штатное действие. Ссылка заменяет его переходом.'}</small></label>}
            {custom && <button onClick={removeButton}>Удалить кнопку из черновика</button>}
            <p className="admin-hint">Сдвиг задаётся в пикселях. Порядок действует внутри текущего flex/grid-ряда. Перенос между разделами пока не подключён.</p>
          </>}
          <button onClick={() => { const next = clone(config); if (selected === 'global') next[device].global = {}; else delete next[device].elements[selected]; change(next); }}>Сбросить параметры элемента</button>
          <button onClick={() => { const next = clone(config); next[device === 'mobile' ? 'desktop' : 'mobile'] = clone(config[device]); change(next); }}>Скопировать оформление на {device === 'mobile' ? 'ПК' : 'телефон'}</button>
        </fieldset>
        </div>
        <section className="admin-files"><h2>Черновики и версии</h2><div><button onClick={exportConfig}>Экспорт JSON</button><button onClick={() => file.current.click()} disabled={busy}>Импорт JSON</button><input ref={file} type="file" accept="application/json,.json" hidden onChange={importConfig}/>{localAvailable && <button onClick={restoreLocal} disabled={busy}>Открыть локальный черновик</button>}</div>
          {releases.length > 0 && <label className="admin-field"><span>Восстановить публикацию в черновик</span><select value="" disabled={busy} onChange={event => { const release = releases.find(item => String(item.id) === event.target.value); if (release) { change(release.config); setStatus('Версия открыта в черновике. Проверьте предпросмотр и опубликуйте для отката.'); } }}><option value="">Выберите версию</option>{releases.map(release => <option key={release.id} value={release.id}>#{release.id} · {new Date(release.published_at).toLocaleString('ru')}</option>)}</select></label>}
        </section>
      </aside>);
  }

  return <div className={`dayris-admin${local ? ' admin-local-studio' : ''}`}>
    <header className="admin-toolbar"><div><a href="/">← DAYRIS</a><h1>Редактор приложения</h1><p>{identity || 'Визуальная настройка DAYRIS'}</p></div><div className="admin-toolbar-actions"><button onClick={undo} title="Ctrl+Z вне текстового поля" disabled={busy || !past.length}>Отменить</button><button onClick={redo} title="Ctrl+Shift+Z / Ctrl+Y" disabled={busy || !future.length}>Вернуть</button>{local ? <><button disabled={busy} onClick={connectLocal}>{localProject.root ? 'Переподключить папку' : 'Подключить папку проекта'}</button><button onClick={()=>activateSelection('global','theme',null)}>Тема и CSS</button><button className="admin-primary" onClick={()=>setLocalReview(true)} disabled={busy || !disk || !dirty || sourceDirty}>Сохранить в проект</button><button onClick={()=>activateSelection('global','release',null)}>Сборка и публикация</button></> : <><button onClick={saveLocal} disabled={busy}>На устройство</button><button onClick={() => persist(false)} disabled={busy || !canWrite || !dirty}>Сохранить черновик</button><button className="admin-primary" onClick={() => persist(true)} disabled={busy || !canWrite}>Опубликовать</button></>}</div></header>
    <div className="admin-notice" role="status" aria-live="polite">
      {access === 'loading' && 'Проверяем доступ…'}
      {access === 'guest' && <>Для публикации <a href="/">войдите в DAYRIS</a> и вернитесь в редактор. Пока доступен локальный предпросмотр.</>}
      {access === 'denied' && 'У аккаунта нет роли администратора. Доступен только локальный предпросмотр.'}
      {access === 'unavailable' && 'Облачная админка недоступна. Требуется миграция Supabase и назначение администратора. Локальный редактор работает.'}
      {access === 'admin' && <><span>{local ? `Локальное оформление${dirty ? ' · есть изменения' : ''}` : `Администратор · версия черновика ${version}${dirty ? ' · есть изменения' : ''}`}</span><small className="admin-publish-hint">{local ? 'Сохранение — в папку проекта с копией. Выпуск — через сборку, выбранные файлы Git и push.' : 'Черновик виден только вам. Публикация меняет оформление всех пользователей.'}</small></>}
      {!local && localDesign.overrideCloud === true && <p>Оформление закреплено в локальном проекте. Облачные настройки не перекроют его до отключения overrideCloud в siteDesign.json.</p>}
      {status && <p>{status}</p>}
    </div>
    {localReview && <section className="admin-local-review"><h2>Сохранение оформления в проект</h2><p>Будут обновлены изменённые файлы: {designDirty ? DESIGN_PATH : ''} {css !== savedCSS ? STYLE_PATH : ''}. Каждый сохраняется со своей резервной копией и проверкой конфликта. Это не атомарная запись двух файлов. После выпуска локальный файл оформления имеет приоритет над облачным.</p><button disabled={busy || !disk || sourceDirty} onClick={saveProject}>Создать копии и сохранить оформление</button><button disabled={busy} onClick={()=>setLocalReview(false)}>Отмена</button></section>}
    <main className={`admin-layout${local ? ' studio-layout' : ''}`}>
      {local ? <StudioWorkspace config={config} selected={selected} view={view} meta={targetMeta} open={inspectorOpen} label={view==='theme'?'Общее оформление':view==='release'?'Сборка и публикация':element?.label || targetMeta?.label || 'Фон приложения'} renderEditor={renderEditor} onActivate={activateSelection} onClose={closeInspector} frameRef={frame} calendarWidth={previewWidth+56} toolbar={<><div className="admin-tabs" role="group" aria-label="Устройство песочницы">{[['mobile','Телефон'],['desktop','ПК']].map(([id,title])=><button key={id} aria-pressed={device===id} onClick={()=>setDevice(id)}>{title}</button>)}</div><label className="studio-element-picker">Элемент <select aria-label="Найти элемент календаря" value={selected} onChange={event=>activateSelection(event.target.value,'design',null)}><option value="global">Фон приложения</option>{elements.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select></label><button onClick={addButton} disabled={busy || !canWrite || (config.buttons?.length || 0)>=20}>+ Добавить кнопку</button></>}>
<section className="admin-stage" aria-label="Предпросмотр приложения">
        <div className="admin-preview-toolbar"><strong>{device === 'mobile' ? 'Телефон · 390 px' : 'ПК · 1280 px'} · {Math.round(scale * 100)}%</strong><div className="admin-tabs" role="group" aria-label="Режим предпросмотра"><button aria-pressed={inspect} onClick={resumeEditing}>Редактирование</button><button aria-pressed={!inspect} onClick={() => setInspect(false)}>Проверить приложение</button></div></div>
        <p className="admin-hint">{inspect ? 'Выберите элемент. «Редактировать вид» и «Логика и команды» откроют отдельное окно. В режиме выбора нажатия не меняют данные.' : 'Внимание: это ваш настоящий аккаунт. Кнопки и ввод выполняют обычные действия приложения, включая изменение данных.'}</p>
        <button className="admin-selection" onClick={() => {setView('design');setInspectorOpen(true);}}>Параметры: {element?.label || 'Фон приложения'} ↗</button>
        <div className="admin-preview-zoom" role="group" aria-label="Масштаб макета"><button aria-pressed={zoom === 'fit'} onClick={() => setZoom('fit')}>Подогнать</button><button onClick={()=>setZoom(Math.max(.25,scale-.1))} aria-label="Уменьшить календарь">−</button><button aria-pressed={zoom === 'actual'} onClick={() => setZoom('actual')}>100% · с прокруткой</button><button onClick={()=>setZoom(Math.min(2.5,scale+.1))} aria-label="Увеличить календарь">+</button><small>Колесо — масштаб · Shift+колесо — прокрутка · Ctrl+Z — отмена</small></div>
        <div ref={canvas} className="admin-frame-scroll"><div className="admin-frame-size" style={{ width: previewWidth * scale, height: 780 * scale }}><iframe ref={frame} title="Предпросмотр DAYRIS" src={local ? '/?adminPreview=1&localStudio=1' : '/?adminPreview=1'} className={`admin-preview admin-preview-${device}`} style={{ transform: `scale(${scale})` }} onLoad={sendPreview}/></div></div>
        {local && <details className="admin-console"><summary>Консоль предпросмотра · {consoleLines.length}</summary><p>Ошибки и предупреждения этого предпросмотра. Журнал build/Git — в «Сборка и публикация». Это не shell и не запуск произвольного JavaScript.</p><pre>{consoleLines.join('\n') || 'Ошибок не зарегистрировано.'}</pre><button onClick={()=>setConsoleLines([])}>Очистить консоль</button></details>}
      </section>
      </StudioWorkspace> : <>{renderControls(renderEditor())}<section className="admin-stage" aria-label="Предпросмотр приложения">
        <div className="admin-preview-toolbar"><strong>{device === 'mobile' ? 'Телефон · 390 px' : 'ПК · 1280 px'} · {Math.round(scale * 100)}%</strong><div className="admin-tabs" role="group" aria-label="Режим предпросмотра"><button aria-pressed={inspect} onClick={resumeEditing}>Редактирование</button><button aria-pressed={!inspect} onClick={() => setInspect(false)}>Проверить приложение</button></div></div>
        <p className="admin-hint">{inspect ? 'Выберите элемент. «Редактировать вид» и «Логика и команды» откроют отдельное окно. В режиме выбора нажатия не меняют данные.' : 'Внимание: это ваш настоящий аккаунт. Кнопки и ввод выполняют обычные действия приложения, включая изменение данных.'}</p>
        <button className="admin-selection" onClick={() => {setView('design');setInspectorOpen(true);}}>Параметры: {element?.label || 'Фон приложения'} ↗</button>
        <div className="admin-preview-zoom" role="group" aria-label="Масштаб макета"><button aria-pressed={zoom === 'fit'} onClick={() => setZoom('fit')}>Подогнать</button><button onClick={()=>setZoom(Math.max(.25,scale-.1))} aria-label="Уменьшить календарь">−</button><button aria-pressed={zoom === 'actual'} onClick={() => setZoom('actual')}>100% · с прокруткой</button><button onClick={()=>setZoom(Math.min(2.5,scale+.1))} aria-label="Увеличить календарь">+</button><small>Колесо — масштаб · Shift+колесо — прокрутка · Ctrl+Z — отмена</small></div>
        <div ref={canvas} className="admin-frame-scroll"><div className="admin-frame-size" style={{ width: previewWidth * scale, height: 780 * scale }}><iframe ref={frame} title="Предпросмотр DAYRIS" src={local ? '/?adminPreview=1&localStudio=1' : '/?adminPreview=1'} className={`admin-preview admin-preview-${device}`} style={{ transform: `scale(${scale})` }} onLoad={sendPreview}/></div></div>
        {local && <details className="admin-console"><summary>Консоль предпросмотра · {consoleLines.length}</summary><p>Ошибки и предупреждения этого предпросмотра. Журнал build/Git — в «Сборка и публикация». Это не shell и не запуск произвольного JavaScript.</p><pre>{consoleLines.join('\n') || 'Ошибок не зарегистрировано.'}</pre><button onClick={()=>setConsoleLines([])}>Очистить консоль</button></details>}
      </section></>}
    </main>
  </div>;
}

function LinkInput({ value, onChange, onError, label, placeholder = 'Штатное действие' }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  const invalid = Boolean(text && !safeLink(text));
  return <><input aria-label={label} type="text" placeholder={placeholder} value={text} aria-invalid={invalid} onChange={event => { const next = event.target.value; setText(next); if (!next || safeLink(next)) onChange(next); }} onBlur={() => { if (invalid) onError(); }}/>{invalid && <small role="alert">Нужна HTTPS-ссылка или путь от / . Некорректная ссылка не сохранится.</small>}</>;
}
