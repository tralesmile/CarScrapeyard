/**
 * Income boost (P2.2b): an optional rewarded ad makes every payout from a sale, a repair or a paint job count double
 * for a while. It runs on game time (`tickBoost` inside the fixed step), never on the wall clock, and only while playing.
 * Bots never watch ads, so the pacing targets in docs/economy.md are unchanged.
 */
import { ECON } from './config';
import type { GameState } from './state';

export interface Boost {
  /** Seconds of x2 left. */
  remaining: number;
  /** Seconds until the next ad may be offered (counts down after a boost ends, or at once after it starts). */
  cooldown: number;
  /** Boosts started over the whole game (stat). */
  started: number;
}

export function newBoost(): Boost {
  return { remaining: 0, cooldown: 0, started: 0 };
}

export function boostActive(state: Pick<GameState, 'boost'>): boolean {
  return state.boost.remaining > 0;
}

/** Multiplier on every sale payout right now (1 when no boost runs). */
export function boostMultiplier(state: Pick<GameState, 'boost'>): number {
  return boostActive(state) ? ECON.ads.boost.multiplier : 1;
}

/** Can the player start a boost (the platform decides if an ad is ready)? */
export function canStartBoost(state: GameState): boolean {
  return state.boost.remaining <= 0 && state.boost.cooldown <= 0 && state.carsSold >= ECON.ads.boost.unlockCarsSold;
}

/** Start (or extend, never stack) the boost after the ad's reward. Returns false when it is not allowed now. */
export function startBoost(state: GameState): boolean {
  if (!canStartBoost(state)) return false;
  state.boost.remaining = ECON.ads.boost.seconds;
  state.boost.cooldown = ECON.ads.boost.seconds + ECON.ads.boost.cooldownSeconds;
  state.boost.started += 1;
  return true;
}

export function tickBoost(state: GameState, dt: number): void {
  const b = state.boost;
  if (b.remaining > 0) b.remaining = Math.max(0, b.remaining - dt);
  if (b.cooldown > 0) b.cooldown = Math.max(0, b.cooldown - dt);
}

/** Boost a payout. Whole dollars, never less than the base amount. */
export function boosted(state: Pick<GameState, 'boost'>, amount: number): number {
  const m = boostMultiplier(state);
  return m === 1 ? amount : Math.round(amount * m);
}

/** Save repair: finite, within the configured lengths. */
export function sanitizeBoost(state: GameState): void {
  const raw = (state as { boost?: Partial<Boost> }).boost ?? {};
  const b = ECON.ads.boost;
  const num = (v: unknown, max: number): number => (typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(0, v)) : 0);
  state.boost = {
    remaining: num(raw.remaining, b.seconds),
    cooldown: num(raw.cooldown, b.seconds + b.cooldownSeconds),
    started: Math.floor(num(raw.started, 1e9)),
  };
}
