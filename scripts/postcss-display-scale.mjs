import valueParser from 'postcss-value-parser';

// Reflow real component sizes rather than zooming the page. Viewport units,
// percentages, media queries and measurements supplied by JS stay unchanged.
export default function displayScale() {
  return {
    postcssPlugin:'dayris-display-scale',
    OnceExit(root) {
      root.walkDecls(declaration => {
        const { prop, value } = declaration;
        if (value.includes('--dayris-interface-scale') || value.includes('--dayris-control-font-size')) return;
        // rem must keep a fixed basis or it would receive the scale twice.
        if (prop === 'font-size' && /^(html|:root)$/.test(declaration.parent.selector?.trim())) return;
        const parsed = valueParser(value);
        let absoluteLength = false;
        parsed.walk(node => {
          if (node.type === 'function' && /^(url|var|env)$/i.test(node.value)) return false;
          if (node.type !== 'word') return;
          const dimension = valueParser.unit(node.value);
          if (!dimension || !['px','rem'].includes(dimension.unit)) return;
          absoluteLength = true;
          node.value = `calc(${node.value} * var(--dayris-interface-scale, 1))`;
        });
        let next = parsed.toString();
        const keyword = /^(inherit|initial|unset|revert(?:-layer)?|normal|(?:xx?-)?small|medium|(?:xx?x?-)?large|smaller|larger)$/i.test(value);
        const typography = prop === 'font-size' || prop === 'line-height';
        // em/percentage type sizes already inherit their parent's text scale.
        if (typography && !keyword && (absoluteLength || /(?:var\(|(?:\d|\.)v[wh])/.test(value))) {
          next = `calc(${next} * var(--dayris-text-scale, 1))`;
        }
        declaration.value = next;
        if (prop === 'font-size' && !keyword) {
          declaration.cloneBefore({ prop:'--dayris-control-font-size', value:next });
        }
      });
    },
  };
}
