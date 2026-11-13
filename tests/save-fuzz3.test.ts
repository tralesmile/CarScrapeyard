import { describe, expect, it } from 'vitest';
import { checksum, deserialize, serialize } from '../src/core/save';
import { tick, buyUpgrade, buySlot, hireManager, sellCar, repairTap, washCar, crushCar, rerollContract, claimContract, addCash } from '../src/core/sim';
import { buyNode, respecTree, freePoints } from '../src/core/legacyTree';
import { LEGACY_BRANCHES } from '../src/core/legacyTree';
import { ECON, type LegacyNode } from '../src/core/config';
import { awardsToClaim, claimAward, trackAchievements, medalCount } from '../src/core/achievements';
import { sellEmpire, canSellEmpire } from '../src/core/legacy';
import { buyShopItem, shopItems } from '../src/core/shop';
import { dueBeat, markBeatSeen } from '../src/core/story';
import { newGame, type GameState } from '../src/core/state';

const T0 = 1_800_000_000_000;
const SAVE_V = (JSON.parse(serialize(newGame(T0, 1), T0)) as { v: number }).v;

function lcg(seed: number): () => number {
  let x = seed >>> 0;
  return () => {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    return x / 4294967296;
  };
}

const BAD: unknown[] = [null, 'x', -1, 0, 1e300, -1e300, 0.5, [], {}, true, 1e9, NaN, 99, 4];

function corrupt(node: unknown, rnd: () => number, rate: number): unknown {
  if (Array.isArray(node)) return node.map((v) => (rnd() < rate ? BAD[Math.floor(rnd() * BAD.length)] : corrupt(v, rnd, rate)));
  if (node && typeof node === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node)) out[k] = rnd() < rate ? BAD[Math.floor(rnd() * BAD.length)] : corrupt(v, rnd, rate);
    return out;
  }
  return node;
}

function late(seed: number): GameState {
  const s = newGame(T0, seed);
  s.managers = { mechanic: true, washer: true, seller: true, scrapper: true };
  s.cash = 1e9;
  s.lifetimeEarnings = 5e9;
  s.carsSold = 400;
  s.legacy.points = 40;
  s.legacy.sold = 2;
  for (const id of Object.keys(s.businesses.opened) as (keyof typeof s.businesses.opened)[]) s.businesses.opened[id] = true;
  tick(s, 600);
  trackAchievements(s);
  return s;
}

function mutate(base: GameState, only: string[], seed: number, rate: number): string {
  const tree = JSON.parse(JSON.stringify(base)) as Record<string, unknown>;
  const rnd = lcg(seed);
  for (const k of only) {
    const v = tree[k];
    tree[k] = v !== null && typeof v === 'object' ? corrupt(v, rnd, rate) : v;
  }
  const data = JSON.stringify(tree);
  return JSON.stringify({ v: SAVE_V, savedAt: T0, sum: checksum(data), data });
}

function walk(node: unknown, path: string, bad: string[]): void {
  if (typeof node === 'number' && !Number.isFinite(node)) bad.push(path);
  else if (node && typeof node === 'object') for (const [k, v] of Object.entries(node)) walk(v, `${path}.${k}`, bad);
}

const NODES = LEGACY_BRANCHES.flatMap((b) => [...ECON.legacy.tree.branches[b].nodes]) as LegacyNode[];

describe('fuzz: legacy tree, awards, wallet, story and random actions', () => {
  it('corrupted legacy / achievements / wallet / story subtrees load and play', () => {
    const base = late(21);
    let loaded = 0;
    for (let seed = 1; seed <= 800; seed++) {
      const r = deserialize(mutate(base, ['legacy', 'achievements', 'wallet', 'story'], seed, 0.1 + (seed % 4) * 0.05), T0);
      if (!r) continue;
      loaded++;
      const s = r.state;
      try {
        for (const n of NODES) buyNode(s, n);
        expect(freePoints(s)).toBeGreaterThanOrEqual(0);
        respecTree(s);
        for (const id of awardsToClaim(s)) claimAward(s, id);
        medalCount(s);
        for (const it of shopItems(s)) buyShopItem(s, it.id);
        const b = dueBeat(s);
        if (b) markBeatSeen(s, b);
        tick(s, 60);
        trackAchievements(s);
        if (canSellEmpire(s)) sellEmpire(s, T0);
        tick(s, 60);
      } catch (e) {
        throw new Error(`seed ${seed}: ${(e as Error).stack}`);
      }
      const bad: string[] = [];
      walk(s, 'state', bad);
      expect(bad, `seed ${seed} non-finite`).toEqual([]);
    }
    expect(loaded).toBeGreaterThan(50);
  });

  it('random public actions never throw or produce non-finite numbers', () => {
    let sold = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const rnd = lcg(seed * 7919);
      const s = newGame(T0, seed);
      s.cash = 1e5;
      for (let step = 0; step < 600; step++) {
        const car = s.cars.length ? s.cars[Math.floor(rnd() * s.cars.length)] : undefined;
        const pick = Math.floor(rnd() * 14);
        try {
          switch (pick) {
            case 0: tick(s, rnd() * 20); break;
            case 1: if (car) washCar(s, car.id, rnd() * 800); break;
            case 2: if (car) repairTap(s, car.id); break;
            case 3: if (car) sellCar(s, car.id, 0.9 + rnd() * 0.4); break;
            case 4: if (car) crushCar(s, car.id); break;
            case 5: buyUpgrade(s, (['wash', 'repair', 'quality', 'press'] as const)[Math.floor(rnd() * 4)]!, rnd() < 0.3 ? 'max' : 1 + Math.floor(rnd() * 10)); break;
            case 6: buySlot(s); break;
            case 7: hireManager(s, (['mechanic', 'washer', 'seller', 'scrapper'] as const)[Math.floor(rnd() * 4)]!); break;
            case 8: if (s.contracts.length) rerollContract(s, s.contracts[Math.floor(rnd() * s.contracts.length)]!.id); break;
            case 9: if (s.contracts.length) claimContract(s, s.contracts[Math.floor(rnd() * s.contracts.length)]!.id); break;
            case 10: addCash(s, 1e4 * rnd()); break;
            case 11: for (const id of awardsToClaim(s)) claimAward(s, id); break;
            case 12: if (canSellEmpire(s)) sellEmpire(s, T0); break;
            default: tick(s, 1);
          }
        } catch (e) {
          throw new Error(`seed ${seed} step ${step} action ${pick}: ${(e as Error).stack}`);
        }
      }
      sold += s.carsSold;
      const bad: string[] = [];
      walk(s, 'state', bad);
      expect(bad, `seed ${seed}`).toEqual([]);
      const back = deserialize(serialize(s, T0), T0);
      expect(back, `seed ${seed} round-trip`).not.toBeNull();
    }
    expect(sold, 'the random player actually sells cars').toBeGreaterThan(100);
  });
});
