// City map and businesses (P1.1). Pure rules: which businesses are unlocked, opening one, switching between them.
// The scrapyard is always open and keeps running in the background while another business is on screen.

import type { BusinessId } from './config';
import { ECON } from './config';
import type { GameState } from './state';
import { franchisePerk } from './legacyTree';
import { cityPrice, cityScale } from './cities';

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

/** Lifetime earnings this empire needs before the business can be bought (scaled to the city). */
export function unlockGoal(state: Pick<GameState, 'legacy'>, id: BusinessId): number {
  return cityPrice(state, businessInfo(id).unlockLifetime);
}

export function businessStatus(state: GameState, id: BusinessId): BusinessStatus {
  if (state.businesses.opened[id]) return 'open';
  const info = businessInfo(id);
  if (state.lifetimeEarnings < unlockGoal(state, id)) return 'locked';
  return info.ready ? 'forSale' : 'soon';
}

/** 0..1 progress towards the unlock goal (1 once unlocked or open). */
export function unlockProgress(state: GameState, id: BusinessId): number {
  const goal = unlockGoal(state, id);
  if (goal <= 0 || state.businesses.opened[id]) return 1;
  return Math.min(1, state.lifetimeEarnings / goal);
}

/** The next business the player is working towards (first one not open), or null when all are open. */
export function nextBusiness(state: GameState): BusinessId | null {
  return BUSINESS_IDS.find((id) => !state.businesses.opened[id]) ?? null;
}

/** Cash it costs to open this business now (scaled to the city; Franchise makes it cheaper). */
export function openCost(state: Pick<GameState, 'legacy'>, id: BusinessId): number {
  return Math.round(businessInfo(id).openCost * cityScale(state) * franchisePerk(state));
}

export function canOpenBusiness(state: GameState, id: BusinessId): boolean {
  return businessStatus(state, id) === 'forSale' && state.cash >= openCost(state, id);
}

/** Buy a business. It does not switch to it; the map does that after the opening celebration. */
export function openBusiness(state: GameState, id: BusinessId): boolean {
  if (!canOpenBusiness(state, id)) return false;
  state.cash -= openCost(state, id);
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

/** Highest map tier (P1.1d). */
export const MAX_TIER = 3;

/** What a business's size is measured in for its map tier, and how big it is now. */
function tierSize(state: GameState, id: BusinessId): number {
  if (id === 'scrapyard') return state.slots;
  if (id === 'garage') return state.garage.bays;
  if (id === 'carlot') return state.carlot.spots;
  if (id === 'paint') return state.paint.booths;
  return 0;
}

/** The business's map tier 1..3, or 0 when it is not open. Grows with lot slots (yard) or repair bays (garage). */
export function businessTier(state: GameState, id: BusinessId): number {
  if (!state.businesses.opened[id]) return 0;
  const at = (ECON.businesses.tiers as Partial<Record<BusinessId, readonly [number, number]>>)[id];
  if (!at) return 1;
  const size = tierSize(state, id);
  return 1 + at.filter((n) => size >= n).length;
}

/** What the next tier needs, e.g. "3 lot slots", or null at the top tier (or for a business without tiers). */
export function nextTierGoal(state: GameState, id: BusinessId): string | null {
  const tier = businessTier(state, id);
  const at = (ECON.businesses.tiers as Partial<Record<BusinessId, readonly [number, number]>>)[id];
  if (!at || tier < 1 || tier >= MAX_TIER) return null;
  const n = at[tier - 1]!;
  if (id === 'scrapyard') return `${n} lot slots`;
  if (id === 'garage') return `${n} repair bays`;
  return id === 'carlot' ? `${n} forecourt spots` : `${n} paint booths`;
}
