import React, { useEffect, useMemo, useRef, useState } from 'react';
import catalog from './projectCatalog.generated.json';
import { describePath, RECIPES } from './projectGuide.js';
import { editableProjectPath, fileRisk, readProjectFile, saveProjectFile, validateProjectRoot } from './projectFiles.js';
import './AdminProject.css';
import LocalProjectTools from './LocalProjectTools.jsx';
import useEditorHistory from './useEditorHistory.js';

const fileIndex = new Map(catalog.files.map(file => [file.path, file]));
const folderSet = new Set(catalog.folders);
const nameOf = path => path.split('/').at(-1);

export default function AdminProject({ initialPath = 'src/features', rootHandle = null, onRootChange, compact = false, onDirtyChange } = {}) {
  const [root, setRootState] = useState(rootHandle);
  const setRoot = value => { setRootState(value); onRootChange?.(value); };
  const [selected, setSelected] = useState(() => folderSet.has(initialPath) || fileIndex.has(initialPath) ? initialPath : 'src/features');
  const [query, setQuery] = useState('');
  const [snapshot, setSnapshot] = useState(null);
  const [text, setText, textHistory] = useEditorHistory('');
  const [editing, setEditing] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [lastBackup, setLastBackup] = useState('');
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const directory = folderSet.has(selected);
  const local = import.meta.env.DEV && ['127.0.0.1','localhost'].includes(location.hostname) && Boolean(window.__DAYRIS_DESK_TOKEN__);
  const entry = fileIndex.get(selected);
  const description = describePath(selected, directory);
  const dirty = snapshot !== null && text !== snapshot.text;
  useEffect(()=>{onDirtyChange?.(dirty);return()=>onDirtyChange?.(false);},[dirty,onDirtyChange]);
  useEffect(()=>{
    const key=event=>{if(!(event.ctrlKey || event.metaKey) || event.altKey || event.target.closest?.('input,textarea,select,[contenteditable=true]'))return;if(!event.target.closest?.('.admin-project'))return;const letter=event.key.toLowerCase();if(letter==='z'||letter==='y'){event.preventDefault();event.stopImmediatePropagation();setEditing(true);(event.shiftKey||letter==='y'?textHistory.redo:textHistory.undo)();}};
    window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);
  },[textHistory]);
  const highRisk = fileRisk(selected) === 'high';
  const editable = Boolean(root && entry?.editable && editableProjectPath(selected) && snapshot);
  useEffect(() => {
    if (!root || !entry) return;
    let active = true; setBusy(true);
    readProjectFile(root, selected).then(value => { if (active) { setSnapshot(value); textHistory.reset(value.text); } }).catch(error => { if (active) setNotice(error.message); }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, []);
  const related = useMemo(() => catalog.files.filter(file => file.imports.includes(selected)).map(file => file.path), [selected]);
  const children = useMemo(() => [...catalog.folders, ...catalog.files.map(file => file.path)].filter(path => path.startsWith(`${selected}/`) && !path.slice(selected.length + 1).includes('/')), [selected]);
  const matches = useMemo(() => {
    const words = query.toLocaleLowerCase().trim().split(/\s+/);
    if (!query.trim()) return [];
    return [...catalog.folders, ...catalog.files.map(file => file.path)].filter(path => {
      const info = describePath(path, folderSet.has(path));
      const haystack = `${path} ${info.title} ${info.description}`.toLocaleLowerCase();
      return words.every(word => haystack.includes(word));
    });
  }, [query]);
  useEffect(() => {
    if (!dirty) return;
    const warn = event => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  useEffect(() => {
    if (!dirty) return;
    const guard = event => {
      const target = event.target instanceof Element ? event.target.closest('.admin-app-header button,.admin-app-header a,.project-desk-header button,.project-desk-header a') : null;
      if (target && !window.confirm('Есть несохранённые изменения файла. Покинуть редактор и потерять их?')) { event.preventDefault(); event.stopImmediatePropagation(); }
    };
    window.addEventListener('click', guard, true);
    return () => window.removeEventListener('click', guard, true);
  }, [dirty]);
  const discard = () => !dirty || window.confirm('Есть несохранённые изменения. Продолжить без сохранения? Сначала можно скачать свой вариант.');
  async function open(path, isDirectory = folderSet.has(path)) {
    if (busy || !discard()) return;
    setSelected(path); setSnapshot(null); textHistory.reset(''); setEditing(false); setAcknowledged(false); setNotice(''); setLastBackup(''); setSaving(false);
    if (isDirectory || !root || !fileIndex.has(path)) return;
    setBusy(true);
    try {
      const value = await readProjectFile(root, path);
      if (alive.current) { setSnapshot(value); textHistory.reset(value.text); }
    } catch (error) { if (alive.current) setNotice(`Не удалось открыть файл. ${error.message}`); }
    finally { if (alive.current) setBusy(false); }
  }
  async function connect() {
    if (!discard()) return;
    if (!window.showDirectoryPicker) { setNotice('Для доступа к папке откройте панель на ПК в Edge или Chrome. Карта и инструкции доступны без подключения папки.'); return; }
    try {
      const handle = await window.showDirectoryPicker({ id: 'dayris-project', mode: 'readwrite' });
      setBusy(true); await validateProjectRoot(handle, local ? window.__DAYRIS_DESK_WORKSPACE__ : undefined);
      if (!alive.current) return;
      setRoot(handle); setSnapshot(null); textHistory.reset(''); setEditing(false); setSaving(false); setAcknowledged(false); setLastBackup('');
      setNotice(`Подключена локальная папка «${handle.name}». Выберите файл. Содержимое не отправляется на сервер.`);
      if (entry) { const value = await readProjectFile(handle, selected); if (alive.current) { setSnapshot(value); textHistory.reset(value.text); } }
    } catch (error) { if (alive.current && error.name !== 'AbortError') setNotice(`Не удалось подключить папку. ${error.message}`); }
    finally { if (alive.current) setBusy(false); }
  }
  async function save() {
    if (!editable || !dirty || busy || !editing || (highRisk && !acknowledged)) return;
    setBusy(true);
    try {
      const result = await saveProjectFile(root, selected, snapshot, text);
      if (!alive.current) return;
      setSnapshot(result.snapshot); setLastBackup(result.backup); setEditing(false); setSaving(false);
      setNotice('Сохранено на этом ПК. Резервная копия создана. На сайте ничего не опубликовано — теперь проверьте сборку и тесты.');
    } catch (error) { if (alive.current) setNotice(`Сохранение отменено. ${error.message}`); }
    finally { if (alive.current) setBusy(false); }
  }
  function download() {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = nameOf(selected); anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const pathButton = path => <button key={path} className="project-path" disabled={busy} onClick={() => open(path)}>{folderSet.has(path) ? '📁 ' : ''}{path}</button>;
  return <section className={`admin-project admin-page${local && !compact ? ' project-is-local' : ''}${compact ? ' project-embedded' : ''}`}>
    <div className="admin-page-title"><div><h1>Карта проекта</h1><p>Что за что отвечает · {catalog.folders.length} папок · {catalog.files.length} файлов</p></div><div className="admin-actions"><button disabled={busy} onClick={connect}>{root ? 'Выбрать другую папку' : 'Подключить папку проекта'}</button>{root && <button disabled={busy} onClick={() => { if (discard()) { setRoot(null); setSnapshot(null); setText(''); setEditing(false); setSaving(false); setNotice('Папка отключена от этой вкладки. Разрешение сайта можно отозвать в настройках браузера.'); } }}>Отключить папку</button>}</div></div>
    <p className="project-boundary">{root ? `Локальная папка: ${root.name}. ` : 'Пока открыта карта версии сборки, а не файлы вашего компьютера. '}Изменения исходников сохраняются на ПК. {local ? 'Сборка и push запускаются отдельно явными кнопками ниже. Предпросмотр выполняет локальный код приложения.' : 'HTTPS-вкладка не запускает команды, SQL и не публикует исходники. Для сборки и push откройте локальную мастерскую.'} Для цветов и кнопок без кода используйте «Оформление».</p>
    <div role="status" aria-live="polite" className="project-status">{busy ? 'Работаем с локальным файлом…' : notice || (dirty ? 'Есть несохранённые изменения.' : 'Выберите папку или файл: справа появятся назначение и связи.')}</div>
    <details className="project-help"><summary>Как пользоваться без помощи ИИ</summary><ol><li>Найдите нужный раздел через поиск или подсказки ниже.</li><li>На ПК откройте панель в Edge/Chrome, нажмите «Подключить папку проекта» и выберите ai-trade-journal.</li><li>Выберите текстовый файл, прочитайте назначение и связи. Нажмите «Редактировать локально».</li><li>Проверьте изменения, подтвердите сохранение. Предыдущий текст останется в .dayris-project-backups.</li><li>В терминале проекта: <code>npm run build</code>, затем подходящие тесты из tests. Проверьте изменения через <code>git diff</code>.</li><li>После проверки сделайте commit и push. Supabase SQL/функции и Android выпускаются отдельно. Подробная инструкция — docs/PROJECT_GUIDE.md.</li></ol><p>Нет встроенного ИИ и зависимости от подписки Codex. Это редактор текста, не гарантия правильности кода. Бинарные файлы, секреты и служебные папки закрыты. Новые файлы попадут в карту после npm run project:map и следующей сборки.</p></details>
    <LocalProjectTools local={local} savedPath={lastBackup} dirty={dirty}/>
    <div className="project-layout">
      <aside className="project-browser" aria-label="Папки и файлы проекта"><label className="admin-field"><span>Поиск по назначению или пути</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Например: календарь, тема, вход"/></label>
        {query.trim() ? <div><p>{matches.length} совпадений{matches.length > 100 ? ' · первые 100' : ''}</p>{matches.slice(0, 100).map(pathButton)}{!matches.length && <p>Ничего не найдено. Попробуйте название папки или другое описание.</p>}</div> : <ProjectTree selected={selected} onSelect={open} disabled={busy}/>}
      </aside>
      <main className="project-detail" aria-label="Описание и редактор файла">
        <div className="project-breadcrumb"><button disabled={busy} onClick={() => open('src/features', true)}>Разделы</button> / <code>{selected}</code></div>
        <h2>{description.title}</h2><p>{description.description}</p>
        <p className="project-file-state">{directory ? 'Папка — выберите файл внутри' : `${entry?.size.toLocaleString('ru')} байт в версии сайта · ${entry?.editable ? 'текстовый исходник' : 'только чтение / ресурс'}`}{highRisk && ' · повышенный риск: права, данные или сборка'}</p>
        {directory ? <div className="project-child-list">{children.map(pathButton)}{children.length === 0 && <p>В этой папке нет показываемых файлов.</p>}</div> : <>
          {!root && <p>Для чтения и редактирования выберите локальную папку проекта. Сервер не отдаёт содержимое исходников.</p>}
          {snapshot && <>
            <div className="admin-actions project-editor-actions"><button disabled={busy || !editable || editing} onClick={() => setEditing(true)}>Редактировать локально</button><button disabled={busy || !textHistory.canUndo} onClick={()=>{setEditing(true);textHistory.undo();}}>Отменить ввод</button><button disabled={busy || !textHistory.canRedo} onClick={()=>{setEditing(true);textHistory.redo();}}>Вернуть ввод</button><button disabled={busy || !dirty || !editing} onClick={() => setSaving(true)}>Проверить и сохранить</button><button disabled={busy} onClick={download}>Скачать мой вариант</button><button disabled={busy} onClick={() => open(selected, false)}>Заново открыть файл</button></div>
            {editing && <p className="project-warning">Редактируется исходный код, а не настройки. Ошибка может сломать сборку. Для отмены до сохранения заново откройте файл; после сохранения используйте резервную копию.</p>}
            <label className="project-source"><span>{editing ? 'Редактор исходного текста' : 'Просмотр исходного текста'} · {text.split('\n').length} строк</span><textarea aria-label="Исходный текст файла" readOnly={!editing || busy} spellCheck={false} value={text} onChange={event => { setText(event.target.value); setSaving(false); }} /></label>
            {saving && <section className="project-review" aria-label="Подтверждение локального сохранения"><h3>Проверьте изменение</h3><p><code>{selected}</code> · сохранение только на этом компьютере</p><div className="project-compare"><label>Было<textarea aria-label="Исходный вариант" readOnly value={snapshot.text}/></label><label>Станет<textarea aria-label="Новый вариант" readOnly value={text}/></label></div>{highRisk && <label className="admin-check"><input type="checkbox" checked={acknowledged} onChange={event => setAcknowledged(event.target.checked)}/>Понимаю: этот файл влияет на права, данные или сборку. После сохранения проверю изменения.</label>}<div className="admin-actions"><button className="admin-primary" disabled={busy || !dirty || (highRisk && !acknowledged)} onClick={save}>Создать копию и сохранить файл</button><button disabled={busy} onClick={() => setSaving(false)}>Продолжить редактирование</button></div></section>}
            {lastBackup && <p className="project-backup">Предыдущая версия: <code>{lastBackup}</code>. Для восстановления откройте этот файл обычным редактором, скопируйте содержимое обратно и снова проверьте сборку.</p>}
          </>}
          <details className="project-links" open><summary>Что куда ведёт: связи импортов</summary><h3>Использует</h3>{entry?.imports.length ? entry.imports.map(pathButton) : <p>Прямые локальные импорты не найдены.</p>}<h3>Используется в</h3>{related.length ? related.map(pathButton) : <p>Прямых импортов из других индексируемых файлов не найдено.</p>}<small>Связи получены из статических и динамических относительных импортов на момент сборки сайта. Это не полный граф URL, событий, CSS или серверных запросов; локальные изменения могут отличаться.</small></details>
        </>}
      </main>
    </div>
    <section className="project-recipes"><h2>Что хотите изменить?</h2><div>{RECIPES.map(recipe => <article key={recipe.title}><h3>{recipe.title}</h3><p>{recipe.hint}</p>{recipe.paths.filter(path => fileIndex.has(path) || folderSet.has(path)).map(pathButton)}</article>)}</div></section>
    <details className="project-help"><summary>Служебные и закрытые папки — почему их нет в дереве</summary><ul>{catalog.excluded.map(text => <li key={text}>{text}</li>)}</ul><p>Карта не хранит секреты и содержимое файлов. Не вставляйте пароли, токены и ключи в клиентский код.</p></details>
  </section>;
}

function ProjectTree({ selected, onSelect, disabled }) {
  const [expanded, setExpanded] = useState(() => new Set(['src', 'src/features', 'src/shared']));
  const childMap = useMemo(() => {
    const map = new Map();
    for (const path of [...catalog.folders, ...catalog.files.map(file => file.path)]) {
      const parent = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
      if (!map.has(parent)) map.set(parent, []);
      map.get(parent).push(path);
    }
    return map;
  }, []);
  const render = parent => <ul>{(childMap.get(parent) || []).map(path => <li key={path}><div className="project-tree-row">{folderSet.has(path) && <button aria-label={`${expanded.has(path) ? 'Свернуть' : 'Развернуть'} ${path}`} aria-expanded={expanded.has(path)} disabled={disabled} onClick={() => setExpanded(previous => { const next = new Set(previous); if (next.has(path)) next.delete(path); else next.add(path); return next; })}>{expanded.has(path) ? '▾' : '▸'}</button>}<button disabled={disabled} aria-current={selected === path ? 'page' : undefined} title={describePath(path, folderSet.has(path)).title} onClick={() => onSelect(path)}>{folderSet.has(path) ? '📁 ' : '· '}{nameOf(path)}</button></div>{folderSet.has(path) && expanded.has(path) && render(path)}</li>)}</ul>;
  return <nav className="project-tree" aria-label="Дерево папок">{render('')}</nav>;
}
