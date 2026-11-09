import { describe, expect, it } from 'vitest';
import { CLASSIC_NAMES, ECON, MODEL_NAMES, type CarFamily } from '../src/core/config';
import { BOOK_MODELS, bookUnlocked, markBookSeen, recordModel, unseenEntries } from '../src/core/collection';
import { checksum, deserialize, serialize } from '../src/core/save';
import { newGame } from '../src/core/state';
import { bookCard, bookView, familyOf } from '../src/ui/collectionView';
import { thumbKey } from '../src/game/bookArt';

const T0 = 1_800_000_000_000;

describe('collection book screen (P1.4b)', () => {
  it('new entries are unseen until the book is opened', () => {
    const s = newGame(T0, 3);
    expect(BOOK_MODELS.every((m) => s.collection.models[m]!.seen === false)).toBe(true);
    expect(unseenEntries(s)).toEqual([]);
    const a = MODEL_NAMES.sedan[0]!;
    const b = MODEL_NAMES.van[2]!;
    recordModel(s, a, 'common');
    recordModel(s, b, 'rare');
    expect(unseenEntries(s)).toEqual([a, b]);
    expect(markBookSeen(s)).toBe(2);
    expect(unseenEntries(s)).toEqual([]);
    expect(markBookSeen(s)).toBe(0);
    // Entries not found yet stay unseen, so they are NEW when they are found.
    expect(s.collection.models[MODEL_NAMES.sedan[1]!]!.seen).toBe(false);
    recordModel(s, a, 'epic');
    expect(unseenEntries(s)).toEqual([]);
  });

  it('the 📒 button waits for the end of the quiet tutorial sales', () => {
    const s = newGame(T0, 3);
    expect(bookUnlocked(s)).toBe(false);
    recordModel(s, MODEL_NAMES.sedan[0]!, 'common');
    s.carsSold = ECON.collection.quietSales;
    expect(bookUnlocked(s)).toBe(false);
    s.carsSold += 1;
    expect(bookUnlocked(s)).toBe(true);
    // A later empire (carsSold back to 0) keeps the button, as does a book that was opened.
    s.carsSold = 0;
    s.legacy.sold = 1;
    expect(bookUnlocked(s)).toBe(true);
    s.legacy.sold = 0;
    markBookSeen(s);
    expect(bookUnlocked(s)).toBe(true);
  });

  it('save: old entries without the flag load unseen; a seen flag without a sale is repaired', () => {
    const old = newGame(T0, 6) as unknown as { collection: { models: Record<string, Record<string, unknown>> } };
    const m = MODEL_NAMES.pickup[1]!;
    old.collection.models[m] = { sold: 4, best: 1 };
    old.collection.models[MODEL_NAMES.pickup[2]!] = { sold: 0, best: -1, seen: true };
    old.collection.models[MODEL_NAMES.pickup[3]!] = { sold: 2, best: 0, seen: 'yes' };
    const env = JSON.parse(serialize(newGame(T0, 6), T0));
    env.data = JSON.stringify(old);
    env.sum = checksum(env.data);
    const s = deserialize(JSON.stringify(env), T0)!.state;
    expect(s.collection.models[m]).toEqual({ sold: 4, best: 1, seen: false });
    expect(s.collection.models[MODEL_NAMES.pickup[2]!]!.seen).toBe(false);
    expect(s.collection.models[MODEL_NAMES.pickup[3]!]!.seen).toBe(false);
    markBookSeen(s);
    const back = deserialize(serialize(s, T0), T0)!.state;
    expect(back.collection.models[m]!.seen).toBe(true);
  });

  it('every entry is drawn as its own car type', () => {
    for (const f of Object.keys(MODEL_NAMES) as CarFamily[]) {
      for (const m of [...MODEL_NAMES[f], ...CLASSIC_NAMES[f]]) expect(familyOf(m)).toBe(f);
    }
  });

  it('cards: silhouette text, sales toward the next star, mastered', () => {
    const s = newGame(T0, 3);
    const m = MODEL_NAMES.muscle[0]!;
    expect(bookCard(s, m)).toMatchObject({ collected: false, isNew: false, rarity: null, stars: 0, line: 'Not found yet', progress: 0 });
    for (let i = 0; i < 12; i++) recordModel(s, m, i === 3 ? 'epic' : 'common');
    const c = bookCard(s, m);
    expect(c).toMatchObject({ collected: true, isNew: true, rarity: 'epic', rarityLabel: 'Epic', stars: 1, line: '12 sold · 50 for ⭐⭐' });
    expect(c.progress).toBeCloseTo(2 / 40);
    s.collection.models[m]!.sold = 200;
    expect(bookCard(s, m)).toMatchObject({ stars: 3, line: '200 sold · mastered', progress: 1 });
    // The thumbnail paint is fixed per model, and every silhouette of a car type shares one cached image.
    expect(bookCard(s, m).paint).toBe(bookCard(newGame(T0, 9), m).paint);
    const u1 = bookCard(s, MODEL_NAMES.muscle[1]!);
    const u2 = bookCard(s, MODEL_NAMES.muscle[2]!);
    expect(thumbKey(u1)).toBe(thumbKey(u2));
    expect(thumbKey(c)).not.toBe(thumbKey(u1));
  });

  it('pages: car types, brands and classics with their sets and totals', () => {
    const s = newGame(T0, 3);
    for (const m of MODEL_NAMES.hatch) recordModel(s, m, 'common');
    recordModel(s, CLASSIC_NAMES.van[0]!, 'legendary');
    const cars = bookView(s, 'cars');
    expect(cars.pages.map((p) => [p.id, p.have, p.of, p.isNew])).toEqual([
      ['cars', 4, 32, true],
      ['brands', 4, 32, true],
      ['classics', 1, 16, true],
    ]);
    expect(cars.sets).toHaveLength(8);
    const hatch = cars.sets.find((x) => x.id === 'hatch')!;
    expect(hatch).toMatchObject({ have: 4, of: 4, complete: true, name: 'Hatchback set', bonus: '+5% Hatchback value' });
    expect(cars.header).toBe('5/48 cars · 1/13 sets complete');
    const brands = bookView(s, 'brands');
    expect(brands.sets.map((x) => [x.id, x.have, x.of])).toEqual([
      ['Vortex', 1, 8],
      ['Stallion', 1, 8],
      ['Kaze', 1, 8],
      ['Regalia', 1, 8],
    ]);
    const classics = bookView(s, 'classics');
    expect(classics.sets).toHaveLength(1);
    expect(classics.sets[0]!.cards).toHaveLength(16);
    markBookSeen(s);
    expect(bookView(s, 'cars').pages.every((p) => !p.isNew)).toBe(true);
  });
});
