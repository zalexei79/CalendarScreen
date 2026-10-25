import React from 'react';
import { ChevronRight, ShieldCheck } from 'lucide-react';
import useAdminAccess from './useAdminAccess.js';

export default function AdminCalendarLink({ user, language = 'ru' }) {
  const preview = window.parent !== window && new URLSearchParams(location.search).get('adminPreview') === '1';
  const allowed = useAdminAccess(preview ? null : user?.id);
  if (!allowed) return null;
  const label = String(language).startsWith('uk') ? 'Адмін-панель' : String(language).startsWith('zh') ? '管理后台' : ['ro','md'].includes(language) ? 'Panou de administrare' : language === 'en' ? 'Admin panel' : 'Админ-панель';
  // Same-tab, same-origin navigation preserves the calendar's signed-in session,
  // including inside an installed iOS PWA. No second OAuth flow is started.
  return <a className="settings-row settings-admin-link" href="/admin.html" aria-label={label}>
    <ShieldCheck size={18} aria-hidden="true"/>
    <span>{label}</span>
    <ChevronRight size={15} aria-hidden="true"/>
  </a>;
}
