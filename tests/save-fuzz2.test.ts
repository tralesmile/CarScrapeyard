import { describe, expect, it } from 'vitest';
import { checksum, deserialize, serialize } from '../src/core/save';
import { applyElapsed, queueOffline, tick } from '../src/core/sim';
import { claimBonus, claimCalendar, claimTask, refreshDaily, trackDaily } from '../src/core/daily';
import { bookProgress, unseenEntries } from '../src/core/collection';
import { newGame } from '../src/core/state';

const T0 = 1_800_000_000_000;
const SAVE_V = (JSON.parse(serialize(newGame(T0, 1), T0)) as { v: number }).v;
const DAY = 86_400_000;

function lcg(seed: number): () => number {
  let x = seed >>> 0;
  return () => {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    return x / 4294967296;
  };
}

const BAD: unknown[] = [null, 'x', -1, 0, 1e300, -1e300, 0.5, [], {}, true, 1e9, NaN];

function corrupt(node: unknown, rnd: () => number, rate: number): unknown {
  if (Array.isArray(node)) return node.map((v) => (rnd() < rate ? BAD[Math.floor(rnd() * BAD.length)] : corrupt(v, rnd, rate)));
  if (node && typeof node === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node)) out[k] = rnd() < rate ? BAD[Math.floor(rnd() * BAD.length)] : corrupt(v, rnd, rate);
    return out;
  }
  return node;
}

function richGame(seed: number): ReturnType<typeof newGame> {
  const s = newGame(T0, seed);
  s.managers = { mechanic: true, washer: true, seller: true, scrapper: true };
  s.cash = 1e9;
  s.lifetimeEarnings = 1e9;
  s.carsSold = 300;
  s.parts = 100;
  for (const id of Object.keys(s.businesses.opened) as (keyof typeof s.businesses.opened)[]) s.businesses.opened[id] = true;
  tick(s, 900);
  refreshDaily(s, T0);
  trackDaily(s);
  return s;
}

function mutate(base: ReturnType<typeof newGame>, only: string[], seed: number, rate: number): string {
  const tree = JSON.parse(JSON.stringify(base)) as Record<string, unknown>;
  const rnd = lcg(seed);
  for (const k of only) {
    const v = tree[k];
    const scalar = v === null || typeof v !== 'object';
    tree[k] = scalar ? (rnd() < rate ? BAD[Math.floor(rnd() * BAD.length)] : v) : corrupt(v, rnd, rate);
  }
  const data = JSON.stringify(tree);
  return JSON.stringify({ v: SAVE_V, savedAt: T0, sum: checksum(data), data });
}

describe('fuzz: collection book, daily tasks and absurd clocks', () => {
  it('collection and daily subtrees load, show and play without throwing', () => {
    const base = richGame(11);
    let loaded = 0;
    for (let seed = 1; seed <= 800; seed++) {
      const r = deserialize(mutate(base, ['collection', 'daily'], seed, 0.1 + (seed % 4) * 0.05), T0);
      if (!r) continue;
      loaded++;
      const s = r.state;
      try {
        for (let day = 0; day < 3; day++) {
          refreshDaily(s, T0 + day * DAY);
          tick(s, 30);
          trackDaily(s);
          for (let i = 0; i < 4; i++) claimTask(s, i);
          claimBonus(s);
          claimCalendar(s);
          bookProgress(s);
          unseenEntries(s);
        }
      } catch (e) {
        throw new Error(`seed ${seed}: ${(e as Error).stack}`);
      }
      expect(Number.isFinite(s.cash), `seed ${seed} cash`).toBe(true);
      expect(Number.isFinite(s.parts), `seed ${seed} parts`).toBe(true);
    }
    expect(loaded).toBeGreaterThan(50);
  });

  it('applyElapsed and queueOffline stay finite with absurd clocks', () => {
    const clocks = [T0 + 1, T0 + 3600_000, T0 + 400 * DAY, T0 - DAY, 0, -1, NaN, Infinity, -Infinity, 1e300, Number.MAX_SAFE_INTEGER];
    for (const now of clocks) {
      const s = richGame(13);
      s.lastSeen = T0;
      const seen = s.lastSeen;
      let r: ReturnType<typeof applyElapsed>;
      try {
        r = queueOffline(s, now);
      } catch (e) {
        throw new Error(`clock ${now}: ${(e as Error).stack}`);
      }
      expect(Number.isFinite(r.earned), `clock ${now} earned`).toBe(true);
      expect(Number.isFinite(s.pendingOffline), `clock ${now} pending`).toBe(true);
      expect(Number.isFinite(s.cash), `clock ${now} cash`).toBe(true);
      expect(s.lastSeen, `clock ${now} lastSeen never moves back`).toBeGreaterThanOrEqual(seen);
    }
  });

  it('a corrupted lastSeen in the save is repaired before the offline pass', () => {
    const base = richGame(17);
    for (let seed = 1; seed <= 300; seed++) {
      const r = deserialize(mutate(base, ['lastSeen', 'pendingOffline'], seed, 0.5), T0);
      if (!r) continue;
      expect(() => queueOffline(r.state, T0 + 6 * 3600_000), `seed ${seed}`).not.toThrow();
      expect(Number.isFinite(r.state.pendingOffline), `seed ${seed} pending`).toBe(true);
    }
  });
});
