// Floating reward texts ("+$110", "+6 Parts") that land at the same time stack upwards
// instead of drawing on top of each other. Pure, so it is unit-tested.

export interface Floater {
  x: number;
  y: number;
  /** Text height (same units as y). */
  h: number;
  /** Time it appeared (ms). */
  born: number;
}

/** Texts younger than this still block the spot they started in. */
export const STACK_WINDOW_MS = 700;

/**
 * The y where a new text of height `h` should start so it doesn't overlap a recent one near `x`.
 * Moves up past each blocker; `nearX` is how close horizontally two texts must be to collide.
 */
export function stackY(live: readonly Floater[], x: number, y: number, h: number, now: number, nearX: number, gap = 4): number {
  const recent = live.filter((f) => now - f.born < STACK_WINDOW_MS && Math.abs(f.x - x) < nearX);
  let cy = y;
  for (let guard = 0; guard < 12; guard++) {
    const hit = recent.find((f) => Math.abs(f.y - cy) < (f.h + h) / 2 + gap / 2);
    if (!hit) break;
    cy = hit.y - (hit.h + h) / 2 - gap;
  }
  return cy;
}

/** Drop texts that no longer block anything. */
export function pruneFloaters(live: Floater[], now: number): Floater[] {
  return live.filter((f) => now - f.born < STACK_WINDOW_MS);
}
