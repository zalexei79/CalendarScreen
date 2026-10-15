import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeConfig, configCSS, safeLink, EMPTY_CONFIG } from '../src/features/admin/siteConfig.js';

test('configuration only accepts registered elements and constrained properties', () => {
  const config = normalizeConfig({ mobile: { elements: {
    settings: { width: 0, height: 999999, x: -999, hidden: true, color: 'red;display:none', href: 'javascript:alert(1)', css: 'body{}' },
    arbitrary: { color: '#ffffff' },
  } } });
  assert.deepEqual(config.mobile.elements.settings, { width: 32, height: 500, x: -200, hidden: true });
  assert.equal(config.mobile.elements.arbitrary, undefined);
  assert.deepEqual(config.desktop, { global: {}, elements: {} });
});
test('navigation rejects script URLs, protocol-relative paths and injection', () => {
  for (const value of ['javascript:alert(1)', 'data:text/html,test', '//evil.example', '/\\evil.example', 'https://u:p@example.com', 'https://example.com/"});body{', '/\n/evil.example']) assert.equal(safeLink(value), '');
  assert.equal(safeLink('/privacy.html'), '/privacy.html');
  assert.equal(safeLink('https://example.com/help?q=1'), 'https://example.com/help?q=1');
});
test('mobile overrides do not leak into desktop and unset values do not override defaults', () => {
  const css = configCSS({ mobile: { global: { background: '#123456' }, elements: { settings: { width: 56, x: 12 } } } });
  assert.match(css, /@media \(max-width:767px\)/);
  assert.match(css, /width:56px!important/);
  assert.match(css, /translate:12px 0px!important/);
  assert.match(css, /@media \(min-width:768px\)\{\}$/);
  assert.doesNotMatch(configCSS(EMPTY_CONFIG), /!important/);
});
test('configuration roundtrip is stable and rejects CSS/URL injection in global settings', () => {
  const config = normalizeConfig({ desktop: { global: { background: '#abcdef', image: 'https://example.com/bg.jpg', accent: '#fbbf24' }, elements: { next: { href: '/help', radius: 12 } } } });
  assert.deepEqual(normalizeConfig(JSON.parse(JSON.stringify(config))), config);
  const attack = configCSS({ desktop: { global: { image: 'https://example.com/x");}body{display:none}/*', background: '#fff;}' } } });
  assert.doesNotMatch(attack, /display:none|background-image|background-color/);
});

test('custom buttons have safe unique IDs, bounded text, placements and links', () => {
  const config = normalizeConfig({ buttons: [
    { id: 'button-help', label: '<Help>', href: '/privacy.html', placement: 'header' },
    { id: 'button-help', label: 'duplicate' },
    { id: 'button-"]body{', href: 'https://example.com' },
    { id: 'button-other', label: 'x'.repeat(100), href: 'javascript:alert(1)', placement: 'evil' },
  ], mobile: { elements: { 'button-help': { background: '#123456', width: 200 } } } });
  assert.equal(config.buttons.length, 2);
  assert.equal(config.buttons[0].href, '/privacy.html');
  assert.equal(config.buttons[1].label.length, 80);
  assert.equal(config.buttons[1].href, '');
  assert.equal(config.buttons[1].placement, 'header');
  assert.match(configCSS(config), /\[data-site-button="button-help"\]\{background-color:#123456!important;width:200px!important/);
  assert.deepEqual(normalizeConfig(config), config);
  assert.equal(normalizeConfig({buttons:Array.from({length:30}, (_, i)=>({id:`button-${i}`}))}).buttons.length,20);
});
