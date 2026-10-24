import React, { useLayoutEffect, useRef, useState } from 'react';
import './MotionSystem.css';

export default function AnimatedMonthLabel({ month, year, label }) {
  const index = year * 12 + month;
  const [frame, setFrame] = useState({ index, label, previous: null, direction: 1 });
  const container = useRef(null);
  const current = useRef(null);
  const width = useRef(null);
  const yearMotion = useRef(null);
  if (frame.index !== index || frame.label !== label) {
    setFrame({ index, label, previous: frame.label, direction: index >= frame.index ? 1 : -1 });
  }
  useLayoutEffect(() => {
    const node = container.current;
    const nextWidth = current.current.getBoundingClientRect().width;
    node.getAnimations().forEach(animation => animation.cancel());
    node.style.width = `${nextWidth}px`;
    if (width.current != null && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      // Commit layout once. FLIP the adjacent year instead of animating width,
      // which reflows the glass header and refits the calendar every frame.
      const year = node.closest('.dayris-month-title')?.children[1];
      yearMotion.current?.cancel();
      yearMotion.current = year?.animate([
        { transform: `translateX(${width.current - nextWidth}px)` },
        { transform: 'translateX(0)' },
      ], { duration: 420, easing: 'cubic-bezier(.22,1,.36,1)' });
    }
    width.current = nextWidth;
    return () => yearMotion.current?.cancel();
  }, [frame.index, frame.label]);
  return <span ref={container} className="dayris-month-label" style={{ '--label-direction': frame.direction }}>
    {frame.previous && <span key={`old-${frame.index}-${frame.label}`} aria-hidden="true" className="dayris-month-outgoing">{frame.previous}</span>}
    <span ref={current} key={`${frame.index}-${frame.label}`} className={frame.previous ? 'dayris-month-incoming' : ''}>{frame.label}</span>
  </span>;
}
