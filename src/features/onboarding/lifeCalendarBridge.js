// Freeze the real cell's paint, including its content and theme, for the journey.
// These passive copies never handle input; the original calendar stays mounted.
export function createCalendarBridge(cell, layer) {
  const wrapper = document.createElement('div');
  wrapper.className = 'life-calendar-cell';
  const face = document.createElement('div');
  face.className = `${cell.className} life-calendar-face`;
  for (const child of cell.childNodes) face.appendChild(child.cloneNode(true));
  const originals = [cell, ...cell.querySelectorAll('*')];
  const copies = [face, ...face.querySelectorAll('*')];
  originals.forEach((original, index) => {
    const copy = copies[index];
    const style = getComputedStyle(original);
    for (const property of style) copy.style.setProperty(property, style.getPropertyValue(property));
    copy.removeAttribute('id');
    copy.removeAttribute('tabindex');
    copy.removeAttribute('data-today-cell');
    copy.style.setProperty('animation', 'none', 'important');
    copy.style.setProperty('transition', 'none', 'important');
    copy.style.visibility = 'visible';
  });
  Object.assign(face.style, { position: 'absolute', inset: '0', margin: '0', width: '100%', height: '100%', minWidth: '0', minHeight: '0', maxWidth: 'none', maxHeight: 'none', transform: 'none', transformOrigin: '0 0', pointerEvents: 'none' });
  // Preserve the native child layout and paint. Only these existing nodes move
  // within their card, so revealing dates never changes the calendar geometry.
  const content = [...face.children].map(node => ({ node, transform: node.style.transform === 'none' ? '' : node.style.transform, opacity: Number(node.style.opacity || 1) }));
  const week = document.createElement('div');
  week.className = 'life-calendar-week';
  wrapper.append(face, week);
  layer.appendChild(wrapper);
  return { wrapper, face, week, content, opacity: Number(getComputedStyle(cell).opacity) || 1 };
}
