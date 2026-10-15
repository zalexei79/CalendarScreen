import { useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { configCSS, ELEMENTS, EMPTY_CONFIG, normalizeConfig } from './siteConfig.js';

export default function SiteConfigRuntime() {
  useEffect(() => {
    let active = true;
    let config = EMPTY_CONFIG;
    const preview = new URLSearchParams(location.search).get('adminPreview') === '1' && window.parent !== window;
    let inspect = preview;
    const style = document.createElement('style');
    style.dataset.dayrisSiteConfig = '';
    document.head.append(style);
    const apply = value => { config = normalizeConfig(value); style.textContent = configCSS(config); };
    let loading = false;
    const refresh = async () => {
      if (loading || preview) return;
      loading = true;
      try {
        const { data, error } = await supabase.from('site_live_config').select('config').eq('id', 1).maybeSingle();
        if (active && !error && data) apply(data.config);
      } catch { /* Use the original design when configuration is unavailable. */ }
      finally { loading = false; }
    };
    const message = event => {
      if (!preview || event.origin !== location.origin || event.source !== window.parent || event.data?.type !== 'dayris:preview') return;
      apply(event.data.config);
      inspect = event.data.inspect !== false;
    };
    const click = event => {
      const element = [...ELEMENTS].reverse().find(item => event.target instanceof Element && event.target.closest(item.selector));
      if (!element) return;
      if (inspect) {
        event.preventDefault(); event.stopImmediatePropagation();
        window.parent.postMessage({ type: 'dayris:select', id: element.id }, location.origin);
        return;
      }
      const device = matchMedia('(max-width:767px)').matches ? 'mobile' : 'desktop';
      const href = config[device].elements[element.id]?.href;
      if (href) { event.preventDefault(); event.stopImmediatePropagation(); location.assign(href); }
    };
    const focus = () => { if (!document.hidden) refresh(); };
    window.addEventListener('message', message);
    document.addEventListener('click', click, true);
    document.addEventListener('visibilitychange', focus);
    const interval = preview ? null : window.setInterval(focus, 60000);
    refresh();
    if (preview) window.parent.postMessage({ type: 'dayris:preview-ready' }, location.origin);
    return () => {
      active = false; style.remove(); clearInterval(interval);
      window.removeEventListener('message', message);
      document.removeEventListener('click', click, true);
      document.removeEventListener('visibilitychange', focus);
    };
  }, []);
  return null;
}
