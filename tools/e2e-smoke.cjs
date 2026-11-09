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
    // Own process group, so the cleanup below also stops vite (a plain kill only stops npx and left vite running).
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
    // The map button used to be drawn from the start: `.hidden` had no CSS rule for icon buttons (found in run 20).
    assert(await page.$eval('.map-btn', (e) => getComputedStyle(e).display === 'none'), 'the map button is really hidden before 30 sales');

    // Art pass (P0.14h): power-of-two car textures with trilinear mipmaps, and a Canvas 2D backdrop.
    const art14h = await page.evaluate(() => {
      const g = window.__jye.game;
      const sc = g.scene.getScene('yard');
      const src = sc.bigCar.texture.source[0];
      const gl = g.renderer.gl;
      const glt = src.glTexture;
      const bd = sc.textures.get('backdrop');
      return {
        aa: g.renderer.config.antialias === true,
        w: src.width,
        h: src.height,
        mip: !!gl && !!glt && glt.minFilter === gl.LINEAR_MIPMAP_LINEAR,
        backdrop: sc.bg.texture.key,
        canvas: !!bd && bd.source[0].isCanvas,
        full: !!bd && bd.source[0].width === g.scale.width,
      };
    });
    const pot = (n) => n > 0 && (n & (n - 1)) === 0;
    assert(pot(art14h.w) && pot(art14h.h), `bay car texture is a power of two (${art14h.w}x${art14h.h})`);
    assert(art14h.aa, 'textures use smooth (linear) filtering, not pixel-art mode');
    assert(art14h.mip, 'bay car texture is mipmapped (trilinear)');
    assert(art14h.backdrop === 'backdrop' && art14h.canvas && art14h.full, 'backdrop is one Canvas 2D texture the size of the game');
    const rvGround = await page.evaluate(() => {
      const img = window.__jye.game.textures.get('backdrop').getSourceImage();
      return Array.from(img.getContext('2d').getImageData(4, img.height - 4, 1, 1).data.slice(0, 3));
    });
    assert(rvGround[0] > rvGround[2], `the Rust Valley yard is warm dirt (ground rgb ${rvGround.join(',')})`);

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
    await page.waitForTimeout(600);
    const lay = await page.evaluate(() => {
      const sc = window.__jye.game.scene.getScene('yard');
      const ins = sc.bridge.insets();
      return { used: sc.layoutInsets, now: `${Math.round(ins.top)},${Math.round(ins.bottom)}`, stripBottom: document.querySelector('.buyer').getBoundingClientRect().bottom, slotTop: sc.focusArea().slotY };
    });
    assert(lay.used === lay.now && lay.slotTop >= lay.stripBottom, `the yard lays out again below the customer strip (${lay.used}; slots at ${Math.round(lay.slotTop)} >= strip ${Math.round(lay.stripBottom)})`);
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

    console.log('collection hook');
    const quiet = await page.evaluate(() => ({ ...window.__jye.state.collection.sold }));
    assert(Object.values(quiet).reduce((a, b) => a + b, 0) >= 3 && quiet.van === 0, `sales are counted per family (${JSON.stringify(quiet)})`);
    await page.waitForFunction(() => window.__jye.state.cars.length > 0);
    await page.evaluate(() => {
      const s = window.__jye.state;
      s.buyer = null;
      const c = s.cars.find((x) => x.id === s.focusedId) ?? s.cars[0];
      s.focusedId = c.id;
      c.family = 'van';
      c.rarity = 'common';
      c.dirt = 0;
      c.damage = 0;
    });
    await page.waitForSelector('.sell:not(.hidden)');
    await page.click('.sell');
    if (await page.$('.haggle:not(.hidden)')) await page.click('.haggle');
    await page.waitForFunction(() => window.__jye.state.collection.sold.van === 1, null, { timeout: 7000 });
    await page.waitForFunction(() => [...document.querySelectorAll('.toast')].some((t) => t.textContent.includes('First Van sold')), null, { timeout: 4000 });
    const toastText = await page.evaluate(() => [...document.querySelectorAll('.toast')].map((t) => t.textContent).find((t) => t.includes('First Van')));
    assert(/Collection: \d\/8/.test(toastText), `first Van sold shows a Collection toast (${toastText})`);

    console.log('collection book');
    // Three Van models are already in the book; selling the fourth completes the Van set (P1.4a).
    const vanModels = ['Kaze Caravan', 'Vortex Shuttle', 'Regalia Nomad', 'Stallion Courier'];
    await page.waitForTimeout(3600); // let the Van toast and any banner pass
    await page.waitForFunction(() => window.__jye.state.cars.length > 0);
    const bookBefore = await page.evaluate((models) => {
      const s = window.__jye.state;
      const collected = Object.values(s.collection.models).filter((e) => e.sold > 0).length;
      for (const m of models.slice(0, 3)) if (s.collection.models[m].sold === 0) s.collection.models[m] = { sold: 1, best: 0 };
      s.collection.models[models[3]] = { sold: 0, best: -1 };
      s.buyer = null;
      const c = s.cars.find((x) => x.id === s.focusedId) ?? s.cars[0];
      s.focusedId = c.id;
      c.family = 'van';
      c.model = models[3];
      c.rarity = 'rare';
      c.dirt = 0;
      c.damage = 0;
      return { collected, entries: Object.keys(s.collection.models).length };
    }, vanModels);
    assert(bookBefore.entries === 48 && bookBefore.collected >= 1, `the book has 48 entries and the cars sold so far are in it (${JSON.stringify(bookBefore)})`);
    await page.waitForSelector('.sell:not(.hidden)');
    await page.click('.sell');
    if (await page.$('.haggle:not(.hidden)')) await page.click('.haggle');
    // Banners queue, and the e2e's earlier sales may have completed another set first: wait for the Van one.
    await page.waitForFunction(() => /SET COMPLETE.*Van set/.test(document.querySelector('.banner')?.textContent ?? ''), null, { timeout: 12000 });
    const setBanner = await page.textContent('.banner');
    await page.screenshot({ path: path.join(SHOTS, 'e2e-03b-set-complete.png') });
    assert(/Van set: \+5% Van value/.test(setBanner), `selling the 4th Van model completes the Van set (${setBanner.trim()})`);
    const courier = await page.evaluate(() => window.__jye.state.collection.models['Stallion Courier']);
    assert(courier.sold === 1 && courier.best === 1, `the sale is in the book with its rarity (${JSON.stringify(courier)})`);
    await page.waitForTimeout(3200); // let the banner pass

    console.log('collection book screen (P1.4b)');
    const early = await page.evaluate(() => window.__jye.state.carsSold);
    if (early <= 10) assert(!(await page.isVisible('.book-btn')), `the 📒 button waits for the quiet tutorial sales (${early} sold)`);
    await page.evaluate(() => {
      const s = window.__jye.state;
      s.carsSold = Math.max(s.carsSold, 11);
    });
    await page.waitForSelector('.book-btn:not(.hidden)', { timeout: 3000 });
    assert(await page.isVisible('.book-btn .dot.on'), 'the 📒 button shows a red dot for new entries');
    await page.click('.book-btn');
    await page.waitForSelector('.book .modal .book-card');
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(SHOTS, 'e2e-03c-book.png') });
    const bookUi = await page.evaluate(() => {
      const van = document.querySelector('.book-set[data-set="family:van"]');
      const courier = document.querySelector('.book-card[data-model="Stallion Courier"]');
      const missing = document.querySelector('.book-card.missing');
      return {
        head: document.querySelector('.book-head').textContent,
        sets: document.querySelectorAll('.book-set').length,
        vanDone: van?.classList.contains('complete'),
        vanGot: van?.querySelectorAll('.book-card.got').length,
        courier: courier?.textContent,
        courierImg: courier?.querySelector('img').src.slice(0, 21),
        missing: missing?.textContent,
        unseen: Object.values(window.__jye.state.collection.models).filter((e) => e.sold > 0 && !e.seen).length,
      };
    });
    assert(/\d+\/48 cars · \d+\/13 sets complete/.test(bookUi.head) && bookUi.sets === 8, `the book opens on the car types page (${bookUi.head}, ${bookUi.sets} sets)`);
    assert(bookUi.vanDone && bookUi.vanGot === 4, 'the completed Van set is highlighted with its four cars');
    assert(/NEW/.test(bookUi.courier) && /Rare/.test(bookUi.courier) && /1 sold · 10 for/.test(bookUi.courier), `a new entry shows NEW, its best rarity and mastery progress (${bookUi.courier})`);
    assert(bookUi.courierImg === 'data:image/png;base64', 'cards show a painted car thumbnail');
    assert(/\?\?\?.*Not found yet/.test(bookUi.missing), `cars not found yet are silhouettes (${bookUi.missing})`);
    assert(bookUi.unseen === 0, 'opening the book marks every entry as seen');
    await page.click('.book-tabs [data-page="classics"]');
    const classicCards = await page.$$eval('.book-set .book-card', (cs) => cs.length);
    assert(classicCards === 16, `the Classics page lists the 16 barn classics (${classicCards})`);
    await page.click('.book .modal .buy');
    await page.waitForSelector('.book .modal', { state: 'detached' });
    assert(!(await page.isVisible('.book-btn .dot.on')), 'the red dot clears after the visit');

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
    // Record the reward texts every frame from the click on: the 3x screenshot below can outlast their 1.3 s life.
    await page.evaluate(() => {
      const rec = (window.__floatRec = { max: 0, n: 0, texts: [] });
      const t0 = performance.now();
      const frame = () => {
        const texts = window.__jye.game.scene.getScene('yard').children.list.filter((o) => o.type === 'Text' && /^\+/.test(o.text));
        if (texts.length > rec.max) {
          const r = texts.map((t) => t.getBounds());
          let n = 0;
          for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++) {
            const a = r[i], b = r[j];
            const ix = Math.min(a.right, b.right) - Math.max(a.left, b.left);
            const iy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
            if (ix > 0 && iy > a.height * 0.25) n++;
          }
          Object.assign(rec, { max: texts.length, n, texts: texts.map((t) => t.text) });
        }
        if (performance.now() - t0 < 4000) requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    });
    await page.click('.crush');
    await page.waitForTimeout(450);
    await page.screenshot({ path: path.join(SHOTS, 'e2e-06-crusher.png') });
    let crushed = await page.evaluate(() => ({ n: window.__jye.state.stats.carsCrushed, parts: window.__jye.state.parts }));
    assert(crushed.n === 1 && crushed.parts > 0, `crushing a wreck gives parts (${crushed.parts})`);
    // "+6 Parts" and "+$110" land together: they must stack, not overlap.
    await page.waitForFunction(() => window.__floatRec.max >= 2, null, { timeout: 4000 });
    const overlaps = await page.evaluate(() => window.__floatRec);
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

    console.log('city map');
    await page.waitForSelector('.map-btn:not(.hidden)');
    assert(await page.isVisible('.map-btn .dot.on'), 'map button appears after 30 sales with a red dot');
    const lifeBefore = await page.evaluate(() => window.__jye.state.lifetimeEarnings);
    await page.evaluate(() => (window.__jye.state.lifetimeEarnings = Math.max(window.__jye.state.lifetimeEarnings, 80000)));
    await page.waitForTimeout(3200); // let the unlock banners pass
    await page.click('.map-btn');
    await page.waitForSelector('.modal.city-map .city-svg');
    const mapInfo = await page.evaluate(() => ({
      plots: [...document.querySelectorAll('.city-svg .plot')].map((g) => g.getAttribute('data-biz') + ':' + g.getAttribute('class')),
      rows: [...document.querySelectorAll('.map-row')].map((r) => r.dataset.biz + ':' + r.querySelector('.map-line').textContent),
      bar: document.querySelector('.map-row[data-biz="garage"] .bar > i')?.style.width,
      pins: document.querySelectorAll('.city-svg .pin').length,
      seen: window.__jye.state.tutorial.mapSeen,
      svgBox: document.querySelector('.city-svg').getBoundingClientRect().toJSON(),
      modalBox: document.querySelector('.modal.city-map').getBoundingClientRect().toJSON(),
      titleTop: document.querySelector('.modal.city-map h2').getBoundingClientRect().top,
      backBottom: document.querySelector('.modal.city-map > .buy').getBoundingClientRect().bottom,
    }));
    assert(mapInfo.plots.length === 4 && mapInfo.plots[0] === 'scrapyard:plot open', `map draws four businesses (${mapInfo.plots.join(', ')})`);
    assert(mapInfo.rows[0] === 'scrapyard:You are here' && mapInfo.pins === 1, 'the scrapyard is marked "You are here" with one pin');
    assert(mapInfo.rows[1].startsWith('garage:Earn $200K') && mapInfo.bar === '40%', `the Repair Garage is locked with its goal and progress (${mapInfo.rows[1]}, ${mapInfo.bar})`);
    assert(mapInfo.seen, 'opening the map marks it seen');
    assert(mapInfo.svgBox.width > 300 && mapInfo.svgBox.right <= 390 && mapInfo.modalBox.bottom <= 844 && mapInfo.titleTop >= mapInfo.modalBox.top && mapInfo.backBottom <= mapInfo.modalBox.bottom, `map, title and Back button fit the phone screen (${Math.round(mapInfo.svgBox.width)}px wide)`);
    await page.screenshot({ path: path.join(SHOTS, 'e2e-16-city-map.png') });
    await page.evaluate(() => (window.__jye.state.lifetimeEarnings = Math.max(window.__jye.state.lifetimeEarnings, 200000)));
    await page.waitForFunction(() => document.querySelector('.map-row[data-biz="garage"]')?.classList.contains('forSale'), null, { timeout: 2000 });
    const forSale = await page.evaluate(() => {
      const b = document.querySelector('.map-row[data-biz="garage"] button');
      return {
        line: document.querySelector('.map-row[data-biz="garage"] .map-line').textContent,
        btn: b?.textContent,
        disabled: b?.disabled,
        sign: document.querySelector('.city-svg .plot[data-biz="garage"]').textContent,
        cash: window.__jye.state.cash,
      };
    });
    assert(forSale.line === "Ready to open" && forSale.btn === "Open $100K" && forSale.sign.includes("FOR SALE"), `reaching the goal puts the garage up for sale (${forSale.btn})`);
    assert(forSale.disabled === forSale.cash < 100000, 'the Open button is disabled while cash is short');
    await page.click('.modal.city-map > .buy');
    await page.waitForSelector('.modal.city-map', { state: 'detached' });
    assert(!(await page.isVisible('.map-btn .dot.on')), 'the map dot clears after the first visit');
    await page.evaluate((v) => (window.__jye.state.lifetimeEarnings = Math.max(v, window.__jye.state.cash)), lifeBefore);

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
    assert(await page.isVisible('.cards .card:nth-child(1).barn'), 'the barn card leads the Yard tab once the barn is open');
    const inView = await page.$eval('.cards .card.barn', (c) => {
      // The whole card, including its button, fits on the phone screen.
      const r = c.querySelector('.buy').getBoundingClientRect();
      return r.top >= 0 && r.bottom <= window.innerHeight;
    });
    assert(inView, 'the barn card is on screen after tapping the barn');
    await page.evaluate(() => {
      const s = window.__jye.state;
      s.cash += 1e7;
      s.lifetimeEarnings += 1e7;
      s.parts += 100;
    });
    await page.waitForTimeout(150);
    assert(await page.evaluate(() => window.__jye.game.scene.getScene('yard').barnDot.visible), 'a red dot on the barn sign shows a stage is affordable');
    for (let i = 0; i < 4; i++) {
      await page.waitForSelector('.cards .barn .buy:not(:disabled)');
      await page.click('.cards .barn .buy');
      const st = await page.evaluate(() => window.__jye.state.barn.status);
      if (i === 0) assert(st === 'working', 'starting a stage pays and runs the timer');
      await page.waitForTimeout(150);
      const barnTex = await page.evaluate(() => window.__jye.game.scene.getScene('yard').barnImg.texture.key);
      assert(barnTex.startsWith(`barn-working-${i}-`), `barn art shows stage ${i + 1} work inside (${barnTex.split('-').slice(0, 3).join('-')})`);
      if (i === 1 || i === 3) {
        const r = await page.evaluate(() => {
          const g = window.__jye.game;
          const b = g.scene.getScene('yard').barnRect;
          const z = g.scale.zoom;
          const c = document.querySelector('#game canvas').getBoundingClientRect();
          return { x: c.x + b.x * z, y: c.y + b.y * z, width: b.width * z, height: b.height * z };
        });
        await page.screenshot({ path: path.join(SHOTS, `e2e-11${i === 1 ? 'b' : 'c'}-barn-stage${i + 1}.png`), clip: r });
      }
      await page.evaluate(() => (window.__jye.state.barn.timeLeft = 0.05));
      await page.waitForFunction((n) => window.__jye.state.barn.stage === n, i + 1);
    }
    await page.waitForFunction(() => window.__jye.state.barn.status === 'finished');
    assert((await page.textContent('.cards .barn .buy')).includes('Reveal'), 'finished restoration offers a reveal');
    await page.click('.cards .barn .buy');
    await page.waitForTimeout(450);
    const out = await page.evaluate(() => {
      const y = window.__jye.game.scene.getScene('yard');
      return { out: y.barnCarOut, tex: y.barnImg.texture.key };
    });
    assert(out.out && out.tex.endsWith('-1'), 'the covered classic drives out of the barn (barn is empty behind it)');
    assert(!(await page.isVisible('.banner.show:not(.muted)')), 'no banner covers the reveal');
    await page.screenshot({ path: path.join(SHOTS, 'e2e-12a-barn-drive-out.png') });
    await page.waitForSelector('.modal-back.reveal .modal .buy', { timeout: 5000 });
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(SHOTS, 'e2e-12-barn-reveal.png') });
    const sale = await page.evaluate(() => ({ cash: window.__jye.state.cash, value: window.__jye.state.barn.value }));
    assert(sale.value > 0, `reveal fixes the price (${sale.value})`);
    await page.click('.modal .buy');
    const sold = await page.evaluate(() => ({ cash: window.__jye.state.cash, status: window.__jye.state.barn.status, n: window.__jye.state.barn.restored }));
    assert(sold.cash >= sale.cash + sale.value && sold.status === 'away' && sold.n === 1, 'selling the classic pays and the barn waits for the next find');
    await page.waitForTimeout(500);
    assert(!(await page.evaluate(() => window.__jye.game.scene.getScene('yard').barnCarOut)), 'the reveal closes cleanly');

    console.log('showcase (P1.4c)');
    // A second restored classic: keep it for the showcase instead of selling.
    const finishBarn = (model) =>
      page.evaluate((m) => {
        const b = window.__jye.state.barn;
        Object.assign(b, { status: 'finished', stage: 4, timeLeft: 0, model: m, family: 'muscle', value: 0 });
      }, model);
    // The book lists the 32 yard models first, then the 16 barn classics: take a classic not found yet.
    const keepModel = await page.evaluate(() => {
      const book = window.__jye.state.collection.models;
      return Object.keys(book).slice(32).find((m) => book[m].sold === 0);
    });
    await finishBarn(keepModel);
    await page.waitForFunction(() => document.querySelector('.cards .barn .buy')?.textContent.includes('Reveal'));
    await page.click('.cards .barn .buy');
    await page.waitForSelector('.modal-back.reveal .modal .third', { timeout: 15000 });
    await page.waitForTimeout(400);
    const keepUi = await page.evaluate(() => ({
      third: document.querySelector('.modal .third').textContent,
      note: document.querySelector('.modal .keep-note')?.textContent ?? '',
      cash: window.__jye.state.cash,
      value: window.__jye.state.barn.value,
      fits: document.querySelector('.modal .secondary').getBoundingClientRect().bottom <= window.innerHeight,
    }));
    await page.screenshot({ path: path.join(SHOTS, 'e2e-12b-barn-keep.png') });
    assert(/Keep it \(\+0\.5% income\)/.test(keepUi.third) && /showcase/.test(keepUi.note), `the reveal offers to keep the classic (${keepUi.third})`);
    assert(keepUi.fits, 'sell, keep and later all fit on screen');
    await page.click('.modal .third');
    const kept = await page.evaluate(() => ({
      cash: window.__jye.state.cash,
      showcase: [...window.__jye.state.collection.showcase],
      status: window.__jye.state.barn.status,
      n: window.__jye.state.barn.restored,
    }));
    assert(kept.cash === keepUi.cash && kept.status === 'away' && kept.n === 2, `keeping pays no cash and the barn waits (${JSON.stringify(kept)})`);
    assert(kept.showcase.length === 1 && kept.showcase[0] === keepModel, `the classic is in the showcase (${kept.showcase})`);
    await page.waitForFunction(() => /IN THE SHOWCASE/.test(document.querySelector('.banner')?.textContent ?? ''), null, { timeout: 8000 });
    assert(true, 'an "IN THE SHOWCASE!" banner celebrates it');
    // The same model again: only selling is offered.
    await page.waitForTimeout(600);
    await finishBarn(keepModel);
    await page.waitForFunction(() => document.querySelector('.cards .barn .buy')?.textContent.includes('Reveal'));
    await page.click('.cards .barn .buy');
    await page.waitForSelector('.modal-back.reveal .modal .buy', { timeout: 15000 });
    const repeat = await page.evaluate(() => ({ third: !!document.querySelector('.modal .third'), note: document.querySelector('.modal .keep-note')?.textContent ?? '' }));
    assert(!repeat.third && /already/.test(repeat.note), `a repeat classic can only be sold (${repeat.note})`);
    await page.click('.modal .buy');
    await page.waitForTimeout(500);
    await page.click('.book-btn');
    await page.click('.book-tabs [data-page="classics"]');
    const shelf = await page.evaluate((m) => ({
      line: document.querySelector('.book-showcase')?.textContent ?? '',
      card: document.querySelector(`.book-card.kept[data-model="${m}"]`)?.textContent ?? '',
    }), keepModel);
    await page.screenshot({ path: path.join(SHOTS, 'e2e-12c-book-showcase.png') });
    assert(/Showcase 1\/16 · \+0\.5% all income/.test(shelf.line) && /In your showcase/.test(shelf.card), `the book shows the showcase (${shelf.line} | ${shelf.card})`);
    await page.click('.book .modal .buy');
    await page.waitForSelector('.book .modal', { state: 'detached' });

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
    await page.click('.cards .card.slot .buy');
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
    const station = await page.evaluate(() => {
      const st = window.__jye.game.scene.getScene('yard').station;
      return st ? { press: st.press.visible, worker: st.scrapper.visible, y: st.press.y } : null;
    });
    assert(station && station.press && station.worker, 'the Scrapper and its press stand beside the barn once hired');
    await page.waitForFunction((n) => window.__jye.state.stats.carsCrushed > n, crushedBefore, { timeout: 20000 });
    await page.waitForTimeout(200);
    // Check the 620 ms slam before the screenshot: a 3x screenshot can take longer than the tween.
    const plateMoved = await page.evaluate(() => {
      const st = window.__jye.game.scene.getScene('yard').station;
      return st.plate.scene.tweens.isTweening(st.plate);
    });
    await page.screenshot({ path: path.join(SHOTS, 'e2e-15-scrapper.png') });
    assert(plateMoved, 'the press slams when the Scrapper crushes a wreck');
    const afterScrap = await page.evaluate(() => ({ parts: window.__jye.state.parts, rest: window.__jye.state.scrapperRest }));
    assert(afterScrap.parts > 0 && afterScrap.rest > 0, `Scrapper crushes a wreck when parts run low (+${afterScrap.parts} parts)`);

    console.log('repair garage');
    await page.evaluate(() => {
      const s = window.__jye.state;
      s.cash += 2e6;
      s.lifetimeEarnings += 2e6;
      s.parts = 0; // first fix pays a parts bill
      s.managers.scrapper = false; // keep the parts bin empty while measuring
    });
    await page.click('.map-btn');
    await page.waitForSelector('.map-row[data-biz="garage"] button:not([disabled])');
    await page.click('.map-row[data-biz="garage"] button');
    await page.waitForFunction(() => window.__jye.state.businesses.opened.garage);
    assert((await page.textContent('.map-row[data-biz="garage"] button')) === 'Go', 'opening the garage costs cash and offers "Go"');
    // P1.1d: the drive between businesses is a road wipe showing where we're going. It lives under a second, so a
    // MutationObserver records it (a busy machine let waitForSelector miss it once, run 28).
    await page.evaluate(() => {
      window.__wipeText = null;
      const mo = new MutationObserver(() => {
        const w = document.querySelector('.drive-wipe');
        if (w && window.__wipeText === null) {
          window.__wipeText = w.textContent;
          mo.disconnect();
        }
      });
      mo.observe(document.body, { childList: true, subtree: true });
    });
    await page.click('.map-row[data-biz="garage"] button');
    const wipe = await page.waitForFunction(() => window.__wipeText, null, { timeout: 3000 }).then((h) => h.jsonValue()).catch(() => null);
    assert(wipe && wipe.includes('Repair Garage'), `"Go" drives to the garage behind a road wipe (${wipe})`);
    await page.waitForSelector('.drive-wipe', { state: 'detached', timeout: 3000 });
    await page.waitForSelector('.modal.city-map', { state: 'detached' });
    await page.waitForFunction(() => window.__jye.game.scene.isActive('garage') && window.__jye.game.scene.isSleeping('yard'));
    assert(true, '"Go" puts the garage scene on screen and the yard to sleep');
    const tabs = await page.evaluate(() => [...document.querySelectorAll('.tab')].filter((t) => t.style.display !== 'none').map((t) => t.textContent.replace(/\s+$/, '')));
    assert(tabs.join(',') === 'Garage,Crew', `the panel shows the garage's tabs (${tabs.join(', ')})`);
    const yardCtl = await page.evaluate(() => ['.sell', '.crush', '.buyer', '.haggle'].filter((q) => !document.querySelector(q).classList.contains('hidden')));
    assert(yardCtl.length === 0, `the yard controls are hidden in the garage (${yardCtl.join(', ') || 'none shown'})`);
    await page.waitForFunction(() => window.__jye.state.garage.jobs.length > 0, null, { timeout: 8000 });
    // P1.1f: the customer says what's wrong in a speech bubble; the fault bubble pops up after it.
    // Catch the speech bubble and hold it (it lasts 1.8 s; the checks and the screenshot take longer).
    await page.waitForFunction(() => {
      const sc = window.__jye.game.scene.getScene('garage');
      if (sc.speech.visible) sc.speechUntil = sc.clock + 99;
      return sc.speech.visible;
    }, null, { timeout: 6000, polling: 'raf' }).catch(async (e) => {
      const d = await page.evaluate(() => { const sc = window.__jye.game.scene.getScene('garage'); return { clock: sc.clock, until: sc.speechUntil, spoken: [...sc.spoken], big: sc.bigJobId, arriving: sc.arriving, cust: sc.customer.visible, focused: window.__jye.state.garage.focusedId }; });
      throw new Error(`speech bubble never showed ${JSON.stringify(d)}: ${e.message}`);
    });
    const talk = await page.evaluate(() => {
      const sc = window.__jye.game.scene.getScene('garage');
      const b = sc.speech.getBounds();
      return { text: sc.speechText.text, fault: sc.bubble.visible, inside: b.left >= 0 && b.right <= sc.scale.width, aboveHead: b.bottom <= sc.customer.y - sc.customer.displayHeight + 2 };
    });
    assert(talk.text.length > 5 && !talk.fault, `the customer says what's wrong ("${talk.text}") before the fault bubble shows`);
    assert(talk.inside && talk.aboveHead, `the speech bubble sits on screen above the customer's head (${JSON.stringify(talk)})`);
    await page.screenshot({ path: path.join(SHOTS, 'e2e-17a-garage-customer-talks.png') });
    await page.evaluate(() => { const sc = window.__jye.game.scene.getScene('garage'); sc.speechUntil = sc.clock; });
    await page.waitForFunction(() => {
      const sc = window.__jye.game.scene.getScene('garage');
      return !sc.speech.visible && sc.bubble.visible && sc.bubble.scale === 1;
    }, null, { timeout: 4000 }).catch(async (e) => {
      const d = await page.evaluate(() => { const sc = window.__jye.game.scene.getScene('garage'); return { clock: sc.clock, until: sc.speechUntil, speech: sc.speech.visible, bubble: sc.bubble.visible, scale: sc.bubble.scale, big: sc.bigJobId, focused: window.__jye.state.garage.focusedId, leaving: sc.carLeaving }; });
      throw new Error(`fault bubble did not come back ${JSON.stringify(d)}: ${e.message}`);
    });
    assert(true, 'the speech bubble gives way to the fault bubble');
    const hint = await page.textContent('.hint');
    assert(/Tap the car to fix the/.test(hint), `garage hint (${hint})`);
    // A yard "LEGENDARY!" banner would cover the garage: yard-only announcements stay quiet here.
    await page.evaluate(() => window.__jye.game.scene.getScene('garage').handleEvents([{ type: 'legendary', car: { model: 'Testmobile' } }]));
    await page.waitForTimeout(100);
    assert(!(await page.innerHTML('.banner')).includes('Testmobile'), 'no yard Legendary banner while the garage is on screen');
    const garageCar = async () =>
      page.evaluate(() => {
        const sc = window.__jye.game.scene.getScene('garage');
        const b = sc.bigCar.getBounds();
        const z = window.__jye.game.scale.zoom;
        const c = document.querySelector('#game canvas').getBoundingClientRect();
        return { x: c.x + b.centerX * z, y: c.y + b.centerY * z, visible: sc.bigCar.visible, bubble: sc.bubble.visible, text: sc.bubbleText.text };
      });
    const gc = await garageCar();
    assert(gc.visible && gc.bubble && gc.text.length > 3, `the customer's car stands on the lift with its fault (${gc.text})`);
    const pose = await page.evaluate(() => {
      const sc = window.__jye.game.scene.getScene('garage');
      return { lift: sc.lift.v, cust: sc.customer.visible && sc.customer.alpha > 0.9, right: sc.customer.x > sc.bigCar.x + sc.bigCar.displayWidth * 0.3, rust: sc.bigRust.alpha, foreman: sc.foreman.visible };
    });
    assert(pose.lift === 1 && pose.cust && pose.right, `the lift raises the car and the customer waits beside it (lift ${pose.lift}, customer ${pose.cust}/${pose.right})`);
    assert(pose.rust <= 0.5 && !pose.foreman, `customer cars carry light rust and no Foreman stands there before he is hired (${pose.rust.toFixed(2)})`);
    await page.screenshot({ path: path.join(SHOTS, 'e2e-17-garage.png') });
    // Fault-specific animation: a flat tyre tilts the car and bulges, a dead battery sparks, hot brakes glow.
    const faultFx = await page.evaluate(async () => {
      const sc = window.__jye.game.scene.getScene('garage');
      const job = window.__jye.state.garage.jobs.find((j) => j.id === window.__jye.state.garage.focusedId);
      const was = job.fault;
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const out = {};
      job.fault = 'tyre';
      await wait(120);
      out.tilt = sc.bigCar.angle;
      out.tyreFx = sc.faultG.commandBuffer.length;
      job.fault = 'brakes';
      await wait(120);
      out.tiltBrakes = sc.bigCar.angle;
      out.brakeFx = sc.faultG.commandBuffer.length;
      job.fault = 'battery';
      out.zap = 0;
      for (let i = 0; i < 30 && out.zap === 0; i++) {
        await wait(60);
        out.zap = sc.zap.getAliveParticleCount();
      }
      job.fault = was;
      return out;
    });
    assert(faultFx.tilt > 0.5 && faultFx.tyreFx > 0 && faultFx.tiltBrakes === 0, `a flat tyre tilts the car and bulges (${faultFx.tilt.toFixed(2)} deg)`);
    assert(faultFx.brakeFx > 0 && faultFx.zap > 0, `hot brakes glow and a dead battery sparks (${faultFx.zap} sparks)`);
    // Make the first job a flat tyre so the fix shows the tyre swap (P1.1f).
    await page.evaluate(() => (window.__jye.state.garage.jobs.find((j) => j.id === window.__jye.state.garage.focusedId).fault = 'tyre'));
    const g0 = await page.evaluate(() => ({ cash: window.__jye.state.cash, fee: window.__jye.state.garage.jobs[0].fee, sold: window.__jye.state.carsSold }));
    for (let i = 0; i < 20; i++) {
      if (await page.evaluate(() => window.__jye.state.garage.jobsDone > 0)) break;
      await page.mouse.click(gc.x, gc.y);
      await page.waitForTimeout(60);
    }
    const g1 = await page.evaluate(() => ({ cash: window.__jye.state.cash, done: window.__jye.state.garage.jobsDone, earned: window.__jye.state.garage.earned }));
    assert(g1.done === 1, 'tapping the car fixes it');
    const swap0 = await page.evaluate(() => {
      const sc = window.__jye.game.scene.getScene('garage');
      return { shown: sc.tyre.visible, fit: sc.tyreFit !== null };
    });
    await page.waitForTimeout(420);
    const swap1 = await page.evaluate(() => {
      const sc = window.__jye.game.scene.getScene('garage');
      const t = sc.tyreFit;
      return t ? { v: t.roll.v, onWheel: Math.abs(sc.tyre.x - (sc.bigCar.x + t.dx)) < 2, visible: sc.tyre.visible } : null;
    });
    assert(swap0.shown && swap0.fit && swap1 && swap1.v === 1 && swap1.onWheel, `a flat-tyre fix rolls a new tyre onto the front wheel (${JSON.stringify(swap1)})`);
    await page.evaluate(() => window.__jye.game.scene.getScene('garage').tweens.pauseAll());
    await page.screenshot({ path: path.join(SHOTS, 'e2e-17b-garage-tyre-swap.png') });
    await page.evaluate(() => window.__jye.game.scene.getScene('garage').tweens.resumeAll());
    await page.waitForFunction(() => !window.__jye.game.scene.getScene('garage').tyre.visible, null, { timeout: 4000 });
    assert(true, 'the new tyre leaves with the car');
    assert(g1.earned === Math.round(g0.fee * 0.7), `without yard parts a parts bill comes off the fee (${g1.earned} of ${g0.fee})`);
    await page.waitForTimeout(600);
    const yardRan = await page.evaluate((n) => window.__jye.state.carsSold > n, g0.sold);
    await page.waitForFunction((n) => window.__jye.state.carsSold > n, g0.sold, { timeout: 20000 });
    assert(true, `the yard crew keeps selling while the garage is on screen${yardRan ? '' : ' (after a wait)'}`);
    // Spare parts from the yard: the next fix pays the full fee.
    await page.evaluate(() => {
      const s = window.__jye.state;
      s.parts = 50;
      // A barn stage that needs parts would keep them; park the barn between finds for this check.
      if (s.barn.status === 'covered') s.barn.status = 'away', s.barn.timeLeft = 9999;
    });
    await page.waitForFunction(() => window.__jye.state.garage.jobs.length > 0, null, { timeout: 8000 });
    await page.waitForTimeout(1300);
    const gc2 = await garageCar();
    const g2 = await page.evaluate(() => ({ fee: window.__jye.state.garage.jobs[0].fee, earned: window.__jye.state.garage.earned }));
    for (let i = 0; i < 20; i++) {
      if (await page.evaluate(() => window.__jye.state.garage.jobsDone > 1)) break;
      await page.mouse.click(gc2.x, gc2.y);
      await page.waitForTimeout(60);
    }
    const g3 = await page.evaluate(() => ({ earned: window.__jye.state.garage.earned, parts: window.__jye.state.parts }));
    assert(g3.earned - g2.earned === g2.fee && g3.parts < 50, `with yard parts the customer pays the full fee (${g2.fee}, parts left ${g3.parts})`);
    // Garage upgrades and crew.
    const tools0 = await page.textContent('.cards .card.garage-tools .desc');
    await page.click('.cards .card.garage-tools .buy');
    await page.click('.cards .card.garage-rep .buy');
    await page.click('.cards .card.garage-bay .buy');
    const gl = await page.evaluate(() => window.__jye.state.garage);
    assert(gl.levels.tools === 2 && gl.levels.rep === 2 && gl.bays === 2 && (await page.textContent('.cards .card.garage-tools .desc')) !== tools0, 'Tool Wall, Reputation and a second bay bought');
    await page.waitForFunction(() => window.__jye.game.scene.getScene('garage').bays.length === 2, null, { timeout: 8000 });
    assert(true, 'two bays show as thumbnails above the lift');
    await page.click('.tab:has-text("Crew"):visible');
    await page.click('.cards .card.garage-foreman .buy');
    assert(await page.evaluate(() => window.__jye.state.garage.foreman), 'Foreman hired');
    const doneBefore = await page.evaluate(() => window.__jye.state.garage.jobsDone);
    await page.waitForFunction((n) => window.__jye.state.garage.jobsDone > n, doneBefore, { timeout: 20000 });
    assert(true, 'the Foreman fixes a car without input');
    await page.waitForFunction(() => {
      const sc = window.__jye.game.scene.getScene('garage');
      const g = window.__jye.state.garage;
      const ok = !sc.carLeaving && !sc.arriving && sc.bigJobId === g.focusedId && sc.lift.v === 1 && sc.customer.visible && sc.customer.alpha === 1;
      // Hold the cars for the screenshot (the Foreman would finish one while the page is captured).
      if (ok) for (const j of g.jobs) j.work = Math.max(j.work, 3);
      return ok;
    }, null, { timeout: 10000 });
    const fm = await page.evaluate(() => {
      const sc = window.__jye.game.scene.getScene('garage');
      return { shown: sc.foreman.visible, left: sc.foreman.x < sc.bigCar.x - sc.bigCar.displayWidth * 0.3, inside: sc.foreman.x - sc.foreman.displayWidth / 2 >= 0 && sc.customer.x + sc.customer.displayWidth / 2 <= sc.scale.width };
    });
    assert(fm.shown && fm.left && fm.inside, 'the Foreman stands at the car on the left, both characters on screen');
    await page.screenshot({ path: path.join(SHOTS, 'e2e-18-garage-foreman.png') });
    // Reload with the garage on screen, then go back to the yard via the map.
    await page.evaluate(() => window.__jye.saveNow());
    await page.reload();
    await page.waitForFunction(() => window.__jye && window.__jye.game.scene.isActive('garage'), null, { timeout: 8000 });
    assert(await page.evaluate(() => !window.__jye.game.scene.isActive('yard')), 'a reload brings back the garage on screen');
    await page.evaluate(() => (window.__jye.state.managers.scrapper = true));
    // The crews earned a little during the reload: close the welcome-back popup if it came up.
    await page.waitForTimeout(500);
    if (await page.isVisible('.modal-back .modal .buy')) await page.click('.modal-back .modal .buy');
    await page.click('.map-btn');
    assert((await page.textContent('.modal.city-map > .buy')) === 'Back to the garage', 'the map\'s back button names the garage');
    // P1.1d: the garage grew to tier 2 with its second bay: stars on the map and in the list, an open door on the plot.
    const tiers = await page.evaluate(() => ({
      garage: document.querySelector('.map-row[data-biz="garage"] .map-stars')?.textContent,
      next: document.querySelector('.map-row[data-biz="garage"] .map-next')?.textContent,
      plot: document.querySelector('.city-svg .plot[data-biz="garage"] .tier')?.getAttribute('data-tier'),
      door: !!document.querySelector('.city-svg .plot[data-biz="garage"] .t2'),
      yard: document.querySelector('.map-row[data-biz="scrapyard"] .map-stars')?.textContent,
      // Rows with a Go button (or none); a business for sale carries a wider "Open $X" button.
      textW: Math.min(...[...document.querySelectorAll('.map-row:not(.forSale) .map-text')].map((t) => t.getBoundingClientRect().width)),
      saleW: Math.min(9999, ...[...document.querySelectorAll('.map-row.forSale .map-text')].map((t) => t.getBoundingClientRect().width)),
    }));
    assert(tiers.textW > 150, `the map rows' text is not squeezed by the Go button (${Math.round(tiers.textW)}px)`);
    assert(tiers.saleW > 120, `a row for sale keeps room for its text next to the Open button (${Math.round(tiers.saleW)}px)`);
    assert(tiers.garage === '★★☆' && tiers.plot === '2' && tiers.door && tiers.next === 'Next ★ with 3 repair bays', `the map shows the garage at tier 2 (${JSON.stringify(tiers)})`);
    assert(typeof tiers.yard === 'string' && tiers.yard.length === 3, `the scrapyard shows its tier too (${tiers.yard})`);
    await page.screenshot({ path: path.join(SHOTS, 'e2e-16b-city-map-tiers.png') });
    await page.click('.map-row[data-biz="scrapyard"] button');
    await page.waitForFunction(() => window.__jye.game.scene.isActive('yard') && window.__jye.game.scene.isSleeping('garage'));
    const yardTabs = await page.evaluate(() => [...document.querySelectorAll('.tab')].filter((t) => t.style.display !== 'none').length);
    assert(yardTabs === 4, '"Go" on the scrapyard brings the yard and its four tabs back');
    // Wait for it rather than a fixed time: the Salesperson may sell a car in the meantime, and while the sold car
    // drives off (0.5 s) the scene shows no car although the next one is already focused (flaked in run 17).
    await page
      .waitForFunction(() => {
        const s = window.__jye.state;
        return s.cars.length === 0 || window.__jye.game.scene.getScene('yard').bigCarId === s.focusedId;
      }, null, { timeout: 4000 })
      .catch(() => {});
    const yardCar = await page.evaluate(() => {
      const sc = window.__jye.game.scene.getScene('yard');
      const s = window.__jye.state;
      return { shown: sc.bigCarId, focused: s.focusedId, cars: s.cars.length };
    });
    assert(yardCar.cars === 0 || yardCar.shown === yardCar.focused, `the yard shows its current car after the garage (${yardCar.shown} / ${yardCar.focused})`);

    console.log('used car lot');
    await page.evaluate(() => {
      const s = window.__jye.state;
      s.cash += 60e6;
      s.lifetimeEarnings += 60e6;
    });
    await page.click('.map-btn');
    await page.waitForSelector('.map-row[data-biz="carlot"] button:not([disabled])');
    assert((await page.textContent('.map-row[data-biz="carlot"] button')) === 'Open $2.50M', 'the Used Car Lot is for sale on the map');
    await page.click('.map-row[data-biz="carlot"] button');
    await page.waitForFunction(() => window.__jye.state.businesses.opened.carlot);
    await page.click('.map-row[data-biz="carlot"] button');
    await page.waitForSelector('.drive-wipe', { state: 'detached', timeout: 3000 });
    await page.waitForSelector('.modal.city-map', { state: 'detached' });
    await page.waitForFunction(() => window.__jye.game.scene.isActive('carlot') && window.__jye.game.scene.isSleeping('yard'), null, { timeout: 4000 });
    assert(true, '"Go" puts the Used Car Lot on screen and the yard to sleep');
    const lotTabs = await page.evaluate(() => [...document.querySelectorAll('.tab')].filter((t) => t.style.display !== 'none').map((t) => t.textContent.replace(/\s+$/, '')));
    assert(lotTabs.join(',') === 'Auction,Lot,Crew', `the panel shows the lot's tabs (${lotTabs.join(', ')})`);
    await page.waitForFunction(() => window.__jye.state.carlot.board.every((b) => !!b), null, { timeout: 5000 });
    // Make the first lot a Rough car so the refurbish takes a few taps and the screenshot shows rust
    // (its price follows the condition: x0.30 of retail instead of the old grade's fraction).
    await page.evaluate(() => {
      const b = window.__jye.state.carlot.board[0];
      const frac = { 1: 0.3, 2: 0.42, 3: 0.54, 4: 0.66, 5: 0.78 };
      b.price = Math.round((b.price / frac[b.condition]) * frac[1]);
      b.condition = 1;
    });
    await page.waitForTimeout(250);
    const auction = await page.evaluate(() => [...document.querySelectorAll('.cards .card.auction-lot')].map((c) => ({ title: c.querySelector('.title').textContent, desc: c.querySelector('.desc').textContent, btn: c.querySelector('.buy').textContent })));
    assert(auction.length === 3 && auction.every((a) => /★/.test(a.desc) && /profit \$\d/.test(a.desc) && /^Buy \$/.test(a.btn)), `the auction board shows three lots with condition, price and profit (${auction[0].title} · ${auction[0].desc})`);
    assert(/Buy a car at the auction/.test(await page.textContent('.hint')), 'the lot hint points at the auction');
    await page.screenshot({ path: path.join(SHOTS, 'e2e-19a-carlot-auction.png') });
    // P1.2c auction feel: a bid countdown on every card, "Going…" with a red timer in the last seconds, and a SOLD!
    // stamp when a lot goes to another bidder.
    const timers = await page.evaluate(() => [...document.querySelectorAll('.cards .card.auction-lot .lvl')].map((l) => l.textContent));
    assert(timers.every((t) => /^⏱ \d+s$/.test(t)), `each lot shows its bid countdown (${timers.join(', ')})`);
    const fit = await page.evaluate(() =>
      [...document.querySelectorAll('.cards .card.auction-lot')].map((c) => {
        const r = c.getBoundingClientRect();
        const b = c.querySelector('.buy').getBoundingClientRect();
        const d = c.querySelector('.desc').getBoundingClientRect();
        return Math.round(r.bottom - b.bottom) >= 0 && Math.round(b.top - d.bottom) >= -1;
      }),
    );
    assert(fit.every(Boolean), `every auction card holds its text and Buy button (${fit.join(', ')})`);
    await page.evaluate(() => (window.__jye.state.carlot.board[1].timeLeft = 5));
    await page.waitForFunction(() => document.querySelectorAll('.cards .card.auction-lot')[1].classList.contains('closing'), null, { timeout: 2000 });
    const going = await page.evaluate(() => document.querySelectorAll('.cards .card.auction-lot .lvl')[1].textContent);
    assert(/^🔨 Going… [45]s$/.test(going), `a closing lot says "Going…" (${going})`);
    await page.evaluate(() => (window.__jye.state.carlot.board[2].timeLeft = 0.05));
    await page.waitForFunction(() => {
      const st = document.querySelectorAll('.cards .card.auction-lot')[2].querySelector('.stamp');
      const ok = !st.classList.contains('hidden') && st.textContent === 'SOLD!';
      // Hold the stamp for the screenshot.
      if (ok) for (const x of window.__jye.ui.stamps) if (x) x.until += 60_000;
      return ok;
    }, null, { timeout: 2000 });
    assert(await page.evaluate(() => window.__jye.state.carlot.board[2] === null), 'a lot that runs out goes to another bidder with a SOLD! stamp');
    await page.waitForTimeout(350);
    await page.screenshot({ path: path.join(SHOTS, 'e2e-19d-carlot-auction-sold.png') });
    await page.evaluate(() => {
      for (const x of window.__jye.ui.stamps) if (x) x.until = 0;
      window.__jye.state.carlot.board[1].timeLeft = 40;
    });
    const cashLot0 = await page.evaluate(() => window.__jye.state.cash);
    await page.click('.cards .card.auction-lot >> nth=0 >> .buy');
    await page.waitForFunction(() => {
      const sc = window.__jye.game.scene.getScene('carlot');
      return window.__jye.state.carlot.cars.length === 1 && sc.debugView().carVisible && !sc.debugView().arriving;
    }, null, { timeout: 4000 });
    const bought = await page.evaluate(() => ({ cash: window.__jye.state.cash, car: window.__jye.state.carlot.cars[0], hint: document.querySelector('.hint').textContent }));
    const wonStamp = await page.evaluate(() => document.querySelectorAll('.cards .card.auction-lot')[0].querySelector('.stamp').textContent);
    assert(wonStamp === 'YOURS!', `the bought lot gets a YOURS! stamp (${wonStamp})`);
    assert(bought.cash < cashLot0 && bought.car.condition === 1 && bought.car.work > 0, `buying moves the car onto the lot (${bought.car.model}, paid ${bought.car.paid})`);
    assert(/Tap the car to refurbish/.test(bought.hint), `the hint says to tap the car (${bought.hint})`);
    const lotCarPos = async () =>
      page.evaluate(() => {
        const sc = window.__jye.game.scene.getScene('carlot');
        const b = sc.bigCar.getBounds();
        const z = window.__jye.game.scale.zoom;
        const c = document.querySelector('#game canvas').getBoundingClientRect();
        return { x: c.x + b.centerX * z, y: c.y + b.centerY * z, rust: sc.bigRust.alpha, label: sc.label.text };
      });
    const lc = await lotCarPos();
    assert(lc.rust > 0.95 && /★☆☆☆☆/.test(lc.label), `a rough car stands on the platform with full rust and one star (${lc.label})`);
    await page.screenshot({ path: path.join(SHOTS, 'e2e-19-carlot-rough.png') });
    for (let i = 0; i < 80; i++) {
      if (await page.evaluate(() => window.__jye.state.carlot.cars[0]?.work === 0)) break;
      await page.mouse.click(lc.x, lc.y);
      await page.waitForTimeout(25);
    }
    await page.waitForFunction(() => window.__jye.game.scene.getScene('carlot').debugView().tag, null, { timeout: 3000 });
    const shine = await lotCarPos();
    assert(shine.rust < 0.05 && shine.label === '', `tapping refurbishes the car: the rust is gone and a FOR SALE tag hangs on it (${shine.label})`);
    const sellTxt = await page.textContent('.sell');
    assert(/^Sell \$/.test(sellTxt) && !(await page.evaluate(() => document.querySelector('.sell').classList.contains('hidden'))), `the Sell button offers the list price (${sellTxt})`);
    await page.screenshot({ path: path.join(SHOTS, 'e2e-19b-carlot-for-sale.png') });
    await page.click('.sell');
    await page.waitForSelector('.haggle:not(.hidden)', { timeout: 2000 });
    assert(await page.evaluate(() => window.__jye.state.carlot.holdId !== null), 'selling on the lot starts the haggle slider and holds the car');
    await page.waitForTimeout(300);
    await page.click('.haggle');
    await page.waitForFunction(() => window.__jye.state.carlot.sold === 1, null, { timeout: 3000 });
    const soldLot = await page.evaluate(() => ({ profit: window.__jye.state.carlot.profit, hold: window.__jye.state.carlot.holdId }));
    assert(soldLot.profit > 0 && soldLot.hold === null, `the haggled sale makes a profit (${soldLot.profit})`);
    // P1.2c walk-up buyers: buy another car, finish it, and a buyer walks up, looks it over and says something.
    await page.waitForSelector('.cards .card.auction-lot .buy:not([disabled])', { timeout: 8000 });
    await page.click('.cards .card.auction-lot .buy:not([disabled]) >> nth=0');
    await page.waitForFunction(() => window.__jye.state.carlot.cars.length === 1, null, { timeout: 3000 });
    await page.evaluate(() => (window.__jye.state.carlot.cars[0].work = 0));
    await page.waitForFunction(() => {
      const v = window.__jye.game.scene.getScene('carlot').debugView();
      const l = window.__jye.state.carlot;
      const ok = !!l.buyer && v.buyerLooking === v.bigId && v.buyerVisible && !v.buyerWalking && v.speech !== '';
      // Keep the buyer looking for the checks and the screenshot.
      if (l.buyer) l.buyerTimer = Math.min(l.buyerTimer, 4.5);
      return ok;
    }, null, { timeout: 12000 });
    const look = await page.evaluate(() => {
      const sc = window.__jye.game.scene.getScene('carlot');
      const sb = sc.speech.getBounds();
      return {
        speech: sc.debugView().speech,
        kind: window.__jye.state.carlot.buyer.kind,
        right: sc.buyer.x > sc.bigCar.x + sc.bigCar.displayWidth * 0.3,
        onScreen: sb.left >= 0 && sb.right <= sc.scale.width && sb.top >= 0,
        sold: window.__jye.state.carlot.sold,
      };
    });
    assert(look.right && look.onScreen && look.sold === 1, `a ${look.kind} buyer stands by the car and looks it over: "${look.speech}"`);
    await page.screenshot({ path: path.join(SHOTS, 'e2e-19e-carlot-buyer-looks.png') });
    await page.waitForFunction(() => window.__jye.state.carlot.sold === 2, null, { timeout: 6000 });
    assert(await page.evaluate(() => window.__jye.state.carlot.buyer === null && window.__jye.state.carlot.cars.length === 0), 'then the buyer pays and drives the car away');
    // Upgrades and crew: Valet Bay, Showroom, a third spot, the Detailer and the Auction Agent.
    await page.click('.tab:has-text("Lot"):visible');
    const valet0 = await page.textContent('.cards .card.carlot-valet .desc');
    await page.click('.cards .card.carlot-valet .buy');
    await page.click('.cards .card.carlot-showroom .buy');
    await page.click('.cards .card.carlot-spot .buy');
    const ll = await page.evaluate(() => window.__jye.state.carlot);
    assert(ll.levels.valet === 2 && ll.levels.showroom === 2 && ll.spots === 3 && (await page.textContent('.cards .card.carlot-valet .desc')) !== valet0, 'Valet Bay, Showroom and a third forecourt spot bought');
    await page.click('.tab:has-text("Crew"):visible');
    await page.click('.cards .card.carlot-detailer .buy');
    await page.click('.cards .card.carlot-agent .buy');
    assert(await page.evaluate(() => window.__jye.state.carlot.crew.detailer && window.__jye.state.carlot.crew.agent), 'Detailer and Auction Agent hired');
    await page.waitForFunction(() => window.__jye.state.carlot.cars.length > 0, null, { timeout: 8000 });
    assert(true, 'the Auction Agent buys a car on its own');
    await page.waitForFunction(() => window.__jye.state.carlot.sold > 2, null, { timeout: 30000 });
    assert(true, 'the Detailer refurbishes and a walk-up buyer drives a car away without input');
    await page.waitForFunction(() => {
      const sc = window.__jye.game.scene.getScene('carlot');
      const v = sc.debugView();
      const l = window.__jye.state.carlot;
      const car = l.cars.find((c) => c.id === l.focusedId);
      const ok = v.carVisible && !v.arriving && !v.leaving && v.detailer && v.spots === 3 && !!car && car.work > 2;
      // Hold the cars for the screenshot (the crew would finish one while the page is captured).
      if (ok) for (const c of l.cars) if (c.work > 0) c.work = Math.max(c.work, 3);
      return ok;
    }, null, { timeout: 20000 });
    const crewView = await page.evaluate(() => {
      const sc = window.__jye.game.scene.getScene('carlot');
      return { left: sc.detailer.x < sc.bigCar.x - sc.bigCar.displayWidth * 0.3, inside: sc.detailer.x - sc.detailer.displayWidth / 2 >= 0 };
    });
    assert(crewView.left && crewView.inside, 'the Detailer stands left of the platform, on screen; three spots show above');
    await page.screenshot({ path: path.join(SHOTS, 'e2e-19c-carlot-crew.png') });
    // Reload with the lot on screen, then go back to the yard via the map.
    await page.evaluate(() => window.__jye.saveNow());
    await page.reload();
    await page.waitForFunction(() => window.__jye && window.__jye.game.scene.isActive('carlot'), null, { timeout: 8000 });
    assert(await page.evaluate(() => !window.__jye.game.scene.isActive('yard') && !window.__jye.game.scene.isActive('garage')), 'a reload brings back the lot on screen');
    await page.waitForTimeout(500);
    if (await page.isVisible('.modal-back .modal .buy')) await page.click('.modal-back .modal .buy');
    await page.click('.map-btn');
    assert((await page.textContent('.modal.city-map > .buy')) === 'Back to the lot', "the map's back button names the lot");
    const lotTier = await page.evaluate(() => document.querySelector('.map-row[data-biz="carlot"] .map-stars')?.textContent);
    assert(lotTier === '★★☆', `three forecourt spots put the lot at tier 2 on the map (${lotTier})`);
    await page.click('.map-row[data-biz="scrapyard"] button');
    await page.waitForFunction(() => window.__jye.game.scene.isActive('yard') && window.__jye.game.scene.isSleeping('carlot'), null, { timeout: 4000 });
    assert(true, 'back to the yard from the lot');

    console.log('paint and tuning');
    await page.evaluate(() => {
      const s = window.__jye.state;
      s.cash += 400e6;
      s.lifetimeEarnings += 400e6;
    });
    await page.click('.map-btn');
    await page.waitForSelector('.map-row[data-biz="paint"] button:not([disabled])');
    assert((await page.textContent('.map-row[data-biz="paint"] button')) === 'Open $25.0M', 'Paint & Tuning is for sale on the map');
    await page.click('.map-row[data-biz="paint"] button');
    await page.waitForFunction(() => window.__jye.state.businesses.opened.paint);
    await page.click('.map-row[data-biz="paint"] button');
    await page.waitForSelector('.drive-wipe', { state: 'detached', timeout: 3000 });
    await page.waitForSelector('.modal.city-map', { state: 'detached' });
    await page.waitForFunction(() => window.__jye.game.scene.isActive('paint') && window.__jye.game.scene.isSleeping('yard'), null, { timeout: 4000 });
    assert(true, '"Go" puts the Paint & Tuning shop on screen and the yard to sleep');
    const paintTabs = await page.evaluate(() => [...document.querySelectorAll('.tab')].filter((t) => t.style.display !== 'none').map((t) => t.textContent.replace(/\s+$/, '')));
    assert(paintTabs.join(',') === 'Shop,Crew', `the panel shows the shop's tabs (${paintTabs.join(', ')})`);
    await page.waitForFunction(() => window.__jye.state.paint.jobs.length > 0, null, { timeout: 6000 });
    // Swap the first order for a known one (respray, rims, engine tune) so every layer is checked.
    await page.evaluate(() => {
      const p = window.__jye.state.paint;
      const j = p.jobs[0];
      const id = p.nextJobId++;
      p.jobs = [{ ...j, id, services: ['respray', 'rims', 'tune'], step: 0, work: 8, age: 0 }];
      p.focusedId = id;
    });
    await page.waitForFunction(() => {
      const v = window.__jye.game.scene.getScene('paint').debugView();
      return v.carVisible && !v.arriving && v.ticket && v.customer && v.bigId === window.__jye.state.paint.focusedId;
    }, null, { timeout: 4000 });
    const order = await page.evaluate(() => window.__jye.game.scene.getScene('paint').debugView());
    assert(order.ticketIcons === '🎨🛞⚙️' && /^⚡ \+\$[\d.]+[KMB]?\ntip · \d+s$/.test(order.tipText), `the order ticket shows the three services and the tip timer (${order.ticketIcons} · ${order.tipText.replace('\n', ' ')})`);
    assert(order.shown.colour === 0 && order.shown.rims === 0 && order.shown.tune === 0, 'the car arrives in its old colour with stock rims');
    assert(/Tap the car: respray/.test(await page.textContent('.hint')), 'the hint says to tap the car for the respray');
    const ticketFit = await page.evaluate(() => {
      const sc = window.__jye.game.scene.getScene('paint');
      const t = sc.ticket.getBounds();
      const z = window.__jye.game.scale.zoom;
      const c = document.querySelector('#game canvas').getBoundingClientRect();
      const hud = document.querySelector('.hud').getBoundingClientRect();
      return { onScreen: t.left >= 0 && t.right <= sc.scale.width, belowHud: c.y + t.top * z >= hud.bottom - 1 };
    });
    assert(ticketFit.onScreen && ticketFit.belowHud, 'the ticket hangs on screen, below the top bar');
    // P1.2g: the customer says what they want; the bubble never covers the ticket (its tip clock is running).
    await page.waitForFunction(() => window.__jye.game.scene.getScene('paint').debugView().speech, null, { timeout: 3000 });
    const said = await page.evaluate(() => window.__jye.game.scene.getScene('paint').debugView());
    const clear = (a, b) => a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y;
    const inScreen = (b, sc) => b.x >= 0 && b.x + b.w <= sc.w && b.y >= 0;
    assert(
      ['The full works, please!', 'Do everything!', 'Make it a show car!'].includes(said.speech.text) && said.ticket && clear(said.speech.box, said.ticketBox) && inScreen(said.speech.box, said.screen),
      `the customer says what they want, clear of the ticket (${JSON.stringify(said.speech)})`,
    );
    await page.screenshot({ path: path.join(SHOTS, 'e2e-20-paint-order.png') });
    const paintCarPos = async () =>
      page.evaluate(() => {
        const sc = window.__jye.game.scene.getScene('paint');
        const b = sc.bigCar.getBounds();
        const z = window.__jye.game.scale.zoom;
        const c = document.querySelector('#game canvas').getBoundingClientRect();
        return { x: c.x + b.centerX * z, y: c.y + b.centerY * z };
      });
    const pc = await paintCarPos();
    const tapUntil = async (pred, max = 60) => {
      for (let i = 0; i < max; i++) {
        if (await page.evaluate(pred)) return true;
        await page.mouse.click(pc.x, pc.y);
        await page.waitForTimeout(20);
      }
      return page.evaluate(pred);
    };
    await tapUntil(() => window.__jye.state.paint.jobs[0].work <= 4);
    await page.evaluate(() => (window.__jye.state.paint.jobs[0].age = 0));
    await page.waitForTimeout(120);
    const mid = await page.evaluate(() => window.__jye.game.scene.getScene('paint').debugView());
    assert(mid.shown.colour > 0.3 && mid.shown.colour < 0.9 && mid.shown.rims === 0, `tapping sprays the new colour across the car (${Math.round(mid.shown.colour * 100)}% done)`);
    await page.screenshot({ path: path.join(SHOTS, 'e2e-20b-paint-spraying.png') });
    await tapUntil(() => window.__jye.state.paint.jobs[0].step === 2);
    await tapUntil(() => window.__jye.state.paint.jobs[0].work <= 8);
    await page.evaluate(() => (window.__jye.state.paint.jobs[0].age = 0));
    await page.waitForTimeout(120);
    const late = await page.evaluate(() => window.__jye.game.scene.getScene('paint').debugView());
    assert(late.shown.colour === 1 && late.shown.rims === 1 && late.shown.tune > 0.3 && late.shown.tune < 0.9, `the respray and rims stay on while the tune decal comes in (tune ${Math.round(late.shown.tune * 100)}%)`);
    assert(/^⚡ \+/.test(late.tipText) && /🛞/.test(late.ticketIcons), 'the ticket still offers the tip after two services');
    await page.screenshot({ path: path.join(SHOTS, 'e2e-20c-paint-tune.png') });
    await tapUntil(() => window.__jye.state.paint.jobsDone === 1, 40);
    const paid = await page.evaluate(() => ({ ...window.__jye.state.paint, jobs: undefined }));
    assert(paid.jobsDone === 1 && paid.tips === 1 && paid.earned > 0, `a quick hand-finished order pays the fee plus the tip (${paid.earned})`);
    await page.waitForFunction(() => window.__jye.game.scene.getScene('paint').debugView().leaving, null, { timeout: 1000 });
    assert(true, 'the customer drives the finished car away');
    // Upgrades, a second booth and the Painter.
    await page.click('.tab:has-text("Shop"):visible');
    const booth0 = await page.textContent('.cards .card.paint-booth .desc');
    await page.click('.cards .card.paint-booth .buy');
    await page.click('.cards .card.paint-hype .buy');
    await page.click('.cards .card.paint-booths .buy');
    const pl = await page.evaluate(() => window.__jye.state.paint);
    assert(pl.levels.booth === 2 && pl.levels.hype === 2 && pl.booths === 2 && (await page.textContent('.cards .card.paint-booth .desc')) !== booth0, 'Spray Booth, Hype and a second booth bought');
    await page.click('.tab:has-text("Crew"):visible');
    await page.click('.cards .card.paint-painter .buy');
    assert(await page.evaluate(() => window.__jye.state.paint.painter), 'Painter hired');
    const done0 = await page.evaluate(() => window.__jye.state.paint.jobsDone);
    await page.waitForFunction((d) => window.__jye.state.paint.jobsDone > d, done0, { timeout: 30000 });
    assert(true, 'the Painter finishes an order without input');
    await page.waitForFunction(() => {
      const sc = window.__jye.game.scene.getScene('paint');
      const v = sc.debugView();
      const p = window.__jye.state.paint;
      const ok = v.carVisible && !v.arriving && !v.leaving && v.painter && v.booths === 2 && v.ticket && p.jobs.length === 2 && v.bigId === p.jobs[0].id;
      // Hold the orders for the screenshot.
      if (ok) for (const j of p.jobs) j.work = Math.max(j.work, 3);
      return ok;
    }, null, { timeout: 20000 });
    const painterView = await page.evaluate(() => {
      const sc = window.__jye.game.scene.getScene('paint');
      return { left: sc.painter.x < sc.bigCar.x - sc.bigCar.displayWidth * 0.3, inside: sc.painter.x - sc.painter.displayWidth / 2 >= 0 };
    });
    assert(painterView.left && painterView.inside, 'the Painter stands left of the car, on screen; two booths show above');
    await page.screenshot({ path: path.join(SHOTS, 'e2e-20d-paint-crew.png') });
    // A very short phone (375x560) with two booths: the car moves down so the sign, the ticket and the booth row
    // stay apart, and the speech bubble still clears the ticket.
    const vp0 = page.viewportSize();
    // Hold the orders again: the Painter can finish a 3-unit order during the resize (run 23 flake: ticket null).
    await page.evaluate(() => { for (const j of window.__jye.state.paint.jobs) j.work = Math.max(j.work, 20); });
    await page.setViewportSize({ width: 375, height: 560 });
    await page.waitForTimeout(700);
    const shortView = await page.evaluate(() => {
      const sc = window.__jye.game.scene.getScene('paint');
      sc.speechText.setText('Wrap it, make it fast!');
      sc.speechFor = sc.bigId;
      sc.placeSpeech();
      sc.speech.setVisible(true).setAlpha(1).setScale(1);
      sc.speechUntil = sc.clock + 3;
      const v = sc.debugView();
      const hud = document.querySelector('.hud').getBoundingClientRect();
      const c = document.querySelector('#game canvas').getBoundingClientRect();
      const rowBottom = Math.max(0, ...sc.booths.map((b) => b.container.getBounds().bottom / sc.bridge.dpr));
      return { v, hudBottom: hud.bottom - c.y, rowBottom, h: sc.cssH };
    });
    const sv = shortView.v;
    const svClear = sv.ticketBox && sv.speech && clear(sv.speech.box, sv.ticketBox) && inScreen(sv.speech.box, sv.screen);
    assert(
      Math.round(shortView.h) === 560 && sv.sign && svClear && sv.ticketBox.y >= shortView.rowBottom + 4 && sv.ticketBox.y >= shortView.hudBottom,
      `on a 560 px phone the sign keeps its lettering, the ticket clears the booth row and the bubble clears the ticket (${JSON.stringify({ carW: sv.carW, t: sv.ticketBox, s: sv.speech && sv.speech.box, row: shortView.rowBottom })})`,
    );
    await page.screenshot({ path: path.join(SHOTS, 'e2e-20f-paint-short-phone.png') });
    await page.setViewportSize(vp0);
    await page.waitForTimeout(400);
    await page.evaluate(() => window.__jye.saveNow());
    await page.reload();
    await page.waitForFunction(() => window.__jye && window.__jye.game.scene.isActive('paint'), null, { timeout: 8000 });
    assert(await page.evaluate(() => !window.__jye.game.scene.isActive('yard') && !window.__jye.game.scene.isActive('carlot')), 'a reload brings back the paint shop on screen');
    await page.waitForTimeout(500);
    if (await page.isVisible('.modal-back .modal .buy')) await page.click('.modal-back .modal .buy');
    await page.click('.map-btn');
    assert((await page.textContent('.modal.city-map > .buy')) === 'Back to the paint shop', "the map's back button names the paint shop");
    const paintTier = await page.evaluate(() => document.querySelector('.map-row[data-biz="paint"] .map-stars')?.textContent);
    assert(paintTier === '★★☆', `two booths put the shop at tier 2 on the map (${paintTier})`);
    await page.screenshot({ path: path.join(SHOTS, 'e2e-20e-paint-map.png') });
    await page.click('.map-row[data-biz="scrapyard"] button');
    await page.waitForFunction(() => window.__jye.game.scene.isActive('yard') && window.__jye.game.scene.isSleeping('paint'), null, { timeout: 4000 });
    assert(true, 'back to the yard from the paint shop');

    console.log('lot cars through the paint shop');
    const goTo = async (biz, scene) => {
      await page.click('.map-btn');
      await page.click(`.map-row[data-biz="${biz}"] button`);
      await page.waitForSelector('.drive-wipe', { state: 'detached', timeout: 3000 });
      await page.waitForSelector('.modal.city-map', { state: 'detached' });
      await page.waitForFunction((sc) => window.__jye.game.scene.isActive(sc), scene, { timeout: 4000 });
    };
    await goTo('carlot', 'carlot');
    // One known refurbished muscle car; no walk-up buyers, no Auction Agent buys and no paint customers for now.
    const tuneId = await page.evaluate(() => {
      const s = window.__jye.state;
      const l = s.carlot;
      const id = l.nextId++;
      l.crew.agent = false;
      l.buyer = null;
      l.buyerTimer = -1e6;
      l.cars = [{ id, family: 'muscle', model: 'Stallion Thunder', paint: 0xe5484d, condition: 3, paid: 1000, work: 0 }];
      l.focusedId = id;
      s.paint.jobs = [];
      s.paint.focusedId = null;
      s.paint.arrivalTimer = -1e6;
      return id;
    });
    await page.waitForSelector('.crush.tune:not(.hidden)', { timeout: 4000 });
    const tuneUi = await page.evaluate(() => {
      const t = document.querySelector('.crush.tune').getBoundingClientRect();
      const s = document.querySelector('.sell').getBoundingClientRect();
      return { text: document.querySelector('.crush.tune').textContent, disabled: document.querySelector('.crush.tune').disabled, apart: s.right <= t.left - 4, onScreen: s.left >= 0 && t.right <= window.innerWidth };
    });
    assert(/⚙️ Tune\+\$[\d.]+[KMB]?/.test(tuneUi.text) && !tuneUi.disabled, `a refurbished lot car offers an engine tune at the paint shop (${tuneUi.text})`);
    assert(tuneUi.apart && tuneUi.onScreen, 'the Tune button sits beside the Sell button, both on screen');
    await page.waitForFunction(() => window.__jye.game.scene.getScene('carlot').tag.visible, null, { timeout: 6000 });
    await page.screenshot({ path: path.join(SHOTS, 'e2e-21a-lot-tune-button.png') });
    const sticker0 = await page.evaluate((id) => window.__jye.state.carlot.cars.find((c) => c.id === id) && window.__jye.game.scene.getScene('carlot').tagText.text, tuneId);
    await page.click('.crush.tune');
    const sent = await page.evaluate((id) => {
      const s = window.__jye.state;
      return { away: s.carlot.cars.find((c) => c.id === id)?.atShop === true, job: s.paint.jobs.find((j) => j.lotCarId === id)?.services.join(',') };
    }, tuneId);
    assert(sent.away && sent.job === 'tune', 'Tune sends the car to a paint booth for an engine tune');
    await page.waitForFunction(() => document.querySelector('.sell').classList.contains('hidden') && document.querySelector('.crush.tune').classList.contains('hidden'));
    await page.waitForFunction(() => /Paint & Tuning/.test(window.__jye.game.scene.getScene('carlot').label.text), null, { timeout: 2000 });
    assert(true, 'the lot says the car is at the paint shop; it cannot be sold meanwhile');
    await goTo('paint', 'paint');
    await page.waitForFunction((id) => {
      const s = window.__jye.state;
      const v = window.__jye.game.scene.getScene('paint').debugView();
      const job = s.paint.jobs.find((j) => j.lotCarId === id);
      const ok = !!job && v.bigId === job.id && v.carVisible && !v.arriving && v.ticket;
      // Hold the job (the Painter works on it) for the checks and the screenshot.
      if (job) job.work = Math.max(job.work, 10);
      return ok;
    }, tuneId, { timeout: 5000 });
    const lotJobView = await page.evaluate(() => window.__jye.game.scene.getScene('paint').debugView());
    assert(lotJobView.ticketIcons === '⚙️' && /^🏷️ \+\$[\d.]+[KMB]?\nsticker$/.test(lotJobView.tipText) && !lotJobView.customer, `the shop shows your lot car with its sticker bonus and no customer (${lotJobView.tipText.replace('\n', ' ')})`);
    await page.screenshot({ path: path.join(SHOTS, 'e2e-21b-paint-lot-car.png') });
    const cash0 = await page.evaluate(() => window.__jye.state.cash);
    await page.waitForFunction((id) => window.__jye.state.carlot.cars.find((c) => c.id === id)?.tuned === 'tune', tuneId, { timeout: 30000 });
    const back = await page.evaluate((id) => ({ car: window.__jye.state.carlot.cars.find((c) => c.id === id), done: window.__jye.state.paint.jobsDone }), tuneId);
    assert(back.car.atShop === undefined && back.car.tuneValue > 0, `the tuned car goes back to the lot (+${back.car.tuneValue} on its sticker)`);
    await goTo('carlot', 'carlot');
    await page.waitForFunction((id) => {
      const sc = window.__jye.game.scene.getScene('carlot');
      return window.__jye.state.carlot.focusedId === id && sc.tag.visible && /⚙️/.test(sc.tagText.text);
    }, tuneId, { timeout: 4000 });
    const sticker1 = await page.evaluate(() => window.__jye.game.scene.getScene('carlot').tagText.text);
    assert(sticker1 !== sticker0 && (await page.evaluate(() => document.querySelector('.crush.tune').classList.contains('hidden'))), `its FOR SALE tag shows the tune and the higher price (${sticker0.replace('\n', ' ')} -> ${sticker1.replace('\n', ' ')}); it can't go twice`);
    await page.screenshot({ path: path.join(SHOTS, 'e2e-21c-lot-tuned.png') });
    assert((await page.evaluate(() => window.__jye.state.cash)) >= cash0 - 1, 'the shop charged nothing for your own car');
    await page.evaluate(() => {
      const s = window.__jye.state;
      s.carlot.crew.agent = true;
      s.carlot.buyerTimer = 0;
      s.paint.arrivalTimer = 0;
    });
    await goTo('scrapyard', 'yard');

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
      s.parts = 0; // the Scrapper refills the bin while away
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
      // Stop this page from saving over it (the 5 s save loop and pagehide would reset lastSeen).
      Storage.prototype.setItem = function () {};
    });
    await page.reload();
    await page.waitForSelector('.modal .buy', { timeout: 5000 });
    const title = await page.textContent('.modal h2');
    const awayText = await page.textContent('.modal');
    assert(title.includes('Welcome back') && /for (59m|1h)/.test(awayText), `welcome-back popup appears after an hour away (${awayText.match(/for [^.]+/)?.[0]})`);
    const scrapLine = (await page.textContent('.modal .offline-parts').catch(() => '')) || '';
    const partsBack = await page.evaluate(() => window.__jye.state.parts);
    assert(/\+\d+ ⚙/.test(scrapLine) && partsBack > 0, `the Scrapper topped up parts while away (${scrapLine.trim()})`);
    const shopLine = (await page.textContent('.modal .offline-garage').catch(() => '')) || '';
    assert(/Foreman fixed cars in the garage: \$/.test(shopLine), `the welcome-back popup shows the garage's earnings (${shopLine.trim()})`);
    const lotLine = (await page.textContent('.modal .offline-carlot').catch(() => '')) || '';
    assert(/lot crew bought, polished and sold cars: \$/.test(lotLine), `the welcome-back popup shows the lot's earnings (${lotLine.trim()})`);
    const paintLine = (await page.textContent('.modal .offline-paint').catch(() => '')) || '';
    assert(/Painter finished paint and tuning orders: \$/.test(paintLine), `the welcome-back popup shows the paint shop's earnings (${paintLine.trim()})`);
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
    assert((await page.textContent('.hud .sound-btn')).includes('🔇'), 'sound toggle mutes the game');
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
      s.managers.scrapper = false; // its scrap cash would muddle the sale amount
      s.garage.foreman = false; // and so would the garage Foreman's fees
      s.paint.painter = false; // and the Painter's (it still works the order held for the short-phone check)
      // ...and the Used Car Lot's walk-up sales.
      s.carlot.crew.detailer = s.carlot.crew.agent = false;
      s.carlot.cars = [];
      s.carlot.buyer = null;
      s.buyer = null;
      s.buyerTimer = 999;
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
    assert(haggleHidden && afterRare.sold === rareSale.sold + 1 && afterRare.cash - rareSale.cash === rareSale.value, `skip haggling sells a Rare car at the asking price, no slider (${JSON.stringify({ rareSale, afterRare, haggleHidden })})`);
    await page.evaluate(() => {
      window.__jye.state.managers.seller = true;
      window.__jye.state.managers.scrapper = true;
    });
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

    console.log('sell empire (P1.3b)');
    {
      const se = await browser.newContext({ ...devices['iPhone SE'] });
      const sp = await se.newPage();
      sp.on('pageerror', (e) => errors.push('sell empire pageerror: ' + e.message));
      sp.on('console', (m) => m.type() === 'error' && errors.push('sell empire console: ' + m.text()));
      await sp.goto(URL);
      await sp.waitForSelector('.modal .buy');
      await sp.click('.modal .buy');
      await sp.waitForFunction(() => window.__jye.state.cars.length > 0);
      // A rich player: 144 x $5M earned is worth 12 Legacy Points.
      await sp.evaluate(() => {
        const s = window.__jye.state;
        Object.assign(s.tutorial, { firstSale: true, firstUpgrade: true, crusherSeen: true, contractsSeen: true, barnSeen: true, mapSeen: true });
        s.carsSold = 120;
        s.cash = 0; // nothing to buy on the map, so its dot is only the Sell Empire offer
        s.lifetimeEarnings = 28e6 * Math.pow(12.5, 1.25); // worth 12 Legacy Points (ECON.legacy: $28M, ^0.8)
        s.legacy.runSeconds = 3 * 3600 + 25 * 60;
      });
      await sp.waitForFunction(() => document.querySelector('.banner')?.textContent.includes('EMPIRE FOR SALE'), null, { timeout: 15000 });
      assert(true, 'an "EMPIRE FOR SALE!" banner announces the offer');
      assert(await sp.isVisible('.map-btn .dot.on'), 'the map button shows a dot while the sale is new');
      assert(await sp.$eval('.legacy-chip', (e) => e.classList.contains('hidden')), 'no Legacy chip before the first sale');
      await sp.waitForTimeout(2600); // let the banner clear
      await sp.click('.map-btn');
      await sp.waitForSelector('.map-row.legacy');
      const row = await sp.$eval('.map-row.legacy', (e) => ({ text: e.textContent, glow: e.classList.contains('glow') }));
      assert(/\+12 Legacy Points/.test(row.text) && /x1\.00 → x1\.24/.test(row.text) && row.glow, `the map offers Sell Empire, glowing (${row.text.trim()})`);
      await sp.$eval('.map-row.legacy', (e) => e.scrollIntoView());
      await sp.screenshot({ path: path.join(SHOTS, 'e2e-21a-sell-empire-map.png') });
      await sp.click('.map-row.legacy .sell-empire');
      await sp.waitForSelector('.sell-empire-preview .modal');
      const prev = await sp.textContent('.sell-empire-preview .modal');
      assert(/\+12/.test(prev) && /x1\.24/.test(prev) && /You keep/.test(prev) && /Starts over/.test(prev) && /3h 25m|3h25m/.test(prev), 'the preview shows the points, the new multiplier, what is kept and the run time');
      const fits = await sp.$eval('.sell-empire-preview .modal', (e) => e.getBoundingClientRect().bottom <= window.innerHeight && e.getBoundingClientRect().top >= 0);
      assert(fits, 'the preview fits an iPhone SE screen');
      assert(/Motor City opens on your 2nd sale/.test(prev) && !(await sp.$('.city-pick')), 'the first sale has no city picker, only the Motor City teaser');
      assert(await sp.evaluate(() => document.getElementById('app').scrollLeft === 0), 'the game never slides sideways when a modal takes focus');
      await sp.screenshot({ path: path.join(SHOTS, 'e2e-21b-sell-empire-preview.png') });
      await sp.click('.modal .secondary');
      const kept = await sp.evaluate(() => ({ pts: window.__jye.state.legacy.points, sold: window.__jye.state.carsSold, offered: window.__jye.state.tutorial.legacyOffered }));
      assert(kept.pts === 0 && kept.sold === 120 && kept.offered, '"Not yet" keeps the empire (and the offer counts as seen)');
      assert(!(await sp.isVisible('.map-btn .dot.on')), 'the map dot clears once the preview was seen');
      await sp.click('.map-btn');
      await sp.click('.map-row.legacy .sell-empire');
      await sp.waitForSelector('.sell-empire-preview .modal .buy');
      await sp.click('.sell-empire-preview .modal .buy');
      await sp.waitForSelector('.legacy-celebrate .modal');
      const cel = await sp.textContent('.legacy-celebrate .modal');
      const after = await sp.evaluate(() => {
        const s = window.__jye.state;
        return { pts: s.legacy.points, sold: s.carsSold, cash: s.cash, empires: s.legacy.sold, intro: s.tutorial.introSeen };
      });
      assert(/EMPIRE SOLD/.test(cel) && /\+12/.test(cel) && /Grandpa Joe/.test(cel), 'a celebration with Grandpa Joe follows the sale');
      assert(after.pts === 12 && after.sold === 0 && after.cash === 0 && after.empires === 1 && after.intro, `the sale banks 12 points and resets the run (${JSON.stringify(after)})`);
      await sp.waitForTimeout(500);
      await sp.screenshot({ path: path.join(SHOTS, 'e2e-21c-sell-empire-celebrate.png') });
      await Promise.all([sp.waitForNavigation(), sp.click('.legacy-celebrate .modal .buy')]);
      await sp.waitForFunction(() => window.__jye && window.__jye.state && window.__jye.state.cars.length > 0, null, { timeout: 8000 });
      const re = await sp.evaluate(() => ({ pts: window.__jye.state.legacy.points, sold: window.__jye.state.carsSold, modal: !!document.querySelector('.modal'), map: getComputedStyle(document.querySelector('.map-btn')).display }));
      assert(re.pts === 12 && re.sold === 0 && !re.modal && re.map === 'none', 'the new empire starts in a fresh yard after the reload, no intro, map hidden again');
      await sp.waitForSelector('.legacy-chip:not(.hidden)');
      const chip = await sp.textContent('.legacy-chip');
      assert(/x1\.24/.test(chip), `the HUD shows the Legacy chip (${chip})`);
      const hudFits = await sp.evaluate(() => {
        const h = document.querySelector('.hud').getBoundingClientRect();
        return [...document.querySelectorAll('.hud > *')].filter((e) => getComputedStyle(e).display !== 'none').every((e) => e.getBoundingClientRect().right <= h.right + 0.5);
      });
      assert(hudFits, 'the top bar still fits on an iPhone SE with the chip');
      const panelFits = await sp.evaluate(() => {
        const p = document.querySelector('.panel').getBoundingClientRect();
        return [...document.querySelectorAll('.panel-head .tab, .panel-head .mode')].filter((e) => getComputedStyle(e).display !== 'none').every((e) => e.getBoundingClientRect().right <= p.right + 0.5);
      });
      assert(panelFits, 'every tab and buy mode fits the panel on a 320 px phone');
      // The new empire's yard runs (its car values already include x1.24, see legacy.test.ts).
      const val = await sp.evaluate(() => {
        const s = window.__jye.state;
        const c = s.cars[0];
        return c.value;
      });
      assert(val > 0, `the new empire's first wreck is on the way ($${val})`);
      await sp.screenshot({ path: path.join(SHOTS, 'e2e-21d-new-empire.png') });
      // Legacy tree (P1.3c): the chip has a dot while a node is affordable and opens the tree.
      assert(await sp.isVisible('.legacy-chip .dot'), 'the Legacy chip shows a dot: points to spend');
      await sp.click('.legacy-chip');
      await sp.waitForSelector('.legacy-tree .modal h2:has-text("Legacy")');
      const info = await sp.textContent('.legacy-tree .modal');
      assert(/12 of 12 points free/.test(info) && /x1\.24/.test(info) && /Sell Empire again after/.test(info), 'the tree shows the free points, the multiplier and the next sale');
      const tabs = await sp.$$eval('.tree-tab', (ts) => ts.map((t) => t.dataset.branch));
      assert(tabs.join() === 'mechanic,dealer,racer', `three branch tabs (${tabs.join()})`);
      const nodes = await sp.$$eval('.tree-node', (ns) => ns.map((n) => n.dataset.node + ':' + n.className.split(' ')[1]));
      assert(nodes.join() === 'quickHands:next,headStart:locked,partsHoarder:locked,masterCrew:locked', `the Mechanic branch lists four nodes in order (${nodes.join()})`);
      assert(await sp.$eval('.tree-node[data-node="headStart"] .tree-buy', (b) => b.disabled), 'a later node cannot be bought first');
      const treeFits = () => sp.evaluate(() => {
        const m = document.querySelector('.legacy-tree .modal').getBoundingClientRect();
        const tabsR = [...document.querySelectorAll('.tree-tab')].map((t) => t.getBoundingClientRect());
        const done = document.querySelector('.legacy-tree .modal .buy').getBoundingClientRect();
        const name = document.querySelector('.tree-tab span');
        return m.top >= 0 && m.bottom <= innerHeight + 0.5 && m.right <= innerWidth + 0.5 && done.bottom <= innerHeight + 0.5 &&
          tabsR.every((r) => r.right <= m.right + 0.5) && name.scrollWidth <= name.clientWidth + 1;
      });
      assert(await treeFits(), 'the tree fits a 320 px phone (modal, tabs, tab names and Done on screen)');
      await sp.screenshot({ path: path.join(SHOTS, 'e2e-21e-legacy-tree.png') });
      await sp.click('.tree-node[data-node="quickHands"] .tree-buy');
      await sp.waitForSelector('.tree-node[data-node="quickHands"].owned');
      const t1 = await sp.evaluate(() => ({ tree: { ...window.__jye.state.legacy.tree }, pts: window.__jye.state.legacy.points }));
      assert(t1.tree.mechanic === 1 && t1.pts === 12, 'buying Quick Hands spends 2 points and keeps all 12 for income');
      assert(/10 of 12 points free/.test(await sp.textContent('.tree-head')), 'the header counts the spent points');
      await sp.click('.tree-tab[data-branch="racer"]');
      await sp.click('.tree-node[data-node="quickTips"] .tree-buy');
      await sp.click('.tree-node[data-node="rareFinds"] .tree-buy');
      await sp.waitForSelector('.tree-node[data-node="rareFinds"].owned');
      await sp.screenshot({ path: path.join(SHOTS, 'e2e-21f-legacy-racer.png') });
      assert(await treeFits(), 'still fits with the respec line showing');
      const t2 = await sp.evaluate(() => ({ ...window.__jye.state.legacy.tree }));
      assert(t2.racer === 2, 'two Racer nodes bought');
      assert(/respec: refund 7/.test(await sp.textContent('.tree-respec')), 'respec offers to refund the 7 spent points');
      await sp.click('.tree-respec');
      const t3 = await sp.evaluate(() => ({ tree: { ...window.__jye.state.legacy.tree }, used: window.__jye.state.legacy.respecUsed }));
      assert(t3.tree.mechanic === 0 && t3.tree.racer === 0 && t3.used, 'respec refunds every node, once');
      assert(/Respec used/.test(await sp.textContent('.legacy-tree .modal')) || (await sp.$('.tree-respec')) === null, 'no second respec this empire');
      await sp.click('.tree-node[data-node="quickTips"] .tree-buy');
      await sp.click('.legacy-tree .modal .buy');
      assert((await sp.$('.legacy-tree')) === null, 'Done closes the tree');
      // Bought nodes are saved.
      await sp.evaluate(() => window.__jye.saveNow());
      await sp.reload();
      await sp.waitForFunction(() => window.__jye && window.__jye.state);
      const t4 = await sp.evaluate(() => ({ ...window.__jye.state.legacy.tree }));
      assert(t4.racer === 1 && t4.mechanic === 0, `the tree survives a reload (${JSON.stringify(t4)})`);
      // P1.3e: a node-bought animation, then the perk shows as a chip on the tabs it changes.
      assert(!(await sp.isVisible('.perk-strip')), 'no perk chips on the Upgrades tab before Quick Hands');
      await sp.click('.legacy-chip');
      await sp.waitForSelector('.legacy-tree .modal');
      await sp.click('.tree-tab[data-branch="mechanic"]');
      await sp.click('.tree-node[data-node="quickHands"] .tree-buy');
      const anim = await sp.evaluate(() => ({
        row: !!document.querySelector('.tree-node[data-node="quickHands"].owned.just-bought'),
        spend: document.querySelector('.tree-node[data-node="quickHands"] .tree-spend')?.textContent ?? '',
        pulse: document.querySelector('.tree-head')?.classList.contains('pulse'),
      }));
      assert(anim.row && /−2/.test(anim.spend) && anim.pulse, `buying a node pops the row, floats "−2 🏛" and pulses the points (${JSON.stringify(anim)})`);
      await sp.waitForTimeout(250);
      await sp.screenshot({ path: path.join(SHOTS, 'e2e-21g-node-bought.png') });
      await sp.waitForTimeout(1100);
      assert((await sp.$('.tree-spend')) === null, 'the floating spend text cleans itself up');
      await sp.click('.legacy-tree .modal .buy');
      await sp.waitForSelector('.perk-strip .perk-chip[data-perk="quickHands"]', { state: 'visible' });
      const strip = await sp.evaluate(() => {
        const p = document.querySelector('.panel').getBoundingClientRect();
        const st = document.querySelector('.perk-strip').getBoundingClientRect();
        const c = document.querySelector('.cards').getBoundingClientRect();
        return { text: document.querySelector('.perk-strip').textContent, inPanel: st.left >= p.left && st.right <= p.right + 0.5, h: st.height, above: st.bottom <= c.top + 0.5, cardsH: c.height };
      });
      assert(/\+25% taps/.test(strip.text) && strip.inPanel && strip.h <= 20 && strip.above && strip.cardsH > 60, `the Upgrades tab names Quick Hands in a slim chip row (${JSON.stringify(strip)})`);
      await sp.screenshot({ path: path.join(SHOTS, 'e2e-21h-perk-strip.png') });
      // Night Shift: the welcome-back popup names it and counts the longer cap.
      await sp.evaluate(() => {
        const s = window.__jye.state;
        s.legacy.points = 22; // 2 (Quick Hands) + 2 (Silver Tongue) + 18 (the whole Racer branch); all-time earnings must back it
        s.legacy.allTime = 28e6 * Math.pow(22, 1.25);
        s.legacy.tree.racer = 4;
        s.legacy.tree.dealer = 1;
        s.carsSold = 5;
        s.managers.mechanic = s.managers.washer = s.managers.seller = true;
        s.lastSeen = Date.now() - 3 * 3600 * 1000;
        const data = JSON.stringify(s);
        let h = 0x811c9dc5;
        for (let i = 0; i < data.length; i++) { h ^= data.charCodeAt(i); h = Math.imul(h, 0x01000193); }
        const env = JSON.stringify({ v: s.version, savedAt: Date.now() + 10, sum: (h >>> 0).toString(16).padStart(8, '0'), data });
        localStorage.setItem('jye_save_a', env);
        localStorage.setItem('jye_save_b', env);
        Storage.prototype.setItem = function () {};
      });
      await sp.reload();
      await sp.waitForSelector('.modal .offline-perk', { timeout: 8000 });
      const wb = await sp.textContent('.modal');
      assert(/working for (2h 59m|3h 0m)/.test(wb) && /4h cap/.test(wb) && !/You were away/.test(wb), `with Night Shift the crew works the full 3 hours away (${wb.match(/working for [^.]+/)?.[0]})`);
      await sp.screenshot({ path: path.join(SHOTS, 'e2e-21i-night-shift.png') });
      // Silver Tongue: a badge on the haggle box names the wider PERFECT zone.
      await sp.click('.modal .buy');
      await sp.evaluate(() => {
        const s = window.__jye.state;
        s.managers.seller = false;
        const c = s.cars.find((x) => x.id === s.focusedId) ?? s.cars[0];
        c.dirt = 0;
        c.damage = 0;
        c.rarity = 'rare';
      });
      await sp.waitForSelector('.sell:not(.hidden)');
      await sp.click('.sell');
      await sp.waitForSelector('.haggle:not(.hidden) .perk-chip[data-perk="silverTongue"]');
      const hb = await sp.evaluate(() => {
        const h = document.querySelector('.haggle').getBoundingClientRect();
        const c = document.querySelector('.haggle .perk-chip').getBoundingClientRect();
        const z = document.querySelector('.haggle .zone-perfect').getBoundingClientRect();
        return { chipIn: c.left >= h.left && c.right <= h.right && c.top >= 0, zone: z.width / document.querySelector('.haggle-track').getBoundingClientRect().width };
      });
      assert(hb.chipIn && hb.zone > 0.15, `the haggle box shows the Silver Tongue badge over a wider zone (${JSON.stringify(hb)})`);
      await sp.screenshot({ path: path.join(SHOTS, 'e2e-21j-silver-tongue.png') });
      await sp.click('.haggle');
      await se.close();
    }

    console.log('motor city (P1.3d)');
    {
      const mc = await browser.newContext({ ...devices['iPhone SE'] });
      const mp = await mc.newPage();
      mp.on('pageerror', (e) => errors.push('motor city pageerror: ' + e.message));
      mp.on('console', (m) => m.type() === 'error' && errors.push('motor city console: ' + m.text()));
      await mp.goto(URL);
      await mp.waitForSelector('.modal .buy');
      await mp.click('.modal .buy');
      await mp.waitForFunction(() => window.__jye.state.cars.length > 0);
      // A second empire ready to sell: 12 points from the first sale, enough earned for 10 more.
      await mp.evaluate(() => {
        const s = window.__jye.state;
        Object.assign(s.tutorial, { firstSale: true, firstUpgrade: true, crusherSeen: true, contractsSeen: true, barnSeen: true, mapSeen: true, legacyOffered: true });
        s.carsSold = 120;
        s.cash = 0;
        s.legacy.sold = 1;
        s.legacy.points = 12;
        s.legacy.allTime = 28e6 * Math.pow(12, 1.25);
        s.lifetimeEarnings = 28e6 * Math.pow(22.5, 1.25) - s.legacy.allTime;
        s.legacy.runSeconds = 2 * 3600;
      });
      await mp.waitForSelector('.map-btn:not(.hidden)');
      await mp.click('.map-btn');
      await mp.waitForSelector('.map-row.legacy .sell-empire');
      await mp.click('.map-row.legacy .sell-empire');
      await mp.waitForSelector('.sell-empire-preview .city-pick');
      const pick = await mp.$$eval('.city-opt', (bs) => bs.map((b) => `${b.dataset.city}:${b.getAttribute('aria-checked')}:${b.textContent}`));
      assert(pick.length === 2 && /^rustValley:false:.*Stay/.test(pick[0]) && /^motorCity:true:.*Motor City.*x3/.test(pick[1]), `the 2nd sale offers Rust Valley or Motor City, Motor City picked (${pick.join(' | ')})`);
      await mp.screenshot({ path: path.join(SHOTS, 'e2e-22a-city-pick.png') });
      const mFits = await mp.$eval('.sell-empire-preview .modal', (e) => {
        const r = e.getBoundingClientRect();
        const b = e.querySelector('.buy').getBoundingClientRect();
        const o = [...e.querySelectorAll('.city-opt')].map((x) => x.getBoundingClientRect());
        return r.top >= 0 && r.bottom <= innerHeight + 0.5 && b.bottom <= innerHeight + 0.5 && o.every((x) => x.right <= r.right && x.left >= r.left) && o[0].right <= o[1].left;
      });
      assert(mFits, 'the preview with the city picker fits an iPhone SE (cards side by side, Sell button on screen)');
      await mp.click('.city-opt[data-city="rustValley"]');
      assert(await mp.$eval('.city-opt[data-city="rustValley"]', (b) => b.classList.contains('on') && b.getAttribute('aria-checked') === 'true'), 'tapping Rust Valley picks it');
      await mp.click('.city-opt[data-city="motorCity"]');
      assert(await mp.$eval('.city-opt[data-city="motorCity"]', (b) => b.classList.contains('on')) && !(await mp.$eval('.city-opt[data-city="rustValley"]', (b) => b.classList.contains('on'))), 'tapping Motor City picks it back');
      await mp.click('.sell-empire-preview .modal .buy');
      await mp.waitForSelector('.legacy-celebrate .modal');
      const mcel = await mp.textContent('.legacy-celebrate .modal');
      assert(/Next stop: .*Motor City/.test(mcel) && /\+10/.test(mcel), `the celebration names the next city (${mcel.match(/Next stop[^.]*/)?.[0]})`);
      assert((await mp.evaluate(() => window.__jye.state.legacy.city)) === 'motorCity', 'the new empire is in Motor City');
      await mp.waitForTimeout(400);
      await mp.screenshot({ path: path.join(SHOTS, 'e2e-22b-motor-city-sold.png') });
      await Promise.all([mp.waitForNavigation(), mp.click('.legacy-celebrate .modal .buy')]);
      await mp.waitForFunction(() => window.__jye && window.__jye.state && window.__jye.state.cars.length > 0, null, { timeout: 8000 });
      const mcs = await mp.evaluate(() => ({ city: window.__jye.state.legacy.city, pts: window.__jye.state.legacy.points, car: window.__jye.state.cars[0].value }));
      assert(mcs.city === 'motorCity' && mcs.pts === 22, `Motor City survives the reload (${JSON.stringify(mcs)})`);
      // P1.3d3c: the day checks below must not depend on the machine's clock ("auto" turns Motor City to night after
      // 7 pm); the night look is checked at the end of this section through the Settings sheet.
      await mp.evaluate(() => { window.__jye.state.settings.cityLights = 'day'; });
      // P1.3d3: the yard is painted in Motor City's colours: asphalt (blue over red) and a skyline in the sky.
      await mp.waitForTimeout(800);
      const mYard = await mp.evaluate(() => {
        const img = window.__jye.game.textures.get('backdrop').getSourceImage();
        const ctx = img.getContext('2d');
        const px = (x, y) => Array.from(ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data.slice(0, 3));
        return { ground: px(4, img.height - 4), w: img.width, h: img.height };
      });
      assert(mYard.ground[2] > mYard.ground[0], `the Motor City yard is asphalt, not dirt (ground rgb ${mYard.ground.join(',')})`);
      await mp.screenshot({ path: path.join(SHOTS, 'e2e-22b2-motor-city-yard.png') });
      // Prices are x3: the Wash Bay's first level costs $450 instead of $150.
      await mp.click('.tab:nth-child(1)');
      const washBtn = await mp.textContent('.cards .card:first-child .buy');
      assert(/\$450/.test(washBtn), `Motor City prices are x3 (Wash Bay ${washBtn})`);
      await mp.evaluate(() => { window.__jye.state.carsSold = 30; });
      await mp.waitForSelector('.map-btn:not(.hidden)');
      await mp.waitForTimeout(2600); // let the CITY MAP banner clear
      await mp.click('.map-btn');
      await mp.waitForSelector('.modal.city-map h2');
      const mTitle = await mp.textContent('.modal.city-map h2');
      const goal = await mp.textContent('.map-row[data-biz="garage"]');
      assert(mTitle === 'Motor City' && /\$600(\.0+)?K/.test(goal), `the map is titled Motor City and the garage goal is x3 (${mTitle}; ${goal.trim()})`);
      await mp.waitForTimeout(700); // the map slides in
      await mp.screenshot({ path: path.join(SHOTS, 'e2e-22c-motor-city-map.png') });
      // P1.3d2: Motor City has its own map (highway, rooftops, no grass) and its own business names.
      const mMap = await mp.evaluate(() => {
        const svg = document.querySelector('.modal.city-map .city-svg');
        return {
          city: svg.dataset.city,
          aria: svg.getAttribute('aria-label'),
          highway: !!svg.querySelector('.highway'),
          roofs: svg.querySelectorAll('.roof').length,
          rows: [...document.querySelectorAll('.map-row .map-name')].map((n) => n.textContent.trim()),
          w: svg.getBoundingClientRect().width,
          vw: window.innerWidth,
        };
      });
      assert(mMap.city === 'motorCity' && mMap.aria === 'Motor City city map' && mMap.highway && mMap.roofs >= 8, `Motor City draws its own map (${JSON.stringify(mMap)})`);
      assert(/^Salvage Yard/.test(mMap.rows[0]) && /^Midtown Garage/.test(mMap.rows[1] || ''), `the map list uses Motor City's names (${mMap.rows.join(' | ')})`);
      assert(mMap.w <= mMap.vw, `the Motor City map fits the phone (${mMap.w} <= ${mMap.vw})`);
      await mp.click('.modal.city-map > .buy');
      await mp.waitForSelector('.modal.city-map', { state: 'detached', timeout: 3000 });
      const mBtn = await mp.evaluate(() => {
        const b = document.querySelector('.map-btn');
        const t = b.querySelector('.city-tag');
        return { aria: b.getAttribute('aria-label'), tag: t.textContent, shown: getComputedStyle(t).display !== 'none' };
      });
      assert(mBtn.aria === 'Motor City map' && mBtn.shown && mBtn.tag === '🏙️', `the map button names the city and shows its icon (${JSON.stringify(mBtn)})`);
      // Go to the garage: its sign carries the Motor City name and the drive wipe says so too.
      await mp.evaluate(() => {
        const s = window.__jye.state;
        s.lifetimeEarnings += 1e7;
        s.cash += 1e7;
      });
      await mp.click('.map-btn');
      await mp.waitForSelector('.map-row[data-biz="garage"] button:not([disabled])');
      await mp.click('.map-row[data-biz="garage"] button');
      await mp.waitForFunction(() => window.__jye.state.businesses.opened.garage);
      await mp.click('.map-row[data-biz="garage"] button');
      const mWipe = await mp.waitForSelector('.drive-wipe', { timeout: 1000 }).then((h) => h.textContent()).catch(() => null);
      assert(mWipe && mWipe.includes('Midtown Garage'), `"Go" drives to the Midtown Garage (${mWipe})`);
      await mp.waitForFunction(() => window.__jye.game.scene.isActive('garage'), null, { timeout: 5000 });
      await mp.waitForSelector('.drive-wipe', { state: 'detached', timeout: 3000 });
      await mp.waitForTimeout(800);
      await mp.screenshot({ path: path.join(SHOTS, 'e2e-22d-midtown-garage.png') });
      // P1.3d3b: the garage, the lot and the paint shop are painted in Motor City colours.
      const bgPx = (key, fx, fy) =>
        mp.evaluate(
          ([k, x, y]) => {
            const img = window.__jye.game.textures.get(k).getSourceImage();
            const c = img.getContext('2d');
            return Array.from(c.getImageData(Math.round(img.width * x), Math.round(img.height * y), 1, 1).data.slice(0, 3));
          },
          [key, fx, fy],
        );
      const gWall = await bgPx('garage-backdrop', 0.97, 0.02);
      assert(gWall[2] > gWall[1] && gWall[2] > gWall[0], `the Midtown Garage wall is steel blue, not teal (rgb ${gWall.join(',')})`);
      const goTo = async (biz, scene, shot) => {
        await mp.evaluate(() => {
          const s = window.__jye.state;
          s.lifetimeEarnings += 1e10;
          s.cash += 1e10;
        });
        await mp.click('.map-btn');
        await mp.waitForSelector(`.map-row[data-biz="${biz}"] button:not([disabled])`);
        await mp.click(`.map-row[data-biz="${biz}"] button`);
        await mp.waitForFunction((b) => window.__jye.state.businesses.opened[b], biz);
        await mp.click(`.map-row[data-biz="${biz}"] button`);
        await mp.waitForFunction((sc) => window.__jye.game.scene.isActive(sc), scene, { timeout: 5000 });
        await mp.waitForSelector('.drive-wipe', { state: 'detached', timeout: 3000 });
        await mp.waitForTimeout(800);
        await mp.screenshot({ path: path.join(SHOTS, shot) });
      };
      await goTo('carlot', 'carlot', 'e2e-22e-motor-city-lot.png');
      const lSky = await bgPx('carlot-backdrop', 0.5, 0.01);
      assert(lSky[0] < 80 && lSky[1] < 120 && lSky[2] > lSky[0], `the Motor City lot has a dusk steel-blue sky (rgb ${lSky.join(',')})`);
      await goTo('paint', 'paint', 'e2e-22f-motor-city-paint.png');
      // P1.3q2: on an iPhone SE the tap hint pill sits below the car's name/price label, not over its lettering.
      const labelVsHint = await mp.evaluate(() => {
        const sc = window.__jye.game.scene.getScene('paint');
        const c = document.querySelector('#game canvas').getBoundingClientRect();
        const z = window.__jye.game.scale.zoom;
        const b = sc.label.getBounds();
        const hint = document.querySelector('.hint');
        const hr = hint.getBoundingClientRect();
        // The pill bobs up by 5 px: compare with the top of its bob, wherever the animation is right now.
        const ty = parseFloat((getComputedStyle(hint).translate || '0 0').split(' ')[1] || '0') || 0;
        return { text: sc.label.text, labelBottom: c.top + b.bottom * z, hintTop: hr.top - ty - 5, hint: hint.textContent, shown: !hint.classList.contains('hidden') };
      });
      assert(
        labelVsHint.text && labelVsHint.shown && labelVsHint.labelBottom <= labelVsHint.hintTop + 1,
        `the paint shop's tap hint clears the car label on a 320x568 phone (${JSON.stringify(labelVsHint)})`,
      );
      const pWall = await bgPx('paint-backdrop', 0.02, 0.02);
      assert(pWall[2] - pWall[0] > 50, `the Motor City paint booth has cool steel-blue panels (rgb ${pWall.join(',')})`);

      // P1.3d3c: City lights -> Night in the Settings sheet turns every Motor City scene to its neon night look.
      await mp.click('.settings-btn');
      await mp.waitForSelector('.modal.settings .lights-row');
      await mp.waitForTimeout(500);
      const litFit = await mp.$eval('.modal.settings .lights-row', (r) => {
        const box = r.closest('.modal').getBoundingClientRect();
        const btns = [...r.querySelectorAll('.seg-btn')].map((b) => b.getBoundingClientRect());
        return { n: btns.length, fits: btns.every((b) => b.right <= box.right + 0.5 && b.left >= box.left - 0.5), oneLine: btns.every((b) => Math.abs(b.top - btns[0].top) < 2), on: r.querySelector('.seg-btn.on')?.dataset.lights };
      });
      assert(litFit.n === 3 && litFit.fits && litFit.oneLine && litFit.on === 'day', `the City lights row shows Auto/Day/Night on one line on an iPhone SE (${JSON.stringify(litFit)})`);
      const sheet = await mp.$eval('.modal.settings', (m) => {
        const r = m.getBoundingClientRect();
        return { top: r.top, bottom: r.bottom, vh: innerHeight, scrolls: m.scrollHeight > m.clientHeight + 1, overflow: getComputedStyle(m).overflowY };
      });
      assert(sheet.top >= 0 && sheet.bottom <= sheet.vh + 0.5 && (!sheet.scrolls || sheet.overflow === 'auto'), `the Settings sheet fits an iPhone SE or scrolls, so Done stays reachable (${JSON.stringify(sheet)})`);
      await mp.click('.modal.settings .lights-row .seg-btn[data-lights="night"]');
      assert((await mp.evaluate(() => window.__jye.state.settings.cityLights)) === 'night', 'tapping Night sets City lights to night');
      await mp.$eval('.modal.settings .lights-row', (r) => r.scrollIntoView({ block: 'center' }));
      await mp.screenshot({ path: path.join(SHOTS, 'e2e-22g-city-lights-setting.png') });
      await mp.click('.modal.settings .buy');
      await mp.waitForTimeout(900); // the scene repaints within half a second
      const lum = (c) => c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
      const pNight = await bgPx('paint-backdrop', 0.02, 0.02);
      assert(lum(pNight) < lum(pWall) * 0.8 && pNight[2] > pNight[0], `the paint booth turns a deeper night blue (rgb ${pWall.join(',')} -> ${pNight.join(',')})`);
      await mp.screenshot({ path: path.join(SHOTS, 'e2e-22h-motor-city-paint-night.png') });
      const goBack = async (biz, scene, shot) => {
        await mp.click('.map-btn');
        await mp.waitForSelector(`.map-row[data-biz="${biz}"] button:not([disabled])`);
        await mp.click(`.map-row[data-biz="${biz}"] button`);
        await mp.waitForFunction((sc) => window.__jye.game.scene.isActive(sc), scene, { timeout: 5000 });
        await mp.waitForSelector('.drive-wipe', { state: 'detached', timeout: 3000 });
        await mp.waitForTimeout(800);
        await mp.screenshot({ path: path.join(SHOTS, shot) });
      };
      await goBack('carlot', 'carlot', 'e2e-22i-motor-city-lot-night.png');
      const lNight = await bgPx('carlot-backdrop', 0.5, 0.01);
      assert(lum(lNight) < lum(lSky) * 0.5, `the lot's sky turns to night (rgb ${lSky.join(',')} -> ${lNight.join(',')})`);
      await goBack('garage', 'garage', 'e2e-22j-midtown-garage-night.png');
      const gNight = await bgPx('garage-backdrop', 0.97, 0.02);
      assert(gNight[2] > gNight[0] && lum(gNight) <= lum(gWall), `the garage stays lit, a little dimmer at night (rgb ${gWall.join(',')} -> ${gNight.join(',')})`);
      await goBack('scrapyard', 'yard', 'e2e-22k-motor-city-yard-night.png');
      const yNight = await mp.evaluate(() => {
        const img = window.__jye.game.textures.get('backdrop').getSourceImage();
        return Array.from(img.getContext('2d').getImageData(4, 4, 1, 1).data.slice(0, 3));
      });
      assert(lum(yNight) < 60 && yNight[2] > yNight[0], `the yard's sky is a night sky (rgb ${yNight.join(',')})`);
      await mc.close();
    }

    console.log('narrow top bar and book (run 28)');
    {
      const nc = await browser.newContext({ ...devices['iPhone SE'] });
      const np = await nc.newPage();
      np.on('pageerror', (e) => errors.push('narrow pageerror: ' + e.message));
      await np.goto(URL);
      await np.waitForSelector('.modal .buy');
      await np.click('.modal .buy');
      await np.waitForFunction(() => window.__jye.state.cars.length > 0);
      // A late-game top bar: big cash and rate, the Legacy chip, parts, 📒, the city map and Settings.
      await np.evaluate(() => {
        const s = window.__jye.state;
        Object.assign(s.tutorial, { firstSale: true, firstUpgrade: true, crusherSeen: true, contractsSeen: true, barnSeen: true, mapSeen: true, legacyOffered: true });
        s.carsSold = 400;
        s.cash = 123456789;
        s.parts = 1234;
        s.legacy.points = 40;
        s.legacy.sold = 2;
        s.legacy.city = 'motorCity';
        const ms = Object.keys(s.collection.models);
        ms.forEach((m, i) => {
          if (i % 3 !== 2) s.collection.models[m] = { sold: [1, 12, 60, 230][i % 4], best: i % 4, seen: i % 5 !== 0 };
        });
        window.__jye.ui.deps.incomePerSecond = () => 123456;
      });
      await np.waitForTimeout(1500);
      await np.screenshot({ path: path.join(SHOTS, 'e2e-24a-narrow-hud.png') });
      const bar = await np.evaluate(() => {
        const h = document.querySelector('.hud').getBoundingClientRect();
        const items = [...document.querySelectorAll('.hud .money > *, .hud .chips > *, .hud > .icon-btn')]
          .filter((e) => getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0)
          .map((e) => ({ c: e.className.split(' ').slice(0, 2).join('.'), r: e.getBoundingClientRect() }));
        const inside = items.every((i) => i.r.left >= h.left - 0.5 && i.r.right <= h.right + 0.5 && i.r.top >= h.top - 0.5 && i.r.bottom <= h.bottom + 0.5);
        const overlaps = [];
        for (let a = 0; a < items.length; a++)
          for (let b = a + 1; b < items.length; b++) {
            const p = items[a].r;
            const q = items[b].r;
            if (p.left < q.right - 0.5 && q.left < p.right - 0.5 && p.top < q.bottom - 0.5 && q.top < p.bottom - 0.5) overlaps.push(`${items[a].c}/${items[b].c}`);
          }
        return { n: items.length, inside, overlaps, cash: document.querySelector('.hud .cash').textContent, rate: document.querySelector('.hud .rate').textContent };
      });
      assert(bar.n === 7 && bar.inside && bar.overlaps.length === 0, `a full top bar fits a 320 px phone without overlaps (${JSON.stringify(bar)})`);
      await np.click('.book-btn');
      await np.waitForSelector('.book .modal .book-card');
      await np.waitForTimeout(500);
      await np.screenshot({ path: path.join(SHOTS, 'e2e-24b-book-320.png') });
      const fit = await np.evaluate(() => {
        const m = document.querySelector('.book .modal').getBoundingClientRect();
        const done = document.querySelector('.book .modal .buy').getBoundingClientRect();
        const cards = [...document.querySelectorAll('.book-set')[0].querySelectorAll('.book-card')].map((c) => c.getBoundingClientRect());
        const cols = new Set(cards.map((c) => Math.round(c.left))).size;
        const list = document.querySelector('.book-sets');
        return { inView: m.top >= 0 && m.bottom <= innerHeight && m.right <= innerWidth, doneOn: done.bottom <= innerHeight, cols, scrolls: list.scrollHeight > list.clientHeight, cardsFit: cards.every((c) => c.right <= m.right) };
      });
      assert(fit.inView && fit.doneOn && fit.cols === 2 && fit.scrolls && fit.cardsFit, `the book fits an iPhone SE: two cards a row, the list scrolls, Done on screen (${JSON.stringify(fit)})`);
      await np.click('.book-tabs [data-page="brands"]');
      await np.waitForTimeout(300);
      await np.screenshot({ path: path.join(SHOTS, 'e2e-24c-book-brands.png') });
      const brandSets = await np.$$eval('.book-set', (ss) => ss.map((x) => x.dataset.set));
      assert(brandSets.join() === 'brand:Vortex,brand:Stallion,brand:Kaze,brand:Regalia', `the Brands page lists the four brand sets (${brandSets.join()})`);
      await nc.close();
    }

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
    const extra = await gal.evaluate(() => ({
      crew: document.querySelectorAll('.car-gallery canvas[data-crew]').length,
      barn: document.querySelectorAll('.car-gallery canvas[data-barn]').length,
      // Reveal tarp: no car paint (the red PAINTS[0]) may show above the tarp's hem.
      tarpLeaks: [...document.querySelectorAll('.car-gallery canvas[data-tarp]')].map((c) => {
        const d = c.getContext('2d').getImageData(0, 0, c.width, Math.floor(c.height * 0.7)).data;
        let red = 0;
        for (let i = 0; i < d.length; i += 4) if (d[i] > 200 && d[i + 1] < 100 && d[i + 2] < 100) red++;
        return red;
      }),
    }));
    assert(extra.crew === 3 && extra.barn === 5, 'gallery draws the Scrapper, the press, the Foreman and 5 barn stages');
    assert(extra.tarpLeaks.every((n) => n < 30), `the reveal tarp covers vans, SUVs and pickups (${extra.tarpLeaks.join(', ')} red px)`);
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
    // Page errors explain most timeouts (a throw in a scene's update stops the game loop).
    if (errors.length) console.error('Page errors so far:\n  ' + errors.slice(0, 10).join('\n  '));
  } finally {
    await browser?.close();
    try {
      process.kill(-server.pid);
    } catch {
      server.kill();
    }
    process.exit(failed ? 1 : 0);
  }
})();
