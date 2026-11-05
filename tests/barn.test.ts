import { describe, expect, it } from 'vitest';
import { ECON } from '../src/core/config';
import {
  barnReservesParts,
  barnStageCost,
  barnUnlocked,
  barnValue,
  nextBarnStage,
  revealBarn,
  sellBarnCar,
  startBarnStage,
} from '../src/core/barn';
import { expectedCarValue } from '../src/core/formulas';
import { deserialize, serialize } from '../src/core/save';
import { applyElapsed, tick, washCar, type GameEvent } from '../src/core/sim';
import { newGame, type GameState } from '../src/core/state';

const T0 = 1_800_000_000_000;

function unlocked(seed = 3): { s: GameState; events: GameEvent[] } {
  const s = newGame(T0, seed);
  s.carsSold = ECON.barn.unlockCarsSold;
  const events = tick(s, 0.1);
  return { s, events };
}

function rich(s: GameState): void {
  s.cash = 1e12;
  s.lifetimeEarnings = 1e12;
  s.parts = 1000;
}

/** Run every stage to the end. */
function restoreAll(s: GameState): void {
  for (let i = 0; i < ECON.barn.stages.length; i++) {
    expect(startBarnStage(s)).toBe(true);
    tick(s, ECON.barn.stages[i]!.seconds + 0.5);
  }
}

describe('barn find', () => {
  it('stays locked until enough cars are sold, then a covered classic appears', () => {
    const s = newGame(T0, 3);
    tick(s, 1);
    expect(barnUnlocked(s)).toBe(false);
    expect(s.barn.status).toBe('locked');
    expect(startBarnStage(s)).toBe(false);
    const r = unlocked();
    expect(r.s.barn.status).toBe('covered');
    expect(r.events.some((e) => e.type === 'barnFound')).toBe(true);
    expect(r.s.barn.model).toMatch(/'\d\d$/);
  });

  it('charges cash and parts for each stage and refuses when short', () => {
    const { s } = unlocked();
    const first = barnStageCost(s);
    expect(first.cash).toBeGreaterThan(0);
    s.cash = first.cash - 1;
    expect(startBarnStage(s)).toBe(false);
    s.cash = first.cash;
    s.lifetimeEarnings = first.cash;
    expect(startBarnStage(s)).toBe(true);
    expect(s.cash).toBe(0);
    expect(s.barn.status).toBe('working');
    expect(nextBarnStage(s)).toBeNull();
    // Stage 2 needs parts.
    tick(s, ECON.barn.stages[0]!.seconds + 0.5);
    expect(s.barn.stage).toBe(1);
    const second = barnStageCost(s);
    expect(second.parts).toBe(ECON.barn.stages[1]!.parts);
    s.cash = 1e9;
    s.lifetimeEarnings = 1e9;
    s.parts = second.parts - 1;
    expect(startBarnStage(s)).toBe(false);
    s.parts = second.parts;
    expect(startBarnStage(s)).toBe(true);
    expect(s.parts).toBe(0);
  });

  it('runs all stages, reveals a fixed price, sells, and a bigger find comes later', () => {
    const { s } = unlocked();
    rich(s);
    const events: GameEvent[] = [];
    for (let i = 0; i < ECON.barn.stages.length; i++) {
      startBarnStage(s);
      events.push(...tick(s, ECON.barn.stages[i]!.seconds + 0.5));
    }
    expect(s.barn.status).toBe('finished');
    expect(events.filter((e) => e.type === 'barnStageDone').length).toBe(ECON.barn.stages.length);
    expect(events.some((e) => e.type === 'barnFinished')).toBe(true);
    expect(sellBarnCar(s)).toBe(0); // must reveal first
    const teaser = barnValue(s);
    expect(revealBarn(s)).toBe(true);
    expect(s.barn.value).toBe(teaser);
    s.levels.quality += 10; // price is locked at the reveal
    expect(barnValue(s)).toBe(teaser);
    const before = s.cash;
    expect(sellBarnCar(s)).toBe(teaser);
    expect(s.cash).toBe(before + teaser);
    expect(s.barn.status).toBe('away');
    expect(s.barn.restored).toBe(1);
    tick(s, ECON.barn.nextFindSeconds + 1);
    expect(s.barn.status).toBe('covered');
    s.levels.quality -= 10;
    expect(barnValue(s)).toBeGreaterThan(teaser);
  });

  it('pays back clearly more than it costs (worth the wait)', () => {
    const { s } = unlocked();
    const ecv = expectedCarValue(s.levels.quality, s.carsSold);
    const cost = ECON.barn.stages.reduce((sum, st) => sum + st.cashMult, 0) * ecv;
    expect(barnValue(s) / cost).toBeGreaterThan(2);
  });

  it('keeps going while the player is away, one stage at most', () => {
    const { s } = unlocked();
    rich(s);
    startBarnStage(s);
    applyElapsed(s, T0 + 3600_000);
    expect(s.barn.stage).toBe(1);
    expect(s.barn.status).toBe('covered');
  });

  it('a clock moved backwards does not advance the barn', () => {
    const { s } = unlocked();
    rich(s);
    startBarnStage(s);
    const left = s.barn.timeLeft;
    applyElapsed(s, T0 - 3600_000);
    expect(s.barn.timeLeft).toBe(left);
  });

  it('saves spare parts for a stage that needs them', () => {
    const { s } = unlocked();
    rich(s);
    startBarnStage(s);
    tick(s, ECON.barn.stages[0]!.seconds + 0.5);
    expect(barnReservesParts(s)).toBe(true);
    s.parts = 4;
    const car = s.cars[0] ?? (tick(s, 3), s.cars[0])!;
    car.dirt = 0.0001;
    car.damage = 0.8;
    washCar(s, car.id, 100);
    expect(car.dirt).toBe(0);
    expect(s.parts).toBe(4);
    expect(car.damage).toBe(0.8);
  });

  it('survives a save round trip and repairs a broken barn', () => {
    const { s } = unlocked();
    rich(s);
    restoreAll(s);
    revealBarn(s);
    const loaded = deserialize(serialize(s, T0), T0)!.state;
    expect(loaded.barn).toEqual(s.barn);
    const bad = JSON.parse(JSON.stringify(s)) as GameState;
    (bad.barn as { status: string }).status = 'exploded';
    const fixed = deserialize(serialize(bad, T0), T0)!.state;
    expect(fixed.barn.status).toBe('locked');
  });

  it('old saves without a barn get one', () => {
    const s = newGame(T0, 1);
    const raw = JSON.parse(JSON.stringify(s)) as Record<string, unknown>;
    delete raw.barn;
    const loaded = deserialize(serialize(raw as unknown as GameState, T0), T0)!.state;
    expect(loaded.barn.status).toBe('locked');
  });
});
