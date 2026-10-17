import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../supabaseClient';
import { configCSS, configElements, EMPTY_CONFIG, normalizeConfig } from './siteConfig.js';
import './SiteConfigRuntime.css';
import { setRuntimeVoiceCommands } from '../../shared/lib/customVoiceCommands.js';
import localDesign from '../appearance/siteDesign.json';
import localCSS from '../appearance/calendar-custom.css?raw';
import { mergeDesign, validLocalCSS } from '../appearance/designModel.js';

export default function SiteConfigRuntime() {
  const [buttons, setButtons] = useState([]);
  const [headerSlot, setHeaderSlot] = useState(null);
  const [menu, setMenu] = useState(null);
  const execute = useRef(null);
  useEffect(() => { if (menu) document.querySelector('[data-design-menu] button')?.focus({ preventScroll: true }); }, [menu]);
  useEffect(() => {
    let active = true, config = normalizeConfig(localDesign), selected = 'global';
    const preview = new URLSearchParams(location.search).get('adminPreview') === '1' && window.parent !== window;
    const localStudio = import.meta.env.DEV && preview && new URLSearchParams(location.search).get('localStudio') === '1';
    let inspect = preview, passThrough = false, viewOnly = false;
    execute.current = node => {
      setMenu(null);
      if (!node?.isConnected || typeof node.click !== 'function' || node.disabled) return;
      passThrough = true;
      try { node.focus?.({ preventScroll: true }); node.click(); } finally { passThrough = false; }
    };
    const style = document.createElement('style');
    style.dataset.dayrisSiteConfig = '';
    document.head.append(style);
    const themeStyle = document.createElement('style'); themeStyle.dataset.dayrisCustomTheme=''; themeStyle.textContent=localCSS;document.head.append(themeStyle);
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
      if (loading || preview || localDesign.overrideCloud === true) return;
      loading = true;
      try {
        const { data, error } = await supabase.from('site_live_config').select('config').eq('id', 1).maybeSingle();
        if (active && !error && data) apply(mergeDesign(localDesign,data.config));
      } catch { /* Fall back to the original design. */ }
      finally { loading = false; }
    };
    const message = event => {
      if (!preview || event.origin !== location.origin || event.data?.type !== 'dayris:preview') return;
      // A detached result is rendered by its same-origin studio opener through a React portal.
      let fromStudio=false;
      if(localStudio && event.data.previewOnly===true){try{fromStudio=event.source===window.parent.opener;}catch{/* Cross-origin parents have no authority. */}}
      if(event.source!==window.parent && !fromStudio)return;
      inspect = event.data.inspect !== false;
      viewOnly = event.data.previewOnly === true;
      if (!inspect) setMenu(null);
      selected = event.data.selected || 'global';
      apply(event.data.config);
      if(localStudio && typeof event.data.localCSS === 'string') { try{themeStyle.textContent=validLocalCSS(event.data.localCSS);}catch{/* Keep the previous theme. */} }
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
        if(viewOnly)return;
        selected = element?.id || 'global'; highlight();
        const node = event.target instanceof Element ? event.target.closest('button,a,[role="button"],[role="switch"]') : null;
        let target = node || (event.target instanceof Element ? event.target : null), meta;
        if(localStudio && target){
          const sources=[];let fiber=target[Object.keys(target).find(key=>key.startsWith('__reactFiber$'))];
          for(let depth=0;fiber&&depth<30;depth++,fiber=fiber.return)if(fiber._debugSource?.fileName && sources.length<12)sources.push({file:String(fiber._debugSource.fileName).slice(0,1000),line:fiber._debugSource.lineNumber});
          const path=[];for(let current=target;current && current!==document.body && path.length<6;current=current.parentElement){const tag=current.tagName.toLowerCase();if(current.id){path.unshift('#'+CSS.escape(current.id));break;}const siblings=[...current.parentElement?.children||[]].filter(item=>item.tagName===current.tagName);path.unshift(tag+(siblings.length>1?`:nth-of-type(${siblings.indexOf(current)+1})`:''));}
          meta={label:(target.getAttribute('aria-label') || target.textContent || target.tagName).trim().slice(0,100),selector:path.join(' > ').slice(0,600),sources,registered:Boolean(element)};
        }
        window.parent.postMessage({ type: 'dayris:select', id: selected,...(meta?{meta}:{}) }, location.origin);
        setMenu({ id: selected, meta, label: element?.label || 'Этот участок', node, left: Math.max(8, Math.min(innerWidth - 232, event.clientX - 30)), top: Math.max(8, Math.min(innerHeight - 248, event.clientY + 16)) });
        return;
      }
      if (!element || element.custom) return;
      const device = matchMedia('(max-width:767px)').matches ? 'mobile' : 'desktop';
      const href = config[device].elements[element.id]?.href;
      if (href) { event.preventDefault(); event.stopImmediatePropagation(); location.assign(href); }
    };
    // Stop calendar gestures and React handlers before a click arrives; keep native scrolling.
    const guard = event => {
      if(localStudio && event.type==='keydown' && (event.ctrlKey||event.metaKey) && event.key.toLowerCase()==='s'){event.preventDefault();event.stopImmediatePropagation();window.parent.postMessage({type:'dayris:save-request'},location.origin);return;}
      if (preview && event.type === 'keydown' && (event.ctrlKey || event.metaKey) && ['z','y'].includes(event.key.toLowerCase()) && !(event.target instanceof Element && event.target.closest('input,textarea,select,[contenteditable=true]'))) {
        event.preventDefault();event.stopImmediatePropagation();window.parent.postMessage({type:'dayris:history',redo:event.shiftKey || event.key.toLowerCase() === 'y'},location.origin);return;
      }
      if (!inspect || passThrough || (event.target instanceof Element && event.target.closest('[data-design-menu]')) || (event.type === 'keydown' && event.key === 'Tab')) return;
      if (event.type === 'keydown' && event.key === 'Escape') setMenu(null);
      event.stopImmediatePropagation();
      if (['keydown', 'submit', 'contextmenu', 'dragstart'].includes(event.type)) event.preventDefault();
    };
    const guarded = ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'touchstart', 'touchend', 'keydown', 'submit', 'contextmenu', 'dblclick', 'dragstart'];
    const focus = () => { if (!document.hidden) refresh(); };
    const wheel = event=>{if(!preview || event.shiftKey || (!event.ctrlKey && !event.metaKey))return;event.preventDefault();event.stopImmediatePropagation();window.parent.postMessage({type:'dayris:zoom',delta:event.deltaY,x:event.clientX,y:event.clientY},location.origin);};
    const report=(level,value)=>{if(localStudio)window.parent.postMessage({type:'dayris:console',level,message:String(value).slice(0,2000)},location.origin);};
    const onError=event=>report('error',`${event.message || 'Ошибка ресурса'} ${event.filename || ''}:${event.lineno || ''}`);
    const onRejection=event=>report('error',event.reason?.message || String(event.reason));
    const originals={error:console.error,warn:console.warn};
    if(localStudio)for(const level of ['error','warn'])console[level]=(...args)=>{originals[level](...args);report(level,args.map(item=>typeof item === 'string' ? item : item instanceof Error ? item.message : '[объект — подробности в DevTools]').join(' '));};
    window.addEventListener('wheel',wheel,{capture:true,passive:false});
    window.addEventListener('error',onError);window.addEventListener('unhandledrejection',onRejection);
    window.addEventListener('message', message);
    window.addEventListener('click', click, true);
    guarded.forEach(type => window.addEventListener(type, guard, true));
    document.addEventListener('visibilitychange', focus);
    const interval = preview ? null : window.setInterval(focus, 60000);
    apply(localDesign); highlight(); refresh();
    if (preview) window.parent.postMessage({ type: 'dayris:preview-ready' }, location.origin);
    return () => {
      active = false; observer.disconnect(); style.remove(); themeStyle.remove(); clearInterval(interval);
      window.removeEventListener('wheel',wheel,true);window.removeEventListener('error',onError);window.removeEventListener('unhandledrejection',onRejection);
      if(localStudio)for(const level of ['error','warn'])console[level]=originals[level];
      setRuntimeVoiceCommands([]); execute.current = null;
      document.documentElement.removeAttribute('data-design-inspect');
      document.querySelectorAll('[data-design-selected]').forEach(node => node.removeAttribute('data-design-selected'));
      window.removeEventListener('message', message);
      window.removeEventListener('click', click, true);
      guarded.forEach(type => window.removeEventListener(type, guard, true));
      document.removeEventListener('visibilitychange', focus);
    };
  }, [localDesign,localCSS]);
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
      <button role="menuitem" onClick={() => { window.parent.postMessage({ type: 'dayris:select', id: menu.id, view: 'design', meta: menu.meta }, location.origin); setMenu(null); }}>✎ Редактировать вид</button>
      <button role="menuitem" onClick={() => { window.parent.postMessage({ type: 'dayris:select', id: menu.id, view: 'logic', meta: menu.meta }, location.origin); setMenu(null); }}>◇ Логика и команды</button>
      <button role="menuitem" disabled={!menu.node || menu.node.disabled} onClick={() => execute.current?.(menu.node)}>↗ Выполнить действие</button>
      <small>Настоящий аккаунт: действие может менять данные.</small>
      <button role="menuitem" onClick={() => { setMenu(null); menu.node?.focus?.(); }}>Закрыть меню</button>
    </div>, document.body)}
  </>;
}
