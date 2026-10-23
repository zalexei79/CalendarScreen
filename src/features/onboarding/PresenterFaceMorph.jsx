import React, { useEffect, useRef, useState } from 'react';
import { createPresenterMesh, PRESENTER_EMOTIONS, PRESENTER_MORPH_MS, smoothMorph } from './presenterMorphMesh.js';
import { createPresenterRenderer } from './presenterFaceRenderer.js';

const mesh = createPresenterMesh();

export default function PresenterFaceMorph({ emotion, sheet, angry, active }) {
  const canvasRef = useRef(null);
  const rendererRef = useRef(null);
  const weights = useRef([1, 0, 0]);
  const updateRef = useRef(null);
  const emotionRef = useRef(emotion);
  const activeRef = useRef(active);
  const [forceCanvas, setForceCanvas] = useState(false);
  emotionRef.current = emotion;
  activeRef.current = active;

  useEffect(() => {
    let disposed = false, frame, transition;
    const canvas = canvasRef.current;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const draw = () => {
      rendererRef.current?.draw(weights.current);
      canvas.dataset.weights = weights.current.map(w => w.toFixed(3)).join(',');
    };
    const tick = now => {
      if (disposed || document.hidden || !activeRef.current) return;
      if (transition) {
        const progress = Math.min(1, (now - transition.started) / PRESENTER_MORPH_MS);
        const eased = smoothMorph(progress);
        weights.current = transition.from.map((w, i) => w + (transition.to[i] - w) * eased);
        canvas.dataset.progress = progress.toFixed(3);
        if (progress === 1) transition = null;
      }
      draw();
      if (transition) frame = requestAnimationFrame(tick);
    };
    const update = () => {
      cancelAnimationFrame(frame);
      const target = PRESENTER_EMOTIONS.map(name => name === emotionRef.current ? 1 : 0);
      if (reduced.matches || target.every((w, i) => Math.abs(w - weights.current[i]) < .00001)) { weights.current = target; transition = null; canvas.dataset.progress = '1'; draw(); return; }
      transition = { from: [...weights.current], to: target, started: performance.now() };
      frame = requestAnimationFrame(tick);
    };
    updateRef.current = update;
    const resize = () => {
      const size = canvas.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.min(1024, Math.round(size.width * dpr)));
      canvas.height = Math.round(canvas.width * mesh.height / mesh.width);
      draw();
    };
    const lost = event => { event.preventDefault(); if (!forceCanvas) setForceCanvas(true); };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    canvas.addEventListener('webglcontextlost', lost);
    document.addEventListener('visibilitychange', update);
    reduced.addEventListener('change', update);
    Promise.all([sheet, angry].map(async url => { const image = new Image(); image.src = url; await image.decode(); return image; }))
      .then(images => {
        if (disposed) return;
        rendererRef.current = createPresenterRenderer(canvas, images, mesh, forceCanvas);
        if (!rendererRef.current) throw Error('Presenter canvas unavailable');
        canvas.dataset.renderer = rendererRef.current.mode;
        resize(); update();
      }).catch(() => { if (!disposed && !forceCanvas) setForceCanvas(true); });
    return () => {
      disposed = true; cancelAnimationFrame(frame); observer.disconnect();
      canvas.removeEventListener('webglcontextlost', lost); document.removeEventListener('visibilitychange', update); reduced.removeEventListener('change', update);
      rendererRef.current?.destroy(); rendererRef.current = null; updateRef.current = null;
    };
  }, [sheet, angry, forceCanvas]);

  useEffect(() => { updateRef.current?.(); }, [emotion, active]);
  return <canvas key={String(forceCanvas)} ref={canvasRef} className="onboarding-presenter-morph" aria-hidden="true" />;
}
