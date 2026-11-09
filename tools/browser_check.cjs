/* Optional browser QA: uses an installed Playwright package and system Chrome. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN || '/usr/bin/google-chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, hasTouch: true });
  const errors = [], failures = [], external = [], outsideBase = [];
  const url = process.argv[2] || 'http://127.0.0.1:8000/';
  const origin = new URL(url).origin;
  const basePath = new URL('.', url).pathname;
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`); });
  page.on('request', request => {
    const target = new URL(request.url());
    if (target.origin !== origin) external.push(request.url());
    else if (!target.pathname.startsWith(basePath)) outsideBase.push(request.url());
  });
  // Capture the real map without adding a test hook to the published application.
  await page.route('**/app.js*', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: `const mapFactory = L.map; L.map = (...args) => (window.qaMap = mapFactory(...args));\n${await response.text()}` });
  });
  await page.goto(url);
  await page.waitForFunction(() => !document.getElementById('controls').disabled);
  const ready = () => page.waitForFunction(() => document.getElementById('map-status').classList.contains('ready'));
  await ready();
  assert.equal(await page.locator('#top-layer').inputValue(), 'site-plan-1956');
  assert.equal(await page.locator('#bottom-layer').inputValue(), 'nyc-2024');
  assert.equal(await page.locator('#top-layer option').count(), 8);
  assert.ok(await page.locator('#boundary').isChecked(), 'Boundary enabled by default');
  assert.equal(await page.locator('.leaflet-renewalBoundary-pane path').count(), 1);
  assert.equal(await page.locator('#boundary').evaluate(el => getComputedStyle(el).accentColor), 'rgb(0, 0, 238)');
  assert.equal(await page.locator('#opacity').evaluate(el => getComputedStyle(el).accentColor), 'rgb(0, 0, 238)');
  const challenge = page.locator('a[href="https://30daymapchallenge.com/"]');
  assert.equal(await challenge.innerText(), '2026 30 Day Map Challenge');
  assert.equal(await challenge.evaluate(el => getComputedStyle(el).fontWeight), '400');
  assert.equal(await page.locator('#swap, #reset').count(), 0);
  assert.equal(await page.evaluate(() => window.qaMap.getBearing()), 90);
  assert.deepEqual(await page.locator('.blend span').allTextContents(), ['Map 1', 'Map 2']);
  const checkLayout = async () => {
    const box = await page.locator('#map').boundingBox();
    const first = await page.locator('#top-layer').boundingBox();
    const second = await page.locator('#bottom-layer').boundingBox();
    const slider = await page.locator('#opacity').boundingBox();
    const width = page.viewportSize().width;
    assert.ok(first.y >= box.y + box.height, 'Dropdowns below map');
    if (width >= 1100) {
      assert.ok(Math.abs(first.y - second.y) < 2, 'Compact horizontal dropdowns');
      assert.ok(second.x > first.x && second.x - first.x - first.width < 100, 'Adjacent dropdowns');
      const checkbox = await page.locator('#boundary').boundingBox();
      assert.ok(checkbox.x > second.x + second.width, 'Boundary checkbox right of dropdowns');
    } else assert.ok(second.y >= first.y, 'Responsive wrapping controls');
    assert.ok(slider.y >= second.y + second.height, 'Slider below dropdowns');
    assert.ok(Math.abs(box.x + box.width / 2 - width / 2) < 2, 'Centered map');
    if (width > 700) assert.ok(Math.abs(box.width / (width - 16) - .75) < .01, '75 percent width');
    assert.ok(first.x >= box.x && second.x + second.width <= box.x + box.width + 1);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    // Native selects use intrinsic widths; verify room for the longest option text.
    assert.ok(await page.locator('.selections select').evaluateAll(selects => selects.every(select => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      ctx.font = getComputedStyle(select).font;
      return Math.max(...[...select.options].map(o => ctx.measureText(o.text).width)) + 20 <= select.clientWidth;
    })), 'Full layer names fit');
  };
  const checkRotationAndAlignment = async () => {
    const result = await page.evaluate(async () => {
      const map = window.qaMap;
      const center = map.getCenter();
      const a = map.latLngToContainerPoint(center);
      const north = map.latLngToContainerPoint([center.lat + .001, center.lng]);
      const mapRect = map.getContainer().getBoundingClientRect();
      let maxTileError = 0;
      for (const tile of document.querySelectorAll('.leaflet-tile-loaded')) {
        const match = new URL(tile.src).pathname.match(/\/(\d+)\/(\d+)\/(\d+)\.webp$/);
        if (!match) continue;
        const [, z, x, y] = match.map(Number);
        const ll = map.unproject([(x + .5) * 256, (y + .5) * 256], z);
        const expected = map.latLngToContainerPoint(ll);
        const actual = tile.getBoundingClientRect();
        maxTileError = Math.max(maxTileError, Math.hypot(actual.x + actual.width / 2 - mapRect.x - expected.x, actual.y + actual.height / 2 - mapRect.y - expected.y));
      }
      return { dx: north.x - a.x, dy: north.y - a.y, maxTileError, bearing: map.getBearing() };
    });
    assert.equal(result.bearing, 90);
    assert.ok(result.dx > 0 && Math.abs(result.dy) < 1, 'North points right');
    assert.ok(result.maxTileError < 2, `Rotated tile alignment: ${JSON.stringify(result)}`);
    assert.equal(await page.locator('.compass-arrow').evaluate(el => el.style.transform), 'rotate(90deg)');
  };
  await checkLayout();
  assert.deepEqual(await page.locator('h1, h2').allTextContents(), ['The Remaking of Lincoln Square', 'Sources', 'Methodology']);
  assert.equal(await page.locator('main > p').first().innerText(), 'Jake Markey');
  assert.equal(await page.locator('hr').count(), 1);
  assert.equal(await page.locator('[aria-labelledby="sources-title"] a').count(), 6);
  assert.equal(await page.locator('[aria-label="Project description"] p').count(), 2);
  assert.equal(await page.locator('[aria-labelledby="methodology-title"] p').count(), 3);
  const checkOverview = async () => {
    const result = await page.evaluate(() => {
      const map = window.qaMap;
      const extent = map.mapBoundsToContainerBounds(map.options.maxBounds);
      const size = map.getSize();
      return { x: extent.min.x, y: extent.min.y, right: extent.max.x, bottom: extent.max.y,
        width: extent.getSize().x / size.x, height: extent.getSize().y / size.y,
        mapWidth: size.x, mapHeight: size.y };
    });
    assert.ok(result.x >= -1 && result.y >= -1 && result.right <= result.mapWidth + 1 && result.bottom <= result.mapHeight + 1, 'Entire rotated study area visible');
    assert.ok(result.width > .9 && result.height > .9, `Prominent imagery: ${JSON.stringify(result)}`);
  };
  await checkOverview();
  const setBlend = async value => page.locator('#opacity').evaluate((el, v) => { el.value = v; el.dispatchEvent(new Event('input')); }, value);
  const alpha = () => page.locator('.leaflet-topImagery-pane').evaluate(el => el.style.opacity);
  await setBlend(0);
  assert.equal(await alpha(), '1');
  await setBlend(100);
  assert.equal(await alpha(), '0');
  assert.equal(await page.locator('#opacity-value, #opacity-help, details').count(), 0);
  await setBlend(45);
  assert.equal(await alpha(), '0.55');
  // Grab the dot at multiple values and offsets: pressing it must preserve the blend.
  for (const value of [15, 45, 75]) {
    for (const offset of [-4, 0, 4]) {
      await setBlend(value);
      const box = await page.locator('#opacity').boundingBox();
      const x = box.x + 8 + (box.width - 16) * value / 100 + offset;
      await page.mouse.click(x, box.y + box.height / 2);
      assert.equal(Number(await page.locator('#opacity').inputValue()), value, 'Thumb press preserves value');
      assert.ok(Math.abs(Number(await alpha()) - (1 - value / 100)) < .00001);
    }
  }
  await setBlend(45);
  // Real range dragging: record every emitted value and the composited pane opacity.
  await page.locator('#opacity').evaluate(el => {
    window.blendSamples = [];
    el.addEventListener('input', () => window.blendSamples.push({ value: el.valueAsNumber,
      alpha: Number(document.querySelector('.leaflet-topImagery-pane').style.opacity) }));
  });
  const sliderBox = await page.locator('#opacity').boundingBox();
  const sx = sliderBox.x + 8, usable = sliderBox.width - 16;
  await page.mouse.move(sx + usable * .45, sliderBox.y + sliderBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(sx + usable * .55, sliderBox.y + sliderBox.height / 2, { steps: 40 });
  await page.mouse.up();
  const samples = await page.evaluate(() => window.blendSamples);
  assert.ok(samples.length > 10, 'Fine native dragging produces intermediate values');
  for (const sample of samples) {
    assert.ok(sample.alpha > .4 && sample.alpha < .6, 'Small movements stay away from endpoints');
    assert.ok(Math.abs(sample.alpha - (1 - sample.value / 100)) < .00001, 'Linear blend');
  }
  for (let i = 1; i < samples.length; i++) assert.ok(Math.abs(samples[i].alpha - samples[i - 1].alpha) < .02, 'No opacity jumps');
  await setBlend(45);
  await page.locator('#opacity').hover();
  const scrollBefore = await page.evaluate(() => window.scrollY);
  const zoomBefore = await page.evaluate(() => window.qaMap.getZoom());
  await page.mouse.wheel(0, 120);
  await page.waitForTimeout(100);
  assert.ok(Math.abs(Number(await alpha()) - .5) < .00001, 'Wheel moves five percent toward Map 2');
  await page.mouse.wheel(0, -120);
  await page.waitForTimeout(100);
  assert.equal(await alpha(), '0.55');
  await page.mouse.wheel(0, 12000);
  await page.waitForTimeout(100);
  assert.ok(Math.abs(Number(await alpha()) - .5) < .00001, 'Large wheel delta stays capped at five percent');
  assert.equal(await page.evaluate(() => window.scrollY), scrollBefore, 'Slider wheel does not scroll page');
  assert.equal(await page.evaluate(() => window.qaMap.getZoom()), zoomBefore, 'Slider wheel does not zoom map');
  await setBlend(0);
  await page.mouse.wheel(0, -120);
  await page.waitForTimeout(100);
  assert.equal(await alpha(), '1', 'Clamp left endpoint');
  await setBlend(100);
  await page.mouse.wheel(0, 120);
  await page.waitForTimeout(100);
  assert.equal(await alpha(), '0', 'Clamp right endpoint');
  await setBlend(45);
  await page.locator('#opacity').focus();
  await page.keyboard.press('ArrowRight');
  assert.equal(Number(await page.locator('#opacity').inputValue()), 45.1, 'Keyboard fine adjustment');
  await page.keyboard.press('Home');
  assert.equal(await alpha(), '1');
  await page.keyboard.press('End');
  assert.equal(await alpha(), '0');
  await setBlend(45);
  await page.locator('#boundary').check();
  const outline = page.locator('.leaflet-renewalBoundary-pane path');
  assert.equal(await outline.getAttribute('stroke'), '#d63636');
  assert.equal(await outline.getAttribute('fill'), 'none');
  // Compare a rendered outline vertex to the same geographic coordinate in the map.
  assert.ok(await page.evaluate(async () => {
    const data = await (await fetch('data/urban-renewal.geojson')).json();
    const [lng, lat] = data.features[0].geometry.coordinates[0][0];
    const map = window.qaMap, rect = map.getContainer().getBoundingClientRect();
    const expected = map.latLngToContainerPoint([lat, lng]);
    const path = document.querySelector('.leaflet-renewalBoundary-pane path');
    const point = path.getPointAtLength(0).matrixTransform(path.getScreenCTM());
    return Math.hypot(point.x - rect.x - expected.x, point.y - rect.y - expected.y) < 2;
  }), 'Vector and imagery share the geographic transform');
  await checkRotationAndAlignment();
  await page.locator('#boundary').uncheck();
  assert.equal(await outline.count(), 0);
  for (const selector of ['#top-layer', '#bottom-layer']) {
    for (const id of await page.locator(`${selector} option`).evaluateAll(options => options.map(o => o.value))) {
      await page.selectOption(selector, id);
      await ready();
      await checkRotationAndAlignment();
      assert.equal(await alpha(), '0.55', 'Blend remains consistent after selection');
    }
  }
  await page.selectOption('#top-layer', 'site-plan-1956');
  await page.selectOption('#bottom-layer', 'nyc-2024');
  await ready();
  await page.evaluate(() => window.qaMap.setZoom(19, { animate: false }));
  await ready();
  await checkRotationAndAlignment();
  const box = await page.locator('#map').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  const beforeDrag = await page.evaluate(() => window.qaMap.getCenter());
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(500);
  assert.notDeepEqual(await page.evaluate(() => window.qaMap.getCenter()), beforeDrag, 'Drag pans rotated map');
  const beforeWheel = await page.evaluate(() => window.qaMap.getZoom());
  await page.mouse.wheel(0, -120);
  await page.waitForTimeout(500);
  await ready();
  assert.ok(await page.evaluate(() => window.qaMap.getZoom()) > beforeWheel, 'Wheel zoom');
  await checkRotationAndAlignment();
  await page.evaluate(() => window.qaMap.setZoom(21, { animate: false }));
  await ready();
  await checkRotationAndAlignment();
  await page.evaluate(() => window.qaMap.panBy([100000, 100000], { animate: false }));
  await page.waitForTimeout(200);
  assert.ok(await page.evaluate(() => window.qaMap.options.maxBounds.contains(window.qaMap.getCenter())));
  // Return to the overview through the map's normal zoom API; no reset button exists.
  await page.evaluate(() => window.qaMap.setZoom(window.qaMap.getMinZoom(), { animate: false }));
  await ready();
  assert.ok(await page.evaluate(() => window.qaMap.getBounds().contains(window.qaMap.options.maxBounds)));
  const output = path.resolve(__dirname, '../test-results');
  fs.mkdirSync(output, { recursive: true });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(output, 'desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  await ready();
  await checkLayout();
  await checkOverview();
  await checkRotationAndAlignment();
  assert.ok(await page.evaluate(() => window.qaMap.getBounds().contains(window.qaMap.options.maxBounds)));
  await page.locator('#opacity').scrollIntoViewIfNeeded();
  const touchBox = await page.locator('#opacity').boundingBox();
  const tx = touchBox.x + 8 + (touchBox.width - 16) * .45;
  const ty = touchBox.y + touchBox.height / 2;
  await page.touchscreen.tap(tx, ty);
  assert.equal(Number(await page.locator('#opacity').inputValue()), 45, 'Touch thumb press preserves value');
  const touchSession = await page.context().newCDPSession(page);
  await touchSession.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: tx, y: ty }] });
  await touchSession.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: tx + 12, y: ty }] });
  await touchSession.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const touchValue = Number(await page.locator('#opacity').inputValue());
  assert.ok(touchValue > 45 && touchValue < 55, 'Small touch drag stays intermediate');
  await setBlend(45);
  await page.locator('#map').scrollIntoViewIfNeeded();
  await page.locator('#boundary').check();
  await page.screenshot({ path: path.join(output, 'mobile.png'), fullPage: true });
  const mobileBox = await page.locator('#map').boundingBox();
  const beforePinch = await page.evaluate(() => window.qaMap.getZoom());
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.synthesizePinchGesture', { x: mobileBox.x + mobileBox.width / 2, y: mobileBox.y + mobileBox.height / 2, scaleFactor: 1.6, gestureSourceType: 'touch' });
  await page.waitForTimeout(500);
  await ready();
  assert.ok(await page.evaluate(() => window.qaMap.getZoom()) > beforePinch, 'Touch pinch zoom');
  await checkRotationAndAlignment();
  assert.equal(await page.locator('[aria-labelledby="sources-title"] li').count(), 5);
  await page.setViewportSize({ width: 320, height: 568 });
  await page.waitForTimeout(300);
  await checkLayout();
  await ready();
  assert.deepEqual(outsideBase, []);
  assert.deepEqual(errors, []);
  assert.deepEqual(failures, []);
  assert.deepEqual(external, []);
  console.log('PASS: both selectors × 8 layers, 90° clockwise rotation, north compass, tile/vector alignment, blend endpoints and selections, exact page structure, compact responsive controls, prominent uncropped overview, stable thumb clicks, mouse/touch dragging, keyboard input, five-percent wheel input, standard hyperlink-blue accents, boundary-on default, challenge link, removed buttons, desktop/mobile layout and full labels, mouse pan, wheel/pinch zoom, bounds, repository-relative paths; no browser errors, HTTP errors, or external requests.');
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
