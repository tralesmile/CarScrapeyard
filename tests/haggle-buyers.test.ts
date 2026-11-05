import { describe, expect, it } from 'vitest';
import { ECON, type BuyerKind } from '../src/core/config';
import { buyerMatches, buyerMultiplier, buyersUnlocked, tickBuyers } from '../src/core/buyers';
import { clampHaggle, haggleGrade, haggleMultiplier, hagglePosition, isHaggleLesson, wantsHaggle } from '../src/core/haggle';
import { deserialize, serialize } from '../src/core/save';
import { holdForHaggle, sellCar, tick, type GameEvent } from '../src/core/sim';
import { newGame, type Car, type GameState } from '../src/core/state';

const T0 = 1_800_000_000_000;

function readyCar(s: GameState, patch: Partial<Car> = {}): Car {
  tick(s, 1);
  const car = s.cars[0]!;
  Object.assign(car, { dirt: 0, damage: 0, rarity: 'common', family: 'pickup', value: 1000 }, patch);
  return car;
}

describe('haggle slider', () => {
  it('needle sweeps 0 → 1 → 0 and stays in range', () => {
    expect(hagglePosition(0, 1)).toBe(0);
    expect(hagglePosition(0.5, 1)).toBeCloseTo(1);
    expect(hagglePosition(1, 1)).toBeCloseTo(0);
    for (let t = 0; t < 10; t += 0.037) {
      const p = hagglePosition(t, ECON.haggle.sweepsPerSec);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
    }
  });

  it('centre pays the max, edges pay the min, and the curve is symmetric', () => {
    expect(haggleMultiplier(0.5)).toBe(ECON.haggle.max);
    expect(haggleMultiplier(0)).toBe(ECON.haggle.min);
    expect(haggleMultiplier(1)).toBe(ECON.haggle.min);
    expect(haggleMultiplier(0.3)).toBe(haggleMultiplier(0.7));
    expect(haggleMultiplier(0.3)).toBeGreaterThan(haggleMultiplier(0.1));
    expect(haggleMultiplier(Number.NaN)).toBe(ECON.haggle.min);
    expect(haggleMultiplier(5)).toBe(ECON.haggle.min);
  });

  it('the lesson haggle always succeeds', () => {
    for (const p of [0, 0.2, 0.5, 1]) expect(haggleMultiplier(p, true)).toBeGreaterThanOrEqual(ECON.haggle.lessonMin);
  });

  it('grades results', () => {
    expect(haggleGrade(1.3)).toBe('perfect');
    expect(haggleGrade(1.2)).toBe('great');
    expect(haggleGrade(1.05)).toBe('good');
    expect(haggleGrade(0.95)).toBe('poor');
  });

  it('clamps cheated multipliers', () => {
    expect(clampHaggle(50)).toBe(ECON.haggle.max);
    expect(clampHaggle(0)).toBe(ECON.haggle.min);
    expect(clampHaggle(Number.POSITIVE_INFINITY)).toBe(1);
  });

  it('a haggled sale pays value x multiplier and counts stats', () => {
    const s = newGame(T0, 3);
    const car = readyCar(s);
    const ev = sellCar(s, car.id, 1.3);
    expect(s.cash).toBe(1300);
    expect(s.stats.haggles).toBe(1);
    expect(s.stats.perfectHaggles).toBe(1);
    const sold = ev.find((e) => e.type === 'sold') as Extract<GameEvent, { type: 'sold' }>;
    expect(sold.haggle).toBe(1.3);
    expect(sold.amount).toBe(1300);
  });

  it('a sale with a cheated multiplier pays at most the max', () => {
    const s = newGame(T0, 3);
    const car = readyCar(s);
    sellCar(s, car.id, 99);
    expect(s.cash).toBe(1000 * ECON.haggle.max);
  });

  it('only big sales haggle: the lesson, Rare+ cars, and buyer matches', () => {
    const s = newGame(T0, 3);
    const car = readyCar(s);
    expect(wantsHaggle(s, car)).toBe(false); // first sale ever: keep it simple
    s.carsSold = 1;
    expect(isHaggleLesson(s)).toBe(true);
    expect(wantsHaggle(s, car)).toBe(true);
    s.carsSold = 5;
    expect(wantsHaggle(s, car)).toBe(false); // plain common pickup
    car.rarity = 'rare';
    expect(wantsHaggle(s, car)).toBe(true);
    car.rarity = 'common';
    s.buyer = { kind: 'speed', timeLeft: 30 };
    car.family = 'muscle';
    expect(wantsHaggle(s, car)).toBe(true);
  });

  it('the salesperson waits while a haggle is open', () => {
    const s = newGame(T0, 3);
    s.managers.seller = true;
    const car = readyCar(s);
    holdForHaggle(s, car.id);
    tick(s, ECON.haggle.timeout + ECON.sellerDelay - 0.5);
    expect(s.cars.some((c) => c.id === car.id)).toBe(true);
    tick(s, 1);
    expect(s.cars.some((c) => c.id === car.id)).toBe(false);
  });
});

describe('customer personalities', () => {
  const mk = (patch: Partial<Car>): Car => ({
    id: 1, family: 'sedan', model: 'x', paint: 0, rarity: 'common', value: 100, dirt: 0, damage: 0, sellProgress: 0, ...patch,
  });

  it('each buyer wants a different kind of car', () => {
    expect(buyerMatches('family', mk({ family: 'sedan' }))).toBe(true);
    expect(buyerMatches('family', mk({ family: 'muscle' }))).toBe(false);
    expect(buyerMatches('speed', mk({ family: 'muscle' }))).toBe(true);
    expect(buyerMatches('bargain', mk({ family: 'hatch' }))).toBe(true);
    expect(buyerMatches('collector', mk({ rarity: 'common' }))).toBe(false);
    expect(buyerMatches('collector', mk({ rarity: 'rare' }))).toBe(true);
    expect(buyerMatches('collector', mk({ rarity: 'legendary' }))).toBe(true);
  });

  it('every car family is wanted by at least one buyer except pickups (until vans/SUVs exist)', () => {
    const wanted = new Set(Object.values(ECON.buyers.kinds).flatMap((b) => b.families ?? []));
    expect([...wanted].sort()).toEqual(['hatch', 'muscle', 'sedan']);
  });

  it('buyers unlock after enough sales, arrive, wait and leave', () => {
    const s = newGame(T0, 11);
    const events: GameEvent[] = [];
    tickBuyers(s, 1, events);
    expect(s.buyer).toBeNull();
    expect(buyersUnlocked(s)).toBe(false);
    s.carsSold = ECON.buyers.unlockCarsSold;
    tickBuyers(s, 0.1, events);
    expect(s.buyer).not.toBeNull();
    expect(events.some((e) => e.type === 'buyerArrived')).toBe(true);
    tickBuyers(s, ECON.buyers.patience + 1, events);
    expect(s.buyer).toBeNull();
    expect(events.some((e) => e.type === 'buyerLeft')).toBe(true);
    tickBuyers(s, ECON.buyers.gap - 1, events);
    expect(s.buyer).toBeNull();
    tickBuyers(s, 1.1, events);
    expect(s.buyer).not.toBeNull();
  });

  it('a matching sale pays the bonus and the buyer leaves happy', () => {
    const s = newGame(T0, 3);
    const car = readyCar(s, { family: 'muscle' });
    s.buyer = { kind: 'speed', timeLeft: 30 };
    expect(buyerMultiplier(s, car)).toBe(1 + ECON.buyers.kinds.speed.bonus);
    const ev = sellCar(s, car.id);
    expect(s.cash).toBe(Math.round(1000 * (1 + ECON.buyers.kinds.speed.bonus)));
    expect(s.buyer).toBeNull();
    expect(s.stats.buyersServed).toBe(1);
    const sold = ev.find((e) => e.type === 'sold') as Extract<GameEvent, { type: 'sold' }>;
    expect(sold.buyer).toBe('speed');
  });

  it('buyer bonus and haggle stack', () => {
    const s = newGame(T0, 3);
    const car = readyCar(s, { rarity: 'rare' });
    s.buyer = { kind: 'collector', timeLeft: 30 };
    sellCar(s, car.id, 1.2);
    expect(s.cash).toBe(Math.round(1000 * (1 + ECON.buyers.kinds.collector.bonus) * 1.2));
  });

  it('a non-matching sale pays normally and the buyer keeps waiting', () => {
    const s = newGame(T0, 3);
    const car = readyCar(s, { family: 'pickup' });
    s.buyer = { kind: 'family', timeLeft: 30 };
    sellCar(s, car.id);
    expect(s.cash).toBe(1000);
    expect(s.buyer?.kind).toBe('family');
  });

  it('the salesperson also serves the buyer', () => {
    const s = newGame(T0, 3);
    s.managers.seller = true;
    readyCar(s, { family: 'sedan' });
    s.buyer = { kind: 'family', timeLeft: 60 };
    tick(s, ECON.sellerDelay + 0.3);
    expect(s.stats.buyersServed).toBe(1);
  });

  it('buyers appear in a long game and every kind shows up', () => {
    const s = newGame(T0, 99);
    s.carsSold = ECON.buyers.unlockCarsSold;
    const seen = new Set<BuyerKind>();
    for (let i = 0; i < 400; i++) {
      tick(s, 10);
      if (s.buyer) seen.add(s.buyer.kind);
    }
    expect(seen.size).toBe(4);
  });

  it('the buyer survives save and load; a garbage buyer is dropped', () => {
    const s = newGame(T0, 3);
    s.buyer = { kind: 'collector', timeLeft: 42 };
    const back = deserialize(serialize(s, T0), T0)!.state;
    expect(back.buyer).toEqual({ kind: 'collector', timeLeft: 42 });
    const bad = JSON.parse(JSON.stringify(s)) as Record<string, unknown>;
    bad.buyer = { kind: 'alien', timeLeft: 5 };
    const env = serialize(bad as unknown as GameState, T0);
    expect(deserialize(env, T0)!.state.buyer).toBeNull();
  });

  it('old saves without buyer fields load with defaults', () => {
    const s = newGame(T0, 3) as unknown as Record<string, unknown>;
    delete s.buyer;
    delete s.buyerTimer;
    const stats = s.stats as Record<string, unknown>;
    delete stats.haggles;
    const back = deserialize(serialize(s as unknown as GameState, T0), T0)!.state;
    expect(back.buyer).toBeNull();
    expect(back.buyerTimer).toBe(0);
    expect(back.stats.haggles).toBe(0);
  });
});
