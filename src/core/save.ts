// Save system.
// - Two rotating slots: a crash mid-write never destroys the only good copy.
// - Every save has a version; migrations upgrade old saves.
// - A checksum detects corrupted or hand-edited saves; we fall back to the other slot.
// - Missing fields are filled from a fresh game, so adding fields never breaks old saves.

import { ECON } from './config';
import { sanitizeBusinesses } from './businesses';
import { sanitizeGarage } from './garage';
import { sanitizeCarLot } from './carlot';
import { sanitizeLotShopLinks, sanitizePaint } from './paint';
import { sanitizeLegacy } from './legacy';
import { newBusinesses, newGame, SAVE_VERSION, type Buyer, type GameState } from './state';

export interface KeyValueStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

interface Envelope {
  v: number;
  savedAt: number;
  sum: string;
  data: string;
}

const SLOT_KEYS = ['jye_save_a', 'jye_save_b'] as const;

/** FNV-1a 32-bit hash, as hex. Not security, just corruption/tamper detection. */
export function checksum(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

type Migration = (data: Record<string, unknown>) => Record<string, unknown>;

/** migrations[n] upgrades a save from version n to n + 1. */
const migrations: Record<number, Migration> = {
  // v1 -> v2 (run 10): the city map. Every v1 player owns just the scrapyard and has it on screen. A v1 save that
  // already has lifetime earnings past a business's unlock goal sees that business for sale on the map at once.
  1: (d) => ({ ...d, businesses: newBusinesses() }),
};

export function migrate(data: Record<string, unknown>, fromVersion: number): Record<string, unknown> {
  let d = data;
  for (let v = fromVersion; v < SAVE_VERSION; v++) {
    const m = migrations[v];
    if (m) d = m(d);
  }
  d.version = SAVE_VERSION;
  return d;
}

function isPlainObject(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

/** Fill anything missing or of the wrong type from `defaults`. Arrays are taken as-is if arrays. */
export function withDefaults<T>(value: unknown, defaults: T): T {
  if (isPlainObject(defaults)) {
    const src = isPlainObject(value) ? value : {};
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(defaults)) {
      out[key] = withDefaults(src[key], (defaults as Record<string, unknown>)[key]);
    }
    return out as T;
  }
  if (Array.isArray(defaults)) return (Array.isArray(value) ? value : defaults) as T;
  if (defaults === null) return (value === undefined ? null : value) as T;
  if (typeof value === typeof defaults) {
    if (typeof value === 'number' && !Number.isFinite(value)) return defaults;
    return value as T;
  }
  return defaults;
}

function isValidCar(c: unknown): boolean {
  if (!isPlainObject(c)) return false;
  const nums = ['id', 'paint', 'value', 'dirt', 'damage', 'sellProgress'];
  if (!nums.every((k) => typeof c[k] === 'number' && Number.isFinite(c[k] as number))) return false;
  return typeof c.family === 'string' && c.family in ECON.families && typeof c.rarity === 'string' && c.rarity in ECON.rarity && typeof c.model === 'string';
}

function isValidContract(c: unknown): boolean {
  if (!isPlainObject(c)) return false;
  const nums = ['id', 'target', 'progress', 'timeLeft', 'rewardCash', 'rewardParts'];
  if (!nums.every((k) => typeof c[k] === 'number' && Number.isFinite(c[k] as number))) return false;
  return ['active', 'done', 'empty'].includes(c.status as string) && typeof c.kind === 'string';
}

function validBuyer(b: unknown): Buyer | null {
  if (!isPlainObject(b)) return null;
  if (typeof b.kind !== 'string' || !(b.kind in ECON.buyers.kinds)) return null;
  if (typeof b.timeLeft !== 'number' || !Number.isFinite(b.timeLeft)) return null;
  return { kind: b.kind as Buyer['kind'], timeLeft: b.timeLeft };
}

const BARN_STATUS: GameState['barn']['status'][] = ['locked', 'covered', 'working', 'finished', 'revealed', 'away'];

/** Reject values no honest game can reach. */
function sane(state: GameState): boolean {
  if (state.cash < 0 || state.lifetimeEarnings < 0) return false;
  // Head Start (legacy tree) hands a new empire some cash before it has earned anything (even if respecced after).
  const gift = state.legacy.sold > 0 ? ECON.legacy.tree.headStartCash : 0;
  if (state.cash > state.lifetimeEarnings + gift + 1) return false;
  if (state.parts < 0) return false;
  if (state.slots < 1 || state.slots > 10) return false;
  return Object.values(state.levels).every((l) => Number.isInteger(l) && l >= 1 && l < 100_000);
}

export function serialize(state: GameState, now: number): string {
  const data = JSON.stringify(state);
  const env: Envelope = { v: SAVE_VERSION, savedAt: now, sum: checksum(data), data };
  return JSON.stringify(env);
}

/** Parse one slot. Returns null if missing, corrupted, tampered or from a newer game version. */
export function deserialize(text: string | null, now: number): { state: GameState; savedAt: number } | null {
  if (!text) return null;
  try {
    const env = JSON.parse(text) as Envelope;
    if (typeof env.data !== 'string' || checksum(env.data) !== env.sum) return null;
    if (typeof env.v !== 'number' || env.v > SAVE_VERSION) return null;
    const raw = JSON.parse(env.data) as Record<string, unknown>;
    const migrated = migrate(raw, env.v);
    const state = withDefaults(migrated, newGame(now));
    state.cars = state.cars.filter(isValidCar);
    state.contracts = state.contracts.filter(isValidContract).map((c) => ({ ...c, rerolled: c.rerolled === true }));
    state.buyer = validBuyer(state.buyer);
    for (const f of Object.keys(state.collection.sold) as (keyof typeof state.collection.sold)[]) {
      state.collection.sold[f] = Math.max(0, Math.floor(state.collection.sold[f]));
    }
    sanitizeBusinesses(state.businesses);
    sanitizeGarage(state.garage);
    sanitizeCarLot(state.carlot);
    sanitizePaint(state.paint);
    sanitizeLotShopLinks(state);
    sanitizeLegacy(state.legacy);
    if (state.settings.numberFormat !== 'scientific') state.settings.numberFormat = 'short';
    if (!BARN_STATUS.includes(state.barn.status) || !(state.barn.family in ECON.families)) state.barn = newGame(now).barn;
    if (!sane(state)) return null;
    return { state, savedAt: env.savedAt };
  } catch {
    return null;
  }
}

export class SaveManager {
  private nextSlot = 0;

  constructor(private store: KeyValueStore) {}

  /** Load the newest valid slot, or null for a new player. */
  load(now: number): GameState | null {
    const results = SLOT_KEYS.map((k, i) => ({ i, r: deserialize(this.store.get(k), now) }));
    const valid = results.filter((x) => x.r !== null) as { i: number; r: { state: GameState; savedAt: number } }[];
    if (valid.length === 0) return null;
    valid.sort((a, b) => b.r.savedAt - a.r.savedAt);
    const best = valid[0]!;
    this.nextSlot = (best.i + 1) % SLOT_KEYS.length;
    return best.r.state;
  }

  /** Write to the older slot. Returns false if storage failed (full, private mode). */
  save(state: GameState, now: number): boolean {
    try {
      this.store.set(SLOT_KEYS[this.nextSlot]!, serialize(state, now));
      this.nextSlot = (this.nextSlot + 1) % SLOT_KEYS.length;
      return true;
    } catch {
      return false;
    }
  }

  wipe(): void {
    for (const k of SLOT_KEYS) this.store.remove(k);
  }
}

export class MemoryStore implements KeyValueStore {
  private map = new Map<string, string>();
  get(key: string) {
    return this.map.get(key) ?? null;
  }
  set(key: string, value: string) {
    this.map.set(key, value);
  }
  remove(key: string) {
    this.map.delete(key);
  }
}
