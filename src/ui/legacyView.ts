// Sell Empire UI text (P1.3b): what the map row, the preview and the HUD badge say. Pure (no DOM) so it is unit-tested.

import { canSellEmpire, legacyMultiplier, nextLegacyMultiplier, pendingLegacyPoints, sellEmpireGlows, earningsForPoints } from '../core/legacy';
import { ECON } from '../core/config';
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
