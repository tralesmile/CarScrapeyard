// Cities (P1.3d). Each empire is built in one city, picked when the previous empire is sold. Every city runs the same
// four businesses; a city's `scale` multiplies every value and every price, so a run plays at the pace the sim tunes
// while earnings (and so Legacy Points) grow with the city. Imports only config and state types (no cycles).

import { ECON, type CityId } from './config';
import type { GameState } from './state';

export const CITY_IDS = Object.keys(ECON.cities.list) as CityId[];

export function cityInfo(id: CityId) {
  return ECON.cities.list[id];
}

/** The city this empire is in. */
export function currentCity(state: Pick<GameState, 'legacy'>): CityId {
  return state.legacy.city;
}

/** Value and price multiplier of the current city (1 in Rust Valley). */
export function cityScale(state: Pick<GameState, 'legacy'>): number {
  return cityInfo(state.legacy.city).scale;
}

/** A price from the config, scaled to the current city (rounded to whole dollars). */
export function cityPrice(state: Pick<GameState, 'legacy'>, base: number): number {
  return Math.round(base * cityScale(state));
}

/** Cities that can be picked for the next empire on this sale (the sale being made is `sold + 1`). */
export function citiesForNextEmpire(state: Pick<GameState, 'legacy'>): CityId[] {
  return CITY_IDS.filter((id) => cityInfo(id).fromSale <= state.legacy.sold + 1);
}

/** The city a sale picks when the player doesn't choose: the biggest one open to them. */
export function defaultNextCity(state: Pick<GameState, 'legacy'>): CityId {
  const open = citiesForNextEmpire(state);
  return open.reduce((best, id) => (cityInfo(id).scale > cityInfo(best).scale ? id : best), open[0] ?? 'rustValley');
}

/** The first city that opens on a later sale, and on which sale (for "Motor City opens on your 2nd sale"). */
export function nextCityToUnlock(state: Pick<GameState, 'legacy'>): { id: CityId; sale: number } | null {
  const id = CITY_IDS.find((c) => cityInfo(c).fromSale > state.legacy.sold + 1);
  return id ? { id, sale: cityInfo(id).fromSale } : null;
}

/** Save repair: an unknown city, or one the sales so far can't have reached, falls back to Rust Valley. */
export function sanitizeCity(legacy: GameState['legacy']): void {
  const id = legacy.city;
  if (!CITY_IDS.includes(id) || cityInfo(id).fromSale > legacy.sold) legacy.city = 'rustValley';
}
