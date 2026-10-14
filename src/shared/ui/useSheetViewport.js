import { useEffect, useState } from 'react';

// Safari keeps the layout viewport tall when the keyboard covers its bottom.
// The visual viewport is the space a user can actually see and interact with.
export default function useSheetViewport() {
  const [viewport, setViewport] = useState(null);
  useEffect(() => {
    const visual = window.visualViewport;
    let frame;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        // Pinch zoom must not resize/reposition an open chart or form.
        if (visual && Math.abs(visual.scale - 1) > .05) return;
        const height = visual?.height || window.innerHeight;
        const inset = Math.max(0, window.innerHeight - height - (visual?.offsetTop || 0));
        setViewport(previous => previous?.height === height && previous?.inset === inset ? previous : { height, inset });
      });
    };
    measure();
    window.addEventListener('resize', measure);
    visual?.addEventListener('resize', measure);
    visual?.addEventListener('scroll', measure);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', measure);
      visual?.removeEventListener('resize', measure);
      visual?.removeEventListener('scroll', measure);
    };
  }, []);
  return viewport ? { '--sheet-visible-height': `${viewport.height}px`, '--sheet-keyboard-inset': `${viewport.inset}px` } : {};
}
