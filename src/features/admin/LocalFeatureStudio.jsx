import React, { useCallback, useEffect, useRef, useState } from 'react';
import manifest from '../extensions/extensions.json';
import { EXTENSION_PATH, EXTENSION_ACTIONS, extensionPrompt, newExtension, validateExtensions } from '../extensions/extensionModel.js';
import { readProjectFile, saveProjectFile, validateProjectRoot } from './projectFiles.js';
import LocalProjectTools from './LocalProjectTools.jsx';
import './AdminProject.css';
import './LocalFeatureStudio.css';
import useEditorHistory from './useEditorHistory.js';

export default function LocalFeatureStudio({ rootHandle, onRootChange, onDirtyChange }) {
  const [config, setConfig, history] = useEditorHistory(() => validateExtensions(manifest));
  const [saved, setSaved] = useState(() => JSON.stringify(validateExtensions(manifest)));
  const [snapshot, setSnapshot] = useState(null), [selected, setSelected] = useState('');
  const [device, setDevice] = useState('mobile'), [mode, setMode] = useState('edit');
  const [preview, setPreview] = useState(() => validateExtensions(manifest)), [ready, setReady] = useState(false);
  const [notice, setNotice] = useState(''), [events, setEvents] = useState([]), [busy, setBusy] = useState(false);
  const [savedPath, setSavedPath] = useState(''), [review, setReview] = useState(false);
  const frame = useRef(null), alive = useRef(true);
  const feature = config.features.find(item => item.id === selected);
  const dirty = JSON.stringify(config) !== saved;
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => { onDirtyChange?.(dirty); return () => onDirtyChange?.(false); }, [dirty, onDirtyChange]);
  useEffect(() => {
    if (!dirty) return;
    const warn = e => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  const load = useCallback(async root => {
    setBusy(true);
    try {
      await validateProjectRoot(root, window.__DAYRIS_DESK_WORKSPACE__);
      const original = await readProjectFile(root, EXTENSION_PATH), value = validateExtensions(JSON.parse(original.text));
      if (!alive.current) return;
      setSnapshot(original); history.reset(value); setSaved(JSON.stringify(value)); setPreview(value); setSelected(value.features[0]?.id || ''); setReview(false); setMode('edit');
      setNotice('Файл функций открыт с этого ПК. Изменения появятся на сайте только после публикации.');
    } catch (error) { if (alive.current) { setSnapshot(null); setNotice(error.message); } }
    finally { if (alive.current) setBusy(false); }
  }, []);
  useEffect(()=>{
    const key=event=>{if(!(event.ctrlKey || event.metaKey) || event.altKey || event.target.closest?.('input,textarea,select,[contenteditable=true]'))return;const letter=event.key.toLowerCase();if(letter==='z'||letter==='y'){event.preventDefault();setReview(false);(event.shiftKey||letter==='y'?history.redo:history.undo)();}};
    window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);
  },[history]);
  useEffect(() => { if (rootHandle) load(rootHandle); }, [rootHandle, load]);
  useEffect(() => {
    if (!ready) return;
    frame.current?.contentWindow?.postMessage({ type: 'dayris:extension-draft', config: preview, selected, mode }, location.origin);
  }, [preview, selected, mode, ready]);
  useEffect(() => {
    const receive = event => {
      if (event.origin !== location.origin || event.source !== frame.current?.contentWindow || event.data?.type !== 'dayris:extension-studio') return;
      const data = event.data;
      if (data.action === 'ready') setReady(true);
      else if (data.action === 'select' && config.features.some(item => item.id === data.id)) setSelected(data.id);
      else if (data.action === 'position' && mode === 'place' && Number.isFinite(data.x) && Number.isFinite(data.y)) {
        setConfig(previous => ({ ...previous, features: previous.features.map(item => item.id === selected ? { ...item, placement: 'fixed', [device]: { ...item[device], x: Math.round(Math.min(100, Math.max(0, data.x))), y: Math.round(Math.min(100, Math.max(0, data.y))) } } : item) }));
        setMode('edit'); setNotice('Место выбрано. Нажмите «Обновить предпросмотр», чтобы применить черновик.');
      } else if (['notify','error','navigate'].includes(data.action) && typeof data.value === 'string') setEvents(previous => [...previous.slice(-29), `${data.action}: ${data.value.slice(0,2048)}`]);
    };
    window.addEventListener('message', receive); return () => window.removeEventListener('message', receive);
  }, [config, selected, device, mode]);
  async function connect() {
    if (busy || (dirty && !window.confirm('Заново открыть функции из папки и потерять несохранённый черновик?'))) return;
    if (!window.showDirectoryPicker) { setNotice('Откройте локальную мастерскую в Edge или Chrome на ПК.'); return; }
    try {
      const root = await window.showDirectoryPicker({ id: 'dayris-project', mode: 'readwrite' });
      await validateProjectRoot(root, window.__DAYRIS_DESK_WORKSPACE__); onRootChange(root);
    } catch (error) { if (error.name !== 'AbortError') setNotice(error.message); }
  }
  function edit(patch) {
    setReview(false); setConfig(previous => ({ ...previous, features: previous.features.map(item => item.id === selected ? { ...item, ...patch } : item) }));
  }
  function apply() {
    try { const value = validateExtensions(config); setPreview(value); setMode('test'); setEvents([]); setNotice('Тестируется текущий черновик. Нажмите новую кнопку в календаре. Переходы только записываются в журнал.'); requestAnimationFrame(()=>frame.current?.scrollIntoView({block:'start'})); }
    catch (error) { setNotice(error.message); }
  }
  async function save() {
    if (!rootHandle || !snapshot || busy) return;
    setBusy(true);
    try {
      const value = validateExtensions(config), text = JSON.stringify(value, null, 2) + '\n';
      const result = await saveProjectFile(rootHandle, EXTENSION_PATH, snapshot, text);
      if (!alive.current) return;
      setConfig(value); setSnapshot(result.snapshot); setSaved(JSON.stringify(value)); setPreview(value); setReview(false); setMode('edit'); setSavedPath(String(Date.now()));
      setNotice(`Сохранено локально. Копия: ${result.backup}. Проверьте сборку и выберите ${EXTENSION_PATH} для публикации.`);
    } catch (error) { if (alive.current) setNotice(error.message); }
    finally { if (alive.current) setBusy(false); }
  }
  function download() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(config,null,2)], { type: 'application/json' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'dayris-functions-draft.json'; anchor.click(); setTimeout(() => URL.revokeObjectURL(url),1000);
  }
  return <section className="admin-page feature-studio">
    <div className="admin-page-title"><div><h1>Конструктор функций</h1><p>Элемент → события → свой экран и код → проверка → выпуск</p></div><div className="admin-actions"><button disabled={busy} onClick={connect}>{rootHandle ? 'Заново подключить папку' : 'Подключить папку проекта'}</button><button onClick={download}>Скачать черновик</button></div></div>
    <p className="project-boundary">Только локальная мастерская. Код мини-экранов изолирован: без аккаунта, сети и доступа к данным DAYRIS. Новые API, запись календаря и серверные функции подключаются отдельно через исходники — эта версия не генерирует их автоматически. Обычный календарь в предпросмотре использует ваш настоящий аккаунт. <a href="/docs/LOCAL_FUNCTION_STUDIO.md" target="_blank" rel="noreferrer">Инструкция и API ↗</a></p>
    <div className="admin-actions"><button disabled={!history.canUndo || busy} onClick={()=>{history.undo();setReview(false);}}>Отменить действие</button><button disabled={!history.canRedo || busy} onClick={()=>{history.redo();setReview(false);}}>Вернуть действие</button><small>Ctrl+Z вне текстового поля; внутри поля — обычная отмена ввода. Запись файла и push не отменяются автоматически.</small></div>
    <p role="status" className="project-status">{notice}{dirty ? ' · Есть несохранённые изменения.' : ''}</p>
    <div className="feature-studio-layout"><aside className="feature-studio-controls">
      <h2>Функции · {config.features.length}/20</h2>
      <button disabled={busy || !snapshot || config.features.length >= 20} onClick={() => { const item = newExtension(); setConfig(previous => ({ ...previous, features: [...previous.features, item] })); setSelected(item.id); setMode('edit'); setReview(false); }}>+ Добавить функцию</button>
      {!snapshot && <p>Сначала подключите папку, из которой запущена мастерская.</p>}
      <div className="feature-studio-list">{config.features.map(item => <button key={item.id} aria-pressed={selected === item.id} onClick={() => { setSelected(item.id); setMode('edit'); }}>{item.label || 'Без названия'}{!item.enabled && ' · выключено'}</button>)}</div>
      {feature && <>
        <label className="admin-field"><span>Название кнопки</span><input maxLength={80} value={feature.label} onChange={e => edit({ label: e.target.value })}/></label>
        <label className="admin-field"><span>Что должна делать функция</span><textarea maxLength={1000} value={feature.description} onChange={e => edit({ description: e.target.value })}/></label>
        <label className="admin-check"><input type="checkbox" checked={feature.enabled} onChange={e => edit({ enabled:e.target.checked })}/>Включена после публикации</label>
        <label className="admin-field"><span>Расположение</span><select value={feature.placement} onChange={e => edit({ placement:e.target.value })}><option value="fixed">Поверх календаря</option><option value="header">В шапке календаря</option></select></label>
        <h3>Вид: {device === 'mobile' ? 'телефон' : 'ПК'}</h3>
        <label className="admin-check"><input type="checkbox" checked={feature[device].visible} onChange={e => edit({ [device]:{ ...feature[device], visible:e.target.checked } })}/>Показывать на этом устройстве</label>
        <button onClick={() => { try { setPreview(validateExtensions(config)); setMode('place'); } catch (error) { setNotice(error.message); } }}>Выбрать место на календаре</button>
        <div className="feature-style-grid">{[['x','X, %',0,100],['y','Y, %',0,100],['width','Ширина',64,400],['height','Высота',32,160],['radius','Скругление',0,80]].map(([key,label,min,max]) => <label className="admin-field" key={key}><span>{label}</span><input type="number" min={min} max={max} value={feature[device][key]} onChange={e => edit({ [device]:{ ...feature[device], [key]:Math.max(min,Math.min(max,Number(e.target.value))) } })}/></label>)}</div>
        {['background','color'].map(key => <label className="admin-field" key={key}><span>{key === 'background' ? 'Цвет кнопки' : 'Цвет текста'}</span><input type="color" value={feature[device][key]} onChange={e => edit({ [device]:{ ...feature[device], [key]:e.target.value } })}/></label>)}
        <h3>Нажатие → шаги действия</h3>
        {feature.steps.map((step,index) => <fieldset key={index}><legend>Шаг {index+1}</legend><label className="admin-field"><span>Действие шага {index+1}</span><select value={step.type} onChange={e => edit({ steps:feature.steps.map((item,i) => i === index ? { type:e.target.value, ...(e.target.value === 'screen' ? {} : e.target.value === 'builtin' ? {action:'settings'} : { value:e.target.value === 'navigate' ? '/' : 'Готово' }) } : item) })}><option value="message">Показать сообщение</option><option value="screen">Открыть свой экран</option><option value="navigate">Перейти по адресу</option><option value="builtin">Действие DAYRIS</option></select></label>{step.type === 'builtin' && <label className="admin-field"><span>Действие DAYRIS</span><select value={step.action} onChange={e => edit({steps:feature.steps.map((item,i) => i === index ? {...item,action:e.target.value} : item)})}>{EXTENSION_ACTIONS.map(action => <option key={action.id} value={action.id}>{action.label}</option>)}</select></label>}{['message','navigate'].includes(step.type) && <label className="admin-field"><span>{step.type === 'navigate' ? 'Адрес перехода' : 'Текст сообщения'}</span><input maxLength={step.type === 'navigate' ? 2048 : 1000} value={step.value} onChange={e => edit({ steps:feature.steps.map((item,i) => i === index ? { ...item,value:e.target.value } : item) })}/></label>}<button disabled={feature.steps.length <= 1} onClick={() => edit({ steps:feature.steps.filter((_,i) => i !== index) })}>Удалить шаг {index+1}</button></fieldset>)}
        <button disabled={feature.steps.length >= 8} onClick={() => edit({ steps:[{ type:'message', value:'Запускаю функцию' }, ...feature.steps] })}>+ Сообщение перед действием</button>
        <details className="feature-code" open><summary>Свой экран: HTML / CSS / JavaScript</summary><p>Обычный браузерный JS, не React/JSX. Запускается только при открытии мини-экрана. Нажмите «Обновить предпросмотр» после правок.</p><label className="project-source"><span>Задание для GPT</span><textarea readOnly aria-label="Задание для GPT" value={extensionPrompt(feature)}/></label>{['html','css','js'].map(key => <label className="project-source" key={key}><span>{key.toUpperCase()}</span><textarea aria-label={`Код ${key.toUpperCase()}`} spellCheck={false} maxLength={65536} value={feature[key]} onChange={e => edit({ [key]:e.target.value })}/></label>)}</details>
        <button onClick={() => { if (window.confirm('Удалить функцию из черновика? На сайте она исчезнет только после публикации.')) { setConfig(previous => ({ ...previous,features:previous.features.filter(item => item.id !== selected) })); setSelected(''); setReview(false); } }}>Удалить функцию</button>
      </>}
    </aside><main className="feature-studio-canvas">
      <div className="admin-actions"><button aria-pressed={device === 'mobile'} onClick={() => { setDevice('mobile'); setReady(false); }}>Телефон · 390</button><button aria-pressed={device === 'desktop'} onClick={() => { setDevice('desktop'); setReady(false); }}>ПК · 1280</button><button className="admin-primary" onClick={apply}>Обновить предпросмотр</button><button aria-pressed={mode === 'edit'} onClick={() => setMode('edit')}>Выбирать элементы</button></div>
      <p>{mode === 'place' ? 'Укажите место кнопки в календаре.' : mode === 'test' ? 'Тест: кнопка выполняет действие, переходы не покидают редактор.' : 'Выбор: нажмите свою кнопку в календаре, чтобы открыть её параметры.'}</p>
      <div className="feature-preview-scroll"><iframe key={device} ref={frame} title="Календарь конструктора функций" src="/?extensionStudio=1" style={{ width:device === 'mobile' ? 390 : 1280 }} onLoad={() => { setReady(true); frame.current?.contentWindow?.postMessage({ type:'dayris:extension-draft',config:preview,selected,mode },location.origin); }}/></div>
      <section className="feature-event-log" aria-label="Журнал проверки"><h3>Журнал проверки</h3><p>Сообщения, ошибки JavaScript и запросы переходов. Это не автоматическая проверка всей функции.</p><pre>{events.join('\n') || 'Запустите функцию в предпросмотре.'}</pre><button onClick={() => setEvents([])}>Очистить журнал</button></section>
      <div className="admin-actions"><button disabled={!dirty || !snapshot || busy} onClick={() => { try { validateExtensions(config); setReview(true); } catch (error) { setNotice(error.message); } }}>Проверить и сохранить функции</button><button disabled={!snapshot || busy} onClick={() => { if (!dirty || window.confirm('Отменить несохранённые изменения и открыть файл с диска?')) load(rootHandle); }}>Заново открыть функции</button></div>
      {review && <div className="project-review"><h3>Сохранение в проект</h3><p>Будет заменён только <code>{EXTENSION_PATH}</code>. До записи создаётся копия предыдущего файла. Если файл изменён другим редактором, сохранение остановится. Код начнёт использоваться в локальном DAYRIS; перед выпуском проверьте его вручную.</p><p>Функций было: {JSON.parse(saved).features.length} → станет: {config.features.length}. Размер: {new Blob([JSON.stringify(config)]).size} байт.</p><button disabled={busy} onClick={save}>Создать копию и сохранить функции</button><button disabled={busy} onClick={() => setReview(false)}>Отмена</button></div>}
      <LocalProjectTools local savedPath={savedPath} dirty={dirty} hidePreview/>
    </main></div>
  </section>;
}
