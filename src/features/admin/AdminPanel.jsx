import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { configElements, EMPTY_CONFIG, normalizeConfig, safeLink } from './siteConfig.js';
import './AdminPanel.css';
import { featureFor } from './featureRegistry.js';
import VoiceCommandsEditor from './VoiceCommandsEditor.jsx';

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

export default function AdminPanel({ onOpenSource, onDirtyChange } = {}) {
  const [config, setConfig] = useState(() => clone(EMPTY_CONFIG));
  const [saved, setSaved] = useState(JSON.stringify(EMPTY_CONFIG));
  const [version, setVersion] = useState(null);
  const [access, setAccess] = useState('loading');
  const [identity, setIdentity] = useState('');
  const [device, setDevice] = useState('mobile');
  const [selected, setSelected] = useState('global');
  const [inspect, setInspect] = useState(true);
  const [view, setView] = useState('design');
  const [zoom, setZoom] = useState('fit');
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
  latest.current = { config, inspect, selected };
  const dirty = JSON.stringify(config) !== saved;
  useEffect(() => { onDirtyChange?.(dirty); return () => onDirtyChange?.(false); }, [dirty, onDirtyChange]);
  const canWrite = access === 'admin' && version !== null;
  const elements = configElements(config);
  const element = elements.find(item => item.id === selected);
  const feature = featureFor(selected);
  const custom = config.buttons?.find(item => item.id === selected);
  const values = selected === 'global' ? config[device].global : config[device].elements[selected] || {};
  const previewWidth = device === 'mobile' ? 390 : 1280;
  const scale = zoom === 'actual' ? 1 : Math.min(1, Math.max(0.1, (canvasWidth - 32) / previewWidth), canvasHeight === null ? 1 : Math.max(0.1, (canvasHeight - 32) / 780));

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
        setSelected(event.data.id);
        if (['design','logic','sources'].includes(event.data.view)) { setView(event.data.view); if (matchMedia('(max-width:900px)').matches) controls.current?.scrollIntoView({ block: 'start' }); }
      }
      if (event.data?.type === 'dayris:preview-ready') sendPreview();
    };
    window.addEventListener('message', message);
    return () => window.removeEventListener('message', message);
  }, []);
  useEffect(() => { sendPreview(); }, [config, inspect, selected]);
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
    if (frame.current) frame.current.src = '/?adminPreview=1';
  }
  function change(next) {
    setPast(previous => [...previous.slice(-49), config]); setFuture([]);
    setConfig(normalizeConfig(next)); setStatus('Есть несохранённые изменения.');
  }
  function edit(key, value) {
    const next = clone(config);
    const target = selected === 'global' ? next[device].global : (next[device].elements[selected] ||= {});
    if (value === '' || value === undefined) delete target[key]; else target[key] = value;
    change(next);
  }
  function editButton(key, value) {
    const next = clone(config);
    next.buttons.find(item => item.id === selected)[key] = value;
    change(next);
  }
  function addButton() {
    const id = `button-${Array.from(crypto.getRandomValues(new Uint8Array(12)), value => value.toString(16).padStart(2, '0')).join('')}`;
    const next = clone(config);
    (next.buttons ||= []).push({ id, label: 'Новая кнопка', href: '', placement: 'header' });
    change(next); setSelected(id); setInspect(true);
    setStatus('Кнопка добавлена в черновик. Задайте название, переход и расположение. До публикации пользователи её не увидят.');
  }
  function removeButton() {
    const next = clone(config);
    next.buttons = next.buttons.filter(item => item.id !== selected);
    for (const target of ['mobile', 'desktop']) delete next[target].elements[selected];
    change(next); setSelected('global');
  }
  function undo() {
    if (!past.length) return;
    setFuture(previous => [config, ...previous]); setConfig(past.at(-1)); setPast(past.slice(0, -1));
  }
  function redo() {
    if (!future.length) return;
    setPast(previous => [...previous, config]); setConfig(future[0]); setFuture(future.slice(1));
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
  function colorField(key, label) {
    return <label className="admin-field" key={key}><span>{label}</span><div className="admin-color"><input aria-label={label} type="color" value={values[key] || '#ffffff'} onChange={event => edit(key, event.target.value)}/><code>{values[key] || 'Как в приложении'}</code><button onClick={() => edit(key, undefined)} disabled={!values[key]}>Сброс</button></div></label>;
  }

  return <div className="dayris-admin">
    <header className="admin-toolbar"><div><a href="/">← DAYRIS</a><h1>Редактор приложения</h1><p>{identity || 'Визуальная настройка DAYRIS'}</p></div><div className="admin-toolbar-actions"><button onClick={undo} disabled={busy || !past.length}>Отменить</button><button onClick={redo} disabled={busy || !future.length}>Вернуть</button><button onClick={saveLocal} disabled={busy}>На устройство</button><button onClick={() => persist(false)} disabled={busy || !canWrite || !dirty}>Сохранить черновик</button><button className="admin-primary" onClick={() => persist(true)} disabled={busy || !canWrite}>Опубликовать</button></div></header>
    <div className="admin-notice" role="status" aria-live="polite">
      {access === 'loading' && 'Проверяем доступ…'}
      {access === 'guest' && <>Для публикации <a href="/">войдите в DAYRIS</a> и вернитесь в редактор. Пока доступен локальный предпросмотр.</>}
      {access === 'denied' && 'У аккаунта нет роли администратора. Доступен только локальный предпросмотр.'}
      {access === 'unavailable' && 'Облачная админка недоступна. Требуется миграция Supabase и назначение администратора. Локальный редактор работает.'}
      {access === 'admin' && <><span>{`Администратор · версия черновика ${version}${dirty ? ' · есть изменения' : ''}`}</span><small className="admin-publish-hint">Черновик виден только вам. Публикация меняет оформление всех пользователей.</small></>}
      {status && <p>{status}</p>}
    </div>
    <main className="admin-layout">
      <aside ref={controls} className="admin-controls" aria-label="Параметры оформления">
        <div className="admin-tabs" role="group" aria-label="Устройство">{[['mobile', 'Телефон'], ['desktop', 'ПК']].map(([id, label]) => <button key={id} aria-pressed={device === id} onClick={() => setDevice(id)}>{label}</button>)}</div>
        <p className="admin-hint">Настройки телефона и ПК независимы. В предпросмотре нажмите на элемент или выберите его ниже.</p>
        <button className="admin-add" onClick={addButton} disabled={busy || !canWrite || (config.buttons?.length || 0) >= 20}>+ Добавить кнопку</button>
        <label className="admin-field"><span>Элемент</span><select aria-label="Элемент" value={selected} disabled={busy} onChange={event => { setSelected(event.target.value); setInspect(true); }}><option value="global">Фон приложения</option>{elements.map(item => <option value={item.id} key={item.id}>{item.custom ? '↳ ' : ''}{item.label}</option>)}</select></label>
        <div className="admin-tabs admin-inspector-tabs" role="group" aria-label="Редактор выбранного элемента">{[['design','Вид'],['logic','Логика'],['sources','Связи']].map(([id,label]) => <button key={id} aria-pressed={view === id} onClick={() => setView(id)}>{label}</button>)}</div>
        <section className="admin-feature-card"><small>ВЫБРАННЫЙ МОДУЛЬ</small><h2>{feature.title}</h2><p>{feature.description}</p><ol>{feature.steps.map(step => <li key={step}>{step}</li>)}</ol></section>
        {view === 'logic' && (feature.voice ? <VoiceCommandsEditor commands={config.voiceCommands} disabled={busy || !canWrite} onChange={commands => { const next = clone(config); next.voiceCommands = commands; change(next); }}/> : <section className="admin-feature-logic"><h3>Как работает модуль</h3><p>{feature.description}</p><p>«Выполнить действие» в меню элемента открывает настоящий экран, не выключая инспектор. Внутри можно выбрать следующий зарегистрированный элемент.</p><button onClick={() => setView('sources')}>Открыть связанные файлы</button><p className="admin-hint">Здесь ещё нет универсального конструктора произвольной логики. Поведение этого модуля меняется в связанных исходниках; права и финансовые проверки нельзя отключить визуальными настройками.</p></section>)}
        {view === 'sources' && <section className="admin-feature-sources"><h3>Связанные исходники</h3>{feature.files.map(path => <button key={path} className="admin-source-link" onClick={() => { if (onOpenSource) onOpenSource(path); else window.dispatchEvent(new CustomEvent('dayris:open-project', { detail: { path } })); }}>{path} ↗</button>)}<p className="admin-hint">Откроется карта с назначением файла. Содержимое читается с вашего ПК только после подключения папки; изменение кода требует проверки и сборки.</p></section>}
        <div hidden={view !== 'design'}>
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
      </aside>
      <section className="admin-stage" aria-label="Предпросмотр приложения">
        <div className="admin-preview-toolbar"><strong>{device === 'mobile' ? 'Телефон · 390 px' : 'ПК · 1280 px'} · {Math.round(scale * 100)}%</strong><div className="admin-tabs" role="group" aria-label="Режим предпросмотра"><button aria-pressed={inspect} onClick={resumeEditing}>Редактирование</button><button aria-pressed={!inspect} onClick={() => setInspect(false)}>Проверить приложение</button></div></div>
        <p className="admin-hint">{inspect ? 'Нажмите на элемент: появится голубая рамка, параметры — слева (на телефоне ниже). Нажатия не открывают календарь и не меняют данные.' : 'Внимание: это ваш настоящий аккаунт. Кнопки и ввод выполняют обычные действия приложения, включая изменение данных.'}</p>
        <button className="admin-selection" onClick={() => controls.current?.scrollIntoView({ block: 'start' })}>Параметры: {element?.label || 'Фон приложения'} ↓</button>
        <div className="admin-preview-zoom" role="group" aria-label="Масштаб макета"><button aria-pressed={zoom === 'fit'} onClick={() => setZoom('fit')}>Подогнать</button><button aria-pressed={zoom === 'actual'} onClick={() => setZoom('actual')}>100% · с прокруткой</button></div>
        <div ref={canvas} className="admin-frame-scroll"><div className="admin-frame-size" style={{ width: previewWidth * scale, height: 780 * scale }}><iframe ref={frame} title="Предпросмотр DAYRIS" src="/?adminPreview=1" className={`admin-preview admin-preview-${device}`} style={{ transform: `scale(${scale})` }} onLoad={sendPreview}/></div></div>
      </section>
    </main>
  </div>;
}

function LinkInput({ value, onChange, onError, label, placeholder = 'Штатное действие' }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  const invalid = Boolean(text && !safeLink(text));
  return <><input aria-label={label} type="text" placeholder={placeholder} value={text} aria-invalid={invalid} onChange={event => { const next = event.target.value; setText(next); if (!next || safeLink(next)) onChange(next); }} onBlur={() => { if (invalid) onError(); }}/>{invalid && <small role="alert">Нужна HTTPS-ссылка или путь от / . Некорректная ссылка не сохранится.</small>}</>;
}
