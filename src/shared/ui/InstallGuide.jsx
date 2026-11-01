import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Download, Share, Home, Plus, MoreVertical, Check, X, Monitor } from 'lucide-react';
import { getInstallPlatform } from '../lib/installPlatform.js';
import { installGuideCopy } from '../i18n/installGuide.js';
import './InstallGuide.css';

export function InstallSteps({ language, platform = getInstallPlatform() }) {
  const copy = installGuideCopy(language);
  const steps = platform.ios
    ? [[Share, platform.browser === 'Chrome' ? copy.chromeShare : copy.share], [Home, copy.home], [Plus, copy.add]]
    : platform.android ? [[MoreVertical, copy.menu], [Download, copy.install], [Check, copy.confirm]]
      : [[MoreVertical, copy.pcMenu], [Monitor, copy.pcInstall]];
  return <div className="dayris-install-guide">
    <p className="dayris-install-platform">{[platform.name, platform.browser].filter(Boolean).join(' · ') || 'Chrome / Edge'}</p>
    <h2>{platform.ios ? copy.ios : platform.android ? copy.android : copy.desktop}</h2>
    {platform.embedded && <p className="dayris-install-note">{copy.embedded}</p>}
    <ol>{steps.map(([Icon, text], index) => <li key={index}>
      <span className="dayris-install-number">{index + 1}</span>
      <div><Icon aria-hidden="true" size={21} /><p>{text}</p></div>
    </li>)}</ol>
    {platform.ios && <p className="dayris-install-note">{copy.fallback}</p>}
  </div>;
}

export default function InstallGuide({ open, onClose, language, isLight, platform }) {
  const ref = useRef(null);
  const copy = installGuideCopy(language);
  useEffect(() => {
    if (!open) return;
    const dialog = ref.current;
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.showModal();
    return () => { dialog.close(); document.body.style.overflow = overflow; previous?.focus?.({ preventScroll: true }); };
  }, [open]);
  if (!open) return null;
  return createPortal(<dialog ref={ref} className="dayris-install-dialog" data-light={isLight ? 'true' : 'false'}
    aria-labelledby="dayris-install-title" onCancel={event => { event.preventDefault(); onClose(); }}
    onClick={event => {
      if (event.target !== event.currentTarget) return;
      const box = event.currentTarget.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) onClose();
    }}>
    <div className="dayris-install-top"><span><Download size={20} aria-hidden="true" />DAYRIS</span><button type="button" onClick={onClose} aria-label={copy.close}><X size={20} /></button></div>
    <h1 id="dayris-install-title">{copy.title}</h1>
    <p className="dayris-install-subtitle">{copy.subtitle}</p>
    <InstallSteps language={language} platform={platform} />
    <button className="dayris-install-done" type="button" onClick={onClose}>{copy.done}</button>
  </dialog>, document.body);
}
