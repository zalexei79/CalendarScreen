import React, { useEffect, useRef, useState } from 'react';
import './GlassSystem.css';

const DISMISS_DISTANCE = 88;
const DISMISS_VELOCITY = 0.55;
const DIRECTION_LOCK_DISTANCE = 8;

function scrollableParent(target, boundary) {
  let node = target instanceof Element ? target : null;
  while (node && node !== boundary) {
    const overflowY = window.getComputedStyle(node).overflowY;
    if (/(auto|scroll)/.test(overflowY) && node.scrollHeight > node.clientHeight + 1) return node;
    node = node.parentElement;
  }
  return boundary?.scrollHeight > boundary?.clientHeight + 1 ? boundary : null;
}

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
  const sheetRef = useRef(null);
  const pointerGesture = useRef(null);
  const touchGesture = useRef(null);
  const offsetRef = useRef(0);
  const hasDragged = useRef(false);
  const dismissTimer = useRef(null);
  const configRef = useRef({ disabled, onDismiss });
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  configRef.current = { disabled, onDismiss };

  function setSheetNode(node) {
    sheetRef.current = node;
    if (typeof forwardedRef === 'function') forwardedRef(node);
    else if (forwardedRef) forwardedRef.current = node;
  }

  function gestureEnabled() {
    return !configRef.current.disabled && !window.matchMedia('(min-width: 1280px)').matches;
  }

  function updateOffset(value) {
    hasDragged.current = true;
    const next = Math.max(0, value);
    offsetRef.current = next;
    setOffset(next);
  }

  function settleDrag(startedAt) {
    setDragging(false);
    const elapsed = Math.max(performance.now() - startedAt, 1);
    const velocity = offsetRef.current / elapsed;
    const shouldDismiss = offsetRef.current >= DISMISS_DISTANCE || (offsetRef.current >= 24 && velocity >= DISMISS_VELOCITY);

    if (!shouldDismiss || configRef.current.disabled) {
      updateOffset(0);
      return;
    }

    updateOffset(Math.max(window.innerHeight, offsetRef.current + 240));
    window.clearTimeout(dismissTimer.current);
    dismissTimer.current = window.setTimeout(() => configRef.current.onDismiss?.(), 210);
  }

  function cancelDrag() {
    pointerGesture.current = null;
    touchGesture.current = null;
    setDragging(false);
    updateOffset(0);
  }

  useEffect(() => {
    const sheet = sheetRef.current;
    if (!sheet) return undefined;

    function onTouchStart(event) {
      if (!gestureEnabled() || event.touches.length !== 1) return;
      const touch = event.touches[0];
      touchGesture.current = {
        startX: touch.clientX,
        startY: touch.clientY,
        startedAt: performance.now(),
        scrollParent: scrollableParent(event.target, sheet),
        active: false,
        rejected: false,
      };
    }

    function onTouchMove(event) {
      const current = touchGesture.current;
      if (!current || current.rejected || event.touches.length !== 1) return;
      if (current.scrollParent?.scrollTop > 0) {
        current.rejected = true;
        return;
      }

      const touch = event.touches[0];
      const dx = touch.clientX - current.startX;
      const dy = touch.clientY - current.startY;

      if (!current.active) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) < DIRECTION_LOCK_DISTANCE) return;
        if (dy <= 0 || Math.abs(dx) > Math.abs(dy) * 1.1) {
          current.rejected = true;
          return;
        }
        current.active = true;
        setDragging(true);
      }

      event.preventDefault();
      updateOffset(dy);
    }

    function onTouchEnd() {
      const current = touchGesture.current;
      touchGesture.current = null;
      if (current?.active) settleDrag(current.startedAt);
    }

    function onTouchCancel() {
      if (touchGesture.current?.active) cancelDrag();
      else touchGesture.current = null;
    }

    sheet.addEventListener('touchstart', onTouchStart, { passive: true });
    sheet.addEventListener('touchmove', onTouchMove, { passive: false });
    sheet.addEventListener('touchend', onTouchEnd, { passive: true });
    sheet.addEventListener('touchcancel', onTouchCancel, { passive: true });

    return () => {
      sheet.removeEventListener('touchstart', onTouchStart);
      sheet.removeEventListener('touchmove', onTouchMove);
      sheet.removeEventListener('touchend', onTouchEnd);
      sheet.removeEventListener('touchcancel', onTouchCancel);
      window.clearTimeout(dismissTimer.current);
    };
  }, []);

  function startHandleDrag(event) {
    if (event.pointerType === 'touch' || !gestureEnabled()) return;
    pointerGesture.current = { pointerId: event.pointerId, startY: event.clientY, startedAt: performance.now() };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setDragging(true);
  }

  function moveHandleDrag(event) {
    if (!pointerGesture.current || pointerGesture.current.pointerId !== event.pointerId) return;
    updateOffset(event.clientY - pointerGesture.current.startY);
  }

  function finishHandleDrag(event) {
    const current = pointerGesture.current;
    if (!current || current.pointerId !== event.pointerId) return;
    pointerGesture.current = null;
    settleDrag(current.startedAt);
  }

  const swipeStyle = offset > 0 || dragging || hasDragged.current
    ? {
        transform: `translate3d(0, ${offset}px, 0)`,
        transition: dragging ? 'none' : 'transform 210ms cubic-bezier(.22,1,.36,1)',
        willChange: 'transform',
      }
    : {};

  return (
    <Component ref={setSheetNode} data-sheet-entrance="true" data-glass-theme={isLight ? 'light' : 'dark'} className={`dayris-swipe-sheet ${className}`} style={{ ...style, ...swipeStyle }} {...props}>
      <div
        aria-hidden="true"
        className={`flex h-7 shrink-0 touch-none cursor-grab items-center justify-center active:cursor-grabbing xl:hidden ${handleClassName}`}
        onPointerDown={startHandleDrag}
        onPointerMove={moveHandleDrag}
        onPointerUp={finishHandleDrag}
        onPointerCancel={cancelDrag}
      >
        <span className={`h-1 w-11 rounded-full transition-colors ${isLight ? 'bg-zinc-300' : 'bg-zinc-700'}`} />
      </div>
      {children}
    </Component>
  );
});

export default SwipeDismissSheet;
