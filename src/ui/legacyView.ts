// Sell Empire UI text (P1.3b) and the Legacy tree screen (P1.3c): what the map row, the preview, the HUD badge and the
// tree say. Pure (no DOM) so it is unit-tested.

import { canSellEmpire, legacyMultiplier, nextLegacyMultiplier, pendingLegacyPoints, sellEmpireGlows, earningsForPoints } from '../core/legacy';
import { ECON, type CityId, type LegacyBranch, type LegacyNode } from '../core/config';
import { LEGACY_BRANCHES, canBuyNode, canRespec, freePoints, hasNode, nodeCost, nodeStatus, spentPoints, type NodeStatus } from '../core/legacyTree';
import { formatCash, formatDuration } from '../core/format';
import { citiesForNextEmpire, cityInfo, defaultNextCity, nextCityToUnlock } from '../core/cities';
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

/** One city the next empire can be built in (P1.3d). */
export interface CityChoice {
  id: CityId;
  name: string;
  icon: string;
  /** "Prices and payouts x10" (or the tagline for scale 1). */
  line: string;
  /** Picked by default (the biggest open city). */
  picked: boolean;
  /** The current empire's city. */
  current: boolean;
}

export interface SellEmpirePreview {
  points: number;
  /** Cities to pick from; empty when only one is open (no picker). */
  cities: CityChoice[];
  /** "Motor City opens on your 2nd sale" while a city is still ahead; null otherwise. */
  cityTeaser: string | null;
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
    cities: cityChoices(state),
    cityTeaser: cityTeaser(state),
    multNow: formatMult(legacyMultiplier(state)),
    multNext: formatMult(nextLegacyMultiplier(state)),
    earned: formatCash(state.lifetimeEarnings + Math.max(0, state.pendingOffline)),
    runTime: formatDuration(state.legacy.runSeconds),
    keeps: ['Legacy Points', 'Collection book', 'Stats and settings'],
    resets: ['Cash, upgrades and crew', 'Every business and car', 'Parts, jobs and the barn'],
  };
}

const ordinal = (n: number) => `${n}${n % 10 === 1 && n % 100 !== 11 ? 'st' : n % 10 === 2 && n % 100 !== 12 ? 'nd' : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th'}`;

/** What a city's scale means, from the config ("Prices and payouts x10"). */
export function cityLine(id: CityId): string {
  const c = cityInfo(id);
  return c.scale === 1 ? c.tagline : `Prices and payouts x${c.scale}`;
}

/** The cities the next empire can be built in, when there is a choice (two or more open on this sale). */
export function cityChoices(state: GameState): CityChoice[] {
  const open = citiesForNextEmpire(state);
  if (open.length < 2) return [];
  const pick = defaultNextCity(state);
  return open.map((id) => ({ id, name: cityInfo(id).name, icon: cityInfo(id).icon, line: cityLine(id), picked: id === pick, current: id === state.legacy.city }));
}

export function cityTeaser(state: GameState): string | null {
  const next = nextCityToUnlock(state);
  return next ? `${cityInfo(next.id).icon} ${cityInfo(next.id).name} opens on your ${ordinal(next.sale)} sale` : null;
}

/** Grandpa Joe's line in the celebration (first sale, then later ones). */
export function grandpaLine(soldBefore: number, city: CityId = 'rustValley', from: CityId = city): string {
  if (city !== from)
    return `"${cityInfo(city).name}! Bigger streets, bigger deals, bigger trouble. Start small again, kid: the scrapyard is how we do it."`;
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

// ---- "What changed" notes (P1.3e) ----

const pct = (f: number) => `${Math.round(f * 100)}%`;

/** Short label of a node's effect, built from the config numbers ("👐 +25% taps"). */
export function perkLabel(node: LegacyNode, scale = 1): string {
  const T = ECON.legacy.tree;
  const icon = T.nodes[node].icon;
  const text: Record<LegacyNode, string> = {
    quickHands: `+${pct(T.quickHandsTap)} taps`,
    headStart: `${formatCash(T.headStartCash * scale)} start`,
    partsHoarder: `+${pct(T.partsHoarderBonus)} parts`,
    masterCrew: `crew +${pct(T.masterCrewSpeed)}`,
    silverTongue: `zone +${pct(T.silverTongueZone)}`,
    regulars: `buyers +${pct(T.regularsRate)}`,
    insider: `auctions −${pct(T.insiderDiscount)}`,
    franchise: `opening −${pct(T.franchiseDiscount)}`,
    quickTips: `tip +${T.quickTipsSeconds}s`,
    rareFinds: `rares x${T.rareFindsMult}`,
    barnScout: `barn x${T.barnScoutFind}`,
    nightShift: `${+((ECON.offline.capSeconds + T.nightShiftSeconds) / 3600).toFixed(1)}h cap`,
  };
  return `${icon} ${text[node]}`;
}

/** Which owned perks change what a panel tab shows (a small chip row above its cards). */
export const TAB_PERKS: Record<string, readonly LegacyNode[]> = {
  upgrades: ['quickHands', 'rareFinds'],
  crew: ['masterCrew'],
  yard: ['partsHoarder', 'barnScout'],
  jobs: [],
  gupgrades: ['quickHands'],
  gcrew: ['masterCrew'],
  auction: ['insider'],
  lupgrades: ['quickHands', 'regulars'],
  lcrew: ['masterCrew'],
  pupgrades: ['quickHands', 'quickTips'],
  pcrew: ['masterCrew'],
};

export interface PerkChip {
  node: LegacyNode;
  label: string;
  /** "Quick Hands (Legacy): +25% tap work in every business" for the tooltip / screen readers. */
  title: string;
}

function chip(node: LegacyNode): PerkChip {
  const n = ECON.legacy.tree.nodes[node];
  return { node, label: perkLabel(node), title: `${n.name} (Legacy): ${n.desc}` };
}

/** The owned perks that apply to a tab, in order. Empty for unknown tabs or when nothing is owned. */
export function tabPerks(state: GameState, tab: string): PerkChip[] {
  return (TAB_PERKS[tab] ?? []).filter((n) => hasNode(state, n)).map(chip);
}

/** One owned perk as a chip, or null (haggle slider, welcome-back popup, map open cost). */
export function perkChip(state: GameState, node: LegacyNode): PerkChip | null {
  return hasNode(state, node) ? chip(node) : null;
}

export interface AwayText {
  /** "Your crew kept working for 2h 0m." (never more than the offline cap) */
  worked: string;
  /** Set when the player was away longer than the cap. */
  capped: string | null;
  /** Night Shift's chip when owned (the welcome-back popup names it). */
  perk: PerkChip | null;
}

/** The welcome-back popup's time lines (P1.3e): the crew works up to the offline cap, Night Shift raises it. */
export function awayText(state: GameState, seconds: number, cap: number): AwayText {
  const worked = Math.min(Math.max(0, seconds), cap);
  return {
    worked: `Your crew kept working for ${formatDuration(worked)}.`,
    capped: seconds > cap + 60 ? `You were away ${formatDuration(seconds)}; crews work up to ${formatDuration(cap)} while you're gone.` : null,
    perk: perkChip(state, 'nightShift'),
  };
}
