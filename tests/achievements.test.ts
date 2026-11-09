// Achievements (P1.5c): lifetime goals with medal tiers, kept across Sell Empire.
import { describe, expect, it } from 'vitest';
import {
  AWARD_IDS,
  MEDAL_COUNT,
  awardReward,
  awardValue,
  awardsToClaim,
  canClaimAward,
  claimAward,
  medalCount,
  newAchievements,
  tiersReached,
  trackAchievements,
} from '../src/core/achievements';
import { ECON } from '../src/core/config';
import { carsWorth } from '../src/core/daily';
import { sellEmpire } from '../src/core/legacy';
import { deserialize, serialize } from '../src/core/save';
import { tick } from '../src/core/sim';
import { newGame } from '../src/core/state';

const A = ECON.achievements;

describe('achievement definitions', () => {
  it('every award has four rising tiers, a name, icon and goal', () => {
    expect(AWARD_IDS.length).toBeGreaterThanOrEqual(12);
    expect(A.medals.length).toBe(MEDAL_COUNT);
    expect(A.medalIcons.length).toBe(MEDAL_COUNT);
    expect(A.rewardCars.length).toBe(MEDAL_COUNT);
    for (const id of AWARD_IDS) {
      const d = A.list[id];
      expect(d.tiers.length, id).toBe(MEDAL_COUNT);
      for (let i = 1; i < d.tiers.length; i++) expect(d.tiers[i]!, id).toBeGreaterThan(d.tiers[i - 1]!);
      expect(d.name.length).toBeGreaterThan(0);
      expect(d.goal.length).toBeGreaterThan(0);
    }
  });

  it('the book award tops out at the full book (48 entries)', () => {
    const s = newGame(0, 1);
    expect(A.list.book.tiers[MEDAL_COUNT - 1]).toBe(Object.keys(s.collection.models).length);
  });

  it('a new game has nothing reached', () => {
    const s = newGame(0, 1);
    expect(awardsToClaim(s)).toEqual([]);
    expect(medalCount(s)).toEqual({ have: 0, of: AWARD_IDS.length * MEDAL_COUNT });
  });
});

describe('reading lifetime numbers', () => {
  it('reads stats, the book, legacy and the calendar directly', () => {
    const s = newGame(0, 1);
    s.collection.sold.sedan = 20;
    s.collection.sold.pickup = 5;
    s.stats.carsCrushed = 11;
    s.stats.perfectHaggles = 4;
    s.legacy.allTime = 1000;
    s.lifetimeEarnings = 500;
    s.legacy.sold = 2;
    s.daily.claims = 7;
    expect(awardValue(s, 'sold')).toBe(25);
    expect(awardValue(s, 'crush')).toBe(11);
    expect(awardValue(s, 'haggle')).toBe(4);
    expect(awardValue(s, 'earned')).toBe(1500);
    expect(awardValue(s, 'empire')).toBe(2);
    expect(awardValue(s, 'days')).toBe(7);
    expect(tiersReached(s, 'sold')).toBe(1);
    expect(tiersReached(s, 'days')).toBe(2);
    expect(awardsToClaim(s)).toEqual(['sold', 'crush', 'empire', 'days']);
  });

  it('follows resettable counters by their growth', () => {
    const s = newGame(0, 1);
    s.garage.jobsDone = 30;
    trackAchievements(s);
    expect(awardValue(s, 'garage')).toBe(30);
    s.garage.jobsDone = 55;
    trackAchievements(s);
    expect(awardValue(s, 'garage')).toBe(55);
    // A reset (counter drops) loses nothing; growth after it counts again.
    s.garage.jobsDone = 0;
    trackAchievements(s);
    s.garage.jobsDone = 5;
    trackAchievements(s);
    expect(awardValue(s, 'garage')).toBe(60);
    expect(canClaimAward(s, 'garage')).toBe(true);
  });

  it('tick follows the counters', () => {
    const s = newGame(0, 1);
    s.barn.restored = 2;
    tick(s, 0.1);
    expect(awardValue(s, 'barn')).toBe(2);
  });
});

describe('claiming', () => {
  it('pays each reached tier once, in order, worth N average cars', () => {
    const s = newGame(0, 1);
    s.stats.carsCrushed = 150; // bronze and silver
    const before = s.cash;
    const first = claimAward(s, 'crush')!;
    expect(first.tier).toBe(0);
    expect(first.cash).toBe(carsWorth(s, A.rewardCars[0]!));
    const second = claimAward(s, 'crush')!;
    expect(second.tier).toBe(1);
    expect(second.cash).toBe(awardReward(s, 1));
    expect(second.cash).toBeGreaterThan(first.cash);
    expect(claimAward(s, 'crush')).toBeNull();
    expect(s.cash).toBe(before + first.cash + second.cash);
    expect(s.lifetimeEarnings).toBe(first.cash + second.cash);
    expect(medalCount(s).have).toBe(2);
  });

  it('ignores unknown ids and stops after the last tier', () => {
    const s = newGame(0, 1);
    expect(claimAward(s, 'nope' as never)).toBeNull();
    s.stats.legendaryFound = 10_000;
    for (let i = 0; i < MEDAL_COUNT; i++) expect(claimAward(s, 'legendary')).not.toBeNull();
    expect(claimAward(s, 'legendary')).toBeNull();
    expect(s.achievements.claimed.legendary).toBe(MEDAL_COUNT);
  });

  it('rewards scale with the city and Legacy like other payouts', () => {
    const a = newGame(0, 1);
    const b = newGame(0, 1);
    b.legacy.points = 10;
    expect(awardReward(b, 0)).toBeGreaterThan(awardReward(a, 0));
  });
});

describe('across saves and sales', () => {
  it('keeps totals and medals when the empire is sold, counting the last moments too', () => {
    const s = newGame(0, 1);
    s.garage.jobsDone = 40;
    trackAchievements(s);
    s.garage.jobsDone = 52; // done since the last tick
    s.stats.carsCrushed = 12;
    claimAward(s, 'crush');
    s.lifetimeEarnings = 1e10;
    s.cash = 0;
    expect(sellEmpire(s, 1000)).not.toBeNull();
    expect(s.garage.jobsDone).toBe(0);
    expect(awardValue(s, 'garage')).toBe(52);
    expect(s.achievements.claimed.crush).toBe(1);
    expect(awardValue(s, 'empire')).toBe(1);
    s.garage.jobsDone = 3;
    tick(s, 0.1);
    expect(awardValue(s, 'garage')).toBe(55);
  });

  it('round-trips through a save', () => {
    const s = newGame(0, 1);
    s.carlot.sold = 12;
    trackAchievements(s);
    s.stats.buyersServed = 10;
    claimAward(s, 'buyer');
    const back = deserialize(serialize(s, 0), 0)!.state;
    expect(back.achievements).toEqual(s.achievements);
  });

  it('an old save without achievements backfills from the current empire', () => {
    const s = newGame(0, 1);
    s.paint.jobsDone = 30;
    const raw = JSON.parse(JSON.stringify(s)) as Record<string, unknown>;
    delete raw.achievements;
    const back = deserialize(serialize(raw as unknown as typeof s, 0), 0)!.state;
    expect(back.achievements.claimed).toEqual(newAchievements().claimed);
    tick(back, 0.1);
    expect(awardValue(back, 'paint')).toBe(30);
  });

  it('repairs tampered values', () => {
    const s = newGame(0, 1);
    const a = s.achievements as unknown as { tracked: Record<string, { total: number; last: number }>; claimed: Record<string, number> };
    a.tracked.lot!.total = -5;
    a.tracked.lot!.last = 999; // counter is 0
    a.claimed.sold = 99;
    a.claimed.crush = 1.7;
    a.claimed.bogus = 3;
    const back = deserialize(serialize(s, 0), 0)!.state;
    expect(back.achievements.tracked.lot).toEqual({ total: 0, last: 0 });
    expect(back.achievements.claimed.sold).toBe(MEDAL_COUNT);
    expect(back.achievements.claimed.crush).toBe(1);
    expect('bogus' in back.achievements.claimed).toBe(false);
  });
});

describe('awards page view', () => {
  it('shows medals, progress and the claim text; claimable rows first', async () => {
    const { awardCard, awardsView, medalToast } = await import('../src/ui/awardsView');
    const s = newGame(0, 1);
    s.stats.carsCrushed = 150;
    claimAward(s, 'crush');
    const c = awardCard(s, 'crush');
    expect(c.medals).toEqual(['claimed', 'ready', 'locked', 'locked']);
    expect(c.claimable).toBe(true);
    expect(c.claimText.startsWith('🥈 Claim $')).toBe(true);
    expect(c.line).toBe('Crush cars: 150 / 1,000');
    expect(c.progress).toBeCloseTo(50 / 900);
    const v = awardsView(s);
    expect(v.cards[0]!.id).toBe('crush');
    expect(v.ready).toBe(1);
    expect(v.header).toBe(`1/${AWARD_IDS.length * MEDAL_COUNT} medals`);
    expect(medalToast(s, 'crush')).toBe('🥈 Crusher: Silver medal! Claim it in the 📒 book');
    const e = awardCard(newGame(0, 2), 'earned');
    expect(e.line).toBe('Earn in total: $0 / $100K');
    s.stats.legendaryFound = 500;
    for (let i = 0; i < MEDAL_COUNT; i++) claimAward(s, 'legendary');
    const done = awardCard(s, 'legendary');
    expect(done.complete).toBe(true);
    expect(done.progress).toBe(1);
    expect(done.line).toBe('Find Legendary cars: 500 ✓');
    expect(awardsView(s).cards.at(-1)!.id).toBe('legendary');
  });
});
