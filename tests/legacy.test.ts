import { describe, expect, it } from 'vitest';
import { ECON } from '../src/core/config';
import { garageIdleIncome, generateJob as generateGarageJob } from '../src/core/garage';
import { idleIncomePerSecond } from '../src/core/formulas';
import {
  allTimeEarnings,
  canSellEmpire,
  earningsForPoints,
  legacyMultiplier,
  legacyPointsFor,
  nextLegacyMultiplier,
  pendingLegacyPoints,
  sanitizeLegacy,
  sellEmpire,
  sellEmpireGlows,
} from '../src/core/legacy';
import { generateLot, listPrice } from '../src/core/carlot';
import { generatePaintJob, paintIdleIncome } from '../src/core/paint';
import { checksum, deserialize, serialize } from '../src/core/save';
import { tick } from '../src/core/sim';
import { newGame, type GameState } from '../src/core/state';

const T0 = 1_800_000_000_000;
const S = ECON.legacy.pointScale;

function rich(earned: number): GameState {
  const s = newGame(T0, 11);
  s.lifetimeEarnings = earned;
  s.cash = earned / 2;
  return s;
}

describe('Legacy Points (P1.3a)', () => {
  it('points are the square root of all-time earnings over the scale, rounded down', () => {
    expect(legacyPointsFor(0)).toBe(0);
    expect(legacyPointsFor(-5)).toBe(0);
    expect(legacyPointsFor(NaN)).toBe(0);
    expect(legacyPointsFor(S)).toBe(1);
    expect(legacyPointsFor(4 * S - 1)).toBe(1);
    expect(legacyPointsFor(100 * S)).toBe(10);
    expect(legacyPointsFor(400 * S)).toBe(20);
    // Diminishing returns: twice the earnings is ~1.41x the points.
    expect(legacyPointsFor(800 * S) / legacyPointsFor(400 * S)).toBeCloseTo(Math.SQRT2, 1);
  });

  it('the sale is offered at 10 new points and glows when they are at least half of what you own', () => {
    const s = rich(99 * S);
    expect(pendingLegacyPoints(s)).toBe(9);
    expect(canSellEmpire(s)).toBe(false);
    expect(sellEmpireGlows(s)).toBe(false);
    s.lifetimeEarnings = 100 * S;
    expect(canSellEmpire(s)).toBe(true);
    expect(sellEmpireGlows(s)).toBe(true);
    // A veteran with 40 points: 10 new points can be taken, but only 20+ glow.
    s.legacy.points = 40;
    s.legacy.allTime = 1600 * S;
    s.lifetimeEarnings = 2500 * S - 1600 * S; // all-time 2500 S = 50 points -> 10 new
    expect(pendingLegacyPoints(s)).toBe(10);
    expect(canSellEmpire(s)).toBe(true);
    expect(sellEmpireGlows(s)).toBe(false);
    s.lifetimeEarnings = 3600 * S - 1600 * S; // 60 points -> 20 new
    expect(sellEmpireGlows(s)).toBe(true);
  });

  it('says how much this run must earn for a number of new points', () => {
    const s = rich(0);
    expect(earningsForPoints(s, 10)).toBe(100 * S);
    s.legacy = { ...s.legacy, points: 10, allTime: 100 * S };
    expect(earningsForPoints(s, 10)).toBe(300 * S);
    s.lifetimeEarnings = earningsForPoints(s, 10);
    expect(pendingLegacyPoints(s)).toBe(10);
  });

  it('offline cash still waiting counts toward the points', () => {
    const s = rich(99 * S);
    s.pendingOffline = S;
    expect(allTimeEarnings(s)).toBe(100 * S);
    expect(canSellEmpire(s)).toBe(true);
  });

  it('each point adds 2% income', () => {
    const s = rich(0);
    expect(legacyMultiplier(s)).toBe(1);
    s.legacy.points = 25;
    expect(legacyMultiplier(s)).toBeCloseTo(1.5, 9);
    s.lifetimeEarnings = 900 * S; // 30 points total -> 5 new
    expect(nextLegacyMultiplier(s)).toBeCloseTo(1.6, 9);
  });
});

describe('selling the empire', () => {
  function veteran(): GameState {
    const s = newGame(T0, 21);
    s.managers = { mechanic: true, washer: true, seller: true, scrapper: false };
    s.settings.sound = false;
    s.settings.numberFormat = 'scientific';
    s.tutorial.introSeen = true;
    s.tutorial.mapSeen = true;
    tick(s, 120);
    s.lifetimeEarnings = 150 * S;
    s.cash = 30 * S;
    s.levels.quality = 40;
    s.slots = 4;
    s.parts = 50;
    s.businesses.opened.garage = true;
    s.businesses.active = 'garage';
    s.garage.foreman = true;
    s.collection.sold.sedan = 12;
    s.stats.haggles = 7;
    s.pendingOffline = 1234;
    s.legacy.runSeconds = 4 * 3600;
    s.lastSeen = T0 + 5_000;
    return s;
  }

  it('refuses before 10 points and changes nothing', () => {
    const s = rich(50 * S);
    const before = JSON.stringify(s);
    expect(sellEmpire(s, T0)).toBeNull();
    expect(JSON.stringify(s)).toBe(before);
  });

  it('banks the points and starts a fresh scrapyard, keeping settings, tutorial, collection and stats', () => {
    const s = veteran();
    const rng = s.rng;
    const sold = sellEmpire(s, T0 + 1000);
    expect(sold).toEqual({ points: 12, earned: 150 * S + 1234, seconds: 4 * 3600 });
    // Reset
    expect(s.cash).toBe(0);
    expect(s.lifetimeEarnings).toBe(0);
    expect(s.carsSold).toBe(0);
    expect(s.levels.quality).toBe(1);
    expect(s.slots).toBe(ECON.slots.start);
    expect(s.parts).toBe(0);
    expect(s.managers.seller).toBe(false);
    expect(s.businesses.opened.garage).toBe(false);
    expect(s.businesses.active).toBe('scrapyard');
    expect(s.garage.foreman).toBe(false);
    expect(s.pendingOffline).toBe(0);
    expect(s.barn.status).toBe('locked');
    // Kept
    expect(s.settings.sound).toBe(false);
    expect(s.settings.numberFormat).toBe('scientific');
    expect(s.tutorial.introSeen && s.tutorial.mapSeen).toBe(true);
    expect(s.collection.sold.sedan).toBe(12);
    expect(s.stats.haggles).toBe(7);
    expect(s.createdAt).toBe(T0);
    expect(s.rng).toBe(rng);
    // The clock never moves backwards, even when "now" is older than the last save.
    expect(s.lastSeen).toBe(T0 + 5_000);
    expect(s.legacy).toEqual({ points: 12, allTime: 150 * S + 1234, sold: 1, lastRunSeconds: 4 * 3600, bestRunSeconds: 4 * 3600, runSeconds: 0 });
    expect(legacyMultiplier(s)).toBeCloseTo(1.24, 9);
    expect(canSellEmpire(s)).toBe(false);
  });

  it('a second sale counts only the new points and keeps the fastest run', () => {
    const s = veteran();
    sellEmpire(s, T0);
    tick(s, 30);
    expect(s.legacy.runSeconds).toBeCloseTo(30, 6);
    // 12 points from 150 S + 1234; 22 points need 484 S in total.
    s.lifetimeEarnings = earningsForPoints(s, 10);
    s.cash = 1;
    s.legacy.runSeconds = 3600;
    const sold = sellEmpire(s, T0 + 10);
    expect(sold?.points).toBe(10);
    expect(s.legacy.points).toBe(22);
    expect(s.legacy.sold).toBe(2);
    expect(s.legacy.bestRunSeconds).toBe(3600);
    expect(s.legacy.lastRunSeconds).toBe(3600);
  });

  it('the fresh empire plays normally', () => {
    const s = veteran();
    sellEmpire(s, T0);
    tick(s, 5);
    expect(s.cars.length).toBeGreaterThan(0);
  });
});

describe('the multiplier reaches every business', () => {
  function pair(): [GameState, GameState] {
    const make = () => {
      const s = newGame(T0, 5);
      s.carsSold = 300;
      s.managers = { mechanic: true, washer: true, seller: true, scrapper: false };
      s.businesses.opened = { scrapyard: true, garage: true, carlot: true, paint: true };
      s.garage.foreman = true;
      s.carlot.crew = { detailer: true, agent: true };
      s.paint.painter = true;
      return s;
    };
    const a = make();
    const b = make();
    b.legacy.points = 50; // x2
    return [a, b];
  }

  it('yard idle income, garage fees and idle, paint fees and idle, lot prices all scale', () => {
    const [a, b] = pair();
    expect(idleIncomePerSecond(b) / idleIncomePerSecond(a)).toBeCloseTo(2, 6);
    expect(garageIdleIncome(b) / garageIdleIncome(a)).toBeCloseTo(2, 6);
    expect(paintIdleIncome(b) / paintIdleIncome(a)).toBeCloseTo(2, 6);
    const ga = generateGarageJob(a);
    const gb = generateGarageJob(b);
    expect(gb.fee / ga.fee).toBeCloseTo(2, 2);
    const pa = generatePaintJob(a);
    const pb = generatePaintJob(b);
    expect(pb.fee / pa.fee).toBeCloseTo(2, 2);
    // Lot: both the auction price and the list price double, so the profit doubles too.
    const la = generateLot(a);
    const lb = generateLot(b);
    expect(lb.price / la.price).toBeCloseTo(2, 2);
    expect(listPrice(b, lb) / listPrice(a, la)).toBeCloseTo(2, 2);
  });

  it('yard cars arrive worth more', () => {
    const [a, b] = pair();
    a.cars = [];
    b.cars = [];
    a.arrivalTimer = b.arrivalTimer = 100;
    tick(a, 0.1);
    tick(b, 0.1);
    expect(a.cars.length).toBe(1);
    expect(b.cars[0]!.value / a.cars[0]!.value).toBeCloseTo(2, 2);
  });
});

describe('legacy saves', () => {
  it('round-trip, and saves from before prestige start with no points', () => {
    const s = newGame(T0, 3);
    s.legacy = { points: 12, allTime: 150 * S, sold: 1, lastRunSeconds: 100, bestRunSeconds: 100, runSeconds: 5 };
    expect(deserialize(serialize(s, T0), T0)?.state.legacy).toEqual(s.legacy);
    const old = JSON.parse(JSON.stringify(newGame(T0, 3))) as Record<string, unknown>;
    delete old.legacy;
    const env = JSON.parse(serialize(newGame(T0, 3), T0));
    env.data = JSON.stringify(old);
    env.sum = checksum(env.data);
    expect(deserialize(JSON.stringify(env), T0)?.state.legacy.points).toBe(0);
  });

  it('repair: no more points than the sold empires are worth, no negatives', () => {
    const l = { points: 999, allTime: 100 * S, sold: -2, lastRunSeconds: NaN, bestRunSeconds: 5, runSeconds: -1 };
    sanitizeLegacy(l);
    expect(l).toEqual({ points: 10, allTime: 100 * S, sold: 0, lastRunSeconds: 0, bestRunSeconds: 5, runSeconds: 0 });
  });
});
