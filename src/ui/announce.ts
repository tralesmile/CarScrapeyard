// Which announcements belong to the business on screen (found in run 13): a "LEGENDARY!" banner about a car rolling
// into the yard, or the buyer's bell, makes no sense while the player is in the Repair Garage. The car and the buyer
// are still there when the player goes back.

import type { BusinessId } from '../core/config';
import type { GameEvent } from '../core/sim';

const YARD_ONLY: ReadonlySet<GameEvent['type']> = new Set<GameEvent['type']>(['legendary', 'buyerArrived']);

/** True when the event's banner or sound should play with `active` on screen. */
export function announceHere(type: GameEvent['type'], active: BusinessId): boolean {
  return active === 'scrapyard' || !YARD_ONLY.has(type);
}
