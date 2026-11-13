// Performance probe (run 58): how smooth is each scene on a slow phone?
//
//   npm run build && npm run perf
//
// Serves dist/ with `vite preview`, opens the game on an emulated iPhone with the CPU throttled (default 4x slower,
// roughly a low-end Android), opens every business and measures 4 s of animation frames in each scene: median and
// 95th-percentile frame time, share of slow frames (> 50 ms), Phaser texture count and JS heap. Prints a table and
// writes screenshots/perf.json. Exits 1 only if a scene is unusable (median frame > 500 ms = under 2 fps) or the
// page throws; the numbers are for tracking, not for tight thresholds. Headless Chromium has no GPU (software GL), so
// even 1x is ~12 fps here: compare runs with each other, never with a real phone.

const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, devices } = require('playwright');

const PORT = 4181;
const RATE = Number(process.env.PERF_CPU_RATE || 4);
const SHOTS = path.join(__dirname, '..', 'screenshots');

async function waitForServer(url, ms = 15000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('preview server did not start');
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
    cwd: path.join(__dirname, '..'),
    stdio: 'ignore',
    detached: true,
  });
  let browser;
  let failed = false;
  const errors = [];
  try {
    await waitForServer(`http://localhost:${PORT}/`);
    browser = await chromium.launch();
    const ctx = await browser.newContext({ ...devices['iPhone 13'] });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(String(e)));
    const cdp = await ctx.newCDPSession(page);
    await page.goto(`http://localhost:${PORT}/?debug=1`);
    await page.waitForFunction(() => window.__jye && window.__jye.game && window.__jye.game.isBooted);
    await page.waitForTimeout(1500);
    // A rich mid-game state: every business open, crew hired, plenty of cash so the scenes are busy.
    await page.evaluate(() => {
      const s = window.__jye.state;
      s.cash += 1e9;
      s.lifetimeEarnings += 1e9;
      for (const b of Object.keys(s.businesses.opened)) s.businesses.opened[b] = true;
    });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: RATE });

    const results = [];
    for (const biz of ['scrapyard', 'garage', 'carlot', 'paint']) {
      // Drive there through the city map like a player (the map button calls the scene switch).
      await page.evaluate(() => {
        window.__jye.state.tutorial.introSeen = true;
        document.querySelectorAll('.modal-back').forEach((m) => m.remove()); // intro / story popups
        window.__jye.ui.modalOpen = false; // the UI still thinks one is open
      });
      if ((await page.evaluate(() => window.__jye.state.businesses.active)) !== biz) {
        await page.click('.map-btn');
        await page.waitForSelector('.map-row', { timeout: 5000 }).catch(async () => { await page.screenshot({ path: path.join(SHOTS, 'perf-debug.png') }); throw new Error('map did not open; page errors: ' + errors.join(' | ')); });
        await page.waitForSelector(`.map-row[data-biz="${biz}"] button:not([disabled])`);
        await page.click(`.map-row[data-biz="${biz}"] button`);
        await page.waitForFunction((b) => window.__jye.state.businesses.active === b, biz);
      }
      await page.waitForTimeout(2500); // road wipe + first draws
      const r = await page.evaluate(
        () =>
          new Promise((resolve) => {
            const dts = [];
            let last = performance.now();
            const end = last + 4000;
            const tick = (now) => {
              dts.push(now - last);
              last = now;
              if (now < end) requestAnimationFrame(tick);
              else {
                dts.sort((a, b) => a - b);
                const q = (p) => dts[Math.min(dts.length - 1, Math.floor(dts.length * p))];
                const heap = performance.memory ? performance.memory.usedJSHeapSize / 1048576 : null;
                resolve({
                  frames: dts.length,
                  medianMs: +q(0.5).toFixed(1),
                  p95Ms: +q(0.95).toFixed(1),
                  slowShare: +(dts.filter((d) => d > 50).length / dts.length).toFixed(3),
                  activeScenes: window.__jye.game.scene.getScenes(true).map((x) => x.scene.key).join('+'),
                  textures: window.__jye.game.textures.getTextureKeys().length,
                  heapMB: heap === null ? null : +heap.toFixed(1),
                });
              }
            };
            requestAnimationFrame(tick);
          }),
      );
      results.push({ scene: biz, ...r });
    }
    console.log(`CPU throttle ${RATE}x`);
    console.table(results);
    fs.writeFileSync(path.join(SHOTS, 'perf.json'), JSON.stringify({ rate: RATE, results }, null, 2));
    for (const r of results) {
      if (r.medianMs > 500) throw new Error(`${r.scene} is stuck at ${RATE}x CPU: median frame ${r.medianMs} ms`);
    }
    if (errors.length) throw new Error('page errors: ' + errors.join(' | '));
    console.log('perf probe done');
  } catch (e) {
    failed = true;
    console.error(e);
  } finally {
    if (browser) await browser.close();
    try { process.kill(-server.pid); } catch {}
    process.exit(failed ? 1 : 0);
  }
})();
