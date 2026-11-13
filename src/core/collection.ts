// Collection book (P1.4a): every yard model and barn classic is an entry. Selling one adds it to the book with the best
// rarity it was sold in; selling many earns mastery stars. Completing a set (a family's models, a brand across the
// families, every barn classic) gives a permanent value bonus. The book is kept when the empire is sold. Pure rules.

import { CLASSIC_NAMES, ECON, MODEL_NAMES, type CarFamily, type Rarity } from './config';
import type { GameState } from './state';

export type Brand = 'Vortex' | 'Stallion' | 'Kaze' | 'Regalia';
export const BRANDS: readonly Brand[] = ['Vortex', 'Stallion', 'Kaze', 'Regalia'];
const RARITIES = Object.keys(ECON.rarity) as Rarity[];

export interface BookEntry {
  /** Times sold. */
  sold: number;
  /** Best rarity sold, as an index into the rarity list (0 Common .. 3 Legendary), -1 before the first sale. */
  best: number;
  /** The player has looked at this entry in the book since it was collected (P1.4b): false shows a NEW badge. */
  seen: boolean;
}

export type CollectionSet =
  | { kind: 'family'; id: CarFamily; models: readonly string[] }
  | { kind: 'brand'; id: Brand; models: readonly string[] }
  | { kind: 'classics'; id: 'classics'; models: readonly string[] };

const FAMILIES = Object.keys(MODEL_NAMES) as CarFamily[];

/** Every yard model, family by family. */
export const YARD_MODELS: readonly string[] = FAMILIES.flatMap((f) => MODEL_NAMES[f]);
/** Every barn classic, family by family. */
export const CLASSIC_MODELS: readonly string[] = FAMILIES.flatMap((f) => CLASSIC_NAMES[f]);
/** Every entry in the book. */
export const BOOK_MODELS: readonly string[] = [...YARD_MODELS, ...CLASSIC_MODELS];

export function brandOf(model: string): Brand | null {
  const b = model.split(' ')[0] as Brand;
  return BRANDS.includes(b) ? b : null;
}

/** The sets, in book order: eight family sets, four brand sets, then the classics. */
export const SETS: readonly CollectionSet[] = [
  ...FAMILIES.map((f) => ({ kind: 'family' as const, id: f, models: MODEL_NAMES[f] })),
  ...BRANDS.map((b) => ({ kind: 'brand' as const, id: b, models: YARD_MODELS.filter((m) => brandOf(m) === b) })),
  { kind: 'classics' as const, id: 'classics' as const, models: CLASSIC_MODELS },
];

/** An empty book: one entry per model, so old saves get every entry from `newGame` defaults. */
export function newBook(): Record<string, BookEntry> {
  return Object.fromEntries(BOOK_MODELS.map((m) => [m, { sold: 0, best: -1, seen: false }]));
}

function entry(state: Pick<GameState, 'collection'>, model: string): BookEntry | undefined {
  return state.collection.models[model];
}

export function isCollected(state: Pick<GameState, 'collection'>, model: string): boolean {
  return (entry(state, model)?.sold ?? 0) > 0;
}

/** Best rarity a model was sold in, or null before its first sale. */
export function bestRarity(state: Pick<GameState, 'collection'>, model: string): Rarity | null {
  const e = entry(state, model);
  return e && e.sold > 0 && e.best >= 0 ? (RARITIES[e.best] ?? null) : null;
}

/** Mastery stars (0-3) from the times a model was sold. */
export function masteryStars(state: Pick<GameState, 'collection'>, model: string): number {
  const sold = entry(state, model)?.sold ?? 0;
  return ECON.collection.masteryTiers.filter((t) => sold >= t).length;
}

/** Sales needed for the next star, or null at three stars. */
export function nextMasteryAt(state: Pick<GameState, 'collection'>, model: string): number | null {
  const sold = entry(state, model)?.sold ?? 0;
  return ECON.collection.masteryTiers.find((t) => sold < t) ?? null;
}

export function setProgress(state: Pick<GameState, 'collection'>, set: CollectionSet): { have: number; of: number } {
  return { have: set.models.filter((m) => isCollected(state, m)).length, of: set.models.length };
}

export function isSetComplete(state: Pick<GameState, 'collection'>, set: CollectionSet): boolean {
  return set.models.every((m) => isCollected(state, m));
}

/** Entries collected / entries in the book. */
export function bookProgress(state: Pick<GameState, 'collection'>): { have: number; of: number } {
  return { have: BOOK_MODELS.filter((m) => isCollected(state, m)).length, of: BOOK_MODELS.length };
}

function setFor(kind: CollectionSet['kind'], id: string): CollectionSet | undefined {
  return SETS.find((s) => s.kind === kind && s.id === id);
}

/** Collected entries the player has not looked at in the book yet (the 📒 button's red dot). */
export function unseenEntries(state: Pick<GameState, 'collection'>): string[] {
  return BOOK_MODELS.filter((m) => isCollected(state, m) && !entry(state, m)!.seen);
}

/** Opening the book marks every collected entry as seen. Returns how many were new. */
export function markBookSeen(state: Pick<GameState, 'collection'>): number {
  const fresh = unseenEntries(state);
  for (const m of fresh) entry(state, m)!.seen = true;
  return fresh.length;
}

/**
 * The 📒 button shows once the book has an entry and the first sales are over (the starter families are recorded
 * quietly during the tutorial), or at once in a later empire / after the book was opened.
 */
export function bookUnlocked(state: Pick<GameState, 'collection' | 'carsSold' | 'legacy'>): boolean {
  if (bookProgress(state).have === 0) return false;
  return state.carsSold > ECON.collection.quietSales || state.legacy.sold > 0 || BOOK_MODELS.some((m) => entry(state, m)!.seen);
}

/** Value multiplier a yard car of this family and model gets from the book (set bonuses and mastery stars). */
export function collectionValueMult(state: Pick<GameState, 'collection'>, family: CarFamily, model: string): number {
  const C = ECON.collection;
  let m = 1;
  const fam = setFor('family', family);
  if (fam && isSetComplete(state, fam)) m += C.familySetBonus;
  const brand = brandOf(model);
  const bs = brand ? setFor('brand', brand) : undefined;
  if (bs && isSetComplete(state, bs)) m += C.brandSetBonus;
  m += C.masteryBonus * masteryStars(state, model);
  return m;
}

/** Average book multiplier of a family's next car (its models are picked evenly), for idle income. */
export function expectedCollectionMult(state: Pick<GameState, 'collection'>, family: CarFamily): number {
  const models = MODEL_NAMES[family];
  return models.reduce((s, m) => s + collectionValueMult(state, family, m), 0) / models.length;
}

/** Barn sale value multiplier: every classic restored and sold. */
export function classicsMult(state: Pick<GameState, 'collection'>): number {
  const set = setFor('classics', 'classics');
  return set && isSetComplete(state, set) ? 1 + ECON.collection.classicsSetBonus : 1;
}

export type CollectionEvent =
  | { type: 'bookNew'; model: string; have: number; of: number }
  | { type: 'bookRarity'; model: string; rarity: Rarity }
  | { type: 'mastery'; model: string; stars: number }
  | { type: 'setComplete'; set: CollectionSet['kind']; id: string };

/** Record a sale in the book; returns what changed (new entry, better rarity, a star, completed sets). */
export function recordModel(state: GameState, model: string, rarity: Rarity): CollectionEvent[] {
  const e = state.collection.models[model];
  if (!e) return [];
  const out: CollectionEvent[] = [];
  const before = SETS.filter((s) => s.models.includes(model) && isSetComplete(state, s));
  const starsBefore = masteryStars(state, model);
  const first = e.sold === 0;
  e.sold += 1;
  const r = RARITIES.indexOf(rarity);
  if (first) {
    e.best = r;
    const p = bookProgress(state);
    out.push({ type: 'bookNew', model, have: p.have, of: p.of });
  } else if (r > e.best) {
    e.best = r;
    out.push({ type: 'bookRarity', model, rarity });
  }
  const stars = masteryStars(state, model);
  if (stars > starsBefore) out.push({ type: 'mastery', model, stars });
  for (const s of SETS) {
    if (s.models.includes(model) && !before.includes(s) && isSetComplete(state, s)) out.push({ type: 'setComplete', set: s.kind, id: s.id });
  }
  return out;
}

/** Save repair: whole, non-negative counts; a valid rarity once sold, -1 before; never seen before the first sale. */
export function sanitizeBook(book: Record<string, BookEntry>): void {
  for (const m of Object.keys(book)) {
    const e = book[m]!;
    e.sold = Number.isFinite(e.sold) && e.sold > 0 ? Math.floor(e.sold) : 0;
    const b = Math.floor(e.best);
    e.seen = e.sold > 0 && e.seen === true;
    e.best = e.sold === 0 ? -1 : Number.isFinite(b) ? Math.min(RARITIES.length - 1, Math.max(0, b)) : 0;
  }
}

/** Showcase (P1.4c): is this barn classic standing in the showcase? */
export function inShowcase(state: Pick<GameState, 'collection'>, model: string): boolean {
  return state.collection.showcase.includes(model);
}

/** Save repair: only real barn classics, each once, in the order kept. */
export function sanitizeShowcase(list: unknown): string[] {
  if (!Array.isArray(list)) return [];
  const out: string[] = [];
  for (const m of list) if (typeof m === 'string' && CLASSIC_MODELS.includes(m) && !out.includes(m)) out.push(m);
  return out;
}
