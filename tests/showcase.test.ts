// Showcase (P1.4c): keep a restored barn classic instead of selling it.
import { describe, expect, it } from 'vitest';
import { CLASSIC_NAMES, ECON } from '../src/core/config';
import { canKeepBarnCar, keepBarnCar, sellBarnCar } from '../src/core/barn';
import { bestRarity, inShowcase, sanitizeShowcase } from '../src/core/collection';
import { incomeMultiplier, legacyMultiplier, sellEmpire, showcaseMultiplier } from '../src/core/legacy';
import { deserialize, serialize } from '../src/core/save';
import { newGame, type GameState } from '../src/core/state';

const T0 = 1_800_000_000_000;
const B = ECON.collection.showcaseBonus;

function revealed(s: GameState, model: string, value = 1000): void {
  s.barn.status = 'revealed';
  s.barn.model = model;
  s.barn.value = value;
}

describe('showcase', () => {
  it('keeping pays nothing, records the classic and adds to every payout', () => {
    const s = newGame(T0, 1);
    const m = CLASSIC_NAMES.muscle[0]!;
    revealed(s, m);
    const cash = s.cash;
    const life = s.lifetimeEarnings;
    const ev: { type: string }[] = [];
    expect(canKeepBarnCar(s)).toBe(true);
    expect(keepBarnCar(s, ev as never)).toBe(true);
    expect(s.cash).toBe(cash);
    expect(s.lifetimeEarnings).toBe(life);
    expect(inShowcase(s, m)).toBe(true);
    expect(bestRarity(s, m)).toBe('legendary');
    expect(ev[0]!.type).toBe('bookNew');
    expect(s.barn.status).toBe('away');
    expect(s.barn.restored).toBe(1);
    expect(s.barn.value).toBe(0);
    expect(s.barn.timeLeft).toBeGreaterThan(0);
    expect(showcaseMultiplier(s)).toBeCloseTo(1 + B, 9);
    expect(incomeMultiplier(s)).toBeCloseTo(legacyMultiplier(s) * (1 + B), 9);
  });

  it('holds one of each model: a repeat find can only be sold', () => {
    const s = newGame(T0, 2);
    const m = CLASSIC_NAMES.van[1]!;
    revealed(s, m);
    keepBarnCar(s);
    revealed(s, m, 500);
    expect(canKeepBarnCar(s)).toBe(false);
    expect(keepBarnCar(s)).toBe(false);
    expect(s.barn.status).toBe('revealed');
    expect(sellBarnCar(s)).toBe(500);
    expect(s.collection.showcase).toEqual([m]);
    expect(s.collection.models[m]!.sold).toBe(2);
  });

  it('cannot keep before the reveal', () => {
    const s = newGame(T0, 3);
    s.barn.status = 'finished';
    s.barn.model = CLASSIC_NAMES.sedan[0]!;
    expect(canKeepBarnCar(s)).toBe(false);
    expect(keepBarnCar(s)).toBe(false);
    expect(s.collection.showcase).toEqual([]);
  });

  it('every classic kept tops out at +0.5% x 16', () => {
    const s = newGame(T0, 4);
    for (const f of Object.keys(CLASSIC_NAMES) as (keyof typeof CLASSIC_NAMES)[]) for (const m of CLASSIC_NAMES[f]) {
      revealed(s, m);
      expect(keepBarnCar(s)).toBe(true);
    }
    expect(s.collection.showcase.length).toBe(16);
    expect(showcaseMultiplier(s)).toBeCloseTo(1 + 16 * B, 9);
  });

  it('is kept when the empire is sold (a copy)', () => {
    const s = newGame(T0, 5);
    revealed(s, CLASSIC_NAMES.pickup[0]!);
    keepBarnCar(s);
    s.lifetimeEarnings = 1e10;
    const old = s.collection.showcase;
    expect(sellEmpire(s, T0 + 1000)).not.toBeNull();
    expect(s.collection.showcase).toEqual([CLASSIC_NAMES.pickup[0]!]);
    expect(s.collection.showcase).not.toBe(old);
  });

  it('save: round-trips, old saves start empty, junk is repaired', () => {
    const s = newGame(T0, 6);
    revealed(s, CLASSIC_NAMES.hatch[0]!);
    keepBarnCar(s);
    expect(deserialize(serialize(s, T0), T0)!.state.collection.showcase).toEqual([CLASSIC_NAMES.hatch[0]!]);
    const old = JSON.parse(JSON.stringify(s)) as { collection: Record<string, unknown> };
    delete old.collection.showcase;
    const t = newGame(T0, 6);
    Object.assign(t, old);
    expect(deserialize(serialize(t, T0), T0)!.state.collection.showcase).toEqual([]);
    const m = CLASSIC_NAMES.suv[0]!;
    expect(sanitizeShowcase([m, m, 'Vortex Nope', 7, CLASSIC_NAMES.van[0]!])).toEqual([m, CLASSIC_NAMES.van[0]!]);
    expect(sanitizeShowcase('nope')).toEqual([]);
  });
});

describe('showcase texts', () => {
  it('book: kept cards and the Barn Classics showcase line', async () => {
    const { bookView, showcaseLine, pctText } = await import('../src/ui/collectionView');
    const { sellEmpirePreview } = await import('../src/ui/legacyView');
    const s = newGame(T0, 7);
    expect(pctText(0.005)).toBe('0.5%');
    expect(pctText(0.015)).toBe('1.5%');
    expect(showcaseLine(s)).toBe('🏆 Keep a restored classic: +0.5% all income each');
    const m = CLASSIC_NAMES.sports[0]!;
    revealed(s, m);
    keepBarnCar(s);
    expect(showcaseLine(s)).toBe('🏆 Showcase 1/16 · +0.5% all income');
    const set = bookView(s, 'classics').sets.find((x) => x.kind === 'classics')!;
    expect(set.showcase).toBe(showcaseLine(s));
    const card = set.cards.find((c) => c.model === m)!;
    expect(card.kept).toBe(true);
    expect(card.collected).toBe(true);
    expect(card.line).toBe('🏆 In your showcase');
    expect(bookView(s, 'cars').sets.every((x) => x.showcase === undefined)).toBe(true);
    expect(sellEmpirePreview(s).keeps).toContain('Collection book and 1 showcase classic');
  });
});
