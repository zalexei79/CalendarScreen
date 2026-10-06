import React, { useEffect, useRef } from 'react';
import { ArrowRight, CalendarDays, Send, X } from 'lucide-react';
import BrandIcon from '../../shared/ui/BrandIcon.jsx';
import { getEntryCopy } from './entryCopy.js';
import { translate } from '../../shared/i18n';
import './WelcomeScreen.css';

function GoogleMark() {
  return <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.36Z"/><path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.41l-3.24-2.51c-.9.6-2.05.97-3.38.97-2.61 0-4.82-1.76-5.61-4.13H3.05v2.59A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.39 13.92a6 6 0 0 1 0-3.84V7.49H3.05a10 10 0 0 0 0 9.02l3.34-2.59Z"/><path fill="#EA4335" d="M12 5.95c1.47 0 2.79.5 3.83 1.5l2.87-2.87A9.63 9.63 0 0 0 12 2a10 10 0 0 0-8.95 5.49l3.34 2.59C7.18 7.71 9.39 5.95 12 5.95Z"/></svg>;
}

export default function WelcomeScreen({ language, currency = 'USD', theme = 'dark', handleGoogleLogin, handleTelegramLogin, loginPending, loginError, onExplore, onClose, compact = false }) {
  const copy = getEntryCopy(language);
  const dialog = useRef(null);
  useEffect(() => {
    if (!compact) return;
    dialog.current.showModal();
    return () => dialog.current?.close();
  }, [compact]);
  const actions = <>
    <div className="entry-welcome-actions">
      <button type="button" className="entry-google" onClick={handleGoogleLogin} disabled={Boolean(loginPending)}><GoogleMark />{loginPending === 'google' ? translate(language, 'authConnecting') : copy.google}<ArrowRight size={16} /></button>
      <button type="button" className="entry-telegram" onClick={handleTelegramLogin} disabled={Boolean(loginPending)}><Send size={19} />{loginPending === 'custom:telegram' ? translate(language, 'authConnecting') : copy.telegram}<ArrowRight size={16} /></button>
    </div>
    {loginError && <p role="alert" className="entry-error">{loginError}</p>}
    <button type="button" className="entry-explore" onClick={compact ? onClose : onExplore}>{compact ? copy.close : copy.explore}<ArrowRight size={14} /></button>
  </>;
  if (compact) return <dialog ref={dialog} className="entry-login-dialog" data-theme={theme} onCancel={event => { event.preventDefault(); onClose(); }} aria-labelledby="entry-login-title">
    <button type="button" className="entry-close" onClick={onClose} aria-label={copy.close}><X size={20} /></button>
    <BrandIcon className="h-12 w-12" /><h2 id="entry-login-title">{copy.addTitle}</h2><p>{copy.addHint}</p>{actions}
  </dialog>;
  return <main className="entry-welcome" data-theme={theme}>
    <div className="entry-welcome-layout">
      <section className="entry-welcome-story" aria-labelledby="entry-welcome-title">
        <div className="entry-brand"><BrandIcon className="h-11 w-11" /><div><strong>DAYRIS</strong><span>{copy.eyebrow}</span></div></div>
        <h1 id="entry-welcome-title">{copy.title}</h1><p className="entry-subtitle">{copy.subtitle}</p>
        <figure className="entry-calendar-preview">
          <figcaption><CalendarDays size={16} />{copy.preview}<span>{currency}</span></figcaption>
          <div className="entry-calendar-cells" aria-hidden="true">{[1, 2, 3, 4, 5, 6, 7].map((day, index) => <div key={day}><span>{day}</span>{index === 0 ? <b className="entry-positive">+777</b> : index === 2 ? <b className="entry-negative">−69</b> : index === 4 ? <b className="entry-positive">+67</b> : index === 6 ? <b className="entry-negative">−7</b> : <i />}</div>)}</div>
        </figure>
      </section>
      <section className="entry-welcome-card" aria-labelledby="entry-start-title">
        <span className="entry-card-eyebrow">DAYRIS</span><h2 id="entry-start-title">{copy.heading}</h2><p>{copy.hint}</p>{actions}
      </section>
    </div>
  </main>;
}
