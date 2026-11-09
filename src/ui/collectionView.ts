// Collection book texts (P1.4a). The book screen itself is P1.4b; for now: set and mastery announcements.

import { ECON } from '../core/config';
import { SETS, type CollectionSet } from '../core/collection';

type SetRef = { kind: CollectionSet['kind']; id: string };

export function setName(set: SetRef): string {
  if (set.kind === 'family') return `${ECON.families[set.id as keyof typeof ECON.families].name} set`;
  if (set.kind === 'brand') return `${set.id} set`;
  return 'Barn Classics';
}

/** What completing the set gives, e.g. "+5% Sedan value". */
export function setBonusText(set: SetRef): string {
  const C = ECON.collection;
  const pct = (x: number) => `+${Math.round(x * 100)}%`;
  if (set.kind === 'family') return `${pct(C.familySetBonus)} ${ECON.families[set.id as keyof typeof ECON.families].name} value`;
  if (set.kind === 'brand') return `${pct(C.brandSetBonus)} ${set.id} value`;
  return `${pct(C.classicsSetBonus)} barn sale value`;
}

/** Banner for a completed set: title and line. */
export function setCompleteBanner(kind: CollectionSet['kind'], id: string): { title: string; line: string } {
  const set = SETS.find((s) => s.kind === kind && s.id === id) ?? { kind, id };
  return { title: 'SET COMPLETE!', line: `📒 ${setName(set)}: ${setBonusText(set)} forever` };
}

/** Toast for a new mastery star. */
export function masteryToast(model: string, stars: number): string {
  return `${'⭐'.repeat(stars)} ${model} mastery: +${Math.round(stars * ECON.collection.masteryBonus * 100)}% value`;
}
