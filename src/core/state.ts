import type { CarFamily, ManagerKind, Rarity, UpgradeKind } from './config';
import { ECON } from './config';

export const SAVE_VERSION = 1;

export interface Car {
  id: number;
  family: CarFamily;
  model: string;
  paint: number;
  rarity: Rarity;
  /** Sale price in cash. */
  value: number;
  /** 1 = filthy, 0 = clean. */
  dirt: number;
  /** 1 = wrecked, 0 = fixed. */
  damage: number;
  /** Seconds the salesperson has spent on this car. */
  sellProgress: number;
}

export interface GameState {
  version: number;
  createdAt: number;
  /** Last trusted timestamp (ms) the game was running. Never moves backwards. */
  lastSeen: number;
  cash: number;
  lifetimeEarnings: number;
  carsSold: number;
  levels: Record<UpgradeKind, number>;
  slots: number;
  managers: Record<ManagerKind, boolean>;
  cars: Car[];
  focusedId: number | null;
  /** Offline earnings waiting to be collected (kept in the save so a crash never loses them). */
  pendingOffline: number;
  arrivalTimer: number;
  rng: number;
  nextCarId: number;
  tutorial: {
    introSeen: boolean;
    firstSale: boolean;
    firstUpgrade: boolean;
  };
  settings: {
    sound: boolean;
  };
  stats: {
    legendaryFound: number;
    playSeconds: number;
  };
}

export function newGame(now: number, seed = Math.floor(Math.random() * 2 ** 31)): GameState {
  return {
    version: SAVE_VERSION,
    createdAt: now,
    lastSeen: now,
    cash: 0,
    lifetimeEarnings: 0,
    carsSold: 0,
    levels: { wash: 1, repair: 1, quality: 1 },
    slots: ECON.slots.start,
    managers: { mechanic: false, washer: false, seller: false },
    cars: [],
    focusedId: null,
    pendingOffline: 0,
    // First car appears almost immediately.
    arrivalTimer: ECON.arrivalInterval - 0.2,
    rng: seed >>> 0 || 1,
    nextCarId: 1,
    tutorial: { introSeen: false, firstSale: false, firstUpgrade: false },
    settings: { sound: true },
    stats: { legendaryFound: 0, playSeconds: 0 },
  };
}
