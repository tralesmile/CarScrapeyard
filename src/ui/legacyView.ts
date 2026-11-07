// Sell Empire UI text (P1.3b) and the Legacy tree screen (P1.3c): what the map row, the preview, the HUD badge and the
// tree say. Pure (no DOM) so it is unit-tested.

import { canSellEmpire, legacyMultiplier, nextLegacyMultiplier, pendingLegacyPoints, sellEmpireGlows, earningsForPoints } from '../core/legacy';
import { ECON, type LegacyBranch, type LegacyNode } from '../core/config';
import { LEGACY_BRANCHES, canBuyNode, canRespec, freePoints, nodeCost, nodeStatus, spentPoints, type NodeStatus } from '../core/legacyTree';
import { formatCash, formatDuration } from '../core/format';
import type { GameState } from '../core/state';

export const LEGACY_ICON = '🏛';

/** "x1.24" (two decimals, no trailing noise). */
export function formatMult(m: number): string {
  return `x${m.toFixed(2)}`;
}

/** HUD chip text once the player owns Legacy Points, else null (the chip stays hidden). */
export function legacyBadge(state: GameState): string | null {
  if (state.legacy.points <= 0) return null;
  return `${LEGACY_ICON} ${formatMult(legacyMultiplier(state))}`;
}

export interface SellEmpireRow {
  glow: boolean;
  line: string;
  action: string;
}

/** The "Sell Empire" row on the city map, or null until a sale would give `minPoints`. */
export function sellEmpireRow(state: GameState): SellEmpireRow | null {
  if (!canSellEmpire(state)) return null;
  const p = pendingLegacyPoints(state);
  return {
    glow: sellEmpireGlows(state),
    line: `+${p} Legacy Points · income ${formatMult(legacyMultiplier(state))} → ${formatMult(nextLegacyMultiplier(state))}`,
    action: 'Sell',
  };
}

/** A teaser line for players who sold before: how far the next worthwhile sale is. Null when the row shows instead. */
export function nextSaleLine(state: GameState): string | null {
  if (state.legacy.sold <= 0 || canSellEmpire(state)) return null;
  const need = earningsForPoints(state, ECON.legacy.minPoints) - state.lifetimeEarnings - Math.max(0, state.pendingOffline);
  return `Sell Empire again after ${formatCash(Math.max(0, need))} more earnings`;
}

export interface SellEmpirePreview {
  points: number;
  multNow: string;
  multNext: string;
  earned: string;
  runTime: string;
  keeps: string[];
  resets: string[];
}

export function sellEmpirePreview(state: GameState): SellEmpirePreview {
  return {
    points: pendingLegacyPoints(state),
    multNow: formatMult(legacyMultiplier(state)),
    multNext: formatMult(nextLegacyMultiplier(state)),
    earned: formatCash(state.lifetimeEarnings + Math.max(0, state.pendingOffline)),
    runTime: formatDuration(state.legacy.runSeconds),
    keeps: ['Legacy Points', 'Collection book', 'Stats and settings'],
    resets: ['Cash, upgrades and crew', 'Every business and car', 'Parts, jobs and the barn'],
  };
}

/** Grandpa Joe's line in the celebration (first sale, then later ones). */
export function grandpaLine(soldBefore: number): string {
  return soldBefore <= 0
    ? '"Kid, I never thought this old yard could become an empire. Sell it, start again, and this time the whole valley knows your name."'
    : '"Again? Ha! Every time you start over, you come back bigger. Go show them, kid."';
}

// ---- Legacy tree screen (P1.3c) ----

export interface TreeNodeView {
  id: LegacyNode;
  icon: string;
  name: string;
  desc: string;
  status: NodeStatus;
  cost: number;
  canBuy: boolean;
  /** Button text, or the state shown instead of a button. */
  action: string;
}

export interface TreeBranchView {
  id: LegacyBranch;
  icon: string;
  name: string;
  owned: number;
  /** True when the branch's next node can be bought now (a dot on its tab). */
  canBuy: boolean;
  nodes: TreeNodeView[];
}

export interface TreeView {
  free: number;
  /** "7 of 12 points free · income x1.24 (spent points keep their bonus)" */
  header: string;
  branches: TreeBranchView[];
  /** Respec button text, or null when it can't be used. */
  respec: string | null;
  /** Why respec is unavailable, when something is owned. */
  respecNote: string | null;
}

export function legacyTreeView(state: GameState): TreeView {
  const T = ECON.legacy.tree;
  const free = freePoints(state);
  const branches = LEGACY_BRANCHES.map((b): TreeBranchView => {
    const def = T.branches[b];
    const nodes = def.nodes.map((id): TreeNodeView => {
      const n = T.nodes[id];
      const status = nodeStatus(state, id);
      const cost = nodeCost(id);
      const canBuy = canBuyNode(state, id);
      const action = status === 'owned' ? 'Owned' : status === 'locked' ? `${cost} ${LEGACY_ICON}` : canBuy ? `Buy ${cost} ${LEGACY_ICON}` : `${cost} ${LEGACY_ICON}`;
      return { id, icon: n.icon, name: n.name, desc: n.desc, status, cost, canBuy, action };
    });
    return { id: b, icon: def.icon, name: def.name, owned: state.legacy.tree[b], canBuy: nodes.some((n) => n.canBuy), nodes };
  });
  const spent = spentPoints(state.legacy);
  return {
    free,
    header: `${free} of ${state.legacy.points} points free · income ${formatMult(legacyMultiplier(state))}`,
    branches,
    respec: canRespec(state) ? `Free respec: refund ${spent} ${LEGACY_ICON} (once per empire)` : null,
    respecNote: spent > 0 && state.legacy.respecUsed ? 'Respec used: free again in your next empire' : null,
  };
}

/** A dot on the HUD chip: some node can be bought. */
export function treeHasBuy(state: GameState): boolean {
  return LEGACY_BRANCHES.some((b) => ECON.legacy.tree.branches[b].nodes.some((n) => canBuyNode(state, n)));
}
