// Deterministic RNG (mulberry32). The seed lives in the save, so the same
// save always produces the same next car: no save-scumming for barn finds.

export function nextRandom(state: { rng: number }): number {
  let t = (state.rng = (state.rng + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function pick<T>(state: { rng: number }, items: readonly T[]): T {
  const item = items[Math.floor(nextRandom(state) * items.length)];
  if (item === undefined) throw new Error('pick from empty list');
  return item;
}

export function weighted<K extends string>(state: { rng: number }, weights: Record<K, number>): K {
  const entries = Object.entries(weights) as [K, number][];
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let roll = nextRandom(state) * total;
  for (const [k, w] of entries) {
    roll -= w;
    if (roll < 0) return k;
  }
  return entries[entries.length - 1]![0];
}
