import { describe, expect, it } from 'vitest';
import { ECON } from '../src/core/config';
import { sellEmpire } from '../src/core/legacy';
import { deserialize, serialize, withDefaults } from '../src/core/save';
import { formatCash } from '../src/core/format';
import { newGame, type GameState } from '../src/core/state';
import { TAB_PERKS, awayText, formatMult, grandpaLine, legacyBadge, legacyTreeView, nextSaleLine, perkChip, perkLabel, sellEmpirePreview, sellEmpireRow, tabPerks, treeHasBuy } from '../src/ui/legacyView';
import { mapRows } from '../src/ui/cityMap';
import { buyNode, offlineCap, respecTree } from '../src/core/legacyTree';

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


describe('Legacy perk notes (P1.3e)', () => {
  const owned = (nodes: Parameters<typeof buyNode>[1][]) => {
    const s = newGame(T0, 4);
    s.legacy.points = 200;
    for (const n of nodes) {
      const { branch } = { branch: Object.entries(ECON.legacy.tree.branches).find(([, b]) => (b.nodes as readonly string[]).includes(n))![0] };
      const order = ECON.legacy.tree.branches[branch as keyof typeof ECON.legacy.tree.branches].nodes;
      for (const m of order) {
        buyNode(s, m);
        if (m === n) break;
      }
    }
    return s;
  };

  it('labels are short and built from the config numbers', () => {
    expect(perkLabel('quickHands')).toBe('👐 +25% taps');
    expect(perkLabel('insider')).toBe('🔨 auctions −10%');
    expect(perkLabel('franchise')).toBe('🏢 opening −25%');
    expect(perkLabel('nightShift')).toBe('🌙 4h cap');
    expect(perkLabel('rareFinds')).toBe(`💎 rares x${ECON.legacy.tree.rareFindsMult}`);
    for (const n of Object.keys(ECON.legacy.tree.nodes) as (keyof typeof ECON.legacy.tree.nodes)[]) {
      expect(perkLabel(n).length, n).toBeLessThanOrEqual(18);
    }
  });

  it('no chips for a player without perks', () => {
    const s = newGame(T0, 1);
    for (const tab of Object.keys(TAB_PERKS)) expect(tabPerks(s, tab)).toEqual([]);
    expect(perkChip(s, 'nightShift')).toBeNull();
  });

  it('each tab shows only its owned perks, in order, with a readable title', () => {
    const s = owned(['quickHands', 'masterCrew', 'insider', 'rareFinds']);
    expect(tabPerks(s, 'upgrades').map((c) => c.node)).toEqual(['quickHands', 'rareFinds']);
    expect(tabPerks(s, 'crew').map((c) => c.node)).toEqual(['masterCrew']);
    expect(tabPerks(s, 'auction')[0]!.title).toBe('Insider (Legacy): Auction prices -10%');
    expect(tabPerks(s, 'lupgrades').map((c) => c.node)).toEqual(['quickHands', 'regulars']); // Insider needs Regulars first
    expect(tabPerks(s, 'jobs')).toEqual([]);
    expect(tabPerks(s, 'nope')).toEqual([]);
  });

  it('every perk with a visible effect has a screen that names it', () => {
    const onTabs = new Set(Object.values(TAB_PERKS).flat());
    // Silver Tongue: haggle slider; Franchise: map open cost; Night Shift: welcome-back; Head Start: acts at the sale.
    const elsewhere = ['silverTongue', 'franchise', 'nightShift', 'headStart'];
    for (const n of Object.keys(ECON.legacy.tree.nodes)) expect(onTabs.has(n as never) || elsewhere.includes(n), n).toBe(true);
    for (const tab of ['upgrades', 'crew', 'yard', 'jobs', 'gupgrades', 'gcrew', 'auction', 'lupgrades', 'lcrew', 'pupgrades', 'pcrew']) {
      expect(TAB_PERKS[tab], tab).toBeDefined();
      expect(TAB_PERKS[tab]!.length, tab).toBeLessThanOrEqual(2);
    }
  });

  it('the map open line names Franchise when it is owned', () => {
    const s = owned(['franchise']);
    s.lifetimeEarnings = ECON.businesses.list.garage.unlockLifetime;
    const row = mapRows(s)[1]!;
    expect(row.line).toBe('Ready to open · 🏢 opening −25%');
    expect(row.action).toBe(`Open ${formatCash(ECON.businesses.list.garage.openCost * 0.75)}`);
  });
});

describe('Welcome-back time lines (P1.3e)', () => {
  const cap = ECON.offline.capSeconds;
  it('says the real time worked and when the cap cut it', () => {
    const s = newGame(T0, 1);
    expect(awayText(s, 3600, cap)).toEqual({ worked: 'Your crew kept working for 1h 0m.', capped: null, perk: null });
    const t = awayText(s, 5 * 3600, cap);
    expect(t.worked).toBe('Your crew kept working for 2h 0m.');
    expect(t.capped).toBe("You were away 5h 0m; crews work up to 2h 0m while you're gone.");
    expect(awayText(s, cap + 30, cap).capped).toBeNull(); // a few seconds over is not worth a line
  });
  it('names Night Shift when it is owned', () => {
    const s = newGame(T0, 1);
    s.legacy.points = 18;
    for (const n of ECON.legacy.tree.branches.racer.nodes) buyNode(s, n);
    const t = awayText(s, 3 * 3600, offlineCap(s));
    expect(t.worked).toBe('Your crew kept working for 3h 0m.');
    expect(t.capped).toBeNull();
    expect(t.perk?.label).toBe('🌙 4h cap');
  });
});
