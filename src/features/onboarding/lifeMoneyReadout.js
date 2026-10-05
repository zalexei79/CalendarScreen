// Roll changed digits independently so the amount keeps its shape between beats.
export function createMoneyReadout(element) {
  const sign = document.createElement('span');
  sign.className = 'life-money-sign';
  const digits = document.createElement('span');
  digits.className = 'life-money-digits';
  const unit = document.createElement('span');
  unit.className = 'life-money-unit';
  element.replaceChildren(sign, digits, unit);
  let previous = '';
  const animations = new Set();
  const clear = () => {
    for (const animation of animations) animation.cancel();
    animations.clear();
    digits.querySelectorAll('.life-money-outgoing').forEach(node => node.remove());
  };
  return {
    update(event, locale, reduce = false, duration = 250) {
      const formatted = event.amount.toLocaleString(locale, { maximumFractionDigits: 2 });
      const prefix = event.tone === 'income' ? '+' : event.tone === 'expense' ? '−' : '±';
      element.setAttribute('aria-label', `${prefix}${formatted} ${event.currency}`);
      clear();
      sign.textContent = prefix;
      unit.textContent = event.currency;
      const old = previous.slice(-formatted.length).padStart(formatted.length, ' ');
      const fragment = document.createDocumentFragment();
      [...formatted].forEach((character, index) => {
        const slot = document.createElement('span');
        slot.className = /\d/.test(character) ? 'life-money-digit' : 'life-money-punctuation';
        const current = document.createElement('span');
        current.textContent = character;
        slot.append(current);
        fragment.append(slot);
        if (reduce || character === old[index] || !/\d/.test(character)) return;
        const outgoing = document.createElement('span');
        outgoing.className = 'life-money-outgoing';
        outgoing.textContent = old[index]?.trim() || '';
        slot.append(outgoing);
        const direction = event.tone === 'income' ? 1 : -1;
        const options = { duration, easing: 'cubic-bezier(.22,1,.36,1)' };
        const incomingAnimation = current.animate([{ transform: `translateY(${direction * 100}%)`, opacity: .2 }, { transform: 'translateY(0)', opacity: 1 }], options);
        const outgoingAnimation = outgoing.animate([{ transform: 'translateY(0)', opacity: .8 }, { transform: `translateY(${-direction * 100}%)`, opacity: 0 }], options);
        animations.add(incomingAnimation); animations.add(outgoingAnimation);
        Promise.all([incomingAnimation.finished, outgoingAnimation.finished]).then(() => { outgoing.remove(); animations.delete(incomingAnimation); animations.delete(outgoingAnimation); }).catch(() => { outgoing.remove(); });
      });
      digits.replaceChildren(fragment);
      previous = formatted;
    },
    destroy: clear,
  };
}
