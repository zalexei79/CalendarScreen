import React from 'react';
import { createRoot } from 'react-dom/client';
import AdminProject from './features/admin/AdminProject.jsx';
import './features/admin/AdminPanel.css';
import './features/admin/AdminUsers.css';

const local = import.meta.env.DEV && ['127.0.0.1','localhost'].includes(location.hostname) && Boolean(window.__DAYRIS_DESK_TOKEN__);
if (local && 'serviceWorker' in navigator) navigator.serviceWorker.getRegistrations().then(items => Promise.all(items.map(item => item.unregister()))).catch(() => {});
createRoot(document.getElementById('root')).render(<div className="dayris-admin"><header className="admin-toolbar"><div><h1>DAYRIS · Локальная мастерская</h1><p>Исходники → локальный результат → проверка → публикация</p></div><a href="/" target="_blank" rel="noreferrer">Открыть локальный DAYRIS ↗</a></header>{local ? <AdminProject/> : <p className="admin-page">Запустите npm run project:desk в папке проекта. Команды доступны только в локальной мастерской.</p>}</div>);
