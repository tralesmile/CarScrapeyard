// Story (P1.6): chapter 1 in Rust Valley. A handful of short scenes with Grandpa Joe and the rival tycoon Vince
// Valvano, each shown once when its moment comes. Pure rules: which beat is due, marking it seen, and whether Vince
// is the one who took an auction lot or a yard customer (flavour only, the economy does not change).
// Kept on a Sell Empire, so a later empire never repeats a scene.

import { ECON } from './config';
import { currentCity } from './cities';
import { canSellEmpire } from './legacy';
import type { GameState } from './state';

export const STORY_BEATS = ['vinceVisit', 'joeGarage', 'vinceAuction', 'vincePaint', 'chapter1End'] as const;
export type StoryBeatId = (typeof STORY_BEATS)[number];

export interface Story {
  /** Beats already shown, in the order they were shown. */
  seen: StoryBeatId[];
  /** `stats.playSeconds` when the last beat was shown (beats keep a gap between them). -1 = none yet. */
  lastAt: number;
  /** Lots that left the auction board unsold, all time (the first one is Vince's). */
  lotsLost: number;
  /** Yard customers who ran out of patience, all time. */
  buyersLost: number;
  /** Of those, how many Vince took (lots + customers), all time. */
  rivalWins: number;
}

export function newStory(): Story {
  return { seen: [], lastAt: -1, lotsLost: 0, buyersLost: 0, rivalWins: 0 };
}

export function storySeen(state: Pick<GameState, 'story'>, id: StoryBeatId): boolean {
  return state.story.seen.includes(id);
}

/** Vince is in the story once he has visited the yard. */
export function vinceMet(state: Pick<GameState, 'story'>): boolean {
  return storySeen(state, 'vinceVisit');
}

/** Whether a beat's moment has come (ignores order and the gap). Chapter 1 plays in Rust Valley only. */
export function beatReady(state: GameState, id: StoryBeatId): boolean {
  if (currentCity(state) !== 'rustValley') return false;
  switch (id) {
    case 'vinceVisit':
      return state.carsSold >= ECON.story.vinceVisitSales;
    case 'joeGarage':
      return state.businesses.opened.garage === true;
    case 'vinceAuction':
      return vinceMet(state) && state.businesses.opened.carlot === true && state.story.lotsLost > 0;
    case 'vincePaint':
      return vinceMet(state) && state.businesses.opened.paint === true;
    case 'chapter1End':
      return canSellEmpire(state);
  }
}

/** The beat to show now, if any: the first unseen one (in story order) whose moment has come, after the gap. */
export function dueBeat(state: GameState): StoryBeatId | null {
  const s = state.story;
  if (s.lastAt >= 0 && state.stats.playSeconds - s.lastAt < ECON.story.gapSeconds) return null;
  for (const id of STORY_BEATS) if (!s.seen.includes(id) && beatReady(state, id)) return id;
  return null;
}

export function markBeatSeen(state: GameState, id: StoryBeatId): void {
  if (state.story.seen.includes(id)) return;
  state.story.seen.push(id);
  state.story.lastAt = state.stats.playSeconds;
}

/** All of chapter 1 has been shown. */
export function chapterDone(state: Pick<GameState, 'story'>, chapter: 1 = 1): boolean {
  return chapter === 1 && state.story.seen.includes('chapter1End');
}

/**
 * A lot left the auction board unsold: count it and say whether Vince won it (the very first one once he is in the
 * story, then every `rivalEvery`-th lot by id, so it never touches the game RNG).
 */
export function noteLotLost(state: GameState, lotId: number): boolean {
  const s = state.story;
  const first = s.lotsLost === 0;
  s.lotsLost++;
  const rival = vinceMet(state) && (first || lotId % ECON.story.rivalEvery === 0);
  if (rival) s.rivalWins++;
  return rival;
}

/** A yard customer ran out of patience: count it and say whether Vince lured them away (every `rivalEvery`-th one). */
export function noteBuyerLost(state: GameState): boolean {
  const s = state.story;
  s.buyersLost++;
  const rival = vinceMet(state) && s.buyersLost % ECON.story.rivalEvery === 0;
  if (rival) s.rivalWins++;
  return rival;
}

export function sanitizeStory(s: Story): void {
  const seen: StoryBeatId[] = [];
  for (const id of Array.isArray(s.seen) ? s.seen : []) {
    if ((STORY_BEATS as readonly string[]).includes(id) && !seen.includes(id)) seen.push(id);
  }
  s.seen = seen;
  s.lastAt = Number.isFinite(s.lastAt) ? Math.max(-1, s.lastAt) : -1;
  for (const k of ['lotsLost', 'buyersLost', 'rivalWins'] as const) s[k] = Math.max(0, Math.floor(Number.isFinite(s[k]) ? s[k] : 0));
}
