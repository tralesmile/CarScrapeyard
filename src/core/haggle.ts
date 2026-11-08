// Haggle: a timing slider on big manual sales. Pure rules; the UI only reads the needle
// position over time and passes the stopped position back as a multiplier.

import { ECON } from './config';
import type { Car, GameState } from './state';
import { buyerMatches } from './buyers';

export type HaggleGrade = 'perfect' | 'great' | 'good' | 'poor';

/** Needle position 0..1 after `seconds`, sweeping left → right → left (triangle wave). */
export function hagglePosition(seconds: number, sweepsPerSec: number): number {
  const phase = (((seconds * sweepsPerSec) % 1) + 1) % 1;
  return phase < 0.5 ? phase * 2 : 2 - phase * 2;
}

/**
 * Price multiplier for a needle stopped at `pos` (0..1). Centre pays `max`, edges pay `min`. `perfectZone` is the
 * half-width of the PERFECT zone (wider with the Silver Tongue legacy node: see legacyTree.perfectZone).
 */
export function haggleMultiplier(pos: number, lesson = false, perfectZone: number = ECON.haggle.perfectZone): number {
  const { min, max, lessonMin } = ECON.haggle;
  const p = Number.isFinite(pos) ? Math.min(1, Math.max(0, pos)) : 0;
  const d = Math.abs(p - 0.5) * 2; // 0 at centre, 1 at the edges
  const raw = d <= perfectZone ? max : max - (max - min) * ((d - perfectZone) / (1 - perfectZone));
  const mult = Math.round(raw * 100) / 100;
  return lesson ? Math.max(lessonMin, mult) : mult;
}

export function haggleGrade(mult: number): HaggleGrade {
  if (mult >= ECON.haggle.max) return 'perfect';
  if (mult >= 1.15) return 'great';
  if (mult >= 1) return 'good';
  return 'poor';
}

/** Clamp a multiplier coming from the UI to the legal range. */
export function clampHaggle(mult: number): number {
  if (!Number.isFinite(mult)) return 1;
  return Math.min(ECON.haggle.max, Math.max(ECON.haggle.min, mult));
}

/** The second sale ever is the haggle lesson: slow needle, always a good result. */
export function isHaggleLesson(state: GameState): boolean {
  return state.carsSold === 1;
}

/**
 * Should a manual sale of this car start a haggle? Only "big" sales do, so the common loop stays quick:
 * the lesson sale, Rare+ cars, and cars the waiting buyer wants.
 */
export function wantsHaggle(state: GameState, car: Car): boolean {
  if (state.carsSold < 1) return false;
  if (isHaggleLesson(state)) return true;
  if (state.settings.skipHaggle) return false;
  return car.rarity !== 'common' || (!!state.buyer && buyerMatches(state.buyer.kind, car));
}
