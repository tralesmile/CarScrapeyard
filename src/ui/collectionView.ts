// Collection book texts (P1.4a: set and mastery announcements) and the book screen's view model (P1.4b). Pure: no DOM.

import { CLASSIC_NAMES, ECON, MODEL_NAMES, PAINTS, type CarFamily, type Rarity } from '../core/config';
import {
  BOOK_MODELS,
  SETS,
  bestRarity,
  bookProgress,
  inShowcase,
  isCollected,
  isSetComplete,
  masteryStars,
  nextMasteryAt,
  setProgress,
  type CollectionSet,
} from '../core/collection';
import type { GameState } from '../core/state';
import { t } from '../i18n';

type SetRef = { kind: CollectionSet['kind']; id: string };

export function setName(set: SetRef): string {
  if (set.kind === 'family') return t('book.set.family', { name: ECON.families[set.id as keyof typeof ECON.families].name });
  if (set.kind === 'brand') return t('book.set.brand', { name: set.id });
  return t('book.set.classics');
}

/** What completing the set gives, e.g. "+5% Sedan value". */
export function setBonusText(set: SetRef): string {
  const C = ECON.collection;
  const pct = (x: number) => `+${Math.round(x * 100)}%`;
  if (set.kind === 'family') return t('book.bonus.value', { pct: pct(C.familySetBonus), name: ECON.families[set.id as keyof typeof ECON.families].name });
  if (set.kind === 'brand') return t('book.bonus.value', { pct: pct(C.brandSetBonus), name: set.id });
  return t('book.bonus.classics', { pct: pct(C.classicsSetBonus) });
}

/** Banner for a completed set: title and line. */
export function setCompleteBanner(kind: CollectionSet['kind'], id: string): { title: string; line: string } {
  const set = SETS.find((s) => s.kind === kind && s.id === id) ?? { kind, id };
  return { title: t('book.setComplete.title'), line: t('book.setComplete.line', { set: setName(set), bonus: setBonusText(set) }) };
}

/** Toast for a new mastery star. */
export function masteryToast(model: string, stars: number): string {
  return t('book.mastery.toast', { stars: '⭐'.repeat(stars), model, pct: Math.round(stars * ECON.collection.masteryBonus * 100) });
}

/** Showcase summary (P1.4c), e.g. "🏆 Showcase 3/16 · +1.5% all income", or how to start one. */
export function showcaseLine(state: Pick<GameState, 'collection'>): string {
  const n = state.collection.showcase.length;
  if (n === 0) return t('book.showcase.start', { pct: pctText(ECON.collection.showcaseBonus) });
  return t('book.showcase.line', { n, of: CLASSIC_COUNT, pct: pctText(n * ECON.collection.showcaseBonus) });
}

const CLASSIC_COUNT = Object.values(CLASSIC_NAMES).reduce((a, l) => a + l.length, 0);

/** 0.005 -> "0.5%", 0.05 -> "5%", 0.015 -> "1.5%". */
export function pctText(x: number): string {
  return `${Math.round(x * 1000) / 10}%`;
}

// ---- Book screen (P1.4b) -------------------------------------------------------------------------------------------

export type BookPage = 'cars' | 'brands' | 'classics';

export interface BookCard {
  model: string;
  family: CarFamily;
  /** Paint for the thumbnail: fixed per model, so a card always looks the same. */
  paint: number;
  collected: boolean;
  /** Collected since the book was last opened. */
  isNew: boolean;
  /** Best rarity sold, or null before the first sale. */
  rarity: Rarity | null;
  rarityLabel: string;
  stars: number;
  /** "12 sold · 50 for ⭐⭐", "200 sold · mastered", or "Not found yet". */
  line: string;
  /** Mastery progress toward the next star, 0..1 (1 when mastered). */
  progress: number;
  /** A barn classic standing in the showcase (P1.4c). */
  kept: boolean;
}

export interface BookSetView {
  kind: CollectionSet['kind'];
  id: string;
  name: string;
  bonus: string;
  have: number;
  of: number;
  complete: boolean;
  /** Barn Classics only: the showcase line, e.g. "🏆 Showcase 3/16 · +1.5% all income" (P1.4c). */
  showcase?: string;
  cards: BookCard[];
}

export interface BookView {
  header: string;
  pages: { id: BookPage; name: string; have: number; of: number; isNew: boolean }[];
  sets: BookSetView[];
}

const FAMILY_OF: Record<string, CarFamily> = Object.fromEntries(
  (Object.keys(MODEL_NAMES) as CarFamily[]).flatMap((f) => [...MODEL_NAMES[f], ...CLASSIC_NAMES[f]].map((m) => [m, f])),
);

/** Family a book entry is drawn as. */
export function familyOf(model: string): CarFamily {
  return FAMILY_OF[model] ?? 'sedan';
}

function paintOf(model: string): number {
  const i = BOOK_MODELS.indexOf(model);
  return PAINTS[(Math.max(0, i) * 7) % PAINTS.length]!;
}

export function bookCard(state: Pick<GameState, 'collection'>, model: string): BookCard {
  const e = state.collection.models[model];
  const collected = isCollected(state, model);
  const rarity = bestRarity(state, model);
  const stars = masteryStars(state, model);
  const next = nextMasteryAt(state, model);
  const sold = e?.sold ?? 0;
  const tiers = ECON.collection.masteryTiers;
  const prev = stars === 0 ? 0 : tiers[stars - 1]!;
  let line = t('book.card.unfound');
  const kept = inShowcase(state, model);
  if (kept) line = t('book.card.kept');
  else if (collected) line = next === null ? t('book.card.mastered', { sold }) : t('book.card.next', { sold, next, stars: '⭐'.repeat(stars + 1) });
  return {
    model,
    family: familyOf(model),
    paint: paintOf(model),
    collected,
    isNew: collected && !(e?.seen ?? false),
    rarity,
    rarityLabel: rarity ? ECON.rarity[rarity].label : '',
    stars,
    line,
    progress: next === null ? 1 : Math.min(1, (sold - prev) / (next - prev)),
    kept,
  };
}

const PAGE_OF: Record<CollectionSet['kind'], BookPage> = { family: 'cars', brand: 'brands', classics: 'classics' };
const pageName = (id: BookPage): string => t(`book.page.${id}`);

/** Everything the book screen shows for one page. */
export function bookView(state: Pick<GameState, 'collection'>, page: BookPage): BookView {
  const p = bookProgress(state);
  const pages = (['cars', 'brands', 'classics'] as BookPage[]).map((id) => {
    const models = [...new Set(SETS.filter((s) => PAGE_OF[s.kind] === id).flatMap((s) => s.models))];
    const cards = models.map((m) => bookCard(state, m));
    return { id, name: pageName(id), have: cards.filter((c) => c.collected).length, of: cards.length, isNew: cards.some((c) => c.isNew) };
  });
  const sets = SETS.filter((s) => PAGE_OF[s.kind] === page).map((s) => {
    const pr = setProgress(state, s);
    return {
      kind: s.kind,
      id: s.id,
      name: setName(s),
      bonus: setBonusText(s),
      have: pr.have,
      of: pr.of,
      complete: isSetComplete(state, s),
      ...(s.kind === 'classics' ? { showcase: showcaseLine(state) } : {}),
      cards: s.models.map((m) => bookCard(state, m)),
    };
  });
  const done = SETS.filter((s) => isSetComplete(state, s)).length;
  return { header: t('book.header', { have: p.have, of: p.of, done, sets: SETS.length }), pages, sets };
}
