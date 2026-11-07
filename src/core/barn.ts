// Barn find: a covered classic waits at the back of the yard. The player pays cash (and parts)
// to run each restoration stage on a timer, then reveals a Legendary classic and sells it.
// Pure rules, ticked from sim.ts. Timers also run while the player is away (see advanceBarn).

import { CLASSIC_NAMES, ECON, PAINTS } from './config';
import { expectedCarValue, roundNice, unlockedFamilies } from './formulas';
import { pick } from './rng';
import type { GameState } from './state';
import { legacyMultiplier } from './legacy';

export type BarnEvent =
  | { type: 'barnFound' }
  | { type: 'barnStageDone'; stage: number }
  | { type: 'barnFinished' }
  | { type: 'barnSold'; amount: number };

export interface BarnSink {
  push(e: BarnEvent): void;
}

export function barnUnlocked(state: GameState): boolean {
  return state.barn.status !== 'locked' || state.carsSold >= ECON.barn.unlockCarsSold;
}

/** Cost and value grow a little with every restoration sold. */
function growth(state: GameState): number {
  return 1 + ECON.barn.growthPerRestore * state.barn.restored;
}

/** The next stage to start, or null when none is waiting. */
export function nextBarnStage(state: GameState) {
  if (state.barn.status !== 'covered') return null;
  return ECON.barn.stages[state.barn.stage] ?? null;
}

/** Cash and parts the next stage costs right now (0/0 when there is no stage to start). */
export function barnStageCost(state: GameState): { cash: number; parts: number } {
  const st = nextBarnStage(state);
  if (!st) return { cash: 0, parts: 0 };
  return { cash: roundNice(expectedCarValue(state.levels.quality, state.carsSold) * st.cashMult * growth(state)), parts: st.parts };
}

/** What the restored car will sell for (shown on the card as a teaser, fixed at the reveal). */
export function barnValue(state: GameState): number {
  if (state.barn.status === 'revealed') return state.barn.value;
  return roundNice(expectedCarValue(state.levels.quality, state.carsSold) * legacyMultiplier(state) * ECON.barn.saleMult * growth(state));
}

/** While the next stage needs parts the player doesn't have yet, spare parts are kept for it. */
export function barnReservesParts(state: GameState): boolean {
  const st = nextBarnStage(state);
  return !!st && st.parts > 0;
}

function newFind(state: GameState, events: BarnSink): void {
  const family = pick(state, unlockedFamilies(state.carsSold));
  const b = state.barn;
  b.status = 'covered';
  b.stage = 0;
  b.timeLeft = 0;
  b.family = family;
  b.model = pick(state, CLASSIC_NAMES[family]);
  b.paint = pick(state, PAINTS);
  b.value = 0;
  events.push({ type: 'barnFound' });
}

/** Advance barn timers by `dt` seconds. Also used for time away (no RNG unless a new find arrives). */
export function tickBarn(state: GameState, dt: number, events: BarnSink): void {
  const b = state.barn;
  if (b.status === 'locked') {
    if (barnUnlocked(state)) newFind(state, events);
    return;
  }
  if (b.status === 'working') {
    b.timeLeft -= dt;
    if (b.timeLeft > 0) return;
    b.timeLeft = 0;
    b.stage += 1;
    events.push({ type: 'barnStageDone', stage: b.stage });
    if (b.stage >= ECON.barn.stages.length) {
      b.status = 'finished';
      events.push({ type: 'barnFinished' });
    } else b.status = 'covered';
    return;
  }
  if (b.status === 'away') {
    b.timeLeft -= dt;
    if (b.timeLeft <= 0) newFind(state, events);
  }
}

/** Something to do at the barn: reveal, sell, or start a stage the player can afford. */
export function barnHasAction(state: GameState): boolean {
  const b = state.barn;
  if (b.status === 'finished' || b.status === 'revealed') return true;
  if (b.status !== 'covered') return false;
  const cost = barnStageCost(state);
  return state.cash >= cost.cash && state.parts >= cost.parts;
}

/** Pay for and start the next restoration stage. */
export function startBarnStage(state: GameState): boolean {
  const st = nextBarnStage(state);
  if (!st) return false;
  const cost = barnStageCost(state);
  if (state.cash < cost.cash || state.parts < cost.parts) return false;
  state.cash -= cost.cash;
  state.parts -= cost.parts;
  state.barn.status = 'working';
  state.barn.timeLeft = st.seconds;
  return true;
}

/** Pull off the tarp: the sale price is fixed now. */
export function revealBarn(state: GameState): boolean {
  if (state.barn.status !== 'finished') return false;
  state.barn.value = barnValue(state);
  state.barn.status = 'revealed';
  return true;
}

/** Sell the restored classic to a collector. Returns the cash paid (0 if nothing to sell). */
export function sellBarnCar(state: GameState): number {
  const b = state.barn;
  if (b.status !== 'revealed') return 0;
  const amount = b.value;
  state.cash += amount;
  state.lifetimeEarnings += amount;
  b.restored += 1;
  b.status = 'away';
  b.stage = 0;
  b.value = 0;
  b.timeLeft = ECON.barn.nextFindSeconds;
  return amount;
}
