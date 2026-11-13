// Rewarded-ad income boost (P2.2b).
import { describe, expect, it } from 'vitest';
import { boostActive, boostMultiplier, canStartBoost, newBoost, startBoost, tickBoost } from '../src/core/boost';
import { ECON } from '../src/core/config';
import { sellCar, tick } from '../src/core/sim';
import { deserialize, serialize } from '../src/core/save';
import { newGame, type GameState } from '../src/core/state';

const T0 = Date.UTC(2027, 0, 15, 12);
const B = ECON.ads.boost;

function ready(): GameState {
  const s = newGame(T0, 1);
  s.carsSold = B.unlockCarsSold;
  return s;
}

describe('income boost', () => {
  it('a new game has no boost and offers none before the unlock', () => {
    const s = newGame(T0, 1);
    expect(s.boost).toEqual(newBoost());
    expect(canStartBoost(s)).toBe(false);
    expect(boostMultiplier(s)).toBe(1);
  });

  it('starts once, lasts its seconds, then waits for the cooldown', () => {
    const s = ready();
    expect(canStartBoost(s)).toBe(true);
    expect(startBoost(s)).toBe(true);
    expect(boostActive(s)).toBe(true);
    expect(boostMultiplier(s)).toBe(B.multiplier);
    expect(startBoost(s)).toBe(false); // never stacks
    tickBoost(s, B.seconds - 1);
    expect(boostActive(s)).toBe(true);
    tickBoost(s, 2);
    expect(boostActive(s)).toBe(false);
    expect(canStartBoost(s)).toBe(false); // cooldown
    tickBoost(s, B.cooldownSeconds);
    expect(canStartBoost(s)).toBe(true);
    expect(s.boost.started).toBe(1);
  });

  it('doubles a sale payout only while it runs', () => {
    const sale = (boost: boolean): number => {
      const s = ready();
      s.carsSold = B.unlockCarsSold;
      s.cash = 0;
      tick(s, 1);
      const car = s.cars[0]!;
      car.dirt = 0;
      car.damage = 0;
      if (boost) startBoost(s);
      const sold = sellCar(s, car.id);
      expect(sold[0]).toMatchObject({ type: 'sold' });
      return s.cash;
    };
    const plain = sale(false);
    expect(plain).toBeGreaterThan(0);
    expect(sale(true) / plain).toBeCloseTo(B.multiplier, 2);
  });

  it('is counted on game time while playing: ticking the simulation runs it down', () => {
    const s = ready();
    startBoost(s);
    tick(s, 60);
    expect(s.boost.remaining).toBeCloseTo(B.seconds - 60, 3);
  });

  it('survives a save and repairs garbage', () => {
    const s = ready();
    startBoost(s);
    tickBoost(s, 100);
    const back = deserialize(serialize(s, T0), T0)!.state;
    expect(back.boost).toEqual(s.boost);
    const messy = newGame(T0, 1) as unknown as { boost: unknown };
    messy.boost = { remaining: 1e9, cooldown: NaN, started: -4 };
    const fixed = deserialize(serialize(messy as unknown as GameState, T0), T0)!.state;
    expect(fixed.boost.remaining).toBe(B.seconds);
    expect(fixed.boost.cooldown).toBe(0);
    expect(fixed.boost.started).toBe(0);
    const old = JSON.parse(serialize(newGame(T0, 1), T0)) as { data: string };
    expect(old.data).toContain('boost');
  });
});
