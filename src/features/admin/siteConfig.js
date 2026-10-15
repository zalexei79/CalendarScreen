// Stable IDs are the contract between the editor and the application.
export const ELEMENTS = [
  { id: 'header', label: 'Шапка', selector: '.dayris-header' },
  { id: 'brand', label: 'Название и логотип', selector: '[data-site-element="brand"]' },
  { id: 'actions', label: 'Кнопки шапки', selector: '[data-site-element="actions"]' },
  { id: 'install', label: 'Установить приложение', selector: '[data-site-element="install"]', action: true },
  { id: 'settings', label: 'Настройки', selector: '[data-site-element="settings"]', action: true },
  { id: 'previous', label: 'Предыдущий месяц', selector: '[data-site-element="previous"]', action: true },
  { id: 'next', label: 'Следующий месяц', selector: '[data-site-element="next"]', action: true },
  { id: 'today', label: 'Сегодня', selector: '[data-site-element="today"]', action: true },
];
export const EMPTY_CONFIG = { schema: 1, mobile: { global: {}, elements: {} }, desktop: { global: {}, elements: {} } };
const color = value => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : undefined;
const number = (value, min, max) => typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : undefined;
export function safeLink(value) {
  if (typeof value !== 'string' || value.length > 2048 || /[\s\\"'<>\x00-\x1f]/.test(value)) return '';
  if (/^\/(?!\/)/.test(value)) return value;
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : ''; } catch { return ''; }
}
const clean = object => Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined && value !== ''));
export function normalizeConfig(input) {
  const result = { schema: 1 };
  for (const device of ['mobile', 'desktop']) {
    const source = input?.[device];
    const global = source?.global;
    result[device] = {
      global: clean({ background: color(global?.background), image: safeLink(global?.image), accent: color(global?.accent) }),
      elements: {},
    };
    for (const { id, action } of ELEMENTS) {
      const item = source?.elements?.[id];
      if (!item || typeof item !== 'object') continue;
      result[device].elements[id] = clean({
        color: color(item.color), background: color(item.background),
        width: number(item.width, 32, 1200), height: number(item.height, 32, 500),
        fontSize: number(item.fontSize, 10, 64), radius: number(item.radius, 0, 100),
        x: number(item.x, -200, 200), y: number(item.y, -200, 200), order: number(item.order, -20, 20),
        hidden: typeof item.hidden === 'boolean' ? item.hidden : undefined,
        href: action ? safeLink(item.href) : undefined,
      });
    }
  }
  return result;
}
export function configCSS(input) {
  const config = normalizeConfig(input);
  return ['mobile', 'desktop'].map(device => {
    const { global, elements } = config[device];
    let css = '';
    const rule = (selector, values) => {
      const body = Object.entries(values).filter(([, value]) => value !== undefined).map(([key, value]) => `${key}:${value}!important`).join(';');
      if (body) css += `${selector}{${body}}`;
    };
    rule('.premium-shell', {
      'background-color': global.background,
      'background-image': global.image ? `url("${global.image}")` : undefined,
      'background-size': global.image ? 'cover' : undefined,
      'background-position': global.image ? 'center' : undefined,
      '--pro-gold': global.accent,
    });
    for (const { id, selector } of ELEMENTS) {
      const item = elements[id];
      if (!item) continue;
      const px = key => item[key] === undefined ? undefined : `${item[key]}px`;
      rule(selector, {
        color: item.color, 'background-color': item.background,
        width: px('width'), height: px('height'), 'font-size': px('fontSize'),
        'border-radius': px('radius'), order: item.order,
        translate: item.x !== undefined || item.y !== undefined ? `${item.x || 0}px ${item.y || 0}px` : undefined,
        display: item.hidden ? 'none' : undefined,
      });
    }
    return `@media ${device === 'mobile' ? '(max-width:767px)' : '(min-width:768px)'}{${css}}`;
  }).join('\n');
}
