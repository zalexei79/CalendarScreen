import React from 'react';
import { createPortal } from 'react-dom';
import './WorkspaceViewport.css';

// Keep fixed navigation outside animated/scrolling app containers.
export default function WorkspaceDock({ children, proView = false, isLight = false, hidden = false }) {
  if (hidden) return null;
  // A standalone calendar control: never inherit shell filters/animations,
  // which create a containing block and move fixed controls on mobile Safari.
  return createPortal(<div data-pro={proView} data-light={isLight} className="history-fab calendar-action-dock fixed inset-x-0 flex justify-center items-center z-30 pointer-events-none px-4">{children}</div>, document.body);
}
