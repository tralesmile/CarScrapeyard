// Customer personalities: one buyer waits in the yard and pays a bonus for the car they want.
// Pure rules, ticked from sim.ts.

import type { BuyerKind, Rarity } from './config';
import { ECON } from './config';
import { pick } from './rng';
import type { Car, GameState } from './state';
import { buyerRatePerk } from './legacyTree';
import { noteBuyerLost } from './story';

const RARITY_ORDER: Rarity[] = ['common', 'rare', 'epic', 'legendary'];

export type BuyerEvent = { type: 'buyerArrived'; kind: BuyerKind } | { type: 'buyerLeft'; kind: BuyerKind; rival: boolean };

export interface BuyerSink {
  push(e: BuyerEvent): void;
}

export function buyersUnlocked(state: GameState): boolean {
  return state.stats.buyersServed > 0 || state.carsSold >= ECON.buyers.unlockCarsSold;
}

export function buyerMatches(kind: BuyerKind, car: Car): boolean {
  const b = ECON.buyers.kinds[kind];
  if (b.families && !(b.families as readonly string[]).includes(car.family)) return false;
  if (b.minRarity && RARITY_ORDER.indexOf(car.rarity) < RARITY_ORDER.indexOf(b.minRarity)) return false;
  return true;
}

/** Bonus multiplier the current buyer pays for this car (1 if no match). */
export function buyerMultiplier(state: GameState, car: Car): number {
  if (!state.buyer || !buyerMatches(state.buyer.kind, car)) return 1;
  return 1 + ECON.buyers.kinds[state.buyer.kind].bonus;
}

/** Buyer personalities that can show up after this many sales. */
export function unlockedBuyerKinds(carsSold: number): BuyerKind[] {
  return (Object.keys(ECON.buyers.kinds) as BuyerKind[]).filter((k) => carsSold >= ECON.buyers.kinds[k].unlockCarsSold);
}

function newBuyer(state: GameState): void {
  state.buyer = { kind: pick(state, unlockedBuyerKinds(state.carsSold)), timeLeft: ECON.buyers.patience };
}

export function tickBuyers(state: GameState, dt: number, events: BuyerSink): void {
  if (!buyersUnlocked(state)) return;
  if (state.buyer) {
    state.buyer.timeLeft -= dt;
    if (state.buyer.timeLeft <= 0) {
      events.push({ type: 'buyerLeft', kind: state.buyer.kind, rival: noteBuyerLost(state) });
      state.buyer = null;
      state.buyerTimer = ECON.buyers.gap / buyerRatePerk(state);
    }
    return;
  }
  state.buyerTimer -= dt;
  if (state.buyerTimer <= 0) {
    newBuyer(state);
    events.push({ type: 'buyerArrived', kind: state.buyer!.kind });
  }
}

/** Called on every sale. Returns the bonus multiplier paid (1 if the buyer didn't want this car). */
export function serveBuyer(state: GameState, car: Car): number {
  const mult = buyerMultiplier(state, car);
  if (mult > 1 && state.buyer) {
    state.stats.buyersServed += 1;
    state.buyer = null;
    state.buyerTimer = ECON.buyers.gap / buyerRatePerk(state);
  }
  return mult;
}
