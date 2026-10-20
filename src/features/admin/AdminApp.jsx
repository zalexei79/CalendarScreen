import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { startOAuthLogin } from '../auth/oauthLogin.js';
import { disablePush } from '../reminders/pushClient.js';
import AdminUsers from './AdminUsers.jsx';
import AdminAudit from './AdminAudit.jsx';
import AdminPro from './AdminPro.jsx';
import StudioLaunch from './StudioLaunch.jsx';
import './AdminPanel.css';
import './AdminUsers.css';
const DesignEditor = React.lazy(() => import('./AdminPanel.jsx'));
const ProjectExplorer = React.lazy(() => import('./AdminProject.jsx'));
const NO_ACCESS = { design: false, viewUsers: false, editUsers: false };

export default function AdminApp() {
  const [section, setSection] = useState(() => {const requested=new URLSearchParams(location.search).get('section');return ['studio','pro'].includes(requested)?requested:location.pathname==='/admin.html'?'users':'design';});
  const [session, setSession] = useState(null);
  const [capabilities, setCapabilities] = useState(NO_ACCESS);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [installPrompt, setInstallPrompt] = useState(window.__atjInstallPrompt);
  const [pending, setPending] = useState(false);
  const [projectPath, setProjectPath] = useState('src/features');
  const [designDirty, setDesignDirty] = useState(false);
  useEffect(() => {
    const open = event => {
      const path = event.detail?.path;
      if (typeof path !== 'string' || path.length > 300) return;
      if (designDirty && !window.confirm('В оформлении есть несохранённые изменения. Перейти к исходникам без сохранения?')) return;
      setProjectPath(path); setSection('project');
    };
    window.addEventListener('dayris:open-project', open);
    const guard = event => { if (designDirty && event.target instanceof Element && event.target.closest('.admin-app-header button,.admin-app-header a') && !window.confirm('В оформлении есть несохранённые изменения. Покинуть редактор?')) { event.preventDefault(); event.stopImmediatePropagation(); } };
    window.addEventListener('click', guard, true);
    return () => { window.removeEventListener('dayris:open-project', open); window.removeEventListener('click', guard, true); };
  }, [designDirty]);
  useEffect(() => {
    let active = true, revision = 0, knownUser;
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      const userId = next?.user?.id || null;
      if (userId === knownUser) { setSession(next); return; }
      knownUser = userId;
      const request = ++revision;
      setSession(next); setCapabilities(NO_ACCESS); setLoading(Boolean(next)); setNotice('');
      if (!next) { setLoading(false); return; }
      queueMicrotask(async () => {
        try {
          const result = await supabase.rpc('admin_capabilities');
          if (!active || revision !== request) return;
          if (result.error) throw result.error;
          setCapabilities(result.data || NO_ACCESS);
        } catch { if (active && revision === request) setNotice('Управление пользователями ещё не подключено. Нужны обе миграции админки и права вашего аккаунта.'); }
        finally { if (active && revision === request) setLoading(false); }
      });
    });
    const prompt = () => setInstallPrompt(window.__atjInstallPrompt);
    window.addEventListener('atj-install-ready', prompt);
    return () => { active = false; revision++; data.subscription.unsubscribe(); window.removeEventListener('atj-install-ready', prompt); };
  }, []);
  async function login() {
    setPending(true); setNotice('');
    try { await startOAuthLogin({ auth: supabase.auth, disablePush, provider: 'google', origin: `${location.origin}/admin.html` }); }
    catch { setNotice('Не удалось войти. Попробуйте ещё раз.'); }
    finally { setPending(false); }
  }
  async function install() {
    if (location.pathname !== '/admin.html') { location.assign('/admin.html'); return; }
    if (!installPrompt) { setNotice('На ПК: откройте /admin.html в Edge или Chrome и выберите «Установить приложение». На iPhone: Safari → Поделиться → На экран «Домой». На Android: меню браузера → Установить приложение.'); return; }
    try { await installPrompt.prompt(); await installPrompt.userChoice; setInstallPrompt(null); }
    catch { setNotice('Откройте /admin.html и установите DAYRIS Admin через меню браузера.'); }
  }
  const allowed = ['design','project','studio'].includes(section) ? capabilities.design === true : capabilities.viewUsers === true;
  const sections = [['users','Пользователи'],['pro','PRO'],['studio','Студия'],['design','Оформление'],['project','Проект'],['audit','Журнал']];
  const designOrProject = section === 'project' ? <ProjectExplorer key={session?.user.id} initialPath={projectPath}/> : <DesignEditor onDirtyChange={setDesignDirty}/>;
  const userSection=section==='pro'?<AdminPro key={session?.user.id} canEdit={capabilities.editUsers===true}/>:<AdminUsers key={session?.user.id} canEdit={capabilities.editUsers===true}/>;
  return <div className="dayris-admin admin-app">
    <header className="admin-app-header"><a href="/admin.html" className="admin-app-brand">DAYRIS <span>ADMIN</span></a><nav aria-label="Разделы админки">{sections.map(([id,label]) => <button key={id} className={id==='studio'?'admin-studio-entry':undefined} aria-current={section === id ? 'page' : undefined} onClick={() => setSection(id)}>{label}</button>)}</nav><button onClick={install}>Установить приложение</button><a href="/admin.html" target="_blank" rel="noreferrer">Открыть отдельно ↗</a>{session && <button onClick={async () => { try { const {error}=await supabase.auth.signOut(); if(error) throw error; } catch { setNotice('Не удалось выйти. Проверьте подключение.'); } }}>Выйти</button>}</header>
    {notice && <p className="admin-notice" role="status">{notice}</p>}
{loading ? <p className="admin-page" role="status">Проверяем административный доступ…</p> : !session ? <section className="admin-access admin-page"><h1>Войти в DAYRIS Admin</h1><p>Войдите назначенным Google-аккаунтом. Отдельный пароль для админки не требуется.</p><div className="admin-actions"><button className="admin-primary" disabled={pending} onClick={login}>Войти через Google</button></div></section> : !allowed ? <section className="admin-page admin-access"><h1>Нужен доступ к данным пользователей</h1><p>{session.user.email || session.user.id}</p><p>Доступ разрешён только назначенному Google-аккаунту. При входе другим аккаунтом или способом повторите вход через Google.</p><button disabled={pending} onClick={login}>Войти через Google</button></section> : section === 'studio' ? <StudioLaunch/> : section === 'design' || section === 'project' ? <React.Suspense fallback={<p className="admin-page">Загрузка раздела…</p>}>{designOrProject}</React.Suspense> : section === 'audit' ? <AdminAudit key={session.user.id} /> : userSection}
  </div>;
}
