import { describe, expect, it } from 'vitest';
import { deserialize, serialize } from '../src/core/save';
import { tick, addCash, hireManager, buySlot } from '../src/core/sim';
import { newGame, type GameState } from '../src/core/state';

const T0 = 1_800_000_000_000;

function walk(node: unknown, path: string, bad: string[]): void {
  if (typeof node === 'number' && !Number.isFinite(node)) bad.push(path);
  else if (node && typeof node === 'object') for (const [k, v] of Object.entries(node)) walk(v, `${path}.${k}`, bad);
}

describe('soak: long sessions do not grow the state', () => {
  it('48 hours of ticks with every business open keeps the save small and finite', () => {
    const s: GameState = newGame(T0, 7);
    addCash(s, 1e9);
    s.carsSold = 300;
    for (const id of Object.keys(s.businesses.opened) as (keyof typeof s.businesses.opened)[]) s.businesses.opened[id] = true;
    for (const k of ['mechanic', 'washer', 'seller'] as const) hireManager(s, k);
    for (let i = 0; i < 4; i++) buySlot(s);
    const sizes: number[] = [];
    for (let hour = 1; hour <= 48; hour++) {
      for (let i = 0; i < 3600; i += 10) tick(s, 10);
      if (hour % 12 === 0) sizes.push(serialize(s, T0).length);
    }
    expect(s.carsSold).toBeGreaterThan(300 + 100); // the crew really worked for 48 hours
    const bad: string[] = [];
    walk(s, 'state', bad);
    expect(bad).toEqual([]);
    // size at hour 48 must not exceed twice the size at hour 12 (no unbounded lists)
    expect(sizes[3] ?? Infinity).toBeLessThan((sizes[0] ?? 0) * 2 + 2000);
    expect(deserialize(serialize(s, T0), T0)).toBeTruthy();
  });
});
