import { describe, expect, it } from 'vitest';
import { checksum, deserialize, serialize } from '../src/core/save';
import { tick } from '../src/core/sim';
import { newGame } from '../src/core/state';

const T0 = 1_800_000_000_000;
const SAVE_V = (JSON.parse(serialize(newGame(T0, 1), T0)) as { v: number }).v;

/** Tiny deterministic generator so a failure can be replayed from its seed. */
function lcg(seed: number): () => number {
  let x = seed >>> 0;
  return () => {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    return x / 4294967296;
  };
}

const BAD: unknown[] = [null, 'x', -1, 0, 1e300, -1e300, 0.5, [], {}, true, 1e9];

/** Replace a few random leaves/branches of a JSON tree with hostile values. */
function corrupt(node: unknown, rnd: () => number, rate: number): unknown {
  if (Array.isArray(node)) return node.map((v) => (rnd() < rate ? BAD[Math.floor(rnd() * BAD.length)] : corrupt(v, rnd, rate)));
  if (node && typeof node === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node)) out[k] = rnd() < rate ? BAD[Math.floor(rnd() * BAD.length)] : corrupt(v, rnd, rate);
    return out;
  }
  return node;
}

describe('save corruption fuzz', () => {
  it('never throws on load or on the next minute of play, whatever the fields hold', () => {
    const base = newGame(T0, 3);
    base.managers = { mechanic: true, washer: true, seller: true, scrapper: false };
    tick(base, 600);
    fuzz(base);
  });

  it('also holds for a late game with every business open', () => {
    const base = newGame(T0, 5);
    base.managers = { mechanic: true, washer: true, seller: true, scrapper: true };
    base.cash = 1e12;
    base.lifetimeEarnings = 1e12;
    base.parts = 500;
    base.carsSold = 400;
    for (const id of Object.keys(base.businesses.opened) as (keyof typeof base.businesses.opened)[]) base.businesses.opened[id] = true;
    tick(base, 1200);
    fuzz(base);
  });
});

function fuzz(base: ReturnType<typeof newGame>): void {
  {
    const tree = JSON.parse(JSON.stringify(base)) as unknown;
    let loaded = 0;
    for (let seed = 1; seed <= 1500; seed++) {
      const rnd = lcg(seed);
      const data = JSON.stringify(corrupt(tree, rnd, 0.02 + (seed % 5) * 0.02));
      const text = JSON.stringify({ v: SAVE_V, savedAt: T0, sum: checksum(data), data });
      let result: ReturnType<typeof deserialize>;
      try {
        result = deserialize(text, T0);
      } catch (e) {
        throw new Error(`seed ${seed}: deserialize threw ${String(e)}`);
      }
      if (!result) continue;
      loaded++;
      try {
        for (let i = 0; i < 60; i++) tick(result.state, 1);
      } catch (e) {
        throw new Error(`seed ${seed}: tick threw ${(e as Error).stack}`);
      }
      expect(Number.isFinite(result.state.cash), `seed ${seed} cash`).toBe(true);
      expect(Number.isFinite(result.state.lifetimeEarnings), `seed ${seed} lifetime`).toBe(true);
    }
    // Most light corruptions are repaired rather than rejected, so the fuzz really exercises the game after load.
    expect(loaded).toBeGreaterThan(30);
  }
}
