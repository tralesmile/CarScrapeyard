import { describe, expect, it } from 'vitest';
import { CLASSIC_NAMES, ECON, MODEL_NAMES, type CarFamily } from '../src/core/config';
import {
  BOOK_MODELS,
  BRANDS,
  SETS,
  bestRarity,
  bookProgress,
  brandOf,
  classicsMult,
  collectionValueMult,
  expectedCollectionMult,
  isSetComplete,
  masteryStars,
  nextMasteryAt,
  recordModel,
  setProgress,
} from '../src/core/collection';
import { barnValue, sellBarnCar } from '../src/core/barn';
import { idleIncomePerSecond } from '../src/core/formulas';
import { earningsForTotalPoints, sellEmpire } from '../src/core/legacy';
import { checksum, deserialize, serialize } from '../src/core/save';
import { generateCar, sellCar } from '../src/core/sim';
import { newGame, type GameState } from '../src/core/state';
import { masteryToast, setBonusText, setCompleteBanner, setName } from '../src/ui/collectionView';

const T0 = 1_800_000_000_000;
const C = ECON.collection;

function sellAll(s: GameState, models: readonly string[], rarity: 'common' | 'rare' | 'epic' | 'legendary' = 'common') {
  return models.flatMap((m) => recordModel(s, m, rarity));
}

describe('Collection book (P1.4a)', () => {
  it('has every yard model and barn classic once, with fictional brands only', () => {
    expect(BOOK_MODELS.length).toBe(32 + 16);
    expect(new Set(BOOK_MODELS).size).toBe(BOOK_MODELS.length);
    for (const m of BOOK_MODELS) expect(BRANDS).toContain(brandOf(m));
    // 8 family sets of 4, 4 brand sets of 8 (one model per family), one classics set of 16.
    expect(SETS.filter((x) => x.kind === 'family').every((x) => x.models.length === 4)).toBe(true);
    const brands = SETS.filter((x) => x.kind === 'brand');
    expect(brands.length).toBe(4);
    for (const b of brands) {
      expect(b.models.length).toBe(8);
      const fams = (Object.keys(MODEL_NAMES) as CarFamily[]).filter((f) => MODEL_NAMES[f].some((m) => b.models.includes(m)));
      expect(fams.length).toBe(8);
    }
    expect(SETS.find((x) => x.kind === 'classics')!.models.length).toBe(16);
  });

  it('records the first sale, a better rarity, and mastery stars at 10 / 50 / 200 sales', () => {
    const s = newGame(T0, 1);
    const m = MODEL_NAMES.sedan[0]!;
    expect(bestRarity(s, m)).toBeNull();
    expect(recordModel(s, m, 'rare')).toEqual([{ type: 'bookNew', model: m, have: 1, of: 48 }]);
    expect(bestRarity(s, m)).toBe('rare');
    expect(recordModel(s, m, 'common')).toEqual([]);
    expect(bestRarity(s, m)).toBe('rare');
    expect(recordModel(s, m, 'epic')).toEqual([{ type: 'bookRarity', model: m, rarity: 'epic' }]);
    expect(nextMasteryAt(s, m)).toBe(10);
    const ev: unknown[] = [];
    for (let i = 3; i < 10; i++) ev.push(...recordModel(s, m, 'common'));
    expect(ev).toEqual([{ type: 'mastery', model: m, stars: 1 }]);
    expect(masteryStars(s, m)).toBe(1);
    for (let i = 10; i < 200; i++) recordModel(s, m, 'common');
    expect(masteryStars(s, m)).toBe(3);
    expect(nextMasteryAt(s, m)).toBeNull();
    // Unknown names (old saves, typos) change nothing.
    expect(recordModel(s, 'Nope Car', 'common')).toEqual([]);
  });

  it('completing a family set announces it and adds its bonus to that family only', () => {
    const s = newGame(T0, 1);
    const [a, b, c, d] = MODEL_NAMES.van;
    sellAll(s, [a!, b!, c!]);
    expect(setProgress(s, SETS[4]!)).toEqual({ have: 3, of: 4 });
    expect(collectionValueMult(s, 'van', a!)).toBe(1);
    const ev = recordModel(s, d!, 'common');
    expect(ev).toContainEqual({ type: 'setComplete', set: 'family', id: 'van' });
    expect(collectionValueMult(s, 'van', a!)).toBeCloseTo(1 + C.familySetBonus, 9);
    expect(collectionValueMult(s, 'sedan', MODEL_NAMES.sedan[0]!)).toBe(1);
    // Selling it again doesn't announce the set again.
    expect(recordModel(s, d!, 'common').some((e) => e.type === 'setComplete')).toBe(false);
  });

  it('a brand set needs that brand in every family; bonuses stack with mastery', () => {
    const s = newGame(T0, 1);
    const vortex = SETS.find((x) => x.kind === 'brand' && x.id === 'Vortex')!;
    const ev = sellAll(s, vortex.models);
    expect(ev.filter((e) => e.type === 'setComplete')).toEqual([{ type: 'setComplete', set: 'brand', id: 'Vortex' }]);
    const m = vortex.models[0]!; // a Vortex sedan
    expect(collectionValueMult(s, 'sedan', m)).toBeCloseTo(1 + C.brandSetBonus, 9);
    expect(collectionValueMult(s, 'sedan', MODEL_NAMES.sedan.find((x) => brandOf(x) !== 'Vortex')!)).toBe(1);
    sellAll(s, MODEL_NAMES.sedan);
    for (let i = 0; i < 60; i++) recordModel(s, m, 'common');
    expect(collectionValueMult(s, 'sedan', m)).toBeCloseTo(1 + C.brandSetBonus + C.familySetBonus + 2 * C.masteryBonus, 9);
    // The idle average is the mean over the family's four models.
    const avg = MODEL_NAMES.sedan.reduce((t, x) => t + collectionValueMult(s, 'sedan', x), 0) / 4;
    expect(expectedCollectionMult(s, 'sedan')).toBeCloseTo(avg, 9);
  });

  it('yard cars arrive worth the book bonus, and selling one records its model and rarity', () => {
    const plain = newGame(T0, 7);
    const booked = newGame(T0, 7);
    for (const f of Object.keys(MODEL_NAMES) as CarFamily[]) sellAll(booked, MODEL_NAMES[f]);
    const a = generateCar(plain);
    const b = generateCar(booked);
    // Same RNG stream: same car, worth every set bonus more.
    expect(b.model).toBe(a.model);
    expect(b.paint).toBe(a.paint);
    expect(b.value / a.value).toBeCloseTo(1 + C.familySetBonus + C.brandSetBonus, 2);
    // Idle income uses the same bonus.
    for (const s of [plain, booked]) {
      s.managers = { washer: true, mechanic: true, seller: true, scrapper: false };
    }
    expect(idleIncomePerSecond(booked) / idleIncomePerSecond(plain)).toBeCloseTo(1 + C.familySetBonus + C.brandSetBonus, 6);

    const s = newGame(T0, 3);
    const car = generateCar(s);
    car.dirt = 0;
    car.damage = 0;
    s.cars.push(car);
    const events = sellCar(s, car.id);
    expect(s.collection.models[car.model]!.sold).toBe(1);
    expect(bestRarity(s, car.model)).toBe(car.rarity);
    expect(events.some((e) => e.type === 'bookNew')).toBe(true);
  });

  it('a sold barn classic goes in the book; all sixteen raise barn values by 25%', () => {
    const s = newGame(T0, 4);
    s.barn.status = 'revealed';
    s.barn.model = CLASSIC_NAMES.muscle[0]!;
    s.barn.value = 1000;
    const ev: { type: string }[] = [];
    expect(sellBarnCar(s, ev as never)).toBe(1000);
    expect(bestRarity(s, CLASSIC_NAMES.muscle[0]!)).toBe('legendary');
    expect(ev[0]!.type).toBe('bookNew');
    s.barn.status = 'away';
    const before = barnValue(s);
    expect(classicsMult(s)).toBe(1);
    const classics = SETS.find((x) => x.kind === 'classics')!;
    sellAll(s, classics.models, 'legendary');
    expect(isSetComplete(s, classics)).toBe(true);
    expect(classicsMult(s)).toBe(1 + C.classicsSetBonus);
    expect(barnValue(s) / before).toBeCloseTo(1 + C.classicsSetBonus, 1);
  });

  it('is kept when the empire is sold (a copy, not shared)', () => {
    const s = newGame(T0, 5);
    sellAll(s, MODEL_NAMES.hatch);
    s.lifetimeEarnings = earningsForTotalPoints(12);
    const before = JSON.stringify(s.collection.models);
    expect(sellEmpire(s, T0 + 1)).not.toBeNull();
    expect(JSON.stringify(s.collection.models)).toBe(before);
    expect(bookProgress(s)).toEqual({ have: 4, of: 48 });
  });

  it('survives save and load; old saves get an empty book; bad entries are repaired', () => {
    const s = newGame(T0, 6);
    sellAll(s, MODEL_NAMES.suv, 'epic');
    const back = deserialize(serialize(s, T0), T0)!.state;
    expect(back.collection.models).toEqual(s.collection.models);

    const old = JSON.parse(JSON.stringify(newGame(T0, 6))) as { collection: Record<string, unknown> };
    delete old.collection.models;
    const env = JSON.parse(serialize(newGame(T0, 6), T0));
    env.data = JSON.stringify(old);
    env.sum = checksum(env.data);
    const loaded = deserialize(JSON.stringify(env), T0)!.state;
    expect(bookProgress(loaded)).toEqual({ have: 0, of: 48 });

    const bad = newGame(T0, 6) as unknown as { collection: { models: Record<string, { sold: number; best: number }> } };
    const m = MODEL_NAMES.sedan[1]!;
    bad.collection.models[m] = { sold: 3.7, best: 9 };
    bad.collection.models[MODEL_NAMES.sedan[2]!] = { sold: -4, best: 2 };
    bad.collection.models['Fake Car'] = { sold: 5, best: 1 };
    const env2 = JSON.parse(serialize(newGame(T0, 6), T0));
    env2.data = JSON.stringify(bad);
    env2.sum = checksum(env2.data);
    const fixed = deserialize(JSON.stringify(env2), T0)!.state;
    expect(fixed.collection.models[m]).toEqual({ sold: 3, best: 3, seen: false });
    expect(fixed.collection.models[MODEL_NAMES.sedan[2]!]).toEqual({ sold: 0, best: -1, seen: false });
    expect(fixed.collection.models['Fake Car']).toBeUndefined();
  });

  it('texts: set names, bonuses, the banner and the mastery toast', () => {
    expect(setName({ kind: 'family', id: 'suv' })).toBe('SUV set');
    expect(setName({ kind: 'brand', id: 'Kaze' })).toBe('Kaze set');
    expect(setName({ kind: 'classics', id: 'classics' })).toBe('Barn Classics');
    expect(setBonusText({ kind: 'family', id: 'sports' })).toBe('+5% Sports Car value');
    expect(setBonusText({ kind: 'classics', id: 'classics' })).toBe('+25% barn sale value');
    expect(setCompleteBanner('brand', 'Regalia')).toEqual({ title: 'SET COMPLETE!', line: '📒 Regalia set: +5% Regalia value forever' });
    expect(masteryToast('Kaze Pip', 2)).toBe('⭐⭐ Kaze Pip mastery: +2% value');
  });
});
