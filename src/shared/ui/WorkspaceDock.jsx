import React, { useEffect, useState } from 'react';
import { ArrowDown, Wallet } from 'lucide-react';
import { createPortal } from 'react-dom';
import './WorkspaceViewport.css';

// Keep fixed navigation outside animated/scrolling app containers.
export default function WorkspaceDock({ children, proView = false, isLight = false, hidden = false, language = 'ru' }) {
  const [pull, setPull] = useState(null);
  useEffect(() => {
    const update = (event) => setPull(event.detail.axis === 'y' ? event.detail : null);
    window.addEventListener('dayris-calendar-pull', update);
    return () => window.removeEventListener('dayris-calendar-pull', update);
  }, []);
  const copy = language === 'en' ? ['Pull down to open wallet', 'Release to open wallet']
    : language === 'md' || language === 'ro' ? ['Trage pentru portofel', 'Eliberează pentru portofel']
    : ['Потяните вниз — в кошелёк', 'Отпустите — открыть кошелёк'];
  if (hidden) return null;
  // A standalone calendar control: never inherit shell filters/animations,
  // which create a containing block and move fixed controls on mobile Safari.
  return createPortal(<div data-pro={proView} data-light={isLight} data-pulling={Boolean(pull)} data-ready={Boolean(pull?.ready)} className="history-fab calendar-action-dock fixed inset-x-0 flex justify-center items-center z-30 pointer-events-none px-4"><div className="calendar-dock-morph">
    <div className="calendar-dock-actions" inert={pull ? '' : undefined} aria-hidden={Boolean(pull)}>{children}</div>
    <div className="calendar-dock-wallet" aria-hidden={!pull}><ArrowDown aria-hidden="true" /><span>{copy[pull?.ready ? 1 : 0]}</span><Wallet aria-hidden="true" /></div>
  </div></div>, document.body);
}
