import { describe, expect, it } from 'vitest';
import { ECON, type PaintService } from '../src/core/config';
import {
  boothCost,
  buyBooth,
  buyPaintUpgrade,
  currentService,
  expectedPaintOrder,
  generatePaintJob,
  hirePainter,
  hypeMultiplier,
  orderWork,
  PAINT_SERVICES,
  paintFee,
  paintIdleIncome,
  paintOfflineEarnings,
  paintTap,
  paintUpgradeCost,
  paintWorkPerTap,
  sanitizePaint,
  tickPaint,
  tipDeadline,
  tipFor,
} from '../src/core/paint';
import { businessStatus, businessTier, nextTierGoal } from '../src/core/businesses';
import { checksum, deserialize, serialize } from '../src/core/save';
import { applyElapsed, tick, type GameEvent } from '../src/core/sim';
import { newGame, SAVE_VERSION, type GameState, type PaintJob } from '../src/core/state';

const T0 = 1_800_000_000_000;

function openShop(seed = 7): GameState {
  const s = newGame(T0, seed);
  s.businesses.opened.paint = true;
  return s;
}

function waitForCar(s: GameState): PaintJob {
  for (let i = 0; i < 100 && s.paint.jobs.length === 0; i++) tickPaint(s, 0.1, []);
  return s.paint.jobs[0]!;
}

/** Tap a job until its order is done; returns the events. */
function tapAll(s: GameState, job: PaintJob): GameEvent[] {
  const out: GameEvent[] = [];
  for (let i = 0; i < 500 && s.paint.jobs.includes(job); i++) out.push(...paintTap(s, job.id));
  return out;
}

describe('paint & tuning', () => {
  it('does nothing until the shop is open', () => {
    const s = newGame(T0, 1);
    tick(s, 30);
    expect(s.paint.jobs).toEqual([]);
    expect(hirePainter(s)).toBe(false);
    expect(buyPaintUpgrade(s, 'booth')).toBe(false);
    expect(buyBooth(s)).toBe(false);
  });

  it('is "coming soon" on the map until its scene ships', () => {
    const s = newGame(T0, 1);
    s.lifetimeEarnings = ECON.businesses.list.paint.unlockLifetime;
    expect(businessStatus(s, 'paint')).toBe(ECON.businesses.list.paint.ready ? 'forSale' : 'soon');
  });

  it('a customer orders 1-3 different services in menu order, with the fee fixed on arrival', () => {
    const s = openShop();
    const job = waitForCar(s);
    expect(job.services.length).toBeGreaterThanOrEqual(1);
    expect(job.services.length).toBeLessThanOrEqual(3);
    expect(job.step).toBe(0);
    expect(job.work).toBe(ECON.paint.services[job.services[0]!].work);
    expect(job.fee).toBe(paintFee(job.family, job.services, 1));
    expect(job.newPaint).not.toBe(job.paint);
    expect(s.paint.focusedId).toBe(job.id);
    // One booth: no second car while the first waits.
    tickPaint(s, 30, []);
    expect(s.paint.jobs).toHaveLength(1);
  });

  it('orders over many seeds: every size shows up, no repeats, always menu order', () => {
    const sizes = new Set<number>();
    const seen = new Set<PaintService>();
    for (let seed = 1; seed <= 300; seed++) {
      const j = generatePaintJob(openShop(seed));
      sizes.add(j.services.length);
      j.services.forEach((k) => seen.add(k));
      expect(new Set(j.services).size).toBe(j.services.length);
      const idx = j.services.map((k) => PAINT_SERVICES.indexOf(k));
      expect([...idx].sort((a, b) => a - b)).toEqual(idx);
    }
    expect([...sizes].sort()).toEqual([1, 2, 3]);
    expect(seen.size).toBe(PAINT_SERVICES.length);
  });

  it('bigger orders pay a combo bonus on top of the services', () => {
    const one = paintFee('sedan', ['respray'], 1);
    const two = paintFee('sedan', ['respray', 'rims'], 1);
    const sum = (ECON.paint.services.respray.feeMult + ECON.paint.services.rims.feeMult) / ECON.paint.services.respray.feeMult;
    expect(two / one).toBeCloseTo(sum * (1 + ECON.paint.comboBonus), 2);
    expect(paintFee('hyper', ['tune'], 1)).toBeGreaterThan(paintFee('hatch', ['tune'], 1));
    expect(paintFee('sedan', ['respray'], 3)).toBe(Math.round(paintFee('sedan', ['respray'], 1) * hypeMultiplier(3)));
  });

  it('taps work through the services one after another, then the customer pays', () => {
    const s = openShop(11);
    s.paint.jobs = [];
    s.paint.arrivalTimer = 0;
    const job = generatePaintJob(s);
    job.services = ['respray', 'rims', 'tune'];
    job.work = ECON.paint.services.respray.work;
    job.fee = paintFee(job.family, job.services, 1);
    job.age = 999; // too slow for a tip
    s.paint.jobs.push(job);
    const events = tapAll(s, job);
    const steps = events.filter((e) => e.type === 'paintStepDone').map((e) => (e as { service: PaintService }).service);
    expect(steps).toEqual(['respray', 'rims', 'tune']);
    const done = events.find((e) => e.type === 'paintDone') as Extract<GameEvent, { type: 'paintDone' }>;
    expect(done.amount).toBe(job.fee);
    expect(done.tip).toBe(0);
    expect(s.cash).toBe(job.fee);
    expect(s.lifetimeEarnings).toBe(job.fee);
    expect(s.paint.jobsDone).toBe(1);
    expect(s.paint.earned).toBe(job.fee);
  });

  it('a quick hand-finished order earns a tip; a slow one or the Painter does not', () => {
    const s = openShop(5);
    const job = waitForCar(s);
    const fee = job.fee;
    const done = tapAll(s, job).find((e) => e.type === 'paintDone') as Extract<GameEvent, { type: 'paintDone' }>;
    expect(done.tip).toBe(tipFor(job));
    expect(done.amount).toBe(fee + tipFor(job));
    expect(s.paint.tips).toBe(1);

    const slow = waitForCar(s);
    slow.age = tipDeadline(slow) + 0.1;
    const d2 = tapAll(s, slow).find((e) => e.type === 'paintDone') as Extract<GameEvent, { type: 'paintDone' }>;
    expect(d2.tip).toBe(0);

    // A Painter fast enough to beat the tip deadline still earns no tip (tips reward the player).
    s.paint.painter = true;
    s.paint.levels.booth = 200;
    const auto = waitForCar(s);
    const events: GameEvent[] = [];
    for (let i = 0; i < 2000 && s.paint.jobs.includes(auto); i++) tickPaint(s, 0.05, events);
    const d3 = events.find((e) => e.type === 'paintDone') as Extract<GameEvent, { type: 'paintDone' }>;
    expect(d3.auto).toBe(true);
    expect(d3.tip).toBe(0);
    expect(auto.age).toBeLessThanOrEqual(tipDeadline(auto));
  });

  it('a tap on a finished or unknown job does nothing', () => {
    const s = openShop();
    expect(paintTap(s, 999)).toEqual([]);
    const job = waitForCar(s);
    tapAll(s, job);
    expect(paintTap(s, job.id)).toEqual([]);
    expect(currentService({ ...job, step: job.services.length })).toBeNull();
  });

  it('upgrades: Spray Booth speeds taps, Hype raises new fees, booths let more cars in', () => {
    const s = openShop();
    s.cash = s.lifetimeEarnings = 1e12;
    const before = paintWorkPerTap(s);
    expect(buyPaintUpgrade(s, 'booth')).toBe(true);
    expect(paintWorkPerTap(s)).toBeGreaterThan(before);
    expect(buyPaintUpgrade(s, 'hype')).toBe(true);
    expect(paintUpgradeCost('hype', 2, 1)).toBeGreaterThan(paintUpgradeCost('hype', 1, 1));
    const job = waitForCar(s);
    expect(job.fee).toBe(paintFee(job.family, job.services, 2));
    expect(buyBooth(s)).toBe(true);
    expect(buyBooth(s)).toBe(true);
    expect(boothCost(s.paint.booths, 1)).toBeNull();
    expect(buyBooth(s)).toBe(false);
    for (let i = 0; i < 200; i++) tickPaint(s, 0.1, []);
    expect(s.paint.jobs).toHaveLength(3);
    expect(hirePainter(s)).toBe(true);
    expect(hirePainter(s)).toBe(false);
  });

  it('upgrades refuse when cash is short', () => {
    const s = openShop();
    expect(buyPaintUpgrade(s, 'booth')).toBe(false);
    expect(hirePainter(s)).toBe(false);
    expect(s.paint.levels.booth).toBe(1);
  });

  it('the Painter works on his own while another business is on screen', () => {
    const s = openShop();
    s.paint.painter = true;
    for (let i = 0; i < 600; i++) tick(s, 0.1);
    expect(s.paint.jobsDone).toBeGreaterThan(0);
    expect(s.cash).toBeGreaterThan(0);
  });

  it('the expected order matches the real draw over many orders (within 4%)', () => {
    const s = openShop(9);
    let work = 0;
    let fee = 0;
    const n = 4000;
    for (let i = 0; i < n; i++) {
      const j = generatePaintJob(s);
      work += orderWork(j.services);
      fee += j.fee;
    }
    const e = expectedPaintOrder(s);
    expect(work / n / e.work).toBeGreaterThan(0.96);
    expect(work / n / e.work).toBeLessThan(1.04);
    expect(fee / n / e.fee).toBeGreaterThan(0.96);
    expect(fee / n / e.fee).toBeLessThan(1.04);
  });

  it('idle income matches what the Painter really earns (within 25%)', () => {
    const s = openShop(3);
    s.paint.painter = true;
    s.paint.levels.booth = 12;
    for (const booths of [1, 3]) {
      s.paint.booths = booths;
      s.paint.earned = 0;
      const seconds = 3000;
      for (let t = 0; t < seconds; t += 0.25) tickPaint(s, 0.25, []);
      const ratio = s.paint.earned / seconds / paintIdleIncome(s);
      expect(ratio).toBeGreaterThan(0.75);
      expect(ratio).toBeLessThan(1.25);
    }
  });

  it('pays offline with the Painter (capped like the yard) and nothing without him', () => {
    const s = openShop();
    expect(paintOfflineEarnings(s, 3600)).toBe(0);
    s.paint.painter = true;
    const cap = paintOfflineEarnings(s, ECON.offline.capSeconds);
    expect(cap).toBeGreaterThan(0);
    expect(paintOfflineEarnings(s, ECON.offline.capSeconds * 5)).toBe(cap);
    const r = applyElapsed(s, T0 + 3600_000);
    expect(r.paint).toBe(paintOfflineEarnings(s, 3600));
    expect(r.earned).toBeGreaterThanOrEqual(r.paint);
  });

  it('grows on the map with paint booths', () => {
    const s = openShop();
    expect(businessTier(s, 'paint')).toBe(1);
    expect(nextTierGoal(s, 'paint')).toBe('2 paint booths');
    s.paint.booths = 3;
    expect(businessTier(s, 'paint')).toBe(3);
  });
});

describe('paint saves', () => {
  it('round-trips the shop', () => {
    const s = openShop();
    s.cash = s.lifetimeEarnings = 1e9;
    hirePainter(s);
    buyBooth(s);
    waitForCar(s);
    const back = deserialize(serialize(s, T0), T0)!.state;
    expect(back.paint).toEqual(s.paint);
  });

  it('old saves without a paint shop get a fresh one', () => {
    const s = newGame(T0, 2) as unknown as Record<string, unknown>;
    delete s.paint;
    const data = JSON.stringify(s);
    const text = JSON.stringify({ v: SAVE_VERSION, savedAt: T0, sum: checksum(data), data });
    const back = deserialize(text, T0)!.state;
    expect(back.paint).toEqual(newGame(T0).paint);
  });

  it('repairs impossible shop data', () => {
    const p = openShop().paint;
    const ok: PaintJob = { id: 4, family: 'sedan', model: 'x', paint: 0, newPaint: 1, services: ['respray', 'wrap'], step: 1, work: 999, fee: 10, age: 0 };
    p.booths = 99;
    p.levels.hype = -3;
    p.jobs = [
      ok,
      { ...ok, id: 5, family: 'nope' as never },
      { ...ok, id: 6, services: ['respray', 'respray'] },
      { ...ok, id: 7, services: ['warp' as never] },
      { ...ok, id: 8, step: 2 },
      { ...ok, id: 9, work: Number.NaN },
      { ...ok, id: 10, services: [] },
    ];
    p.tips = 50;
    p.focusedId = 99;
    p.nextJobId = 1;
    sanitizePaint(p);
    expect(p.booths).toBe(ECON.paint.booths.start + ECON.paint.booths.costs.length);
    expect(p.levels.hype).toBe(1);
    expect(p.jobs.map((j) => j.id)).toEqual([4]);
    expect(p.jobs[0]!.work).toBe(ECON.paint.services.wrap.work);
    expect(p.tips).toBe(0);
    expect(p.focusedId).toBe(4);
    expect(p.nextJobId).toBe(5);
  });
});
