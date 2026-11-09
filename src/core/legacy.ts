// Prestige "Sell Empire" (P1.3a): sell every business for Legacy Points and start again in a fresh scrapyard. Points
// come from the square root of everything ever earned (all sold empires plus this run), so each restart rewards more
// play with diminishing returns. Each point adds 2% to all income, forever. Pure rules; the UI is P1.3b.

import { trackAchievements } from './achievements';
import { ECON, type CityId } from './config';
import { newGame, type GameState, type Legacy } from './state';
import { hasNode, sanitizeTree } from './legacyTree';
import { cityPrice, cityScale, citiesForNextEmpire, defaultNextCity, sanitizeCity } from './cities';

export { newLegacy, type Legacy } from './state';

/** Total Legacy Points that `allTimeEarnings` is worth: floor((earnings / scale) ^ exponent). */
export function legacyPointsFor(allTimeEarnings: number): number {
  if (!(allTimeEarnings > 0)) return 0;
  return Math.floor(Math.pow(allTimeEarnings / ECON.legacy.pointScale, ECON.legacy.pointExponent) + 1e-9);
}

/** All-time earnings at which the total reaches `points` (the inverse of `legacyPointsFor`). */
export function earningsForTotalPoints(points: number): number {
  if (!(points > 0)) return 0;
  return Math.pow(points, 1 / ECON.legacy.pointExponent) * ECON.legacy.pointScale;
}

/** Everything earned, sold empires included. */
export function allTimeEarnings(state: GameState): number {
  return state.legacy.allTime + state.lifetimeEarnings + Math.max(0, state.pendingOffline);
}

/** Points selling the empire now would add. */
export function pendingLegacyPoints(state: GameState): number {
  return Math.max(0, legacyPointsFor(allTimeEarnings(state)) - state.legacy.points);
}

/** Lifetime earnings this run needs for the next sale to reach `points` new points. */
export function earningsForPoints(state: GameState, points: number): number {
  const total = state.legacy.points + Math.max(1, points);
  return Math.max(0, earningsForTotalPoints(total) - state.legacy.allTime);
}

/** The Sell Empire button shows once a sale would give at least `minPoints`. */
export function canSellEmpire(state: GameState): boolean {
  return pendingLegacyPoints(state) >= ECON.legacy.minPoints;
}

/** It glows when the new points would be at least half of the points already owned. */
export function sellEmpireGlows(state: GameState): boolean {
  const p = pendingLegacyPoints(state);
  return p >= ECON.legacy.minPoints && p >= state.legacy.points * ECON.legacy.glowFrac;
}

/** Income multiplier from Legacy Points: 1 + 2% per point. Every business's payouts and idle income use it. */
export function legacyMultiplier(state: Pick<GameState, 'legacy'>): number {
  return 1 + ECON.legacy.incomePerPoint * Math.max(0, state.legacy.points);
}

/**
 * Multiplier on every value the rules create (car prices, fees, rewards, idle income): Legacy Points times the city's
 * scale. Prices are scaled by the city too (`cityPrice`), so only the Legacy part makes a run faster.
 */
export function incomeMultiplier(state: Pick<GameState, 'legacy' | 'collection'>): number {
  return legacyMultiplier(state) * showcaseMultiplier(state) * cityScale(state);
}

/** Showcase (P1.4c): every barn classic kept instead of sold adds a little to every payout, for good. */
export function showcaseMultiplier(state: Pick<GameState, 'collection'>): number {
  return 1 + ECON.collection.showcaseBonus * state.collection.showcase.length;
}

/** The multiplier the next empire will have. */
export function nextLegacyMultiplier(state: GameState): number {
  return legacyMultiplier({ legacy: { ...state.legacy, points: state.legacy.points + pendingLegacyPoints(state) } });
}

export interface SoldEmpire {
  points: number;
  earned: number;
  seconds: number;
  /** City the new empire is built in. */
  city: CityId;
}

/**
 * Sell the empire: bank its points and start a fresh scrapyard (cash, upgrades, crew, cars, every business and the
 * barn reset). Kept: Legacy Points, settings, tutorial flags, the collection book, lifetime stats, dailies, achievements, the clock and the
 * RNG stream. Offline cash waiting to be collected is paid in first, so it counts. Mutates `state` in place.
 * `city` picks where the new empire is built (default: the biggest city open on this sale).
 * Returns null (and changes nothing) when the sale isn't allowed yet or the city isn't open on this sale.
 */
export function sellEmpire(state: GameState, now: number, city: CityId = defaultNextCity(state)): SoldEmpire | null {
  if (!canSellEmpire(state)) return null;
  if (!citiesForNextEmpire(state).includes(city)) return null;
  state.lifetimeEarnings += Math.max(0, state.pendingOffline);
  state.pendingOffline = 0;
  // Count what the businesses did since the last tick before their counters reset.
  trackAchievements(state);
  const points = pendingLegacyPoints(state);
  const earned = state.lifetimeEarnings;
  const seconds = state.legacy.runSeconds;
  const fresh = newGame(Math.max(now, state.lastSeen), state.rng);
  fresh.createdAt = state.createdAt;
  fresh.lastSeen = Math.max(state.lastSeen, now);
  fresh.settings = { ...state.settings };
  fresh.tutorial = { ...state.tutorial };
  fresh.collection = {
    sold: { ...state.collection.sold },
    models: Object.fromEntries(Object.entries(state.collection.models).map(([m, e]) => [m, { ...e }])),
    showcase: [...state.collection.showcase],
  };
  fresh.stats = { ...state.stats };
  fresh.daily = { ...state.daily, tasks: state.daily.tasks.map((t) => ({ ...t })) };
  fresh.achievements = {
    tracked: Object.fromEntries(Object.entries(state.achievements.tracked).map(([k, t]) => [k, { total: t.total, last: 0 }])) as GameState['achievements']['tracked'],
    claimed: { ...state.achievements.claimed },
  };
  fresh.story = { ...state.story, seen: [...state.story.seen] };
  fresh.legacy = {
    points: state.legacy.points + points,
    allTime: state.legacy.allTime + earned,
    sold: state.legacy.sold + 1,
    lastRunSeconds: seconds,
    bestRunSeconds: state.legacy.bestRunSeconds > 0 ? Math.min(state.legacy.bestRunSeconds, seconds) : seconds,
    runSeconds: 0,
    tree: { ...state.legacy.tree },
    respecUsed: false,
    city,
  };
  // Head Start (legacy tree): the new empire starts with some cash and the Mechanic hired.
  if (hasNode(fresh, 'headStart')) {
    fresh.cash += cityPrice(fresh, ECON.legacy.tree.headStartCash);
    fresh.managers.mechanic = true;
  }
  for (const k of Object.keys(state) as (keyof GameState)[]) delete state[k];
  Object.assign(state, fresh);
  return { points, earned, seconds, city };
}

/** Save repair: whole, non-negative numbers, and never more points than the sold empires are worth. */
export function sanitizeLegacy(l: Legacy): void {
  const num = (x: number) => (Number.isFinite(x) && x > 0 ? x : 0);
  l.allTime = num(l.allTime);
  l.points = Math.min(Math.floor(num(l.points)), legacyPointsFor(l.allTime));
  l.sold = Math.floor(num(l.sold));
  l.lastRunSeconds = num(l.lastRunSeconds);
  l.bestRunSeconds = num(l.bestRunSeconds);
  l.runSeconds = num(l.runSeconds);
  sanitizeTree(l);
  sanitizeCity(l);
}
