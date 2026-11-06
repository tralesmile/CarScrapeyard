// Collection hook (P0.14i): cars sold per family and the "first of a family" event.

import { describe, expect, it } from 'vitest';
import { ECON, type CarFamily } from '../src/core/config';
import { recordCollection, sellCar, tick, type GameEvent } from '../src/core/sim';
import { deserialize, serialize } from '../src/core/save';
import { newGame } from '../src/core/state';

const T0 = 1_800_000_000_000;
const FAMILIES = Object.keys(ECON.families) as CarFamily[];

function readyCar(s: ReturnType<typeof newGame>) {
  tick(s, ECON.arrivalInterval + 0.1);
  const car = s.cars[0]!;
  car.dirt = 0;
  car.damage = 0;
  return car;
}

describe('collection counts', () => {
  it('a new game counts zero cars for every family', () => {
    const s = newGame(T0, 1);
    expect(Object.keys(s.collection.sold).sort()).toEqual([...FAMILIES].sort());
    expect(Object.values(s.collection.sold).every((n) => n === 0)).toBe(true);
  });

  it('selling a car counts its family; only the first sale of a family announces it', () => {
    const s = newGame(T0, 7);
    const car = readyCar(s);
    const first = sellCar(s, car.id);
    expect(s.collection.sold[car.family]).toBe(1);
    expect(first).toContainEqual({ type: 'firstOfFamily', family: car.family, families: 1 });
    const again: GameEvent[] = [];
    recordCollection(s, car.family, again);
    expect(s.collection.sold[car.family]).toBe(2);
    expect(again).toEqual([]);
  });

  it('the families count grows with each new family, up to all of them', () => {
    const s = newGame(T0, 2);
    const seen: number[] = [];
    for (const f of FAMILIES) {
      const ev: GameEvent[] = [];
      recordCollection(s, f, ev);
      recordCollection(s, f, ev);
      const firsts = ev.filter((e) => e.type === 'firstOfFamily');
      expect(firsts).toHaveLength(1);
      if (firsts[0]?.type === 'firstOfFamily') seen.push(firsts[0].families);
    }
    expect(seen).toEqual(FAMILIES.map((_, i) => i + 1));
  });

  it('counts survive a save and old saves without them load with zeros', () => {
    const s = newGame(T0, 3);
    s.collection.sold.van = 4;
    const back = deserialize(serialize(s, T0), T0);
    expect(back?.state.collection.sold.van).toBe(4);
    const old = JSON.parse(JSON.stringify(s)) as Record<string, unknown>;
    delete old.collection;
    const loaded = deserialize(serialize(old as unknown as typeof s, T0), T0);
    expect(loaded?.state.collection.sold).toEqual(newGame(T0).collection.sold);
    // Hand-edited nonsense is cleaned up.
    const bad = newGame(T0, 4);
    (bad.collection.sold as Record<string, number>).van = -3;
    (bad.collection.sold as Record<string, number>).suv = 2.7;
    const fixed = deserialize(serialize(bad, T0), T0);
    expect(fixed?.state.collection.sold.van).toBe(0);
    expect(fixed?.state.collection.sold.suv).toBe(2);
  });
});
