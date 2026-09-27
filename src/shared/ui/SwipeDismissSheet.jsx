import React, { useEffect, useRef, useState } from 'react';

const DISMISS_DISTANCE = 88;
const DISMISS_VELOCITY = 0.55;

const SwipeDismissSheet = React.forwardRef(function SwipeDismissSheet({
  as: Component = 'div',
  children,
  className = '',
  style,
  onDismiss,
  disabled = false,
  isLight = false,
  handleClassName = '',
  ...props
}, forwardedRef) {
  const gesture = useRef(null);
  const offsetRef = useRef(0);
  const dismissTimer = useRef(null);
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);

  useEffect(() => () => window.clearTimeout(dismissTimer.current), []);

  function updateOffset(value) {
    const next = Math.max(0, value);
    offsetRef.current = next;
    setOffset(next);
  }

  function startDrag(event) {
    if (disabled || window.matchMedia('(min-width: 1280px)').matches) return;
    gesture.current = { pointerId: event.pointerId, startY: event.clientY, startedAt: performance.now() };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setDragging(true);
  }

  function moveDrag(event) {
    if (!gesture.current || gesture.current.pointerId !== event.pointerId) return;
    updateOffset(event.clientY - gesture.current.startY);
  }

  function finishDrag(event) {
    const current = gesture.current;
    if (!current || current.pointerId !== event.pointerId) return;
    gesture.current = null;
    setDragging(false);

    const elapsed = Math.max(performance.now() - current.startedAt, 1);
    const velocity = offsetRef.current / elapsed;
    const shouldDismiss = offsetRef.current >= DISMISS_DISTANCE || (offsetRef.current >= 24 && velocity >= DISMISS_VELOCITY);

    if (!shouldDismiss || disabled) {
      updateOffset(0);
      return;
    }

    updateOffset(Math.max(window.innerHeight, offsetRef.current + 240));
    window.clearTimeout(dismissTimer.current);
    dismissTimer.current = window.setTimeout(() => onDismiss?.(), 210);
  }

  function cancelDrag() {
    gesture.current = null;
    setDragging(false);
    updateOffset(0);
  }

  const swipeStyle = offset > 0
    ? {
        transform: `translate3d(0, ${offset}px, 0)`,
        transition: dragging ? 'none' : 'transform 210ms cubic-bezier(.22,1,.36,1)',
        willChange: 'transform',
      }
    : {};

  return (
    <Component ref={forwardedRef} className={className} style={{ ...style, ...swipeStyle }} {...props}>
      <div
        aria-hidden="true"
        className={`flex h-7 shrink-0 touch-none cursor-grab items-center justify-center active:cursor-grabbing xl:hidden ${handleClassName}`}
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={finishDrag}
        onPointerCancel={cancelDrag}
      >
        <span className={`h-1 w-11 rounded-full transition-colors ${isLight ? 'bg-zinc-300' : 'bg-zinc-700'}`} />
      </div>
      {children}
    </Component>
  );
});

export default SwipeDismissSheet;
