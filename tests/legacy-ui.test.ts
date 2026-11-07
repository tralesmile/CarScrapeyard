import { describe, expect, it } from 'vitest';
import { ECON } from '../src/core/config';
import { sellEmpire } from '../src/core/legacy';
import { deserialize, serialize, withDefaults } from '../src/core/save';
import { formatCash } from '../src/core/format';
import { newGame, type GameState } from '../src/core/state';
import { formatMult, grandpaLine, legacyBadge, nextSaleLine, sellEmpirePreview, sellEmpireRow } from '../src/ui/legacyView';

const T0 = 1_800_000_000_000;
const S = ECON.legacy.pointScale;

function rich(earned: number): GameState {
  const s = newGame(T0, 3);
  s.lifetimeEarnings = earned;
  return s;
}

describe('Sell Empire UI text (P1.3b)', () => {
  it('formats multipliers with two decimals', () => {
    expect(formatMult(1)).toBe('x1.00');
    expect(formatMult(1.24)).toBe('x1.24');
    expect(formatMult(2.5)).toBe('x2.50');
  });

  it('no row and no badge for a new player', () => {
    const s = newGame(T0, 1);
    expect(sellEmpireRow(s)).toBeNull();
    expect(legacyBadge(s)).toBeNull();
    expect(nextSaleLine(s)).toBeNull();
  });

  it('the row appears exactly at the minimum points and shows the gain', () => {
    const need = ECON.legacy.minPoints ** 2 * S;
    expect(sellEmpireRow(rich(need - 1))).toBeNull();
    const row = sellEmpireRow(rich(need))!;
    expect(row).not.toBeNull();
    expect(row.glow).toBe(true);
    expect(row.line).toBe(`+${ECON.legacy.minPoints} Legacy Points · income x1.00 → x1.20`);
  });

  it('offline cash still waiting counts toward the row', () => {
    const s = rich(ECON.legacy.minPoints ** 2 * S - 10);
    expect(sellEmpireRow(s)).toBeNull();
    s.pendingOffline = 10;
    expect(sellEmpireRow(s)).not.toBeNull();
  });

  it('the preview lists the gain, the multipliers, the run and what is kept', () => {
    const s = rich(144 * S);
    s.legacy.runSeconds = 3 * 3600 + 25 * 60;
    const p = sellEmpirePreview(s);
    expect(p.points).toBe(12);
    expect(p.multNow).toBe('x1.00');
    expect(p.multNext).toBe('x1.24');
    expect(p.runTime).toMatch(/3h/);
    expect(p.keeps).toContain('Legacy Points');
    expect(p.keeps.join(' ')).toMatch(/Collection/);
    expect(p.resets.join(' ')).toMatch(/business/);
  });

  it('after a sale: the badge shows the multiplier, the row hides and a teaser says how far the next sale is', () => {
    const s = rich(144 * S);
    const sold = sellEmpire(s, T0 + 1000)!;
    expect(sold.points).toBe(12);
    expect(legacyBadge(s)).toBe('🏛 x1.24');
    expect(sellEmpireRow(s)).toBeNull();
    // 12 points owned: 22 total needs 484 x S all-time; 144 x S already banked.
    expect(nextSaleLine(s)).toBe(`Sell Empire again after ${formatCash((484 - 144) * S)} more earnings`);
    // The glow needs at least half the owned points: 10 new points >= 6.
    s.lifetimeEarnings = (484 - 144) * S;
    expect(sellEmpireRow(s)!.glow).toBe(true);
  });

  it('the row stops glowing when the new points are small next to the owned ones', () => {
    const s = rich(0);
    s.legacy.points = 30;
    s.legacy.allTime = 900 * S;
    s.lifetimeEarnings = 40 * 40 * S - 900 * S; // 40 total -> 10 new < 15
    const row = sellEmpireRow(s)!;
    expect(row).not.toBeNull();
    expect(row.glow).toBe(false);
  });

  it('a sale survives save and load, with the offer seen flag kept', () => {
    const s = rich(144 * S);
    s.tutorial.legacyOffered = true;
    sellEmpire(s, T0 + 1000);
    const back = deserialize(serialize(s, T0 + 2000), T0 + 3000)!.state;
    expect(back.legacy.points).toBe(12);
    expect(back.tutorial.legacyOffered).toBe(true);
    expect(legacyBadge(back)).toBe('🏛 x1.24');
  });

  it('old saves without the new tutorial flag load with it off', () => {
    const old: Record<string, unknown> = { ...newGame(T0, 2).tutorial, mapSeen: true };
    delete old.legacyOffered;
    const t = withDefaults(old, newGame(T0).tutorial);
    expect(t.legacyOffered).toBe(false);
    expect(t.mapSeen).toBe(true);
  });

  it('Grandpa Joe has a first-sale line and a later one', () => {
    expect(grandpaLine(0)).not.toBe(grandpaLine(1));
    expect(grandpaLine(0)).toMatch(/empire/);
  });
});
