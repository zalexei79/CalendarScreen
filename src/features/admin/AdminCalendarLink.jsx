import React from 'react';
import { ShieldCheck } from 'lucide-react';
import useAdminAccess from './useAdminAccess.js';
import './AdminCalendarLink.css';

export default function AdminCalendarLink({ user, language = 'ru', isLight }) {
  const preview = window.parent !== window && new URLSearchParams(location.search).get('adminPreview') === '1';
  const allowed = useAdminAccess(preview ? null : user?.id);
  if (!allowed) return null;
  const label = String(language).startsWith('zh') ? '管理后台' : ['ro','md'].includes(language) ? 'Panou de administrare' : language === 'en' ? 'Admin panel' : 'Админ-панель';
  // Same-tab, same-origin navigation preserves the calendar's signed-in session,
  // including inside an installed iOS PWA. No second OAuth flow is started.
  return <a className={`calendar-admin-link${isLight ? ' is-light' : ''}`} href="/admin.html" aria-label={label} title={label}>
    <ShieldCheck size={16} aria-hidden="true"/>
    <span className="calendar-admin-short">Admin</span>
    <span className="calendar-admin-full">{label}</span>
  </a>;
}
