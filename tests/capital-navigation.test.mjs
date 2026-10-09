import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [calendar, panel, grid, dock, css, offerCopy] = await Promise.all([
  readFile(new URL('CalendarScreen.jsx', root), 'utf8'),
  readFile(new URL('src/features/capital/CapitalPanel.jsx', root), 'utf8'),
  readFile(new URL('CalendarGrid.jsx', root), 'utf8'),
  readFile(new URL('src/shared/ui/WorkspaceDock.jsx', root), 'utf8'),
  readFile(new URL('src/features/capital/capital.css', root), 'utf8'),
  readFile(new URL('src/features/pro/proOfferCopy.js', root), 'utf8'),
]);

test('calendar has a named Capital entry and swipe route for PRO while the wallet remains separate', () => {
  assert.match(calendar, /function openCapitalFromCalendarGesture\(\)[\s\S]*?if \(!proAccessActive\) \{ openProPresentation\(\); return; \}[\s\S]*?setAccountMode\('capital'\)/);
  assert.match(calendar, /accountMode === 'capital' && proAccessActive && !proAccessLoading/);
  assert.match(calendar, /onOpenCapital=\{proAccessLoading \? undefined : openCapitalFromCalendarGesture\}/);
  assert.match(calendar, /className="capital-entry-card"[\s\S]*?onClick=\{openCapitalFromCalendarGesture\}[\s\S]*?t\('capitalHomeTitle'\)/);
  assert.doesNotMatch(calendar, /aria-label="DAYRIS Capital"/);
  assert.match(grid, /navigation: 'calendar', onExit: onOpenCapital/);
  assert.match(dock, /Pull down to open Capital/);
  assert.match(calendar, /accountMode === 'wallet' \? <WalletPanel/);
  assert.match(calendar, /onWallet=\{\(\) => transitionView\(\(\) => setAccountMode\('wallet'\)\)\}/);
  assert.match(calendar, /onBackToCalendar=\{\(\) => transitionView\(\(\) => setAccountMode\('main'\)\)\}/);
  assert.match(calendar, /if \(command\.type === 'wallet'\)[\s\S]*?openWalletFromCalendarAction\(\)/);
});

test('asset entry starts with categories and searchable catalogue before the short purchase form', () => {
  assert.match(panel, /capital-category-grid/);
  assert.match(panel, /loadBinanceSpotPairs/);
  assert.match(panel, /capital-picker-results/);
  assert.match(panel, /capital-custom-link/);
  assert.match(panel, /capital-purchase-details/);
  assert.match(panel, /t\.quantity/);
  assert.match(panel, /t\.purchase/);
});

test('Capital layout has a mobile breakpoint and respects reduced motion', () => {
  assert.match(css, /@media\s*\(max-width:\s*640px\)/);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  assert.match(css, /capital-quote-mobile/);
  assert.match(css, /capital-assets\{grid-template-columns:repeat\(auto-fit/);
  assert.match(css, /grid-template-areas:"icon main value" "icon qty quote"/);
});

test('Capital sheet shows one backend error and does not duplicate the custom asset label', () => {
  assert.match(panel, /portfolio\.error&&!composer/);
  assert.match(panel, /saveError\|\|portfolio\.error&&composer/);
  assert.match(panel, /<strong>\{form\.name\|\|t\.customAsset\}<\/strong>/);
  assert.doesNotMatch(panel, /assetSelection\.custom\?t\.customAsset:form\.name/);
});

test('Capital is represented in every existing PRO offer locale', () => {
  for (const key of ['ru', 'en', 'ro', 'zh']) {
    const copy = offerCopy.match(new RegExp(`Object\\.assign\\(copy\\.${key},\\s*\\{[\\s\\S]*?capitalPoints:[\\s\\S]*?\\}\\);`));
    assert.ok(copy, `missing Capital PRO copy for ${key}`);
    assert.match(copy[0], /capitalBody:/);
  }
});
