import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import manifest from './extensions.json';
import { validateExtensions, extensionLink, EXTENSION_ACTIONS } from './extensionModel.js';
import ExtensionScreen from './ExtensionScreen.jsx';
import './Extensions.css';

function initial() { try { return validateExtensions(manifest); } catch { return { schema: 1, features: [] }; } }
export default function ExtensionRuntime() {
  const [config, setConfig] = useState(initial), [selected, setSelected] = useState(''), [mode, setMode] = useState('test');
  const [screen, setScreen] = useState(null), [notice, setNotice] = useState('');
  const [mobile, setMobile] = useState(() => matchMedia('(max-width:767px)').matches);
  const [header, setHeader] = useState(null);
  const lastDraft = useRef('');
  const studio = import.meta.env.DEV && new URLSearchParams(location.search).get('extensionStudio') === '1' && window.parent !== window;
  useEffect(() => { if (!studio) setConfig(initial()); }, [manifest, studio]);
  const post = useCallback(data => { if (studio) window.parent.postMessage({ type: 'dayris:extension-studio', ...data }, location.origin); }, [studio]);
  useEffect(() => {
    const media = matchMedia('(max-width:767px)'), update = () => setMobile(media.matches);
    media.addEventListener('change', update);
    const observer = new MutationObserver(() => setHeader(document.querySelector('[data-site-buttons="header"]')));
    observer.observe(document.body, { childList: true, subtree: true }); setHeader(document.querySelector('[data-site-buttons="header"]'));
    return () => { observer.disconnect(); media.removeEventListener('change', update); };
  }, []);
  useEffect(() => {
    if (!studio) return;
    const receive = event => {
      if (event.origin !== location.origin || event.source !== window.parent || event.data?.type !== 'dayris:extension-draft') return;
      try {
        const value = validateExtensions(event.data.config), encoded = JSON.stringify(value);
        if (lastDraft.current !== encoded) { setConfig(value); setScreen(null); lastDraft.current = encoded; }
        setSelected(event.data.selected || '');
        const nextMode = ['edit', 'test', 'place'].includes(event.data.mode) ? event.data.mode : 'edit';
        setMode(nextMode); if (nextMode !== 'test') setScreen(null);
      }
      catch (error) { post({ action: 'error', value: error.message }); }
    };
    window.addEventListener('message', receive); post({ action: 'ready' });
    return () => window.removeEventListener('message', receive);
  }, [studio, post]);
  const event = useCallback((action, value) => {
    post({ action, value });
    if (action === 'navigate') {
      const href = extensionLink(value); if (!href) return;
      if (studio) { setNotice(`Тест перехода: ${href}`); return; }
      if (href.startsWith('/') || window.confirm(`Перейти на внешний сайт?\n${href}`)) location.assign(href);
    } else setNotice(value);
  }, [studio, post]);
  const close = useCallback(() => setScreen(null), []);
  const run = feature => {
    if (studio) { post({ action: 'select', id: feature.id }); if (mode !== 'test') return; }
    setNotice('');
    for (const step of feature.steps) {
      if (step.type === 'screen') setScreen(feature);
      else if (step.type === 'builtin') {
        const action = EXTENSION_ACTIONS.find(item => item.id === step.action);
        const target = action && [...document.querySelectorAll(action.selector)].find(node => node.getClientRects().length && !node.disabled && node.getAttribute('aria-disabled') !== 'true');
        if (target) { target.click(); post({ action:'notify', value:`DAYRIS: ${action.label}` }); }
        else event('error', 'Это действие сейчас недоступно в календаре.');
      }
      else event(step.type === 'message' ? 'notify' : 'navigate', step.value);
    }
  };
  const button = feature => {
    const style = feature[mobile ? 'mobile' : 'desktop'];
    if (!style.visible || (!feature.enabled && !studio)) return null;
    return <button type="button" data-extension-id={feature.id} data-selected={studio && selected === feature.id ? '' : undefined} key={feature.id} className={`extension-launch extension-${feature.placement}`} style={{ width: style.width, height: style.height, borderRadius: style.radius, background: style.background, color: style.color, ...(feature.placement === 'fixed' ? { left: `clamp(min(${style.width / 2 + 8}px, 50vw), ${style.x}%, calc(100% - min(${style.width / 2 + 8}px, 50vw)))`, top: `clamp(${style.height / 2 + 8}px, ${style.y}%, calc(100% - ${style.height / 2 + 8}px))` } : {}) }} onClick={() => run(feature)}>{feature.label || 'Моя функция'}{studio && !feature.enabled ? ' · выкл.' : ''}</button>;
  };
  return <>{header && createPortal(config.features.filter(item => item.placement === 'header').map(button), header)}
    {createPortal(<>{config.features.filter(item => item.placement !== 'header').map(button)}
      {studio && mode === 'place' && <button className="extension-position-picker" aria-label="Выбрать расположение новой кнопки" onClick={e => post({ action: 'position', x: e.clientX / innerWidth * 100, y: e.clientY / innerHeight * 100 })}>Нажмите в нужном месте календаря</button>}
      {notice && <div role="status" className="extension-notice"><span>{notice}</span><button onClick={() => setNotice('')} aria-label="Скрыть сообщение">×</button></div>}
      {screen && <ExtensionScreen feature={screen} onClose={close} onEvent={event}/>}</>, document.body)}
  </>;
}
