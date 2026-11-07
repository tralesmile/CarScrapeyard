// Legacy tree (P1.3c): spend Legacy Points on three branches of four nodes (Mechanic, Dealer, Racer), bought in order
// within a branch. Spending never lowers the +2% income per point (legacyMultiplier counts points earned), so the
// tree is pure upside. One free respec per empire. Every effect is a small helper the rules call; numbers are in
// ECON.legacy.tree. Only imports config and state types, so every business module can use it without a cycle.

import { ECON, type LegacyBranch, type LegacyNode } from './config';
import type { GameState, Legacy } from './state';

const T = ECON.legacy.tree;
export const LEGACY_BRANCHES = Object.keys(T.branches) as LegacyBranch[];

type WithLegacy = Pick<GameState, 'legacy'>;

/** Branch and position (0-3) of a node. */
export function nodeSlot(node: LegacyNode): { branch: LegacyBranch; index: number } {
  for (const branch of LEGACY_BRANCHES) {
    const index = (T.branches[branch].nodes as readonly LegacyNode[]).indexOf(node);
    if (index >= 0) return { branch, index };
  }
  throw new Error(`unknown legacy node ${node}`);
}

export function nodeCost(node: LegacyNode): number {
  return T.costs[nodeSlot(node).index]!;
}

export function hasNode(state: WithLegacy, node: LegacyNode): boolean {
  const { branch, index } = nodeSlot(node);
  return (state.legacy.tree?.[branch] ?? 0) > index;
}

/** Points spent on the tree. */
export function spentPoints(legacy: Legacy): number {
  let sum = 0;
  for (const b of LEGACY_BRANCHES) for (let i = 0; i < (legacy.tree[b] ?? 0); i++) sum += T.costs[i]!;
  return sum;
}

/** Points free to spend. */
export function freePoints(state: WithLegacy): number {
  return Math.max(0, state.legacy.points - spentPoints(state.legacy));
}

export type NodeStatus = 'owned' | 'next' | 'locked';

/** owned; next = the next one in its branch (buyable if the points are there); locked = an earlier node is missing. */
export function nodeStatus(state: WithLegacy, node: LegacyNode): NodeStatus {
  const { branch, index } = nodeSlot(node);
  const owned = state.legacy.tree[branch] ?? 0;
  return owned > index ? 'owned' : owned === index ? 'next' : 'locked';
}

export function canBuyNode(state: WithLegacy, node: LegacyNode): boolean {
  return nodeStatus(state, node) === 'next' && freePoints(state) >= nodeCost(node);
}

export function buyNode(state: WithLegacy, node: LegacyNode): boolean {
  if (!canBuyNode(state, node)) return false;
  state.legacy.tree[nodeSlot(node).branch]++;
  return true;
}

/** Respec is free once per empire, and only worth offering when something is owned. */
export function canRespec(state: WithLegacy): boolean {
  return !state.legacy.respecUsed && spentPoints(state.legacy) > 0;
}

/** Refund every node. Returns the points refunded (0 = not allowed). */
export function respecTree(state: WithLegacy): number {
  if (!canRespec(state)) return 0;
  const refunded = spentPoints(state.legacy);
  for (const b of LEGACY_BRANCHES) state.legacy.tree[b] = 0;
  state.legacy.respecUsed = true;
  return refunded;
}

/** Save repair: whole levels 0-4 per branch and never more spent than owned (drop nodes from the top). */
export function sanitizeTree(l: Legacy): void {
  const tree = (l.tree ?? {}) as Record<string, unknown>;
  const clean = {} as Record<LegacyBranch, number>;
  for (const b of LEGACY_BRANCHES) {
    const v = tree[b];
    clean[b] = typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(T.costs.length, Math.floor(v))) : 0;
  }
  l.tree = clean;
  l.respecUsed = l.respecUsed === true;
  while (spentPoints(l) > l.points) {
    const top = LEGACY_BRANCHES.filter((b) => l.tree[b] > 0).sort((a, b) => l.tree[b] - l.tree[a])[0];
    if (!top) break;
    l.tree[top]--;
  }
}

// ---- Effects (each is 1 / 0 / the plain ECON value when the node isn't owned) ----

/** Mechanic: Quick Hands. Multiplier on tap work in every business. */
export function tapPerk(state: WithLegacy): number {
  return hasNode(state, 'quickHands') ? 1 + T.quickHandsTap : 1;
}

/** Mechanic: Parts Hoarder. Extra fraction of crusher parts. */
export function partsPerk(state: WithLegacy): number {
  return hasNode(state, 'partsHoarder') ? T.partsHoarderBonus : 0;
}

/** Mechanic: Master Crew. Multiplier on every crew member's work rate. */
export function crewPerk(state: WithLegacy): number {
  return hasNode(state, 'masterCrew') ? 1 + T.masterCrewSpeed : 1;
}

/** Seconds the Salesperson needs to close a sale (Master Crew makes it quicker). */
export function sellerDelay(state: WithLegacy): number {
  return ECON.sellerDelay / crewPerk(state);
}

/** Dealer: Silver Tongue. The haggle PERFECT zone. */
export function perfectZone(state: WithLegacy): number {
  return ECON.haggle.perfectZone * (hasNode(state, 'silverTongue') ? 1 + T.silverTongueZone : 1);
}

/** Dealer: Regulars. Divider on buyer gaps and walk-up intervals. */
export function buyerRatePerk(state: WithLegacy): number {
  return hasNode(state, 'regulars') ? 1 + T.regularsRate : 1;
}

/** Dealer: Insider. Multiplier on auction prices. */
export function auctionPerk(state: WithLegacy): number {
  return hasNode(state, 'insider') ? 1 - T.insiderDiscount : 1;
}

/** Dealer: Franchise. Multiplier on business open costs. */
export function franchisePerk(state: WithLegacy): number {
  return hasNode(state, 'franchise') ? 1 - T.franchiseDiscount : 1;
}

/** Racer: Quick Tips. Paint tip window per service, seconds. */
export function tipSecondsPerService(state: WithLegacy): number {
  return ECON.paint.tipSecondsPerService + (hasNode(state, 'quickTips') ? T.quickTipsSeconds : 0);
}

/** Racer: Rare Finds. Multiplier on the Rare, Epic and Legendary arrival weights. */
export function rarePerk(state: WithLegacy): number {
  return hasNode(state, 'rareFinds') ? T.rareFindsMult : 1;
}

/** Racer: Barn Scout. Seconds to the next barn find. */
export function barnFindSeconds(state: WithLegacy): number {
  return ECON.barn.nextFindSeconds / (hasNode(state, 'barnScout') ? T.barnScoutFind : 1);
}

/** Racer: Barn Scout. Seconds a restoration stage takes. */
export function barnStageSeconds(state: WithLegacy, stage: number): number {
  const st = ECON.barn.stages[stage];
  if (!st) return 0;
  return st.seconds * (hasNode(state, 'barnScout') ? 1 - T.barnScoutStage : 1);
}

/** Racer: Night Shift. The offline earnings cap, seconds. */
export function offlineCap(state: WithLegacy): number {
  return ECON.offline.capSeconds + (hasNode(state, 'nightShift') ? T.nightShiftSeconds : 0);
}
