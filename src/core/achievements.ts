// Achievements (P1.5c). Pure rules.
//
// Each achievement follows one lifetime number and has four medal tiers. Numbers that already last forever (stats,
// the book, Legacy) are read directly. Numbers a Sell Empire resets (garage jobs, lot sales, paint orders, barn
// restorations) are followed by their growth like the daily tasks (`trackAchievements` in `tick`), so a reset never
// takes progress away. Old saves start the followed totals at what the current empire has done (backfill for free).
// Claiming pays the next unclaimed tier that is reached; nothing is paid automatically.

import { ECON } from './config';
import { bookProgress } from './collection';
import { carsWorth } from './daily';
import type { GameState } from './state';

export type AwardId = keyof typeof ECON.achievements.list;
export const AWARD_IDS = Object.keys(ECON.achievements.list) as AwardId[];
export const MEDAL_COUNT = ECON.achievements.medals.length;

/** Awards whose number resets on a Sell Empire: followed by growth. */
export const TRACKED = ['garage', 'lot', 'paint', 'barn'] as const;
export type TrackedId = (typeof TRACKED)[number];

export interface Achievements {
  /** Lifetime totals of the numbers a sale resets, and the counter seen at the last look. */
  tracked: Record<TrackedId, { total: number; last: number }>;
  /** Tiers claimed per award (0-4). */
  claimed: Record<AwardId, number>;
}

export function newAchievements(): Achievements {
  const tracked = {} as Achievements['tracked'];
  for (const id of TRACKED) tracked[id] = { total: 0, last: 0 };
  const claimed = {} as Achievements['claimed'];
  for (const id of AWARD_IDS) claimed[id] = 0;
  return { tracked, claimed };
}

function trackedCounter(state: GameState, id: TrackedId): number {
  switch (id) {
    case 'garage':
      return state.garage.jobsDone;
    case 'lot':
      return state.carlot.sold;
    case 'paint':
      return state.paint.jobsDone;
    case 'barn':
      return state.barn.restored;
  }
}

/** Follow the resettable counters (called after every tick). */
export function trackAchievements(state: GameState): void {
  for (const id of TRACKED) {
    const t = state.achievements.tracked[id];
    const cur = trackedCounter(state, id);
    if (cur > t.last) t.total += cur - t.last;
    t.last = cur;
  }
}

function isTracked(id: AwardId): id is TrackedId {
  return (TRACKED as readonly string[]).includes(id);
}

/** The lifetime number an award follows. */
export function awardValue(state: GameState, id: AwardId): number {
  if (isTracked(id)) return state.achievements.tracked[id].total;
  switch (id) {
    case 'sold':
      return Object.values(state.collection.sold).reduce((a, n) => a + n, 0);
    case 'earned':
      return state.legacy.allTime + state.lifetimeEarnings;
    case 'crush':
      return state.stats.carsCrushed;
    case 'haggle':
      return state.stats.perfectHaggles;
    case 'buyer':
      return state.stats.buyersServed;
    case 'contract':
      return state.stats.contractsDone;
    case 'legendary':
      return state.stats.legendaryFound;
    case 'book':
      return bookProgress(state).have;
    case 'empire':
      return state.legacy.sold;
    case 'days':
      return state.daily.claims;
  }
}

/** Tiers reached (0-4). */
export function tiersReached(state: GameState, id: AwardId): number {
  const v = awardValue(state, id);
  return ECON.achievements.list[id].tiers.filter((t) => v >= t).length;
}

/** A reached tier is waiting to be claimed. */
export function canClaimAward(state: GameState, id: AwardId): boolean {
  return state.achievements.claimed[id] < tiersReached(state, id);
}

export function awardsToClaim(state: GameState): AwardId[] {
  return AWARD_IDS.filter((id) => canClaimAward(state, id));
}

/** Reward of a tier (0-3), in cash at today's car value. */
export function awardReward(state: GameState, tier: number): number {
  return carsWorth(state, ECON.achievements.rewardCars[Math.min(tier, MEDAL_COUNT - 1)] ?? 0);
}

/** Claim the next reached tier of an award. Returns the cash paid and the tier, or null. */
export function claimAward(state: GameState, id: AwardId): { cash: number; tier: number } | null {
  if (!(id in ECON.achievements.list) || !canClaimAward(state, id)) return null;
  const tier = state.achievements.claimed[id];
  const cash = awardReward(state, tier);
  state.achievements.claimed[id] = tier + 1;
  state.cash += cash;
  state.lifetimeEarnings += cash;
  return { cash, tier };
}

/** Medals earned (claimed) out of all. */
export function medalCount(state: GameState): { have: number; of: number } {
  return { have: AWARD_IDS.reduce((a, id) => a + state.achievements.claimed[id], 0), of: AWARD_IDS.length * MEDAL_COUNT };
}

/** Save repair: whole numbers, `last` never above the counter it follows, claims within the four tiers. */
export function sanitizeAchievements(state: GameState): void {
  const a = state.achievements;
  const int = (x: number) => (Number.isFinite(x) ? Math.max(0, Math.floor(x)) : 0);
  for (const id of TRACKED) {
    const t = a.tracked[id];
    t.total = int(t.total);
    t.last = int(t.last);
    const cur = trackedCounter(state, id);
    // A counter below `last` only happens after a reset: start following it again from where it is.
    if (t.last > cur) t.last = cur;
  }
  for (const id of AWARD_IDS) a.claimed[id] = Math.min(MEDAL_COUNT, int(a.claimed[id]));
}
