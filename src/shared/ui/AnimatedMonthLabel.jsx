import React, { useLayoutEffect, useRef, useState } from 'react';
import './MotionSystem.css';

export default function AnimatedMonthLabel({ month, year, label }) {
  const index = year * 12 + month;
  const [frame, setFrame] = useState({ index, label, previous: null, direction: 1 });
  const current = useRef(null);
  const width = useRef(null);
  const yearMotion = useRef(null);
  if (frame.index !== index || frame.label !== label) {
    setFrame({ index, label, previous: frame.label, direction: index >= frame.index ? 1 : -1 });
  }
  useLayoutEffect(() => {
    const text = current.current;
    const nextWidth = text.offsetWidth;
    if (width.current != null && width.current !== nextWidth && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      // Commit layout once. FLIP the adjacent year instead of animating width,
      // which reflows the glass header and refits the calendar every frame.
      const year = text.closest('.dayris-month-title')?.children[1];
      yearMotion.current?.cancel();
      yearMotion.current = year?.animate([
        { transform: `translateX(${width.current - nextWidth}px)` },
        { transform: 'translateX(0)' },
      ], { duration: 420, easing: 'cubic-bezier(.22,1,.36,1)' });
    }
    width.current = nextWidth;
    // Fonts and responsive sizing can change after first paint. Natural
    // width keeps the year aligned; only the animation baseline is measured.
    const observer = new ResizeObserver(() => {
      const measuredWidth = text.offsetWidth;
      if (width.current !== measuredWidth) yearMotion.current?.cancel();
      width.current = measuredWidth;
    });
    observer.observe(text);
    return () => { observer.disconnect(); yearMotion.current?.cancel(); };
  }, [frame.index, frame.label]);
  return <span className="dayris-month-label" style={{ '--label-direction': frame.direction }}>
    {frame.previous && <span key={`old-${frame.index}-${frame.label}`} aria-hidden="true" className="dayris-month-outgoing">{frame.previous}</span>}
    <span ref={current} key={`${frame.index}-${frame.label}`} className={frame.previous ? 'dayris-month-incoming' : ''}>{frame.label}</span>
  </span>;
}
