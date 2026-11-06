// City map and businesses (P1.1). Pure rules: which businesses are unlocked, opening one, switching between them.
// The scrapyard is always open and keeps running in the background while another business is on screen.

import type { BusinessId } from './config';
import { ECON } from './config';
import type { GameState } from './state';

export const BUSINESS_IDS = Object.keys(ECON.businesses.list) as BusinessId[];

export type BusinessStatus =
  /** Lifetime earnings are still short of the unlock goal. */
  | 'locked'
  /** Unlocked, but its loop is not in the game yet. */
  | 'soon'
  /** Unlocked and can be bought. */
  | 'forSale'
  | 'open';

export function businessInfo(id: BusinessId) {
  return ECON.businesses.list[id];
}

export function mapUnlocked(state: GameState): boolean {
  return state.carsSold >= ECON.businesses.mapUnlockCarsSold || BUSINESS_IDS.some((id) => id !== 'scrapyard' && state.businesses.opened[id]);
}

export function businessStatus(state: GameState, id: BusinessId): BusinessStatus {
  if (state.businesses.opened[id]) return 'open';
  const info = businessInfo(id);
  if (state.lifetimeEarnings < info.unlockLifetime) return 'locked';
  return info.ready ? 'forSale' : 'soon';
}

/** 0..1 progress towards the unlock goal (1 once unlocked or open). */
export function unlockProgress(state: GameState, id: BusinessId): number {
  const goal = businessInfo(id).unlockLifetime;
  if (goal <= 0 || state.businesses.opened[id]) return 1;
  return Math.min(1, state.lifetimeEarnings / goal);
}

/** The next business the player is working towards (first one not open), or null when all are open. */
export function nextBusiness(state: GameState): BusinessId | null {
  return BUSINESS_IDS.find((id) => !state.businesses.opened[id]) ?? null;
}

export function canOpenBusiness(state: GameState, id: BusinessId): boolean {
  return businessStatus(state, id) === 'forSale' && state.cash >= businessInfo(id).openCost;
}

/** Buy a business. It does not switch to it; the map does that after the opening celebration. */
export function openBusiness(state: GameState, id: BusinessId): boolean {
  if (!canOpenBusiness(state, id)) return false;
  state.cash -= businessInfo(id).openCost;
  state.businesses.opened[id] = true;
  return true;
}

/** Put an open business on screen. Returns false for one that is not open. */
export function switchBusiness(state: GameState, id: BusinessId): boolean {
  if (!state.businesses.opened[id]) return false;
  state.businesses.active = id;
  return true;
}

/** Repair an impossible businesses block from a save (unknown active id, scrapyard closed). */
export function sanitizeBusinesses(b: GameState['businesses']): void {
  b.opened.scrapyard = true;
  for (const id of BUSINESS_IDS) b.opened[id] = b.opened[id] === true;
  if (!BUSINESS_IDS.includes(b.active) || !b.opened[b.active]) b.active = 'scrapyard';
}
