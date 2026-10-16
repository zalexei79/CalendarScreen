import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../supabaseClient';
import { configCSS, configElements, EMPTY_CONFIG, normalizeConfig } from './siteConfig.js';
import './SiteConfigRuntime.css';
import { setRuntimeVoiceCommands } from '../../shared/lib/customVoiceCommands.js';

export default function SiteConfigRuntime() {
  const [buttons, setButtons] = useState([]);
  const [headerSlot, setHeaderSlot] = useState(null);
  const [menu, setMenu] = useState(null);
  const execute = useRef(null);
  useEffect(() => { if (menu) document.querySelector('[data-design-menu] button')?.focus({ preventScroll: true }); }, [menu]);
  useEffect(() => {
    let active = true, config = EMPTY_CONFIG, selected = 'global';
    const preview = new URLSearchParams(location.search).get('adminPreview') === '1' && window.parent !== window;
    let inspect = preview, passThrough = false;
    execute.current = node => {
      setMenu(null);
      if (!node?.isConnected || typeof node.click !== 'function' || node.disabled) return;
      passThrough = true;
      try { node.focus?.({ preventScroll: true }); node.click(); } finally { passThrough = false; }
    };
    const style = document.createElement('style');
    style.dataset.dayrisSiteConfig = '';
    document.head.append(style);
    const highlight = () => {
      document.documentElement.toggleAttribute('data-design-inspect', inspect);
      document.querySelectorAll('[data-design-selected]').forEach(node => node.removeAttribute('data-design-selected'));
      const element = configElements(config).find(item => item.id === selected);
      if (inspect && element) document.querySelectorAll(element.selector).forEach(node => node.setAttribute('data-design-selected', ''));
    };
    const observer = new MutationObserver(() => {
      setHeaderSlot(document.querySelector('[data-site-buttons="header"]'));
      highlight();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setHeaderSlot(document.querySelector('[data-site-buttons="header"]'));
    const apply = value => {
      config = normalizeConfig(value); style.textContent = configCSS(config);
      setRuntimeVoiceCommands(config.voiceCommands);
      setButtons(config.buttons || []); highlight();
    };
    let loading = false;
    const refresh = async () => {
      if (loading || preview) return;
      loading = true;
      try {
        const { data, error } = await supabase.from('site_live_config').select('config').eq('id', 1).maybeSingle();
        if (active && !error && data) apply(data.config);
      } catch { /* Fall back to the original design. */ }
      finally { loading = false; }
    };
    const message = event => {
      if (!preview || event.origin !== location.origin || event.source !== window.parent || event.data?.type !== 'dayris:preview') return;
      inspect = event.data.inspect !== false;
      if (!inspect) setMenu(null);
      selected = event.data.selected || 'global';
      apply(event.data.config);
    };
    const click = event => {
      if (event.target instanceof Element && event.target.closest('[data-design-menu]')) return;
      const registry = configElements(config);
      let element;
      for (let node = event.target instanceof Element ? event.target : null; node && !element; node = node.parentElement) {
        element = registry.find(item => node.matches(item.selector));
      }
      if (inspect && !passThrough) {
        event.preventDefault(); event.stopImmediatePropagation();
        selected = element?.id || 'global'; highlight();
        window.parent.postMessage({ type: 'dayris:select', id: selected }, location.origin);
        const node = event.target instanceof Element ? event.target.closest('button,a,[role="button"],[role="switch"]') : null;
        setMenu({ id: selected, label: element?.label || 'Этот участок', node, left: Math.max(8, Math.min(innerWidth - 232, event.clientX - 30)), top: Math.max(8, Math.min(innerHeight - 248, event.clientY + 16)) });
        return;
      }
      if (!element || element.custom) return;
      const device = matchMedia('(max-width:767px)').matches ? 'mobile' : 'desktop';
      const href = config[device].elements[element.id]?.href;
      if (href) { event.preventDefault(); event.stopImmediatePropagation(); location.assign(href); }
    };
    // Stop calendar gestures and React handlers before a click arrives; keep native scrolling.
    const guard = event => {
      if (!inspect || passThrough || (event.target instanceof Element && event.target.closest('[data-design-menu]')) || (event.type === 'keydown' && event.key === 'Tab')) return;
      if (event.type === 'keydown' && event.key === 'Escape') setMenu(null);
      event.stopImmediatePropagation();
      if (['keydown', 'submit', 'contextmenu', 'dragstart'].includes(event.type)) event.preventDefault();
    };
    const guarded = ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'touchstart', 'touchend', 'keydown', 'submit', 'contextmenu', 'dblclick', 'dragstart'];
    const focus = () => { if (!document.hidden) refresh(); };
    window.addEventListener('message', message);
    window.addEventListener('click', click, true);
    guarded.forEach(type => window.addEventListener(type, guard, true));
    document.addEventListener('visibilitychange', focus);
    const interval = preview ? null : window.setInterval(focus, 60000);
    highlight(); refresh();
    if (preview) window.parent.postMessage({ type: 'dayris:preview-ready' }, location.origin);
    return () => {
      active = false; observer.disconnect(); style.remove(); clearInterval(interval);
      setRuntimeVoiceCommands([]); execute.current = null;
      document.documentElement.removeAttribute('data-design-inspect');
      document.querySelectorAll('[data-design-selected]').forEach(node => node.removeAttribute('data-design-selected'));
      window.removeEventListener('message', message);
      window.removeEventListener('click', click, true);
      guarded.forEach(type => window.removeEventListener(type, guard, true));
      document.removeEventListener('visibilitychange', focus);
    };
  }, []);
  const links = placement => buttons.filter(item => item.placement === placement).map(item => <a key={item.id} data-site-button={item.id} className="dayris-custom-button" href={item.href || undefined} aria-disabled={!item.href} onClick={event => { if (!item.href) event.preventDefault(); }}>{item.label || 'Новая кнопка'}</a>);
  return <>
    {headerSlot && createPortal(links('header'), headerSlot)}
    {createPortal(<div className="dayris-custom-floating">{links('bottom')}</div>, document.body)}
    {menu && createPortal(<div data-design-menu="" role="menu" aria-label="Действия выбранного элемента" style={{ left: menu.left, top: menu.top }} onKeyDown={event => {
      event.stopPropagation();
      if (event.key === 'Escape') { setMenu(null); menu.node?.focus?.(); }
      if (['ArrowUp','ArrowDown','Home','End'].includes(event.key)) {
        event.preventDefault(); const buttons = [...event.currentTarget.querySelectorAll('button:not(:disabled)')], index = buttons.indexOf(document.activeElement);
        buttons[event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length]?.focus();
      }
    }}>
      <strong>{menu.label}</strong>
      <button role="menuitem" onClick={() => { window.parent.postMessage({ type: 'dayris:select', id: menu.id, view: 'design' }, location.origin); setMenu(null); }}>✎ Редактировать вид</button>
      <button role="menuitem" onClick={() => { window.parent.postMessage({ type: 'dayris:select', id: menu.id, view: 'logic' }, location.origin); setMenu(null); }}>◇ Логика и команды</button>
      <button role="menuitem" disabled={!menu.node || menu.node.disabled} onClick={() => execute.current?.(menu.node)}>↗ Выполнить действие</button>
      <small>Настоящий аккаунт: действие может менять данные.</small>
      <button role="menuitem" onClick={() => { setMenu(null); menu.node?.focus?.(); }}>Закрыть меню</button>
    </div>, document.body)}
  </>;
}
