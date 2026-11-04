import { describe, expect, it } from 'vitest';
import { ECON } from '../src/core/config';
import {
  bulkCost,
  idleIncomePerSecond,
  milestonesReached,
  offlineEarnings,
  stationPower,
  upgradeCost,
} from '../src/core/formulas';
import { formatNumber } from '../src/core/format';
import {
  applyElapsed,
  buySlot,
  buyUpgrade,
  carStage,
  hireManager,
  repairTap,
  sellCar,
  tick,
  touch,
  washCar,
} from '../src/core/sim';
import { newGame } from '../src/core/state';

const T0 = 1_800_000_000_000;

describe('formulas', () => {
  it('upgrade cost grows exponentially from the base', () => {
    expect(upgradeCost('wash', 1)).toBe(ECON.upgrades.wash.baseCost);
    expect(upgradeCost('wash', 2)).toBe(Math.ceil(ECON.upgrades.wash.baseCost * ECON.upgrades.wash.growth));
    expect(upgradeCost('wash', 20)).toBeGreaterThan(upgradeCost('wash', 19));
  });

  it('bulk max never spends more than the cash', () => {
    const { levels, cost } = bulkCost('repair', 1, 'max', 5_000);
    expect(levels).toBeGreaterThan(0);
    expect(cost).toBeLessThanOrEqual(5_000);
    expect(cost + upgradeCost('repair', 1 + levels)).toBeGreaterThan(5_000);
  });

  it('milestones double power', () => {
    expect(milestonesReached(9)).toBe(0);
    expect(milestonesReached(10)).toBe(1);
    const before = stationPower(9);
    const at = stationPower(10);
    expect(at / before).toBeGreaterThan(1.9);
  });

  it('idle income is zero until all three managers are hired', () => {
    const s = newGame(T0, 1);
    expect(idleIncomePerSecond(s)).toBe(0);
    s.managers = { mechanic: true, washer: true, seller: false };
    expect(idleIncomePerSecond(s)).toBe(0);
    s.managers.seller = true;
    expect(idleIncomePerSecond(s)).toBeGreaterThan(0);
  });

  it('more lot slots raise idle income', () => {
    const s = newGame(T0, 1);
    s.managers = { mechanic: true, washer: true, seller: true };
    const one = idleIncomePerSecond(s);
    s.slots = 3;
    expect(idleIncomePerSecond(s)).toBeGreaterThan(one);
  });

  it('offline earnings respect the cap', () => {
    const s = newGame(T0, 1);
    s.managers = { mechanic: true, washer: true, seller: true };
    const capped = offlineEarnings(s, ECON.offline.capSeconds);
    expect(offlineEarnings(s, ECON.offline.capSeconds * 10)).toBe(capped);
    expect(offlineEarnings(s, -100)).toBe(0);
  });
});

describe('core loop', () => {
  it('a car arrives, gets washed, repaired and sold', () => {
    const s = newGame(T0, 42);
    const events = tick(s, 1);
    expect(events.some((e) => e.type === 'arrived')).toBe(true);
    const car = s.cars[0]!;
    expect(s.focusedId).toBe(car.id);
    expect(carStage(car)).toBe('dirty');

    // Can't repair or sell while dirty.
    expect(repairTap(s, car.id)).toEqual([]);
    expect(sellCar(s, car.id)).toEqual([]);

    washCar(s, car.id, 10_000);
    expect(carStage(car)).toBe('damaged');

    let taps = 0;
    while (car.damage > 0 && taps < 100) {
      repairTap(s, car.id);
      taps++;
    }
    expect(taps).toBeLessThanOrEqual(5);
    expect(carStage(car)).toBe('ready');

    const value = car.value;
    const sold = sellCar(s, car.id);
    expect(sold[0]).toMatchObject({ type: 'sold', amount: value });
    expect(s.cash).toBe(value);
    expect(s.cars).toHaveLength(0);
    expect(s.tutorial.firstSale).toBe(true);
  });

  it('managers run the yard on their own', () => {
    const s = newGame(T0, 7);
    s.managers = { mechanic: true, washer: true, seller: true };
    tick(s, 120);
    expect(s.carsSold).toBeGreaterThan(3);
    expect(s.cash).toBeGreaterThan(0);
  });

  it('never fills more cars than lot slots', () => {
    const s = newGame(T0, 3);
    tick(s, 60);
    expect(s.cars.length).toBe(1);
    s.cash = s.lifetimeEarnings = 100_000;
    expect(buySlot(s)).toBe(true);
    tick(s, 60);
    expect(s.cars.length).toBe(2);
  });

  it('purchases fail without cash and never make cash negative', () => {
    const s = newGame(T0, 1);
    expect(buyUpgrade(s, 'wash')).toBe(false);
    expect(hireManager(s, 'mechanic')).toBe(false);
    expect(buySlot(s)).toBe(false);
    s.cash = s.lifetimeEarnings = upgradeCost('wash', 1);
    expect(buyUpgrade(s, 'wash')).toBe(true);
    expect(s.cash).toBe(0);
    expect(s.levels.wash).toBe(2);
  });

  it('a manager can only be hired once', () => {
    const s = newGame(T0, 1);
    s.cash = s.lifetimeEarnings = 1e9;
    expect(hireManager(s, 'mechanic')).toBe(true);
    const cash = s.cash;
    expect(hireManager(s, 'mechanic')).toBe(false);
    expect(s.cash).toBe(cash);
  });

  it('bad tick inputs do nothing', () => {
    const s = newGame(T0, 1);
    expect(tick(s, NaN)).toEqual([]);
    expect(tick(s, -5)).toEqual([]);
    expect(tick(s, Infinity)).toEqual([]);
  });
});

describe('time and clock edge cases', () => {
  it('awards offline earnings for real elapsed time', () => {
    const s = newGame(T0, 1);
    s.managers = { mechanic: true, washer: true, seller: true };
    const r = applyElapsed(s, T0 + 3_600_000);
    expect(r.seconds).toBeCloseTo(3600);
    expect(r.earned).toBe(offlineEarnings(s, 3600));
  });

  it('a clock moved backwards awards nothing and does not move lastSeen back', () => {
    const s = newGame(T0, 1);
    s.managers = { mechanic: true, washer: true, seller: true };
    const r = applyElapsed(s, T0 - 3_600_000);
    expect(r.earned).toBe(0);
    expect(s.lastSeen).toBe(T0);
    touch(s, T0 - 1000);
    expect(s.lastSeen).toBe(T0);
  });

  it('back-then-forward clock trick gains nothing extra', () => {
    const s = newGame(T0, 1);
    s.managers = { mechanic: true, washer: true, seller: true };
    applyElapsed(s, T0 + 60_000); // normal minute
    const back = applyElapsed(s, T0 - 86_400_000);
    const forward = applyElapsed(s, T0 + 120_000);
    expect(back.earned).toBe(0);
    expect(forward.seconds).toBeCloseTo(60);
  });
});

describe('number format', () => {
  it('formats big numbers with suffixes', () => {
    expect(formatNumber(999)).toBe('999');
    expect(formatNumber(1234)).toBe('1.23K');
    expect(formatNumber(1_500_000)).toBe('1.50M');
    expect(formatNumber(999_999)).toBe('1.00M');
    expect(formatNumber(1e15)).toBe('1.00aa');
    expect(formatNumber(1e18)).toBe('1.00ab');
  });
});
