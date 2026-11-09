// Daily tasks and the 7-day login calendar (P1.5a). Pure rules.
//
// A game day starts at a fixed UTC hour (`ECON.daily.resetHourUtc`), so changing time zone or daylight saving never
// gives a double or a missed day. `refreshDaily` is called with the platform clock (never earlier than `lastSeen`, so
// winding the clock back changes nothing); on a new day it rolls three tasks and opens the next calendar reward.
// Tasks follow counters that already exist (cars sold, crushes, jobs done...): `trackDaily` adds what each counter
// grew by since the last look, so a Sell Empire reset (counters back to 0) never takes progress away.
// Task picks hash the day number instead of using the game RNG, so the yard's random stream is unchanged.

import { ECON } from './config';
import { expectedCarValue, roundNice } from './formulas';
import { incomeMultiplier } from './legacy';
import type { GameState } from './state';
import { addGems, addTokens } from './wallet';

export type DailyKind = keyof typeof ECON.daily.tasks;
export const DAILY_KINDS = Object.keys(ECON.daily.tasks) as DailyKind[];

export interface DailyTask {
  kind: DailyKind;
  target: number;
  progress: number;
  /** Counter value at the last look (see `trackDaily`). */
  last: number;
  claimed: boolean;
}

export interface Daily {
  /** Game day the tasks belong to (-1 before the first roll). */
  day: number;
  tasks: DailyTask[];
  /** The all-done bonus of `day` was paid. */
  bonusClaimed: boolean;
  /** Calendar rewards claimed in total; the next one is `claims % 7`. */
  claims: number;
  /** Game day of the last calendar claim (-1 = never). */
  claimedDay: number;
  /** Gift cars from the calendar waiting for a free yard slot. */
  giftCars: number;
}

export function newDaily(): Daily {
  return { day: -1, tasks: [], bonusClaimed: false, claims: 0, claimedDay: -1, giftCars: 0 };
}

const DAY_MS = 86_400_000;

/** Game day number for a timestamp: days since 1970 counted from the reset hour (UTC). */
export function gameDay(ms: number): number {
  return Math.floor((ms - ECON.daily.resetHourUtc * 3_600_000) / DAY_MS);
}

/** Milliseconds until the next daily reset. */
export function msToReset(ms: number): number {
  const start = (gameDay(ms) + 1) * DAY_MS + ECON.daily.resetHourUtc * 3_600_000;
  return Math.max(0, start - ms);
}

export function dailyUnlocked(state: Pick<GameState, 'carsSold' | 'legacy' | 'daily'>): boolean {
  return state.carsSold >= ECON.daily.unlockCarsSold || state.legacy.sold > 0 || state.daily.claims > 0;
}

/** The counter a task kind follows. */
export function dailyCounter(state: GameState, kind: DailyKind): number {
  switch (kind) {
    case 'sell':
      return state.carsSold;
    case 'haggle':
      return state.stats.haggles;
    case 'buyer':
      return state.stats.buyersServed;
    case 'crush':
      return state.stats.carsCrushed;
    case 'contract':
      return state.stats.contractsDone;
    case 'garage':
      return state.garage.jobsDone;
    case 'lot':
      return state.carlot.sold;
    case 'paint':
      return state.paint.jobsDone;
  }
}

/** Task kinds that can be rolled now: their feature is open. */
export function availableKinds(state: GameState): DailyKind[] {
  const on: Record<DailyKind, boolean> = {
    sell: true,
    haggle: !state.settings.skipHaggle,
    buyer: state.carsSold >= ECON.buyers.unlockCarsSold,
    crush: state.stats.carsCrushed > 0 || state.carsSold >= ECON.crusher.unlockCarsSold,
    contract: state.carsSold >= ECON.contracts.unlockCarsSold,
    garage: state.businesses.opened.garage,
    lot: state.businesses.opened.carlot,
    paint: state.businesses.opened.paint,
  };
  return DAILY_KINDS.filter((k) => on[k]);
}

/** A small integer hash (deterministic per day). */
function hash(n: number): number {
  let h = (n ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

/** The day's task kinds: a hashed pick from what is open, listed in a fixed order. */
export function rollKinds(available: readonly DailyKind[], day: number): DailyKind[] {
  const n = Math.min(ECON.daily.tasksPerDay, available.length);
  const pool = [...available];
  const out: DailyKind[] = [];
  let h = hash(day);
  while (out.length < n && pool.length) {
    const i = h % pool.length;
    out.push(pool.splice(i, 1)[0]!);
    h = hash(h + out.length);
  }
  return out.sort((a, b) => DAILY_KINDS.indexOf(a) - DAILY_KINDS.indexOf(b));
}

/** Cash worth `cars` average yard cars right now. */
export function carsWorth(state: GameState, cars: number): number {
  if (cars <= 0) return 0;
  return roundNice(expectedCarValue(state.levels.quality, state.carsSold) * cars * incomeMultiplier(state));
}

export interface DailyReward {
  cash: number;
  parts: number;
  gift: boolean;
  /** Wallet extras (P1.7a). */
  gems: number;
  tokens: number;
}

export function taskReward(state: GameState, task: DailyTask): DailyReward {
  const t = ECON.daily.tasks[task.kind];
  return { cash: carsWorth(state, t.rewardCars), parts: t.parts, gift: false, gems: 0, tokens: ECON.wallet.taskTokens };
}

export function bonusReward(state: GameState): DailyReward {
  return { cash: carsWorth(state, ECON.daily.allDoneBonusCars), parts: 0, gift: false, gems: ECON.wallet.allDoneGems, tokens: ECON.wallet.allDoneTokens };
}

/** Calendar slot (0-6) the next claim pays. */
export function calendarIndex(state: Pick<GameState, 'daily'>): number {
  return state.daily.claims % ECON.daily.calendar.length;
}

export function calendarReward(state: GameState, index = calendarIndex(state)): DailyReward {
  const c = ECON.daily.calendar[index]!;
  return {
    cash: carsWorth(state, c.cars),
    parts: c.parts,
    gift: 'gift' in c && c.gift === true,
    gems: ECON.wallet.calendarGems[index] ?? 0,
    tokens: ECON.wallet.calendarTokens[index] ?? 0,
  };
}

/** The calendar has a reward to claim today. */
export function canClaimCalendar(state: GameState): boolean {
  return dailyUnlocked(state) && state.daily.day >= 0 && state.daily.claimedDay < state.daily.day;
}

/** Bring the daily state up to `now`: a new day rolls fresh tasks. Returns true when a new day started. */
export function refreshDaily(state: GameState, now: number): boolean {
  if (!dailyUnlocked(state)) return false;
  const day = gameDay(Math.max(now, state.lastSeen));
  const d = state.daily;
  if (day <= d.day) return false;
  d.day = day;
  d.bonusClaimed = false;
  d.tasks = rollKinds(availableKinds(state), day).map((kind) => {
    const last = dailyCounter(state, kind);
    return { kind, target: ECON.daily.tasks[kind].target, progress: 0, last, claimed: false };
  });
  return true;
}

/** Follow the counters: progress grows by what each counter grew since the last look (resets only move `last`). */
export function trackDaily(state: GameState): void {
  for (const t of state.daily.tasks) {
    const cur = dailyCounter(state, t.kind);
    if (cur > t.last) t.progress = Math.min(t.target, t.progress + (cur - t.last));
    t.last = cur;
  }
}

export function taskDone(t: DailyTask): boolean {
  return t.progress >= t.target;
}

function pay(state: GameState, r: DailyReward): void {
  state.cash += r.cash;
  state.lifetimeEarnings += r.cash;
  state.parts += r.parts;
  addGems(state, r.gems);
  addTokens(state, r.tokens);
  if (r.gift) state.daily.giftCars += 1;
}

/** Claim a finished task. Returns what it paid, or null. */
export function claimTask(state: GameState, index: number): DailyReward | null {
  const t = state.daily.tasks[index];
  if (!t || t.claimed || !taskDone(t)) return null;
  const r = taskReward(state, t);
  t.claimed = true;
  pay(state, r);
  return r;
}

/** All of today's tasks claimed and the bonus not paid yet. */
export function canClaimBonus(state: GameState): boolean {
  const d = state.daily;
  return d.tasks.length > 0 && !d.bonusClaimed && d.tasks.every((t) => t.claimed);
}

export function claimBonus(state: GameState): DailyReward | null {
  if (!canClaimBonus(state)) return null;
  const r = bonusReward(state);
  state.daily.bonusClaimed = true;
  pay(state, r);
  return r;
}

export function claimCalendar(state: GameState): DailyReward | null {
  if (!canClaimCalendar(state)) return null;
  const r = calendarReward(state);
  state.daily.claims += 1;
  state.daily.claimedDay = state.daily.day;
  pay(state, r);
  return r;
}

/** Something to claim (the red dot): a finished task, the all-done bonus or today's calendar reward. */
export function dailyHasClaim(state: GameState): boolean {
  if (!dailyUnlocked(state)) return false;
  return canClaimCalendar(state) || canClaimBonus(state) || state.daily.tasks.some((t) => !t.claimed && taskDone(t));
}

/** Save repair: whole non-negative numbers, known kinds only, progress within the target. */
export function sanitizeDaily(d: Daily): void {
  const int = (x: number, min = 0) => (Number.isFinite(x) ? Math.max(min, Math.floor(x)) : min);
  d.day = Number.isFinite(d.day) ? Math.max(-1, Math.floor(d.day)) : -1;
  d.claims = int(d.claims);
  d.claimedDay = Number.isFinite(d.claimedDay) ? Math.max(-1, Math.floor(d.claimedDay)) : -1;
  if (d.claimedDay > d.day) d.claimedDay = d.day;
  d.giftCars = Math.min(ECON.daily.calendar.length, int(d.giftCars));
  d.bonusClaimed = d.bonusClaimed === true;
  const seen = new Set<string>();
  d.tasks = (Array.isArray(d.tasks) ? d.tasks : [])
    .filter((t): t is DailyTask => !!t && typeof t === 'object' && typeof t.kind === 'string' && t.kind in ECON.daily.tasks && !seen.has(t.kind) && !!seen.add(t.kind))
    .slice(0, ECON.daily.tasksPerDay)
    .map((t) => {
      const target = ECON.daily.tasks[t.kind].target;
      return { kind: t.kind, target, progress: Math.min(target, int(t.progress)), last: int(t.last), claimed: t.claimed === true };
    });
}
