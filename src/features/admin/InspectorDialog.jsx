import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
export default function InspectorDialog({ title,onClose,children,actions }) {
  const dialog = useRef(null), latestClose = useRef(onClose); latestClose.current = onClose;
  useEffect(() => {
    const previous = document.activeElement, node = dialog.current;
    node.showModal();
    const cancel = event => { event.preventDefault(); latestClose.current(); };
    node.addEventListener('cancel',cancel);
    return () => { node.removeEventListener('cancel',cancel); node.close(); previous?.focus?.(); };
  },[]);
  return createPortal(<dialog ref={dialog} className="dayris-admin admin-inspector-dialog" aria-label={title}><header className="admin-inspector-title"><h2>{title}</h2><div className="admin-inspector-actions">{actions}<button onClick={onClose} aria-label="Закрыть редактор элемента">Закрыть ×</button></div></header>{children}</dialog>,document.body);
}
