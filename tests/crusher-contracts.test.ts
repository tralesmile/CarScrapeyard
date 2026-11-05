import { describe, expect, it } from 'vitest';
import { ECON } from '../src/core/config';
import { canRerollContract, contractLabel, contractsUnlocked, generateContract } from '../src/core/contracts';
import { checksum, deserialize, serialize } from '../src/core/save';
import {
  canCrush,
  carStage,
  claimContract,
  crushCar,
  crusherUnlocked,
  rerollContract,
  sellCar,
  tick,
  washCar,
  type GameEvent,
} from '../src/core/sim';
import { newGame, type GameState } from '../src/core/state';

const T0 = 1_800_000_000_000;

function withCar(seed = 7): GameState {
  const s = newGame(T0, seed);
  tick(s, 1); // first car arrives
  expect(s.cars.length).toBe(1);
  return s;
}

function finish(s: GameState): void {
  const car = s.cars[0]!;
  car.dirt = 0;
  car.damage = 0;
}

describe('car crusher', () => {
  it('is locked for new players and unlocks after enough sales', () => {
    const s = withCar();
    expect(crusherUnlocked(s)).toBe(false);
    expect(crushCar(s, s.cars[0]!.id)).toEqual([]);
    s.carsSold = ECON.crusher.unlockCarsSold;
    expect(crusherUnlocked(s)).toBe(true);
  });

  it('turns a wreck into parts and scrap cash, then cools down', () => {
    const s = withCar();
    s.carsSold = ECON.crusher.unlockCarsSold;
    const car = s.cars[0]!;
    const events = crushCar(s, car.id);
    expect(events[0]?.type).toBe('crushed');
    expect(s.cars.length).toBe(0);
    expect(s.parts).toBe(ECON.crusher.parts[car.rarity]);
    expect(s.cash).toBe(Math.floor(car.value * ECON.crusher.scrapFraction));
    expect(s.lifetimeEarnings).toBe(s.cash);
    expect(s.stats.carsCrushed).toBe(1);
    expect(s.crusherCooldown).toBe(ECON.crusher.cooldown);
    // Next car arrives, but the press is still cooling down.
    tick(s, ECON.arrivalInterval + 0.1);
    expect(s.cars.length).toBe(1);
    expect(canCrush(s, s.cars[0])).toBe(false);
    tick(s, ECON.crusher.cooldown);
    expect(canCrush(s, s.cars[0])).toBe(true);
  });

  it('refuses finished cars (sell those instead)', () => {
    const s = withCar();
    s.carsSold = ECON.crusher.unlockCarsSold;
    finish(s);
    expect(carStage(s.cars[0]!)).toBe('ready');
    expect(crushCar(s, s.cars[0]!.id)).toEqual([]);
    expect(s.cars.length).toBe(1);
  });

  it('spends parts to halve the damage when a car is washed', () => {
    const s = withCar();
    s.parts = 5;
    const car = s.cars[0]!;
    const damage = car.damage;
    const events = washCar(s, car.id, 1e6);
    expect(events.map((e) => e.type)).toContain('partsUsed');
    expect(s.parts).toBe(5 - ECON.crusher.partsPerFix);
    expect(car.damage).toBeCloseTo(damage * (1 - ECON.crusher.fixFraction));
  });

  it('does nothing extra without enough parts', () => {
    const s = withCar();
    s.parts = ECON.crusher.partsPerFix - 1;
    const car = s.cars[0]!;
    const damage = car.damage;
    washCar(s, car.id, 1e6);
    expect(car.damage).toBe(damage);
    expect(s.parts).toBe(ECON.crusher.partsPerFix - 1);
  });

  it('the washer also uses parts', () => {
    const s = withCar();
    s.managers.washer = true;
    s.parts = 10;
    const events = tick(s, 20);
    expect(events.some((e) => e.type === 'partsUsed')).toBe(true);
  });
});

describe('contracts board', () => {
  it('appears once unlocked with three active orders', () => {
    const s = newGame(T0, 3);
    tick(s, 1);
    expect(s.contracts.length).toBe(0);
    s.carsSold = ECON.contracts.unlockCarsSold;
    expect(contractsUnlocked(s)).toBe(true);
    tick(s, 0.1);
    expect(s.contracts.length).toBe(ECON.contracts.board);
    for (const c of s.contracts) {
      expect(c.status).toBe('active');
      expect(c.target).toBeGreaterThan(0);
      expect(c.rewardCash).toBeGreaterThan(0);
      expect(contractLabel(c).length).toBeGreaterThan(4);
    }
  });

  it('counts sales, completes, pays on claim and refreshes later', () => {
    const s = withCar();
    s.carsSold = ECON.contracts.unlockCarsSold;
    tick(s, 0.1);
    const c = s.contracts[0]!;
    c.kind = 'sellAny';
    c.family = null;
    c.target = 2;
    const events: GameEvent[] = [];
    for (let i = 0; i < 2; i++) {
      if (!s.cars.length) tick(s, ECON.arrivalInterval + 0.1);
      finish(s);
      events.push(...sellCar(s, s.cars[0]!.id));
    }
    expect(c.status).toBe('done');
    expect(events.some((e) => e.type === 'contractDone')).toBe(true);
    const cash = s.cash;
    const reward = claimContract(s, c.id);
    expect(reward.cash).toBe(c.rewardCash);
    expect(s.cash).toBe(cash + reward.cash);
    expect(c.status).toBe('empty');
    expect(claimContract(s, c.id).cash).toBe(0); // no double claim
    tick(s, ECON.contracts.refresh + 0.5);
    expect(c.status).toBe('active');
  });

  it('family orders only count that family', () => {
    const s = withCar();
    s.carsSold = ECON.contracts.unlockCarsSold;
    tick(s, 0.1);
    const c = s.contracts[0]!;
    const car = s.cars[0]!;
    c.kind = 'sellFamily';
    c.family = car.family === 'pickup' ? 'sedan' : 'pickup';
    finish(s);
    sellCar(s, car.id);
    expect(c.progress).toBe(0);
  });

  it('crush orders count crushed wrecks and pay parts', () => {
    const s = withCar();
    s.carsSold = Math.max(ECON.contracts.unlockCarsSold, ECON.crusher.unlockCarsSold);
    tick(s, 0.1);
    const c = s.contracts[0]!;
    c.kind = 'crush';
    c.target = 1;
    c.rewardParts = 4;
    if (!s.cars.length) tick(s, ECON.arrivalInterval);
    crushCar(s, s.cars[0]!.id);
    expect(c.status).toBe('done');
    const parts = s.parts;
    claimContract(s, c.id);
    expect(s.parts).toBe(parts + 4);
  });

  it('expired orders free the slot', () => {
    const s = newGame(T0, 5);
    s.carsSold = ECON.contracts.unlockCarsSold;
    tick(s, 0.1);
    const events = tick(s, ECON.contracts.duration + 1);
    expect(events.some((e) => e.type === 'contractExpired')).toBe(true);
  });

  it('never puts the same order twice on the board', () => {
    for (let seed = 1; seed < 300; seed++) {
      const s = newGame(T0, seed);
      s.carsSold = ECON.contracts.unlockCarsSold;
      tick(s, 0.1);
      // Claim and refresh a few times too.
      for (let r = 0; r < 3; r++) {
        const keys = s.contracts.map((c) => `${c.kind}:${c.family}`);
        expect(new Set(keys).size).toBe(ECON.contracts.board);
        const c = s.contracts[r]!;
        c.progress = c.target;
        c.status = 'done';
        claimContract(s, c.id);
        tick(s, ECON.contracts.refresh + 0.1);
      }
    }
  });

  it('rewards scale with car quality', () => {
    const s = newGame(T0, 9);
    s.contracts = [{ id: 0, status: 'empty', kind: 'sellAny', family: null, target: 1, progress: 0, timeLeft: 0, rewardCash: 0, rewardParts: 0, rerolled: false }];
    const slot = s.contracts[0]!;
    s.rng = 42;
    generateContract(s, slot);
    const low = slot.rewardCash / slot.target / ECON.contracts.rewardMult[slot.kind];
    s.levels.quality = 30;
    s.rng = 42;
    generateContract(s, slot);
    const high = slot.rewardCash / slot.target / ECON.contracts.rewardMult[slot.kind];
    expect(high).toBeGreaterThan(low * 5);
  });

  it('parts and contracts survive a save round trip; broken contracts are dropped', () => {
    const s = withCar();
    s.carsSold = ECON.contracts.unlockCarsSold;
    s.parts = 12;
    tick(s, 0.1);
    const text = serialize(s, T0);
    const back = deserialize(text, T0)!;
    expect(back.state.parts).toBe(12);
    expect(back.state.contracts).toEqual(s.contracts);

    const broken = JSON.parse(JSON.stringify(s)) as Record<string, unknown>;
    (broken.contracts as unknown[]).push({ id: 'x' });
    const data = JSON.stringify(broken);
    const env = JSON.parse(text) as { data: string; sum: string };
    env.data = data;
    env.sum = checksum(data);
    const back2 = deserialize(JSON.stringify(env), T0)!;
    expect(back2.state.contracts.length).toBe(ECON.contracts.board);
  });

  it('old saves without the new fields load with defaults', () => {
    const s = withCar() as unknown as Record<string, unknown>;
    delete s.parts;
    delete s.contracts;
    delete s.crusherCooldown;
    const data = JSON.stringify(s);
    const back = deserialize(JSON.stringify({ v: 1, savedAt: T0, sum: checksum(data), data }), T0)!;
    expect(back.state.parts).toBe(0);
    expect(back.state.contracts).toEqual([]);
    expect(back.state.crusherCooldown).toBe(0);
  });
});

describe('contract reroll', () => {
  function board(seed: number): GameState {
    const s = newGame(T0, seed);
    s.carsSold = ECON.contracts.unlockCarsSold;
    tick(s, 0.1);
    tick(s, 0.1);
    expect(s.contracts.every((c) => c.status === 'active')).toBe(true);
    return s;
  }

  it('swaps an active order for a different one with a fresh timer, once', () => {
    for (let seed = 1; seed < 200; seed++) {
      const s = board(seed);
      const c = s.contracts[0]!;
      tick(s, 30);
      const before = { kind: c.kind, family: c.family, id: c.id };
      const events = rerollContract(s, c.id);
      expect(events.map((e) => e.type)).toEqual(['contractNew']);
      expect(c.kind !== before.kind || c.family !== before.family).toBe(true);
      expect(c.id).not.toBe(before.id);
      expect(c.timeLeft).toBe(ECON.contracts.duration);
      expect(c.progress).toBe(0);
      expect(c.rerolled).toBe(true);
      // Still no duplicates on the board.
      const keys = s.contracts.map((x) => `${x.kind}:${x.family}`);
      expect(new Set(keys).size).toBe(keys.length);
      expect(rerollContract(s, c.id)).toEqual([]);
    }
  });

  it('done orders cannot be rerolled; the next order in the slot gets a fresh reroll', () => {
    const s = board(3);
    const c = s.contracts[0]!;
    rerollContract(s, c.id);
    c.status = 'done';
    expect(canRerollContract(c)).toBe(false);
    claimContract(s, c.id);
    tick(s, ECON.contracts.refresh + 0.1);
    expect(c.status).toBe('active');
    expect(canRerollContract(c)).toBe(true);
  });

  it('old saves without the reroll flag load with a reroll available', () => {
    const s = board(5);
    const raw = JSON.parse(JSON.stringify(s)) as GameState;
    for (const c of raw.contracts) delete (c as Partial<typeof c>).rerolled;
    const loaded = deserialize(serialize(raw, T0), T0)!.state;
    expect(loaded.contracts.every((c) => c.rerolled === false)).toBe(true);
  });
});
