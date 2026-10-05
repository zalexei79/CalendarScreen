const modulo = value => ((value % 10) + 10) % 10;

// Persistent drums keep their position and velocity when a new amount arrives.
// Blank leading columns reserve room, so the currency and digits never jump sideways.
export function createMoneyReadout(element) {
  const sign = document.createElement('span');
  sign.className = 'life-money-sign';
  const signs = ['+', '−', '±'].map(character => {
    const node = document.createElement('span');
    node.textContent = character;
    sign.append(node);
    return node;
  });
  const digits = document.createElement('span');
  digits.className = 'life-money-digits';
  const unit = document.createElement('span');
  unit.className = 'life-money-unit';
  element.replaceChildren(sign, digits, unit);
  const columns = [];
  let frame;
  let lastTime;
  let disposed = false;
  const addColumn = () => {
    const slot = document.createElement('span');
    slot.className = 'life-money-digit';
    const track = document.createElement('span');
    track.className = 'life-money-track';
    for (let row = 0; row < 30; row++) {
      const digit = document.createElement('span');
      digit.textContent = String(row % 10);
      track.append(digit);
    }
    const punctuation = document.createElement('span');
    punctuation.className = 'life-money-punctuation';
    slot.append(track, punctuation);
    digits.prepend(slot);
    columns.unshift({ slot, track, punctuation, position: 0, target: 0, velocity: 0, alpha: 0, targetAlpha: 0, punctuationAlpha: 0, targetPunctuationAlpha: 0 });
  };
  const paint = column => {
    column.track.style.transform = `translate3d(0,${-(10 + modulo(column.position)) * 1.15}em,0)`;
    column.track.style.opacity = String(column.alpha);
    column.punctuation.style.opacity = String(column.punctuationAlpha);
  };
  const tick = time => {
    frame = undefined;
    if (disposed) return;
    const dt = Math.min(.05, Math.max(0, (time - (lastTime ?? time - 16)) / 1000));
    lastTime = time;
    const omega = 18;
    const decay = Math.exp(-omega * dt);
    let moving = false;
    for (const column of columns) {
      const offset = column.position - column.target;
      const slope = column.velocity + omega * offset;
      column.position = column.target + (offset + slope * dt) * decay;
      column.velocity = (column.velocity - omega * slope * dt) * decay;
      const blend = 1 - Math.exp(-10 * dt);
      column.alpha += (column.targetAlpha - column.alpha) * blend;
      column.punctuationAlpha += (column.targetPunctuationAlpha - column.punctuationAlpha) * blend;
      moving ||= Math.abs(column.position - column.target) > .0001 || Math.abs(column.velocity) > .001 || Math.abs(column.alpha - column.targetAlpha) > .001 || Math.abs(column.punctuationAlpha - column.targetPunctuationAlpha) > .001;
      paint(column);
    }
    if (moving) frame = requestAnimationFrame(tick);
    else lastTime = undefined;
  };
  return {
    update(event, locale, reduce = false) {
      if (disposed) return;
      const formatted = event.amount.toLocaleString(locale, { maximumFractionDigits: 2 });
      const prefix = event.tone === 'income' ? '+' : event.tone === 'expense' ? '−' : '±';
      element.setAttribute('aria-label', `${prefix}${formatted} ${event.currency}`);
      for (const node of signs) node.dataset.active = String(node.textContent === prefix);
      unit.textContent = event.currency;
      while (columns.length < Math.max(7, formatted.length)) addColumn();
      const padded = formatted.padStart(columns.length, ' ');
      columns.forEach((column, index) => {
        const character = padded[index];
        const numeric = /\d/.test(character);
        column.targetAlpha = numeric ? 1 : 0;
        column.targetPunctuationAlpha = !numeric && character.trim() ? 1 : 0;
        column.punctuation.textContent = numeric ? '' : character;
        if (numeric) {
          const delta = modulo(Number(character) - modulo(column.target) + 5) - 5;
          column.target += delta;
          // A newly revealed leading digit fades in already at its destination.
          if (column.alpha < .001 || reduce) column.position = column.target;
        }
        if (reduce) {
          column.position = column.target;
          column.velocity = 0;
          column.alpha = column.targetAlpha;
          column.punctuationAlpha = column.targetPunctuationAlpha;
        }
        paint(column);
      });
      if (reduce) { cancelAnimationFrame(frame); frame = undefined; lastTime = undefined; }
      else if (frame === undefined) frame = requestAnimationFrame(tick);
    },
    destroy() { disposed = true; cancelAnimationFrame(frame); },
  };
}
