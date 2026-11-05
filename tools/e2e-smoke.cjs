// Browser smoke test: builds must pass this before every push.
//
//   npm run build && npm run e2e
//
// Starts `vite preview`, plays the opening on an emulated iPhone in headless
// Chromium, checks the core loop, automation and save/reload, and fails on
// any page error. Screenshots go to screenshots/ (git-ignored).
//
// Uses the Playwright that is installed globally in the cloud workspace
// (NODE_PATH is set by the npm script). Locally: `npm i -g playwright` once.

const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, devices } = require('playwright');

const PORT = 4179;
const URL = `http://localhost:${PORT}/?debug=1`;
const SHOTS = path.join(__dirname, '..', 'screenshots');

function assert(cond, msg) {
  if (!cond) throw new Error('ASSERTION FAILED: ' + msg);
  console.log('  ok -', msg);
}

async function waitForServer(url, ms = 15000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
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
  });
  let browser;
  let failed = false;
  try {
    await waitForServer(`http://localhost:${PORT}/`);
    browser = await chromium.launch();
    const ctx = await browser.newContext({ ...devices['iPhone 13'] });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (m) => m.type() === 'error' && errors.push('console: ' + m.text()));

    console.log('first launch');
    await page.goto(URL);
    await page.waitForSelector('.modal .buy');
    await page.screenshot({ path: path.join(SHOTS, 'e2e-01-intro.png') });
    await page.click('.modal .buy');
    await page.waitForFunction(() => window.__jye.state.cars.length > 0);
    await page.waitForTimeout(800); // drive-in animation

    const geo = await page.evaluate(() => {
      const g = window.__jye.game;
      const b = g.scene.getScene('yard').bigCar.getBounds();
      const z = g.scale.zoom;
      const r = document.querySelector('#game canvas').getBoundingClientRect();
      return { x: r.x + b.centerX * z, y: r.y + b.centerY * z, w: b.width * z, h: b.height * z };
    });
    assert(geo.w > 100, 'big car is on screen');

    console.log('wash by swiping');
    await page.mouse.move(geo.x - geo.w * 0.35, geo.y);
    await page.mouse.down();
    for (let i = 0; i < 20; i++) {
      for (let s = 0; s <= 10; s++) {
        const f = i % 2 ? 1 - s / 10 : s / 10;
        await page.mouse.move(geo.x - geo.w * 0.35 + f * geo.w * 0.7, geo.y + ((s % 3) - 1) * geo.h * 0.15);
      }
      const dirt = await page.evaluate(() => window.__jye.state.cars[0]?.dirt ?? 0);
      if (dirt === 0) break;
    }
    await page.mouse.up();
    let car = await page.evaluate(() => window.__jye.state.cars[0]);
    assert(car.dirt === 0, 'swiping washes the car clean');

    console.log('repair by tapping');
    for (let i = 0; i < 10 && car.damage > 0; i++) {
      await page.mouse.click(geo.x, geo.y);
      await page.waitForTimeout(80);
      car = await page.evaluate(() => window.__jye.state.cars[0]);
    }
    assert(car.damage === 0, 'tapping repairs the car');
    await page.waitForSelector('.sell:not(.hidden)');
    await page.screenshot({ path: path.join(SHOTS, 'e2e-02-ready.png') });

    console.log('sell');
    const value = car.value;
    await page.click('.sell');
    await page.waitForTimeout(300);
    const after = await page.evaluate(() => ({ cash: window.__jye.state.cash, sold: window.__jye.state.carsSold }));
    assert(after.cash === value && after.sold === 1, `selling pays the car value (${value})`);
    const cashText = await page.textContent('.hud .cash');
    assert(cashText.startsWith('$'), `cash counter shows ${cashText}`);

    console.log('haggle');
    // Second sale ever is the haggle lesson: slow needle, always pays at least x1.2.
    await page.waitForFunction(() => window.__jye.state.cars.length > 0);
    await page.waitForTimeout(700);
    const lessonCar = await page.evaluate(() => {
      const c = window.__jye.state.cars[0];
      c.dirt = 0;
      c.damage = 0;
      c.rarity = 'common';
      return { value: c.value, cash: window.__jye.state.cash };
    });
    await page.waitForSelector('.sell:not(.hidden)');
    await page.click('.sell');
    await page.waitForSelector('.haggle:not(.hidden)');
    assert(await page.isHidden('.sell') || (await page.$eval('.sell', (e) => e.classList.contains('hidden'))), 'sell button hides while haggling');
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(SHOTS, 'e2e-08-haggle.png') });
    await page.click('.haggle');
    await page.waitForTimeout(150);
    const haggleText = await page.textContent('.haggle-label');
    await page.screenshot({ path: path.join(SHOTS, 'e2e-09-haggle-result.png') });
    await page.waitForFunction(() => window.__jye.state.carsSold === 2, null, { timeout: 3000 });
    const lessonPaid = await page.evaluate(() => window.__jye.state.cash);
    assert(lessonPaid - lessonCar.cash >= Math.round(lessonCar.value * 1.2), `lesson haggle pays at least x1.2 (${haggleText.trim()})`);
    assert(await page.$eval('.haggle', (e) => e.classList.contains('hidden')), 'haggle bar closes after the deal');

    console.log('customer personalities');
    assert(await page.$eval('.buyer', (e) => e.classList.contains('hidden')), 'no buyer strip before buyers unlock');
    await page.evaluate(() => (window.__jye.state.carsSold = 10));
    await page.waitForSelector('.buyer:not(.hidden)');
    await page.waitForFunction(() => window.__jye.state.buyer !== null, null, { timeout: 3000 });
    await page.waitForFunction(() => window.__jye.state.cars.length > 0);
    await page.waitForTimeout(700);
    const matchCar = await page.evaluate(() => {
      const s = window.__jye.state;
      s.buyer = { kind: 'speed', timeLeft: 60 };
      const c = s.cars[0];
      c.family = 'muscle';
      c.rarity = 'common';
      c.dirt = 0;
      c.damage = 0;
      return { value: c.value, cash: s.cash };
    });
    await page.waitForSelector('.sell.match:not(.hidden)');
    assert((await page.textContent('.buyer')).includes('Speed Freak'), 'buyer strip names the customer');
    assert(await page.$eval('.buyer', (e) => e.classList.contains('match')), 'buyer strip lights up for a matching car');
    await page.screenshot({ path: path.join(SHOTS, 'e2e-10-buyer.png') });
    await page.click('.sell');
    // A buyer match is a big sale: haggle opens. Let it time out (sells at asking price).
    await page.waitForSelector('.haggle:not(.hidden)');
    await page.waitForFunction(() => window.__jye.state.stats.buyersServed === 1, null, { timeout: 7000 });
    const buyerPaid = await page.evaluate(() => window.__jye.state.cash);
    assert(buyerPaid - matchCar.cash === Math.round(matchCar.value * 1.25), `Speed Freak pays the bonus (${buyerPaid - matchCar.cash})`);

    console.log('car crusher');
    let hasCrush = await page.evaluate(() => !document.querySelector('.crush').classList.contains('hidden'));
    assert(!hasCrush, 'crusher is hidden for a new player');
    await page.evaluate(() => (window.__jye.state.carsSold = 25));
    await page.waitForFunction(() => window.__jye.state.cars.length > 0 && window.__jye.state.crusherCooldown === 0);
    await page.evaluate(() => {
      const c = window.__jye.state.cars[0];
      c.rarity = 'common';
      c.dirt = 1;
    });
    await page.waitForSelector('.crush:not(.hidden):not(:disabled)');
    await page.waitForTimeout(400); // car drive-in
    assert(await page.isVisible('.hud .parts'), 'parts counter appears once the crusher unlocks');
    await page.click('.crush');
    await page.waitForTimeout(450);
    await page.screenshot({ path: path.join(SHOTS, 'e2e-06-crusher.png') });
    let crushed = await page.evaluate(() => ({ n: window.__jye.state.stats.carsCrushed, parts: window.__jye.state.parts }));
    assert(crushed.n === 1 && crushed.parts > 0, `crushing a wreck gives parts (${crushed.parts})`);
    await page.waitForTimeout(1200);
    // Epic cars ask before crushing.
    await page.waitForFunction(() => window.__jye.state.cars.length > 0 && window.__jye.state.crusherCooldown === 0, null, { timeout: 8000 });
    await page.evaluate(() => {
      const c = window.__jye.state.cars[0];
      c.rarity = 'epic';
      c.dirt = 1;
    });
    await page.waitForSelector('.crush:not(.hidden):not(:disabled)');
    await page.click('.crush');
    await page.waitForSelector('.modal .buy');
    assert((await page.textContent('.modal h2')).includes('Crush'), 'crushing an Epic car asks first');
    await page.click('.modal .buy');
    crushed = await page.evaluate(() => ({ n: window.__jye.state.stats.carsCrushed, cars: window.__jye.state.cars.length }));
    assert(crushed.n === 1 && crushed.cars === 1, '"Keep it" keeps the car');
    // Washing with parts in stock uses them.
    const used = await page.evaluate(() => {
      const s = window.__jye.state;
      const before = s.parts;
      const c = s.cars[0];
      c.dirt = 0.001;
      return before;
    });
    await page.mouse.move(geo.x - 50, geo.y);
    await page.mouse.down();
    await page.mouse.move(geo.x + 50, geo.y, { steps: 5 });
    await page.mouse.up();
    const partsNow = await page.evaluate(() => window.__jye.state.parts);
    assert(partsNow === used - 2, 'washing a car spends 2 spare parts');

    console.log('contracts board');
    let jobsVisible = await page.isVisible('.tab:nth-child(4)');
    assert(!jobsVisible, 'Jobs tab is hidden before contracts unlock');
    await page.evaluate(() => (window.__jye.state.carsSold = 45));
    await page.waitForSelector('.tab:nth-child(4)', { state: 'visible' });
    await page.click('.tab:nth-child(4)');
    await page.waitForFunction(() => document.querySelectorAll('.cards .contract').length === 3);
    const labels = await page.$$eval('.cards .contract .title', (els) => els.map((e) => e.textContent));
    assert(labels.every((l) => l && l.length > 4), `three orders on the board (${labels.join(' | ')})`);
    await page.evaluate(() => {
      const c = window.__jye.state.contracts[0];
      c.progress = c.target;
      c.status = 'done';
    });
    await page.waitForSelector('.cards .contract.ready .buy:not(:disabled)');
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(SHOTS, 'e2e-07-contracts.png') });
    const claim = await page.evaluate(() => ({ cash: window.__jye.state.cash, reward: window.__jye.state.contracts[0].rewardCash }));
    await page.click('.cards .contract.ready .buy');
    const claimed = await page.evaluate(() => ({ cash: window.__jye.state.cash, status: window.__jye.state.contracts[0].status }));
    assert(claimed.cash >= claim.cash + claim.reward && claimed.status === 'empty', `claiming pays ${claim.reward}`);

    console.log('upgrades, crew, slots');
    await page.evaluate(() => {
      const s = window.__jye.state;
      s.cash += 5e6;
      s.lifetimeEarnings += 5e6;
    });
    await page.click('.tab:nth-child(1)');
    await page.click('.cards .card:nth-child(1) .buy');
    let lv = await page.evaluate(() => window.__jye.state.levels.wash);
    assert(lv === 2, 'buying a Wash Bay upgrade raises its level');
    await page.click('.mode:has-text("Max")');
    await page.click('.cards .card:nth-child(2) .buy');
    lv = await page.evaluate(() => window.__jye.state.levels.repair);
    assert(lv > 10, `Max buys many Repair Bench levels (${lv})`);
    await page.click('.tab:nth-child(2)');
    for (const n of [1, 2, 3]) await page.click(`.cards .card:nth-child(${n}) .buy`);
    const m = await page.evaluate(() => window.__jye.state.managers);
    assert(m.mechanic && m.washer && m.seller, 'all three crew members hired');
    await page.click('.tab:nth-child(3)');
    await page.click('.cards .card:nth-child(1) .buy');
    const slots = await page.evaluate(() => window.__jye.state.slots);
    assert(slots === 2, 'lot space bought');

    console.log('automation runs on its own');
    const soldBefore = await page.evaluate(() => window.__jye.state.carsSold);
    await page.waitForFunction((n) => window.__jye.state.carsSold > n, soldBefore, { timeout: 30000 });
    assert(true, 'crew sold a car without input');
    await page.screenshot({ path: path.join(SHOTS, 'e2e-03-automated.png') });

    console.log('save and reload');
    const before = await page.evaluate(() => {
      window.__jye.saveNow();
      return { sold: window.__jye.state.carsSold, repair: window.__jye.state.levels.repair };
    });
    await page.reload();
    await page.waitForFunction(() => window.__jye && window.__jye.state);
    const reloaded = await page.evaluate(() => ({
      sold: window.__jye.state.carsSold,
      repair: window.__jye.state.levels.repair,
      intro: window.__jye.state.tutorial.introSeen,
    }));
    assert(reloaded.sold >= before.sold && reloaded.repair === before.repair, 'progress survives a reload');
    assert(reloaded.intro, 'intro is not shown again');

    console.log('offline earnings');
    // Simulate leaving: set lastSeen an hour back in the save, then reload.
    await page.evaluate(() => {
      const s = window.__jye.state;
      s.lastSeen = Date.now() - 3600 * 1000;
    });
    await page.evaluate(() => {
      // Write the save directly without touching lastSeen.
      const { state } = window.__jye;
      const data = JSON.stringify(state);
      let h = 0x811c9dc5;
      for (let i = 0; i < data.length; i++) { h ^= data.charCodeAt(i); h = Math.imul(h, 0x01000193); }
      const env = JSON.stringify({ v: state.version, savedAt: Date.now() + 10, sum: (h >>> 0).toString(16).padStart(8, '0'), data });
      localStorage.setItem('jye_save_a', env);
      localStorage.setItem('jye_save_b', env);
    });
    await page.reload();
    await page.waitForSelector('.modal .buy', { timeout: 5000 });
    const title = await page.textContent('.modal h2');
    assert(title.includes('Welcome back'), 'welcome-back popup appears after an hour away');
    await page.screenshot({ path: path.join(SHOTS, 'e2e-04-offline.png') });
    const cashBefore = await page.evaluate(() => window.__jye.state.cash);
    await page.click('.modal .buy');
    const cashAfter = await page.evaluate(() => window.__jye.state.cash);
    assert(cashAfter > cashBefore, 'collecting adds offline earnings');

    console.log('desktop layout');
    const d = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    d.on('pageerror', (e) => errors.push('desktop pageerror: ' + e.message));
    await d.goto(`http://localhost:${PORT}/`);
    await d.waitForTimeout(1200);
    await d.screenshot({ path: path.join(SHOTS, 'e2e-05-desktop.png') });

    assert(errors.length === 0, 'no page or console errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
    console.log('\nE2E PASSED');
  } catch (e) {
    failed = true;
    console.error('\nE2E FAILED:', e.message);
  } finally {
    await browser?.close();
    server.kill();
    process.exit(failed ? 1 : 0);
  }
})();
