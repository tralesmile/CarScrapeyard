// All tunable numbers for the economy live here (mirrored in docs/economy.md).
// Rule: game code never hard-codes a balance number; it reads ECON.

export type UpgradeKind = 'wash' | 'repair' | 'quality';
export type ManagerKind = 'mechanic' | 'washer' | 'seller';
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';
export type CarFamily = 'sedan' | 'hatch' | 'pickup' | 'muscle';

export const ECON = {
  /** Seconds between new wrecks arriving while a lot slot is free. */
  arrivalInterval: 2.5,

  /** Lot slots: how many cars can sit in the yard at once. */
  slots: {
    start: 1,
    /** Cost of slot 2, 3, 4. */
    costs: [20_000, 150_000, 900_000] as const,
  },

  upgrades: {
    wash: { name: 'Wash Bay', baseCost: 150, growth: 1.14 },
    repair: { name: 'Repair Bench', baseCost: 200, growth: 1.14 },
    quality: { name: 'Junk Supplier', baseCost: 900, growth: 1.22 },
  } satisfies Record<UpgradeKind, { name: string; baseCost: number; growth: number }>,

  /** Each level adds this fraction of base power (wash and repair). */
  powerPerLevel: 0.15,
  /** Each Junk Supplier level multiplies car value by this. */
  qualityValueGrowth: 1.08,

  /** Station levels that double that station's power. */
  milestones: [10, 25, 50, 100, 200] as const,
  milestoneMultiplier: 2,

  /** Manual play. */
  manual: {
    /** Dirt removed per pixel of swipe (design pixels, 390-wide layout) at level 1. */
    washPerPixel: 1 / 2000,
    /** Damage removed per tap at level 1. */
    repairPerTap: 0.2,
  },

  managers: {
    mechanic: { name: 'Mechanic', cost: 9_000, ratePerSec: 0.12 },
    washer: { name: 'Washer', cost: 25_000, ratePerSec: 0.15 },
    seller: { name: 'Salesperson', cost: 75_000, ratePerSec: 0 },
  } satisfies Record<ManagerKind, { name: string; cost: number; ratePerSec: number }>,

  /** Seconds a salesperson needs to close a sale once a car is ready. */
  sellerDelay: 3,

  offline: {
    capSeconds: 2 * 60 * 60,
    efficiency: 0.5,
    /** Below this, no welcome-back popup (seconds). */
    minSecondsForPopup: 30,
  },

  rarity: {
    common: { weight: 78, valueMult: 1, label: 'Common' },
    rare: { weight: 17, valueMult: 2.5, label: 'Rare' },
    epic: { weight: 4.5, valueMult: 6, label: 'Epic' },
    legendary: { weight: 0.5, valueMult: 20, label: 'Legendary' },
  } satisfies Record<Rarity, { weight: number; valueMult: number; label: string }>,

  families: {
    sedan: { name: 'Sedan', baseValue: 420 },
    hatch: { name: 'Hatchback', baseValue: 360 },
    pickup: { name: 'Pickup', baseValue: 520 },
    muscle: { name: 'Muscle', baseValue: 680 },
  } satisfies Record<CarFamily, { name: string; baseValue: number }>,

  /** The first N cars are always Common, so the tutorial pacing is predictable. */
  tutorialCommonCars: 5,

  /** Random spread on car value, +/- this fraction. */
  valueSpread: 0.1,
} as const;

export const PAINTS = [
  0xe5484d, 0x3b82f6, 0x1f9e9a, 0xe8762b, 0xf5b700, 0x3bc45a, 0xeadbc8, 0x2b2f36, 0xf2f4f7, 0x8b5cf6,
] as const;

/** Fictional brands only. Never use real car makers' names or logos. */
export const MODEL_NAMES: Record<CarFamily, readonly string[]> = {
  sedan: ['Vortex Cruiser', 'Regalia Civica', 'Stallion Comet', 'Kaze Aurora'],
  hatch: ['Kaze Pip', 'Vortex Hopper', 'Regalia Mini', 'Stallion Spark'],
  pickup: ['Stallion Ranger', 'Vortex Hauler', 'Kaze Trail', 'Regalia Ox'],
  muscle: ['Stallion Thunder', 'Vortex Fury', 'Regalia Brute', 'Kaze Ronin'],
};
