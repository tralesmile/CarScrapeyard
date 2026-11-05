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
    await page.waitForTimeout(1300); // walk-in
    const figure = await page.evaluate(() => {
      const sc = window.__jye.game.scene.getScene('yard');
      const b = sc.buyerSprite;
      return b ? { kind: b.getData('kind'), x: b.x, w: sc.scale.width, visible: b.visible } : null;
    });
    assert(figure && figure.kind === 'speed' && figure.visible && figure.x > figure.w * 0.5 && figure.x < figure.w, 'the customer stands in the yard');
    await page.screenshot({ path: path.join(SHOTS, 'e2e-10-buyer.png') });
    await page.click('.sell');
    // A buyer match is a big sale: haggle opens. Let it time out (sells at asking price).
    await page.waitForSelector('.haggle:not(.hidden)');
    await page.waitForFunction(() => window.__jye.state.stats.buyersServed === 1, null, { timeout: 7000 });
    const buyerPaid = await page.evaluate(() => window.__jye.state.cash);
    assert(buyerPaid - matchCar.cash === Math.round(matchCar.value * 1.25), `Speed Freak pays the bonus (${buyerPaid - matchCar.cash})`);

    console.log('new car families');
    await page.evaluate(() => {
      window.__vib = [];
      // Phaser copies vibrate onto navigator itself, so stub the own property.
      navigator.vibrate = (p) => (window.__vib.push(p), true);
    });
    await page.waitForFunction(() => window.__jye.state.cars.length > 0);
    await page.waitForTimeout(700);
    await page.evaluate(() => {
      const s = window.__jye.state;
      s.carsSold = 14;
      s.buyer = null;
      const c = s.cars[0];
      c.rarity = 'common';
      c.dirt = 0;
      c.damage = 0;
    });
    await page.waitForSelector('.sell:not(.hidden)');
    await page.click('.sell');
    if (await page.$('.haggle:not(.hidden)')) await page.click('.haggle');
    await page.waitForFunction(() => window.__jye.state.carsSold === 15, null, { timeout: 7000 });
    await page.waitForFunction(() => document.querySelector('.banner')?.textContent.includes('NEW CARS'), null, { timeout: 4000 });
    assert((await page.textContent('.banner')).includes('Vans'), 'selling car #15 announces Vans');
    assert(await page.evaluate(() => window.__vib.length > 0), 'haptics fire on sales and taps (navigator.vibrate)');

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
    // "+6 Parts" and "+$110" land together: they must stack, not overlap.
    await page.waitForFunction(() => window.__jye.game.scene.getScene('yard').children.list.filter((o) => o.type === 'Text' && /^\+/.test(o.text)).length >= 2, null, { timeout: 3000 });
    const overlaps = await page.evaluate(() => {
      const texts = window.__jye.game.scene.getScene('yard').children.list.filter((o) => o.type === 'Text' && /^\+/.test(o.text));
      const r = texts.map((t) => t.getBounds());
      let n = 0;
      for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++) {
        const a = r[i], b = r[j];
        const ix = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const iy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (ix > 0 && iy > a.height * 0.25) n++;
      }
      return { n, texts: texts.map((t) => t.text) };
    });
    assert(overlaps.n === 0, `reward texts stack without overlapping (${overlaps.texts.join(' / ')})`);
    await page.screenshot({ path: path.join(SHOTS, 'e2e-06b-crush-rewards.png') });
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
    // Free reroll: the second order swaps once, then the button goes back to "In progress".
    const before2 = await page.evaluate(() => ({ id: window.__jye.state.contracts[1].id, label: document.querySelectorAll('.cards .contract .title')[1].textContent }));
    assert((await page.textContent('.cards .contract:nth-child(2) .buy')).includes('Swap'), 'active orders offer a free swap');
    await page.click('.cards .contract:nth-child(2) .buy');
    const after2 = await page.evaluate(() => ({ id: window.__jye.state.contracts[1].id, rerolled: window.__jye.state.contracts[1].rerolled }));
    await page.waitForTimeout(150);
    const btn2 = await page.$eval('.cards .contract:nth-child(2) .buy', (b) => ({ text: b.textContent, disabled: b.disabled }));
    const label2 = await page.$$eval('.cards .contract .title', (els) => els[1].textContent);
    assert(after2.id !== before2.id && after2.rerolled && btn2.disabled && btn2.text.includes('In progress'), `swap gives a new order once (${before2.label} -> ${label2})`);
    await page.evaluate(() => {
      const c = window.__jye.state.contracts[0];
      c.progress = c.target;
      c.status = 'done';
    });
    await page.waitForSelector('.cards .contract.ready .buy:not(:disabled)');
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(SHOTS, 'e2e-07-contracts.png') });
    assert(!(await page.$eval('.cards .contract.ready .buy', (b) => b.classList.contains('swap'))), 'a finished order shows a normal Claim button (no swap style)');
    const claim = await page.evaluate(() => ({ cash: window.__jye.state.cash, reward: window.__jye.state.contracts[0].rewardCash }));
    await page.click('.cards .contract.ready .buy');
    const claimed = await page.evaluate(() => ({ cash: window.__jye.state.cash, status: window.__jye.state.contracts[0].status }));
    assert(claimed.cash >= claim.cash + claim.reward && claimed.status === 'empty', `claiming pays ${claim.reward}`);

    console.log('barn find');
    await page.click('.tab:nth-child(3)');
    await page.waitForSelector('.cards .barn');
    assert((await page.textContent('.cards .barn .buy')).includes('Locked'), 'barn card is locked before 60 sales');
    await page.evaluate(() => (window.__jye.state.carsSold = 60));
    await page.waitForFunction(() => window.__jye.state.barn.status === 'covered');
    await page.waitForTimeout(3200); // unlock banner
    await page.screenshot({ path: path.join(SHOTS, 'e2e-11-barn.png') });
    // Tapping the barn in the yard opens the Yard tab.
    await page.click('.tab:nth-child(1)');
    const barnPt = await page.evaluate(() => {
      const g = window.__jye.game;
      const r = g.scene.getScene('yard').barnRect;
      const z = g.scale.zoom;
      const c = document.querySelector('#game canvas').getBoundingClientRect();
      return { x: c.x + r.centerX * z, y: c.y + (r.y + r.height * 0.6) * z };
    });
    await page.mouse.click(barnPt.x, barnPt.y);
    await page.waitForSelector('.cards .barn');
    assert(true, 'tapping the barn opens the Yard tab');
    await page.evaluate(() => {
      const s = window.__jye.state;
      s.cash += 1e7;
      s.lifetimeEarnings += 1e7;
      s.parts += 100;
    });
    for (let i = 0; i < 4; i++) {
      await page.waitForSelector('.cards .barn .buy:not(:disabled)');
      await page.click('.cards .barn .buy');
      const st = await page.evaluate(() => window.__jye.state.barn.status);
      if (i === 0) assert(st === 'working', 'starting a stage pays and runs the timer');
      await page.evaluate(() => (window.__jye.state.barn.timeLeft = 0.05));
      await page.waitForFunction((n) => window.__jye.state.barn.stage === n, i + 1);
    }
    await page.waitForFunction(() => window.__jye.state.barn.status === 'finished');
    assert((await page.textContent('.cards .barn .buy')).includes('Reveal'), 'finished restoration offers a reveal');
    await page.click('.cards .barn .buy');
    await page.waitForSelector('.modal-back.reveal .modal .buy', { timeout: 5000 });
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(SHOTS, 'e2e-12-barn-reveal.png') });
    const sale = await page.evaluate(() => ({ cash: window.__jye.state.cash, value: window.__jye.state.barn.value }));
    assert(sale.value > 0, `reveal fixes the price (${sale.value})`);
    await page.click('.modal .buy');
    const sold = await page.evaluate(() => ({ cash: window.__jye.state.cash, status: window.__jye.state.barn.status, n: window.__jye.state.barn.restored }));
    assert(sold.cash >= sale.cash + sale.value && sold.status === 'away' && sold.n === 1, 'selling the classic pays and the barn waits for the next find');
    await page.waitForTimeout(500);

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
    await page.click('.mode:has-text("x1")');
    assert(await page.isVisible('.cards .card:nth-child(4)'), 'Hydraulic Press card shows once the crusher is unlocked');
    const pressDesc0 = await page.textContent('.cards .card:nth-child(4) .desc');
    await page.click('.cards .card:nth-child(4) .buy');
    const pressDesc1 = await page.textContent('.cards .card:nth-child(4) .desc');
    assert((await page.evaluate(() => window.__jye.state.levels.press)) === 2 && pressDesc0 !== pressDesc1, `Hydraulic Press upgrade (${pressDesc1.trim()})`);
    await page.click('.tab:nth-child(2)');
    for (const n of [1, 2, 3, 4]) await page.click(`.cards .card:nth-child(${n}) .buy`);
    const m = await page.evaluate(() => window.__jye.state.managers);
    assert(m.mechanic && m.washer && m.seller, 'all three crew members hired');
    assert(m.scrapper, 'Scrapper hired');
    await page.click('.tab:nth-child(3)');
    await page.click('.cards .card:nth-child(1) .buy');
    const slots = await page.evaluate(() => window.__jye.state.slots);
    assert(slots === 2, 'lot space bought');

    console.log('automation runs on its own');
    const soldBefore = await page.evaluate(() => window.__jye.state.carsSold);
    await page.waitForFunction((n) => window.__jye.state.carsSold > n, soldBefore, { timeout: 30000 });
    assert(true, 'crew sold a car without input');
    await page.screenshot({ path: path.join(SHOTS, 'e2e-03-automated.png') });

    console.log('scrapper');
    const crushedBefore = await page.evaluate(() => {
      const s = window.__jye.state;
      s.parts = 0;
      s.scrapperRest = 0;
      return s.stats.carsCrushed;
    });
    await page.waitForFunction((n) => window.__jye.state.stats.carsCrushed > n, crushedBefore, { timeout: 20000 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(SHOTS, 'e2e-15-scrapper.png') });
    const afterScrap = await page.evaluate(() => ({ parts: window.__jye.state.parts, rest: window.__jye.state.scrapperRest }));
    assert(afterScrap.parts > 0 && afterScrap.rest > 0, `Scrapper crushes a wreck when parts run low (+${afterScrap.parts} parts)`);

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

    console.log('settings');
    await page.evaluate(() => {
      window.__vib = [];
      navigator.vibrate = (p) => (window.__vib.push(p), true);
    });
    await page.click('.settings-btn');
    await page.waitForSelector('.modal.settings');
    await page.screenshot({ path: path.join(SHOTS, 'e2e-13-settings.png') });
    await page.click('.toggle[aria-label="Reduce motion"]');
    const calm = await page.evaluate(() => ({ s: window.__jye.state.settings.reduceMotion, cls: document.getElementById('ui').classList.contains('reduce-motion') }));
    assert(calm.s && calm.cls, 'reduce motion switches on');
    await page.click('.seg-btn[data-fmt="scientific"]');
    await page.waitForFunction(() => /e\d/.test(document.querySelector('.hud .cash').textContent));
    assert(true, `scientific numbers in the top bar (${await page.textContent('.hud .cash')})`);
    await page.click('.seg-btn[data-fmt="short"]');
    await page.click('.toggle[aria-label="Sound effects"]');
    assert((await page.textContent('.hud .icon-btn')).includes('🔇'), 'sound toggle mutes the game');
    await page.click('.toggle[aria-label="Sound effects"]');
    await page.click('.toggle[aria-label="Vibration"]');
    assert(await page.evaluate(() => window.__jye.state.settings.vibration === false), 'vibration switches off');
    const vibCount = await page.evaluate(() => window.__vib.length);
    await page.click('.seg-btn[data-fmt="short"]');
    assert(await page.evaluate((n) => window.__vib.length === n, vibCount), 'no haptics while vibration is off');
    await page.click('.toggle[aria-label="Vibration"]');
    assert(await page.evaluate((n) => window.__jye.state.settings.vibration && window.__vib.length > n, vibCount), 'vibration switches back on with a test buzz');
    await page.click('.toggle[aria-label="Skip haggling"]');
    await page.click('.modal.settings .buy');
    assert(!(await page.$('.modal.settings')), 'Done closes the settings');
    // Skip haggling: a Rare car sells straight away at the asking price.
    await page.evaluate(() => {
      const s = window.__jye.state;
      s.managers.seller = false;
      s.buyer = null;
    });
    await page.waitForFunction(() => window.__jye.state.cars.length > 0);
    const rareSale = await page.evaluate(() => {
      const s = window.__jye.state;
      const c = s.cars.find((x) => x.id === s.focusedId) ?? s.cars[0];
      s.focusedId = c.id;
      c.rarity = 'rare';
      c.dirt = 0;
      c.damage = 0;
      return { sold: s.carsSold, cash: s.cash, value: c.value };
    });
    await page.waitForSelector('.sell:not(.hidden)');
    await page.click('.sell');
    await page.waitForTimeout(200);
    const afterRare = await page.evaluate(() => ({ sold: window.__jye.state.carsSold, cash: window.__jye.state.cash }));
    const haggleHidden = await page.$eval('.haggle', (e) => e.classList.contains('hidden'));
    assert(haggleHidden && afterRare.sold === rareSale.sold + 1 && afterRare.cash - rareSale.cash === rareSale.value, 'skip haggling sells a Rare car at the asking price, no slider');
    await page.evaluate(() => (window.__jye.state.managers.seller = true));
    await page.evaluate(() => window.__jye.saveNow());
    await page.reload();
    await page.waitForFunction(() => window.__jye && window.__jye.state);
    assert(await page.evaluate(() => window.__jye.state.settings.reduceMotion === true), 'settings survive a reload');
    // Reset: "Keep playing" keeps everything, "Delete everything" starts over.
    await page.waitForTimeout(300);
    if (await page.$('.modal .buy')) await page.click('.modal .buy'); // welcome-back after the reload
    const soldNow = await page.evaluate(() => window.__jye.state.carsSold);
    await page.click('.settings-btn');
    await page.click('.modal .danger');
    await page.waitForSelector('.modal h2:has-text("Start over")');
    await page.click('.modal .buy');
    assert((await page.evaluate(() => window.__jye.state.carsSold)) === soldNow, '"Keep playing" keeps progress');
    await page.click('.settings-btn');
    await page.click('.modal .danger');
    await page.waitForSelector('.modal h2:has-text("Start over")');
    await Promise.all([page.waitForNavigation(), page.click('.modal .secondary')]);
    await page.waitForFunction(() => window.__jye && window.__jye.state);
    const fresh = await page.evaluate(() => ({ sold: window.__jye.state.carsSold, cash: window.__jye.state.cash, intro: window.__jye.state.tutorial.introSeen }));
    assert(fresh.sold === 0 && fresh.cash === 0 && !fresh.intro, 'reset progress starts a new game');

    console.log('car art gallery');
    const gal = await ctx.newPage();
    gal.on('pageerror', (e) => errors.push('gallery pageerror: ' + e.message));
    await gal.goto(URL + '&gallery=1');
    await gal.waitForSelector('.car-gallery canvas');
    await gal.waitForTimeout(300);
    const art = await gal.evaluate(() =>
      [...document.querySelectorAll('.car-gallery canvas[data-family]')].map((c) => {
        const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
        let solid = 0;
        let soft = 0;
        for (let i = 3; i < d.length; i += 4) {
          if (d[i] === 255) solid++;
          else if (d[i] > 0) soft++;
        }
        return { family: c.dataset.family, solid, soft };
      }),
    );
    const fams = [...new Set(art.map((a) => a.family))];
    assert(fams.length === 8, `gallery draws all 8 families (${fams.join(', ')})`);
    const buyerArt = await gal.$$eval('.car-gallery canvas[data-buyer]', (cs) => cs.map((c) => c.dataset.buyer));
    assert(buyerArt.length === 6, `gallery draws all 6 customers (${buyerArt.join(', ')})`);
    assert(art.every((a) => a.solid > 5000), 'every car has a solid body');
    assert(art.every((a) => a.soft > 200), 'car edges are antialiased (soft edge pixels)');
    await gal.screenshot({ path: path.join(SHOTS, 'e2e-14-car-gallery.png') });
    await gal.close();

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
