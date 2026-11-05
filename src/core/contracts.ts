// Contracts board: three timed orders ("Sell 3 Pickups") with cash and parts rewards.
// Pure rules, no DOM. Progress hooks are called from sim.ts.

import type { CarFamily } from './config';
import { ECON } from './config';
import { expectedCarValue, roundNice } from './formulas';
import { nextRandom, pick, weighted } from './rng';
import type { Car, Contract, ContractKind, GameState } from './state';

export type ContractEvent =
  | { type: 'contractDone'; contract: Contract }
  | { type: 'contractExpired'; contract: Contract }
  | { type: 'contractNew'; contract: Contract };

/** Anything events can be pushed into (the sim's wider GameEvent[] works too). */
export interface EventSink {
  push(e: ContractEvent): void;
}

export function contractsUnlocked(state: GameState): boolean {
  return state.contracts.length > 0 || state.carsSold >= ECON.contracts.unlockCarsSold;
}

const KIND_WEIGHTS: Record<ContractKind, number> = { sellAny: 3, sellFamily: 3, sellRare: 2, crush: 2 };


function rollInt(state: GameState, [min, max]: readonly [number, number]): number {
  return min + Math.floor(nextRandom(state) * (max - min + 1));
}

/** Fill `slot` with a fresh order. Avoids repeating an order already on the board. */
export function generateContract(state: GameState, slot: Contract): void {
  const others = state.contracts.filter((c) => c !== slot && c.status !== 'empty');
  let kind: ContractKind;
  let family: CarFamily | null;
  const taken = (k: ContractKind, f: CarFamily | null) => others.some((o) => o.kind === k && o.family === f);
  kind = weighted(state, KIND_WEIGHTS);
  family = kind === 'sellFamily' ? pick(state, Object.keys(ECON.families) as CarFamily[]) : null;
  if (taken(kind, family)) {
    // Pick randomly among the orders not on the board yet (there are always some: 7 orders, 3 slots).
    const free: [ContractKind, CarFamily | null][] = [];
    for (const k of Object.keys(KIND_WEIGHTS) as ContractKind[]) {
      const fams: (CarFamily | null)[] = k === 'sellFamily' ? (Object.keys(ECON.families) as CarFamily[]) : [null];
      for (const f of fams) if (!taken(k, f)) free.push([k, f]);
    }
    if (free.length) [kind, family] = pick(state, free);
  }
  const target = rollInt(state, ECON.contracts.targets[kind]);
  const cash = expectedCarValue(state.levels.quality) * target * ECON.contracts.rewardMult[kind];
  slot.id = state.nextContractId++;
  slot.status = 'active';
  slot.kind = kind;
  slot.family = family;
  slot.target = target;
  slot.progress = 0;
  slot.timeLeft = ECON.contracts.duration;
  slot.rewardCash = roundNice(cash);
  slot.rewardParts = kind === 'crush' ? ECON.contracts.crushPartsPerTarget * target : 0;
}

function emptySlot(): Contract {
  return {
    id: 0,
    status: 'empty',
    kind: 'sellAny',
    family: null,
    target: 1,
    progress: 0,
    timeLeft: 0,
    rewardCash: 0,
    rewardParts: 0,
  };
}

/** Advance timers; fill the board once unlocked. */
export function tickContracts(state: GameState, dt: number, events: EventSink): void {
  if (!contractsUnlocked(state)) return;
  while (state.contracts.length < ECON.contracts.board) state.contracts.push(emptySlot());
  for (const c of state.contracts) {
    if (c.status === 'done') continue;
    c.timeLeft -= dt;
    if (c.timeLeft > 0) continue;
    if (c.status === 'active') {
      events.push({ type: 'contractExpired', contract: { ...c } });
      c.status = 'empty';
      c.timeLeft = ECON.contracts.refresh;
    } else {
      generateContract(state, c);
      events.push({ type: 'contractNew', contract: { ...c } });
    }
  }
}

function advance(state: GameState, matches: (c: Contract) => boolean, events: EventSink): void {
  for (const c of state.contracts) {
    if (c.status !== 'active' || !matches(c)) continue;
    c.progress = Math.min(c.target, c.progress + 1);
    if (c.progress >= c.target) {
      c.status = 'done';
      events.push({ type: 'contractDone', contract: { ...c } });
    }
  }
}

export function onCarSold(state: GameState, car: Car, events: EventSink): void {
  advance(
    state,
    (c) =>
      c.kind === 'sellAny' ||
      (c.kind === 'sellFamily' && c.family === car.family) ||
      (c.kind === 'sellRare' && car.rarity !== 'common'),
    events,
  );
}

export function onCarCrushed(state: GameState, events: EventSink): void {
  advance(state, (c) => c.kind === 'crush', events);
}

/** Collect a finished order. Returns the cash paid (0 if nothing to claim). */
export function claimContract(state: GameState, id: number): { cash: number; parts: number } {
  const c = state.contracts.find((x) => x.id === id && x.status === 'done');
  if (!c) return { cash: 0, parts: 0 };
  const reward = { cash: c.rewardCash, parts: c.rewardParts };
  state.cash += reward.cash;
  state.lifetimeEarnings += reward.cash;
  state.parts += reward.parts;
  state.stats.contractsDone += 1;
  c.status = 'empty';
  c.timeLeft = ECON.contracts.refresh;
  return reward;
}

/** Short player-facing description, e.g. "Sell 3 Pickups". */
export function contractLabel(c: Contract): string {
  const n = c.target;
  switch (c.kind) {
    case 'sellAny':
      return `Sell ${n} cars`;
    case 'sellFamily': {
      const name = ECON.families[c.family ?? 'sedan'].name;
      return `Sell ${n} ${name}${n > 1 ? 's' : ''}`;
    }
    case 'sellRare':
      return n > 1 ? `Sell ${n} Rare+ cars` : 'Sell a Rare+ car';
    case 'crush':
      return `Crush ${n} wrecks`;
  }
}
