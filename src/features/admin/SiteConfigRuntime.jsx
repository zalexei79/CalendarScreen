import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../supabaseClient';
import { configCSS, configElements, EMPTY_CONFIG, normalizeConfig } from './siteConfig.js';
import './SiteConfigRuntime.css';

export default function SiteConfigRuntime() {
  const [buttons, setButtons] = useState([]);
  const [headerSlot, setHeaderSlot] = useState(null);
  useEffect(() => {
    let active = true, config = EMPTY_CONFIG, selected = 'global';
    const preview = new URLSearchParams(location.search).get('adminPreview') === '1' && window.parent !== window;
    let inspect = preview;
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
      selected = event.data.selected || 'global';
      apply(event.data.config);
    };
    const click = event => {
      const registry = configElements(config);
      let element;
      for (let node = event.target instanceof Element ? event.target : null; node && !element; node = node.parentElement) {
        element = registry.find(item => node.matches(item.selector));
      }
      if (inspect) {
        event.preventDefault(); event.stopImmediatePropagation();
        selected = element?.id || 'global'; highlight();
        window.parent.postMessage({ type: 'dayris:select', id: selected }, location.origin);
        return;
      }
      if (!element || element.custom) return;
      const device = matchMedia('(max-width:767px)').matches ? 'mobile' : 'desktop';
      const href = config[device].elements[element.id]?.href;
      if (href) { event.preventDefault(); event.stopImmediatePropagation(); location.assign(href); }
    };
    // Stop calendar gestures and React handlers before a click arrives; keep native scrolling.
    const guard = event => {
      if (!inspect || (event.type === 'keydown' && event.key === 'Tab')) return;
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
  </>;
}
