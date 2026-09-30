import React from 'react';
import { createPortal } from 'react-dom';
import './WorkspaceViewport.css';

// Keep fixed navigation outside animated/scrolling app containers.
export default function WorkspaceDock({ children, proView = false, isLight = false }) {
  return createPortal(<div className={`${proView ? 'pro-active-shell' : ''} ${isLight ? 'theme-light' : ''}`}>
    <div className="history-fab fixed inset-x-0 flex justify-center items-center z-30 pointer-events-none px-4">{children}</div>
  </div>, document.body);
}
