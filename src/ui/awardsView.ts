// Achievements page texts (P1.5c). Pure: no DOM.

import { medalGems } from '../core/wallet';
import { AWARD_IDS, MEDAL_COUNT, awardReward, awardValue, canClaimAward, medalCount, tiersReached, type AwardId } from '../core/achievements';
import { ECON } from '../core/config';
import { formatCash, formatNumber } from '../core/format';
import type { GameState } from '../core/state';
import { t } from '../i18n';

export type MedalState = 'claimed' | 'ready' | 'locked';

export interface AwardCard {
  id: AwardId;
  icon: string;
  name: string;
  /** One state per medal tier: claimed, reached but not claimed, or not reached. */
  medals: MedalState[];
  /** "Sell yard cars: 120 / 250", or "Sell yard cars: 25,000 ✓ all medals". */
  line: string;
  /** Progress toward the next tier not reached, 0..1 (1 when every tier is reached). */
  progress: number;
  /** A reached tier waits to be claimed. */
  claimable: boolean;
  /** Claim button text, e.g. "🥈 Claim $1.2K", or "" when nothing to claim. */
  claimText: string;
  /** Every tier claimed. */
  complete: boolean;
}

function amount(id: AwardId, n: number): string {
  if (id === 'earned') return formatCash(n);
  // Counts read best whole: "2,500" rather than "2.50K".
  return n < 1_000_000 ? Math.floor(n).toLocaleString('en-US') : formatNumber(n);
}

export function awardCard(state: GameState, id: AwardId): AwardCard {
  const d = ECON.achievements.list[id];
  const claimed = state.achievements.claimed[id];
  const reached = tiersReached(state, id);
  const value = awardValue(state, id);
  const medals: MedalState[] = d.tiers.map((_, i) => (i < claimed ? 'claimed' : i < reached ? 'ready' : 'locked'));
  const next = d.tiers[reached];
  const prev = reached === 0 ? 0 : d.tiers[reached - 1]!;
  const line =
    next === undefined
      ? t('awards.line.done', { goal: d.goal, value: amount(id, value) })
      : t('awards.line.progress', { goal: d.goal, value: amount(id, value), next: amount(id, next) });
  const claimable = canClaimAward(state, id);
  const tier = Math.min(claimed, MEDAL_COUNT - 1);
  return {
    id,
    icon: d.icon,
    name: d.name,
    medals,
    line,
    progress: next === undefined ? 1 : Math.max(0, Math.min(1, (value - prev) / (next - prev))),
    claimable,
    claimText: claimable
      ? t(medalGems(claimed) ? 'awards.claim.gems' : 'awards.claim', {
          icon: ECON.achievements.medalIcons[tier]!,
          cash: formatCash(awardReward(state, claimed)),
          gems: medalGems(claimed),
        })
      : '',
    complete: claimed >= MEDAL_COUNT,
  };
}

export interface AwardsView {
  header: string;
  /** Medals claimed / all, for the book tab. */
  have: number;
  of: number;
  ready: number;
  cards: AwardCard[];
}

/** Claimable awards first, then the rest in a fixed order; finished ones last. */
export function awardsView(state: GameState): AwardsView {
  const cards = AWARD_IDS.map((id) => awardCard(state, id));
  const rank = (c: AwardCard) => (c.claimable ? 0 : c.complete ? 2 : 1);
  const order = [...cards].sort((a, b) => rank(a) - rank(b) || AWARD_IDS.indexOf(a.id) - AWARD_IDS.indexOf(b.id));
  const m = medalCount(state);
  const ready = cards.filter((c) => c.claimable).length;
  return { header: t('awards.header', { have: m.have, of: m.of }), have: m.have, of: m.of, ready, cards: order };
}

/** Toast when a new medal is reached, e.g. "🥉 Crusher: Bronze medal! Claim it in the 📒 book". */
export function medalToast(state: GameState, id: AwardId): string {
  const tier = Math.max(0, tiersReached(state, id) - 1);
  const d = ECON.achievements.list[id];
  return t('awards.toast', { icon: ECON.achievements.medalIcons[tier]!, name: d.name, medal: ECON.achievements.medals[tier]! });
}
