import { useEffect } from 'react';
import { getGlassTiltState, subscribeGlassTilt, reportGlassTilt, glassTiltVector, glassDepthProfile } from './glassTilt.js';
import { getGlassPointerEnabled, subscribeGlassPointer } from './glassPointer.js';
import './GlassParallax.css';

// Separated atmosphere, reflected light and calendar plane. Never transform
// the app root or fixed controls; no gesture capture or React updates per sample.
export default function useGlassParallax(theme) {
  useEffect(() => {
    if (!['gold','emerald'].includes(theme)) return undefined;
    const root = document.documentElement;
    const pointerDepth = glassDepthProfile(theme), sensorDepth = glassDepthProfile(theme,'sensor');
    let depth = pointerDepth;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const opaque = matchMedia('(prefers-reduced-transparency: reduce)');
    const layer = document.createElement('div');
    layer.className = 'dayris-glass-parallax';
    layer.setAttribute('aria-hidden','true'); layer.inert = true;
    const caustic = document.createElement('div'), light = document.createElement('div');
    caustic.className = 'dayris-glass-caustic'; light.className = 'dayris-glass-light';
    layer.append(caustic,light);
    document.body.prepend(layer);
    let frame = 0, target = { x:0,y:0 }, previous = '', neutral = null;
    let listening = false, hasSignal = false, signalTimer = 0;
    let grid = null, hovered = null, optics = null, hoverRect = null, hoverPoint = null;
    // Standalone iOS can disagree with the modern natural-screen angle.
    const screenAngle = () => Number.isFinite(window.orientation) ? window.orientation : (window.screen.orientation?.angle ?? 0);
    // Window blur is not page visibility: iOS permission sheets can blur a
    // still-visible page and never send focus back. Do not latch sensors off.
    const allowed = () => !reduced.matches && !opaque.matches && !document.hidden;
    function paint() {
      frame = 0;
      if (!allowed()) return;
      const value = `${target.x.toFixed(1)}px ${target.y.toFixed(1)}px`;
      if (value !== previous || !grid?.isConnected) {
        previous = value;
        // Only non-inherited compositor properties change. Inherited variables
        // on BODY used to restyle every day, panel and control on every sample.
        layer.style.translate = value;
        const sensor = depth === sensorDepth;
        // Child offsets include their parent's travel: sensor reflections
        // must actually counter-move, rather than following it at half speed.
        const causticTravel = sensor ? 1.65 : .8, lightTravel = sensor ? 2.1 : .5;
        caustic.style.translate = `${(-target.x*causticTravel).toFixed(1)}px ${(-target.y*causticTravel).toFixed(1)}px`;
        light.style.translate = `${(-target.x*lightTravel).toFixed(1)}px ${(-target.y*lightTravel).toFixed(1)}px`;
        const x=target.x/depth.x, y=target.y/depth.y;
        if (!grid?.isConnected) grid = document.querySelector('.calendar-section:not(.calendar-month-preview) .calendar-days-grid');
        if (grid) {
          grid.style.translate = `${(-x*depth.plane).toFixed(2)}px ${(-y*depth.plane*.7).toFixed(2)}px`;
          grid.style.rotate = `${Math.abs(y)<.001?'0':y.toFixed(3)} ${Math.abs(x)+Math.abs(y)<.001?'1':(-x).toFixed(3)} 0 ${Math.min(sensor?depth.rotation:3.2,Math.hypot(x,y)*depth.rotation).toFixed(2)}deg`;
        }
      }
      if (hovered?.isConnected && hoverRect && hoverPoint) {
        const limit = n => Math.max(-1,Math.min(1,n));
        const x = limit((hoverPoint.x-hoverRect.left)/Math.max(1,hoverRect.width)*2-1);
        const y = limit((hoverPoint.y-hoverRect.top)/Math.max(1,hoverRect.height)*2-1);
        if (optics) optics.style.translate = `${(x*5).toFixed(1)}px ${(y*4).toFixed(1)}px`;
      }
    }
    function moveTo(x,y) {
      if (!allowed()) return;
      target = { x:Math.max(-depth.x,Math.min(depth.x,x)),y:Math.max(-depth.y,Math.min(depth.y,y)) };
      if (!frame) frame = requestAnimationFrame(paint);
    }
    function recenter() {
      neutral = null; hasSignal = false; target = { x:0,y:0 }; previous = '';
      depth = pointerDepth; root.removeAttribute('data-glass-sensor');
      cancelAnimationFrame(frame); frame = 0;
      layer.style.removeProperty('translate'); caustic.style.removeProperty('translate'); light.style.removeProperty('translate');
      resetGrid();
      clearHover();
    }
    function resetGrid() {
      if (grid) { grid.style.removeProperty('rotate'); grid.style.removeProperty('translate'); }
    }
    function clearHover() {
      if (hovered) {
        optics?.style.removeProperty('translate');
        hovered.removeAttribute('data-glass-hover');
      }
      hovered = optics = hoverRect = hoverPoint = null;
    }
    function orientation(event) {
      if (!allowed() || !Number.isFinite(event.beta) || !Number.isFinite(event.gamma)) return;
      if (!neutral) neutral = { alpha:event.alpha,beta:event.beta,gamma:event.gamma };
      const position = glassTiltVector(event,neutral,screenAngle(),theme);
      if (!position) return;
      if (depth !== sensorDepth) {
        depth = sensorDepth; previous = ''; root.setAttribute('data-glass-sensor','');
      }
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
      if (event.pointerType !== 'mouse' || !getGlassPointerEnabled() || !allowed() || (listening && hasSignal)) return;
      const cell = event.target instanceof Element ? event.target.closest('.calendar-day-surface:not(:disabled)') : null;
      if (cell !== hovered) {
        clearHover(); hovered = cell; hoverRect = cell?.getBoundingClientRect() || null;
        optics = cell?.querySelector('.calendar-glass-optics') || null;
        hovered?.setAttribute('data-glass-hover','');
      }
      hoverPoint = { x:event.clientX,y:event.clientY };
      moveTo(-(event.clientX / Math.max(innerWidth,1) - .5) * depth.x*2,-(event.clientY / Math.max(innerHeight,1) - .5) * depth.y*2);
    }
    function blur() { recenter(); }
    function focus() { sync(); }
    function leave() { if (!listening) recenter(); }
    function pointerPreference() {
      if (!getGlassPointerEnabled()) {
        if (listening && hasSignal) clearHover();
        else recenter();
      }
    }
    const unsubscribe = subscribeGlassTilt(sync);
    const unsubscribePointer = subscribeGlassPointer(pointerPreference);
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
      unsubscribe(); unsubscribePointer(); cancelAnimationFrame(frame); clearTimeout(signalTimer);
      clearHover();
      resetGrid();
      window.removeEventListener('deviceorientation',orientation);
      document.removeEventListener('pointermove',pointer); root.removeEventListener('pointerleave',leave);
      document.removeEventListener('visibilitychange',sync);
      document.removeEventListener('scroll',clearHover,true); window.removeEventListener('resize',clearHover);
      window.removeEventListener('blur',blur); window.removeEventListener('focus',focus);
      window.removeEventListener('orientationchange',recenter);
      window.screen.orientation?.removeEventListener('change',recenter);
      reduced.removeEventListener('change',sync); opaque.removeEventListener('change',sync);
      root.removeAttribute('data-glass-parallax'); root.removeAttribute('data-glass-sensor'); layer.remove();
    };
  },[theme]);
}
