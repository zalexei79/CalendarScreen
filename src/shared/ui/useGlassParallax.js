import { useEffect } from 'react';
import { getGlassTiltState, subscribeGlassTilt, reportGlassTilt, glassTiltVector, glassDepthProfile } from './glassTilt.js';
import './GlassParallax.css';

// Separated atmosphere, reflected light and calendar plane. Never transform
// the app root or fixed controls; no gesture capture or React updates per sample.
export default function useGlassParallax(theme) {
  useEffect(() => {
    if (!['gold','emerald'].includes(theme)) return undefined;
    const root = document.documentElement;
    const body = document.body, depth = glassDepthProfile(theme);
    const sceneProperties = ['--glass-scene-x','--glass-scene-y','--glass-scene-axis-x','--glass-scene-axis-y','--glass-scene-angle','--glass-global-sheen-x','--glass-global-sheen-y','--gold-pointer-x','--gold-pointer-y','--glass-x','--glass-y'];
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const opaque = matchMedia('(prefers-reduced-transparency: reduce)');
    const layer = document.createElement('div');
    layer.className = 'dayris-glass-parallax';
    layer.setAttribute('aria-hidden','true'); layer.inert = true;
    document.body.prepend(layer);
    let frame = 0, target = { x:0,y:0 }, previous = '', neutral = null;
    let listening = false, hasSignal = false, signalTimer = 0;
    let hovered = null, hoverRect = null, hoverPoint = null;
    const screenAngle = () => window.screen.orientation?.angle ?? (Number.isFinite(window.orientation) ? window.orientation : 0);
    // Window blur is not page visibility: iOS permission sheets can blur a
    // still-visible page and never send focus back. Do not latch sensors off.
    const allowed = () => !reduced.matches && !opaque.matches && !document.hidden;
    function paint() {
      frame = 0;
      if (!allowed()) return;
      const value = `${target.x.toFixed(1)}px ${target.y.toFixed(1)}px`;
      if (value !== previous) {
        previous = value;
        layer.style.setProperty('--glass-depth-x',`${target.x.toFixed(1)}px`);
        layer.style.setProperty('--glass-depth-y',`${target.y.toFixed(1)}px`);
        const x=target.x/depth.x, y=target.y/depth.y;
        const properties = {
          '--glass-scene-x':`${(-x*depth.plane).toFixed(2)}px`,
          '--glass-scene-y':`${(-y*depth.plane*.7).toFixed(2)}px`,
          '--glass-scene-axis-x':Math.abs(y)<.001?'0':y.toFixed(3),
          '--glass-scene-axis-y':Math.abs(x)+Math.abs(y)<.001?'1':(-x).toFixed(3),
          '--glass-scene-angle':`${Math.min(3.2,Math.hypot(x,y)*depth.rotation).toFixed(2)}deg`,
          '--glass-global-sheen-x':`${(-x*4).toFixed(2)}px`,
          '--glass-global-sheen-y':`${(-y*3).toFixed(2)}px`,
          '--gold-pointer-x':`${50-x*35}%`,'--gold-pointer-y':`${35-y*30}%`,
          '--glass-x':`${50-x*35}%`,'--glass-y':`${35-y*30}%`,
        };
        // Body variables do not trigger the root-style calendar fit observer.
        for (const [name,setting] of Object.entries(properties)) body.style.setProperty(name,setting);
      }
      if (hovered?.isConnected && hoverRect && hoverPoint) {
        const limit = n => Math.max(-1,Math.min(1,n));
        const x = limit((hoverPoint.x-hoverRect.left)/Math.max(1,hoverRect.width)*2-1);
        const y = limit((hoverPoint.y-hoverRect.top)/Math.max(1,hoverRect.height)*2-1);
        hovered.style.setProperty('--glass-shadow-x',`${(-x*9).toFixed(1)}px`);
        hovered.style.setProperty('--glass-sheen-x',`${(x*5).toFixed(1)}px`);
        hovered.style.setProperty('--glass-sheen-y',`${(y*4).toFixed(1)}px`);
        hovered.setAttribute('data-glass-hover','');
      }
    }
    function moveTo(x,y) {
      if (!allowed()) return;
      target = { x:Math.max(-depth.x,Math.min(depth.x,x)),y:Math.max(-depth.y,Math.min(depth.y,y)) };
      if (!frame) frame = requestAnimationFrame(paint);
    }
    function recenter() {
      neutral = null; hasSignal = false; target = { x:0,y:0 }; previous = '';
      cancelAnimationFrame(frame); frame = 0;
      layer.style.removeProperty('--glass-depth-x'); layer.style.removeProperty('--glass-depth-y');
      for (const name of sceneProperties) body.style.removeProperty(name);
      clearHover();
    }
    function clearHover() {
      if (hovered) {
        for (const name of ['--glass-shadow-x','--glass-sheen-x','--glass-sheen-y']) hovered.style.removeProperty(name);
        hovered.removeAttribute('data-glass-hover');
      }
      hovered = hoverRect = hoverPoint = null;
    }
    function orientation(event) {
      if (!allowed() || !Number.isFinite(event.beta) || !Number.isFinite(event.gamma)) return;
      if (!neutral) neutral = { beta:event.beta,gamma:event.gamma };
      const position = glassTiltVector(event,neutral,screenAngle(),theme);
      if (!position) return;
      hasSignal = true;
      clearTimeout(signalTimer); reportGlassTilt('active'); moveTo(position.x,position.y);
    }
    function sync() {
      const visible = allowed();
      root.toggleAttribute('data-glass-parallax',visible);
      const wantsSensor = visible && getGlassTiltState().enabled;
      if (wantsSensor === listening) { if (!visible) recenter(); return; }
      listening = wantsSensor;
      clearTimeout(signalTimer); recenter();
      if (listening) {
        window.addEventListener('deviceorientation',orientation,{ passive:true });
        signalTimer = window.setTimeout(() => reportGlassTilt('noData'),5000);
      } else window.removeEventListener('deviceorientation',orientation);
    }
    function pointer(event) {
      if (event.pointerType !== 'mouse' || !allowed() || (listening && hasSignal)) return;
      const cell = event.target instanceof Element ? event.target.closest('.calendar-day-surface:not(:disabled)') : null;
      if (cell !== hovered) { clearHover(); hovered = cell; hoverRect = cell?.getBoundingClientRect() || null; }
      hoverPoint = { x:event.clientX,y:event.clientY };
      moveTo(-(event.clientX / Math.max(innerWidth,1) - .5) * depth.x*2,-(event.clientY / Math.max(innerHeight,1) - .5) * depth.y*2);
    }
    function blur() { recenter(); }
    function focus() { sync(); }
    function leave() { if (!listening) recenter(); }
    const unsubscribe = subscribeGlassTilt(sync);
    sync();
    document.addEventListener('pointermove',pointer,{ passive:true });
    root.addEventListener('pointerleave',leave);
    document.addEventListener('visibilitychange',sync);
    document.addEventListener('scroll',clearHover,{passive:true,capture:true});
    window.addEventListener('resize',clearHover);
    window.addEventListener('blur',blur); window.addEventListener('focus',focus);
    window.addEventListener('orientationchange',recenter);
    window.screen.orientation?.addEventListener('change',recenter);
    reduced.addEventListener('change',sync); opaque.addEventListener('change',sync);
    return () => {
      unsubscribe(); cancelAnimationFrame(frame); clearTimeout(signalTimer);
      clearHover();
      for (const name of sceneProperties) body.style.removeProperty(name);
      window.removeEventListener('deviceorientation',orientation);
      document.removeEventListener('pointermove',pointer); root.removeEventListener('pointerleave',leave);
      document.removeEventListener('visibilitychange',sync);
      document.removeEventListener('scroll',clearHover,true); window.removeEventListener('resize',clearHover);
      window.removeEventListener('blur',blur); window.removeEventListener('focus',focus);
      window.removeEventListener('orientationchange',recenter);
      window.screen.orientation?.removeEventListener('change',recenter);
      reduced.removeEventListener('change',sync); opaque.removeEventListener('change',sync);
      root.removeAttribute('data-glass-parallax'); layer.remove();
    };
  },[theme]);
}
