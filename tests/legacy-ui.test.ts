import { describe, expect, it } from 'vitest';
import { ECON } from '../src/core/config';
import { sellEmpire } from '../src/core/legacy';
import { deserialize, serialize, withDefaults } from '../src/core/save';
import { formatCash } from '../src/core/format';
import { newGame, type GameState } from '../src/core/state';
import { formatMult, grandpaLine, legacyBadge, legacyTreeView, nextSaleLine, sellEmpirePreview, sellEmpireRow, treeHasBuy } from '../src/ui/legacyView';
import { buyNode, respecTree } from '../src/core/legacyTree';

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

describe('Legacy tree screen (P1.3c)', () => {
  function owner(points: number): GameState {
    const s = newGame(T0, 3);
    s.legacy.points = points;
    s.legacy.allTime = points * points * S;
    s.legacy.sold = 1;
    return s;
  }

  it('lists three branches of four nodes with status, cost and the button text', () => {
    const s = owner(12);
    const v = legacyTreeView(s);
    expect(v.header).toBe('12 of 12 points free · income x1.24');
    expect(v.branches.map((b) => b.id)).toEqual(['mechanic', 'dealer', 'racer']);
    expect(v.branches.every((b) => b.nodes.length === 4 && b.canBuy)).toBe(true);
    const m = v.branches[0]!.nodes;
    expect(m.map((n) => n.status)).toEqual(['next', 'locked', 'locked', 'locked']);
    expect(m.map((n) => n.cost)).toEqual([2, 3, 5, 8]);
    expect(m[0]!.action).toBe('Buy 2 🏛');
    expect(m[1]!.action).toBe('3 🏛');
    expect(v.respec).toBeNull();
    expect(v.respecNote).toBeNull();
    expect(treeHasBuy(s)).toBe(true);
  });

  it('after buying: owned nodes, fewer free points, a respec offer, then the used note', () => {
    const s = owner(12);
    buyNode(s, 'quickHands');
    buyNode(s, 'headStart');
    let v = legacyTreeView(s);
    expect(v.header.startsWith('7 of 12')).toBe(true);
    expect(v.branches[0]!.nodes[0]!.status).toBe('owned');
    expect(v.branches[0]!.nodes[0]!.action).toBe('Owned');
    expect(v.branches[0]!.owned).toBe(2);
    expect(v.branches[0]!.canBuy).toBe(true); // Parts Hoarder for 5
    expect(v.branches[0]!.nodes[3]!.canBuy).toBe(false);
    expect(v.respec).toBe('Free respec: refund 5 🏛 (once per empire)');
    respecTree(s);
    buyNode(s, 'silverTongue');
    v = legacyTreeView(s);
    expect(v.respec).toBeNull();
    expect(v.respecNote).toMatch(/next empire/);
  });

  it('no dot once nothing is affordable', () => {
    const s = owner(1);
    expect(treeHasBuy(s)).toBe(false);
    expect(legacyTreeView(s).branches.every((b) => !b.canBuy && b.nodes[0]!.action === '2 🏛')).toBe(true);
  });
});

