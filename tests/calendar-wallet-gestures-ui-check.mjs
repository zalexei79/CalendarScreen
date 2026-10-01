import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import path from 'node:path';
const require = createRequire(process.env.DAYRIS_PLAYWRIGHT_PACKAGE || import.meta.url);
const bundle = await createRequire(path.resolve('package.json'))('esbuild').build({ entryPoints: [path.resolve('tests/calendar-wallet-gestures-ui.jsx')], bundle: true, write: false, outfile: 'calendar.js', format: 'iife', define: { 'process.env.NODE_ENV': '"production"' } });
const js = bundle.outputFiles.find(file => file.path.endsWith('.js')).text;
const css = bundle.outputFiles.find(file => file.path.endsWith('.css')).text;
const browser = await require('playwright').chromium.launch({ channel: 'msedge', headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem('dayris_wallet_onboarding_v2', '1'));
  await page.route('http://dayris.test/**', route => route.fulfill({ contentType: 'text/html', body: `<!doctype html><html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}
    *{box-sizing:border-box}body{margin:0;font:14px system-ui;background:#09090b;color:white}.controls{height:60px}button,input{max-width:80px}svg{width:18px;height:18px}.calendar-section{padding:10px;height:720px}.calendar-section>div:first-child{display:grid;grid-template-columns:repeat(7,1fr);height:40px}.calendar-days-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:4px}.calendar-days-grid>button{height:90px;background:#18181b;color:white}.wallet-panel-enter{height:720px;padding:16px;overflow:auto}
    </style><div id="root"></div><script>${js}</script></html>` }));
  const cdp = await context.newCDPSession(page);
  const send = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' || type === 'touchCancel' ? [] : [{ x, y, id: 1, radiusX: 2, radiusY: 2 }] });
  async function swipe(x, y, dx, dy, cancel = false) {
    await send('touchStart', x, y);
    for (let i = 1; i <= 10; i++) { await new Promise(resolve => setTimeout(resolve, 20)); await send('touchMove', x + dx * i / 10, y + dy * i / 10); }
    await send(cancel ? 'touchCancel' : 'touchEnd');
  }
  async function fresh() { await page.goto('http://dayris.test/'); await page.locator('.calendar-days-grid').waitFor(); await page.waitForTimeout(50); }
  const remains = async () => assert.equal(await page.locator('.calendar-days-grid').count(), 1);
  // Verify the actual browser timeline: departure, visible arrival, and no
  // native snapshot overlay swallowing a second navigation during arrival.
  await fresh();
  await page.evaluate(() => window.testNavigate('wallet'));
  assert.ok(await page.locator('.calendar-section').evaluate(el => el.getAnimations().some(animation => animation.effect.getTiming().duration === 120)));
  await page.locator('.wallet-panel-enter').waitFor();
  const motion = await page.locator('.wallet-panel-enter').evaluate(el => {
    const animation = el.getAnimations().find(animation => animation.effect.getTiming().duration === 520);
    if (!animation) return null;
    animation.pause(); animation.currentTime = 0;
    const style = getComputedStyle(el);
    const result = { opacity: Number(style.opacity), translate: style.translate };
    animation.play();
    return result;
  });
  assert.ok(motion && motion.opacity < .8 && motion.translate.includes('26px'));
  await page.evaluate(() => window.testNavigate('calendar'));
  await page.locator('.calendar-days-grid').waitFor();
  await page.waitForTimeout(650);
  assert.equal(await page.locator('.calendar-section').evaluate(el => getComputedStyle(el).opacity), '1');
  assert.equal(await page.locator('.calendar-days-grid > button').first().evaluate(el => getComputedStyle(el).animationName), 'none');
  // Android: root overscroll is disabled before the gesture, including small moves.
  await fresh();
  for (const selector of ['html', 'body']) assert.equal(await page.locator(selector).evaluate(el => getComputedStyle(el).overscrollBehaviorY), 'none');
  await send('touchStart', 195, 150);
  for (const dy of [2, 5, 10, 20, 45, 90, 150, 180]) { await send('touchMove', 195, 150 + dy); await page.waitForTimeout(20); }
  await send('touchEnd'); await page.locator('.wallet-panel-enter').waitFor();
  await swipe(195, 115, 0, 180); await page.locator('.calendar-days-grid').waitFor();
  // Browser bars/keyboard: keep the floating dock above the visible lower edge.
  await fresh();
  await page.evaluate(() => {
    Object.defineProperty(visualViewport, 'height', { configurable: true, value: 550 });
    visualViewport.dispatchEvent(new Event('resize'));
  });
  await page.waitForFunction(() => parseFloat(document.documentElement.style.getPropertyValue('--dayris-viewport-bottom')) > 200);
  assert.ok((await page.locator('.history-fab').boundingBox()).y + 48 <= 550);
  await page.evaluate(() => { delete visualViewport.height; visualViewport.dispatchEvent(new Event('resize')); });
  await page.waitForFunction(() => document.documentElement.style.getPropertyValue('--dayris-viewport-bottom') === '0px');
  // Pull from a real day button: follows the finger, shows readiness, prevents ghost selection.
  await fresh(); await send('touchStart', 195, 150); await send('touchMove', 195, 220);
  assert.notEqual(await page.locator('.calendar-section').evaluate(el => getComputedStyle(el).transform), 'none');
  assert.equal(await page.locator('.calendar-dock-wallet').textContent(), 'Pull down to open wallet');
  await send('touchMove', 195, 325);
  assert.equal(await page.locator('.calendar-dock-wallet').textContent(), 'Release to open wallet');
  await send('touchEnd'); await page.locator('.wallet-panel-enter').waitFor();
  assert.equal(await page.locator('#selected').textContent(), '');
  // Return uses the existing wallet interaction, then another pull enters again.
  await swipe(195, 115, -130, 2); await page.locator('.calendar-days-grid').waitFor();
  assert.equal(await page.locator('.calendar-section').getAttribute('data-cells-enter'), 'false');
  await page.waitForTimeout(350);
  assert.equal(await page.locator('.calendar-days-grid > button').first().evaluate(el => getComputedStyle(el).animationName), 'none');
  await swipe(195, 150, 0, 180); await page.locator('.wallet-panel-enter').waitFor();
  await fresh(); await swipe(195, 150, 0, 70); await remains();
  await page.waitForFunction(() => getComputedStyle(document.querySelector('.calendar-section')).transform === 'none');
  assert.equal(await page.locator('.calendar-section').evaluate(el => getComputedStyle(el).transform), 'none');
  assert.equal(await page.locator('#selected').textContent(), '');
  await swipe(195, 150, 0, 180, true); await remains();
  // Month swipes still work once per gesture, including FREE.
  await send('touchStart', 195, 150);
  await send('touchMove', 115, 150);
  await page.locator('.calendar-month-preview').first().waitFor({ state: 'attached' });
  assert.equal(await page.locator('.calendar-month-preview').count(), 2, 'both adjacent months are available during drag');
  const readsBeforeTracking = await page.evaluate(() => window.testTradesReads);
  await send('touchMove', 95, 150);
  await page.evaluate(() => new Promise(requestAnimationFrame));
  assert.equal(await page.evaluate(() => window.testTradesReads), readsBeforeTracking, 'tracking must not rerender day data');
  assert.notEqual(await page.locator('.calendar-motion-light').evaluate(el => el.style.transform), 'translate3d(0px, 0px, 0px)', 'shared light follows the swipe');
  assert.equal(await page.locator('.calendar-motion-light').count(), 1, 'all three pages share a single light layer');
  assert.equal(await page.locator('.calendar-motion-sheen').count(), 0, 'no decorative stripe between months');
  const trackedX = await page.locator('.calendar-section').evaluate(el => new DOMMatrix(getComputedStyle(el).transform).m41);
  assert.ok(Math.abs(trackedX + 100) < 1, 'month follows the finger one-to-one');
  const depth = await page.locator('.calendar-section > .calendar-days-grid').evaluate(el => Number(el.style.getPropertyValue('--month-scale')));
  assert.ok(depth < 1 && depth > .96, 'outgoing month recedes gently during drag');
  const incomingDepth = await page.locator('.calendar-month-preview').last().locator('.calendar-days-grid').evaluate(el => Number(el.style.getPropertyValue('--month-scale')));
  assert.ok(incomingDepth > .96 && incomingDepth < 1, 'incoming month unfolds continuously with swipe progress');
  const previewBox = await page.locator('.calendar-month-preview').last().boundingBox();
  assert.ok(previewBox.x < 390 && previewBox.x > 0, 'next month enters the viewport behind the finger');
  await send('touchCancel');
  await page.waitForFunction(() => getComputedStyle(document.querySelector('.calendar-section')).transform === 'none');
  await page.evaluate(() => {
    window.monthFrameGaps = [];
    window.sampleMonthFrames = true;
    const sample = () => {
      if (!window.sampleMonthFrames) return;
      const boxes = [...document.querySelectorAll('.calendar-section, .calendar-month-preview')].map(el => el.getBoundingClientRect());
      const incoming = document.querySelector('.calendar-section[data-settling="true"] .calendar-month-preview:last-child .calendar-days-grid');
      if (incoming) window.lastIncomingScale = new DOMMatrix(getComputedStyle(incoming).transform).m11;
      // The incoming and outgoing pages must cover the viewport throughout.
      const left = Math.min(...boxes.map(box => box.left)), right = Math.max(...boxes.map(box => box.right));
      if (left > 1 || right < innerWidth - 1) window.monthFrameGaps.push({left,right});
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  await swipe(195, 150, -120, 0); await page.waitForFunction(() => document.querySelector('#month').textContent === '1'); assert.equal(await page.locator('#month').textContent(), '1');
  await page.evaluate(() => window.sampleMonthFrames = false);
  assert.deepEqual(await page.evaluate(() => window.monthFrameGaps), [], 'no blank page frame during release and commit');
  assert.ok(await page.evaluate(() => window.lastIncomingScale > .999), 'incoming page reaches full size before the month is committed');
  await swipe(195, 150, 120, 0); await page.waitForFunction(() => document.querySelector('#month').textContent === '0'); assert.equal(await page.locator('#month').textContent(), '0');
  await page.getByRole('button', { name: 'PRO', exact: true }).click();
  await swipe(195, 150, 0, 180); await remains();
  await swipe(195, 150, -120, 0); await page.waitForFunction(() => document.querySelector('#month').textContent === '1'); assert.equal(await page.locator('#month').textContent(), '1');
  // Ordinary scrolling, taps, overlays, and multiple fingers do not open the wallet.
  await fresh(); await page.locator('.calendar-days-grid > button').nth(10).tap();
  assert.equal(await page.locator('#selected').textContent(), 'day-10');
  await fresh(); await page.locator('#blocked').click(); await swipe(195, 150, 0, 180); await remains();
  await fresh(); await page.locator('.calendar-section').evaluate(el => el.style.height = '1100px');
  await swipe(195, 600, 0, -210); await remains();
  assert.ok(await page.evaluate(() => document.scrollingElement.scrollTop) > 0);
  await swipe(195, 150, 0, 180); await remains();
  await fresh(); await send('touchStart', 140, 150); await send('touchMove', 140, 200);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 140, y: 200, id: 1 }, { x: 240, y: 200, id: 2 }] });
  await send('touchEnd'); await remains();
  await page.emulateMedia({ reducedMotion: 'reduce' }); await fresh();
  await swipe(195, 150, 0, 180); await page.locator('.wallet-panel-enter').waitFor();
  assert.equal(await page.locator('.wallet-panel-enter').evaluate(el => getComputedStyle(el).animationName), 'none');
  // Desktop mouse month navigation remains independent from touch gestures.
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 1280, height: 900 }); await fresh();
  await page.mouse.click(650, 150, { button: 'middle' }); await page.locator('.wallet-panel-enter').waitFor();
  await page.mouse.click(650, 115, { button: 'middle' }); await page.locator('.calendar-days-grid').waitFor();
  assert.equal(await page.locator('#selected').textContent(), '');
  await fresh(); await page.locator('#blocked').click();
  await page.mouse.click(650, 150, { button: 'middle' }); await remains();
  await fresh(); await page.locator('#pro').click();
  await page.mouse.click(650, 150, { button: 'middle' }); await remains();
  await fresh();
  await page.mouse.move(650, 150); await page.mouse.down();
  await page.mouse.move(480, 150, { steps: 8 }); await page.mouse.up();
  assert.equal(await page.locator('#month').textContent(), '1');
  assert.equal(await page.locator('#selected').textContent(), '');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  // The real dock component is portalled and measured, including wrapped text.
  for (const [width, height] of [[320,568],[360,640],[412,915],[568,320],[768,1024],[1024,768],[1440,900]]) {
    await page.setViewportSize({ width, height }); await fresh();
    await page.evaluate(() => document.getElementById('root').style.transform = 'translateY(180px)');
    for (const size of [14, 20, 24]) {
      await page.locator('.history-fab button').evaluateAll((buttons, size) => buttons.forEach(button => button.style.fontSize = `${size}px`), size);
      await page.waitForFunction(() => Math.abs(parseFloat(document.documentElement.style.getPropertyValue('--dayris-dock-height')) - document.querySelector('.history-fab').getBoundingClientRect().height) < 1);
      const dock = await page.locator('.history-fab').boundingBox();
      assert.ok(dock.y >= 0 && dock.y + dock.height <= height - 12, `dock stays inside the visible viewport at ${width}x${height}, font ${size}`);
      for (const button of await page.locator('.history-fab button').all()) {
        const box = await button.boundingBox();
        assert.ok(box.x >= 0 && box.x + box.width <= width && box.height >= 44, 'buttons stay visible and tappable');
      }
    }
  }
  assert.deepEqual(errors, []);
  console.log('PASS: Android overscroll policy and slow pull round trip, visual viewport dock clearance, desktop middle-button round trip and guards, day-cell pull and feedback, snap-back, cancellation, no ghost click, month swipes, FREE gate, overlays, native scrolling, multitouch, reduced motion.');
} finally { await browser.close(); }
