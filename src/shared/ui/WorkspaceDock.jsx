import React, { useEffect, useState } from 'react';
import { ArrowDown, ChartNoAxesCombined } from 'lucide-react';
import { createPortal } from 'react-dom';
import './WorkspaceViewport.css';

// Keep fixed navigation outside animated/scrolling app containers.
export default function WorkspaceDock({ children, proView = false, isLight = false, hidden = false, preserveChildren = false, language = 'ru' }) {
  const [pull, setPull] = useState(null);
  useEffect(() => {
    const update = (event) => setPull(event.detail.axis === 'y' ? event.detail : null);
    window.addEventListener('dayris-calendar-pull', update);
    return () => window.removeEventListener('dayris-calendar-pull', update);
  }, []);
  const copy = language === 'zh-CN' ? ['下拉打开投资组合', '松开打开投资组合'] : language === 'en' ? ['Pull down to open Capital', 'Release to open Capital']
    : language === 'md' || language === 'ro' ? ['Trage pentru Capital', 'Eliberează pentru Capital']
    : ['Потяните вниз — в Capital', 'Отпустите — открыть Capital'];
  if (hidden && !preserveChildren) return null;
  // A standalone calendar control: never inherit shell filters/animations,
  // which create a containing block and move fixed controls on mobile Safari.
  return createPortal(<div style={hidden?{display:'none'}:undefined} aria-hidden={hidden} data-pro={proView} data-light={isLight} data-pulling={Boolean(pull)} data-ready={Boolean(pull?.ready)} className="history-fab calendar-action-dock fixed inset-x-0 flex justify-center items-center z-30 pointer-events-none px-4"><div className="calendar-dock-morph">
    <div className="calendar-dock-actions" inert={pull ? '' : undefined} aria-hidden={Boolean(pull)}>{children}</div>
    <div className="calendar-dock-capital" aria-hidden={!pull}><ArrowDown aria-hidden="true" /><span>{copy[pull?.ready ? 1 : 0]}</span><ChartNoAxesCombined aria-hidden="true" /></div>
  </div></div>, document.body);
}
