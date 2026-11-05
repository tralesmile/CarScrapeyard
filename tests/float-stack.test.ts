import { describe, expect, it } from 'vitest';
import { STACK_WINDOW_MS, pruneFloaters, stackY, type Floater } from '../src/game/floatStack';

describe('floating text stacking', () => {
  it('a lone text keeps its spot', () => {
    expect(stackY([], 100, 200, 30, 0, 160)).toBe(200);
  });

  it('a text landing on a recent one moves above it, and a third above both', () => {
    const live: Floater[] = [];
    const a = stackY(live, 100, 200, 30, 0, 160);
    live.push({ x: 100, y: a, h: 30, born: 0 });
    const b = stackY(live, 110, 190, 30, 50, 160);
    expect(b).toBeLessThanOrEqual(a - 30);
    live.push({ x: 110, y: b, h: 30, born: 50 });
    const c = stackY(live, 100, 200, 30, 80, 160);
    expect(c).toBeLessThanOrEqual(b - 30);
    // No two overlap.
    const ys = [a, b, c].sort((p, q) => p - q);
    for (let i = 1; i < ys.length; i++) expect(ys[i]! - ys[i - 1]!).toBeGreaterThanOrEqual(30);
  });

  it('texts far apart or old ones do not push', () => {
    const live: Floater[] = [{ x: 100, y: 200, h: 30, born: 0 }];
    expect(stackY(live, 400, 200, 30, 10, 160)).toBe(200);
    expect(stackY(live, 100, 200, 30, STACK_WINDOW_MS + 1, 160)).toBe(200);
    expect(pruneFloaters(live, STACK_WINDOW_MS + 1)).toEqual([]);
  });
});
