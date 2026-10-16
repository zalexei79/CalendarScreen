import React, { useEffect, useMemo, useRef } from 'react';
import { sandboxDocument } from './extensionSandbox.js';
import { extensionLink } from './extensionModel.js';

export default function ExtensionScreen({ feature, onClose, onEvent }) {
  const frame = useRef(null), close = useRef(null);
  const channel = useMemo(() => crypto.randomUUID(), [feature]);
  const document = useMemo(() => sandboxDocument(feature, channel), [feature, channel]);
  useEffect(() => {
    const previous = window.document.activeElement; close.current?.focus();
    const receive = event => {
      if (event.source !== frame.current?.contentWindow || event.origin !== location.origin || event.data?.type !== 'dayris:extension' || event.data.channel !== channel) return;
      const { action, value } = event.data;
      if (action === 'close') onClose();
      else if (typeof value === 'string' && value.length <= 2048 && ['notify', 'error', 'navigate'].includes(action)) {
        if (action === 'navigate' && !extensionLink(value)) onEvent('error', 'Заблокирован небезопасный переход.');
        else onEvent(action, value);
      }
    };
    window.addEventListener('message', receive);
    return () => { window.removeEventListener('message', receive); previous?.focus?.(); };
  }, [channel, onClose, onEvent]);
  return <div className="extension-overlay"><section role="dialog" aria-modal="true" aria-label={feature.label} className="extension-dialog" onKeyDown={event => {
    if (event.key === 'Escape') onClose();
    if (event.key === 'Tab' && event.shiftKey && event.target === close.current) { event.preventDefault(); frame.current?.focus(); }
  }}><header><strong>{feature.label}</strong><button ref={close} type="button" onClick={onClose} aria-label="Закрыть мини-экран">Закрыть ×</button></header><iframe ref={frame} title={`Функция: ${feature.label}`} sandbox="allow-scripts allow-same-origin" referrerPolicy="no-referrer" allow="camera 'none'; microphone 'none'; geolocation 'none'; clipboard-read 'none'; clipboard-write 'none'" srcDoc={document}/><button className="extension-focus-end" onFocus={() => close.current?.focus()} aria-label="Вернуться к закрытию"/></section></div>;
}
