function copyThroughSelection(text, container) {
  if (typeof document.execCommand !== 'function') return false;
  const active = document.activeElement;
  const selection = window.getSelection();
  const ranges = [];
  for (let i = 0; selection && i < selection.rangeCount; i += 1) ranges.push(selection.getRangeAt(i).cloneRange());
  const fieldSelection = typeof active?.selectionStart === 'number'
    ? [active.selectionStart, active.selectionEnd, active.selectionDirection] : null;
  const scroll = [];
  for (let node = container; node; node = node.parentElement) scroll.push([node, node.scrollLeft, node.scrollTop]);
  const field = document.createElement('textarea');
  field.value = text;
  field.readOnly = true;
  field.tabIndex = -1;
  // A selectable rendered field is required on iOS. Keep it inside the sheet
  // so modal focus containment cannot move focus away before the copy command.
  field.style.cssText = 'position:fixed;top:0;left:0;width:2px;height:2px;padding:0;border:0;opacity:0;font-size:16px;user-select:text;-webkit-user-select:text;';
  field.dataset.clipboardTemporary = 'true';
  function onCopy(event) {
    if (!event.clipboardData) return;
    event.clipboardData.setData('text/plain', text);
    event.preventDefault();
  }
  try {
    container.appendChild(field);
    field.focus({ preventScroll: true });
    field.select();
    field.setSelectionRange(0, text.length);
    field.addEventListener('copy', onCopy);
    return document.execCommand('copy') === true;
  } catch {
    return false;
  } finally {
    field.removeEventListener('copy', onCopy);
    field.remove();
    if (active instanceof HTMLElement && active.isConnected) {
      active.focus({ preventScroll: true });
      if (fieldSelection) {
        try { active.setSelectionRange(...fieldSelection); } catch { /* unsupported input type */ }
      }
    }
    if (selection) {
      selection.removeAllRanges();
      for (const range of ranges) {
        if (range.commonAncestorContainer.isConnected) selection.addRange(range);
      }
    }
    for (const [node, left, top] of scroll) { node.scrollLeft = left; node.scrollTop = top; }
  }
}

// Call directly from the click handler. On iOS, try the synchronous path before
// any await can lose the gesture Safari requires for clipboard access.
export async function copyText(text, { container = document.body, preferSelection = false } = {}) {
  if (!text) throw new Error('CLIPBOARD_EMPTY');
  if (preferSelection && copyThroughSelection(text, container)) return;
  try {
    if (!navigator.clipboard?.writeText) throw new Error('CLIPBOARD_UNAVAILABLE');
    await navigator.clipboard.writeText(text);
    return;
  } catch (error) {
    if (!preferSelection && copyThroughSelection(text, container)) return;
    throw error;
  }
}
