import React from 'react';
import { createRoot } from 'react-dom/client';
import AdminProject from './features/admin/AdminProject.jsx';
import AdminPanel from './features/admin/AdminPanel.jsx';
import LocalFeatureStudio from './features/admin/LocalFeatureStudio.jsx';
import './features/admin/AdminPanel.css';
import './features/admin/AdminUsers.css';

const local = import.meta.env.DEV && ['127.0.0.1','localhost'].includes(location.hostname) && Boolean(window.__DAYRIS_DESK_TOKEN__);
if (local && 'serviceWorker' in navigator) navigator.serviceWorker.getRegistrations().then(items => Promise.all(items.map(item => item.unregister()))).catch(() => {});
function Desk() {
  const [view, setView] = React.useState('visual');
  const [path, setPath] = React.useState('src/features');
  const [root, setRoot] = React.useState(null);
  const [dirty, setDirty] = React.useState(false);
  function source(path) {
    if (dirty && !window.confirm('В редакторе есть несохранённый черновик. Перейти без сохранения?')) return;
    setDirty(false); setPath(path); setView('source');
  }
  function navigate(next) {
    if (next === view || (dirty && !window.confirm('Есть несохранённый черновик. Перейти без сохранения?'))) return;
    setDirty(false); setView(next);
  }
  return <div className="dayris-admin admin-app"><header className="admin-toolbar project-desk-header"><div><h1>DAYRIS · Локальная мастерская</h1><p>Календарь → элемент → вид, логика и связанные исходники</p></div><div className="admin-tabs"><button aria-pressed={view === 'visual'} onClick={() => navigate('visual')}>Визуально</button><button aria-pressed={view === 'functions'} onClick={() => navigate('functions')}>Конструктор функций</button><button aria-pressed={view === 'source'} onClick={() => source(path)}>Карта и исходники</button></div><a href="/" target="_blank" rel="noreferrer">Открыть локальный DAYRIS ↗</a></header>{local ? view === 'visual' ? <AdminPanel onOpenSource={source} onDirtyChange={setDirty} localProject={{root,onRootChange:setRoot}}/> : view === 'functions' ? <LocalFeatureStudio rootHandle={root} onRootChange={setRoot} onDirtyChange={setDirty}/> : <AdminProject initialPath={path} rootHandle={root} onRootChange={setRoot}/> : <p className="admin-page">Запустите npm run project:desk в папке проекта. Команды доступны только в локальной мастерской.</p>}</div>;
}
createRoot(document.getElementById('root')).render(<Desk/>);
