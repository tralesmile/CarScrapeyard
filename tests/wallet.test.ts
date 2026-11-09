// Gems and Auction Tokens (P1.7a).
import { describe, expect, it } from 'vitest';
import { awardReward, claimAward } from '../src/core/achievements';
import { ECON } from '../src/core/config';
import { calendarReward, claimBonus, claimCalendar, claimTask, refreshDaily, bonusReward } from '../src/core/daily';
import { sellEmpire } from '../src/core/legacy';
import { deserialize, serialize } from '../src/core/save';
import { newGame, type GameState } from '../src/core/state';
import { addGems, addTokens, medalGems, newWallet, sanitizeWallet, spendGems, spendTokens, walletText } from '../src/core/wallet';

const NOON = Date.UTC(2027, 0, 15, 12);

function open(): GameState {
  const s = newGame(NOON, 1);
  s.carsSold = ECON.daily.unlockCarsSold;
  refreshDaily(s, NOON);
  return s;
}

describe('wallet basics', () => {
  it('a new game has an empty wallet', () => {
    expect(newGame(NOON, 1).wallet).toEqual(newWallet());
  });

  it('adds whole amounts, counts what was earned and caps the balance', () => {
    const s = newGame(NOON, 1);
    expect(addGems(s, 3.9)).toBe(3);
    expect(addGems(s, -5)).toBe(0);
    expect(addGems(s, NaN)).toBe(0);
    expect(s.wallet).toMatchObject({ gems: 3, gemsEarned: 3 });
    s.wallet.gems = ECON.wallet.maxGems - 1;
    expect(addGems(s, 10)).toBe(1);
    expect(addTokens(s, 2)).toBe(2);
    expect(s.wallet.tokensEarned).toBe(2);
  });

  it('spends only what is there and never lowers the earned totals', () => {
    const s = newGame(NOON, 1);
    addGems(s, 5);
    addTokens(s, 2);
    expect(spendGems(s, 6)).toBe(false);
    expect(spendGems(s, 0)).toBe(false);
    expect(spendGems(s, 5)).toBe(true);
    expect(spendTokens(s, 3)).toBe(false);
    expect(spendTokens(s, 2)).toBe(true);
    expect(s.wallet).toEqual({ gems: 0, tokens: 0, gemsEarned: 5, tokensEarned: 2 });
  });

  it('formats the reward text', () => {
    expect(walletText(0, 0)).toBe('');
    expect(walletText(3, 0)).toBe('+3 💎');
    expect(walletText(3, 1)).toBe('+3 💎 · +1 🎟');
  });
});

describe('where gems and tokens come from', () => {
  it('a finished task pays tokens, the all-done bonus gems and tokens', () => {
    const s = open();
    for (const t of s.daily.tasks) t.progress = t.target;
    const r = claimTask(s, 0)!;
    expect(r.tokens).toBe(ECON.wallet.taskTokens);
    expect(s.wallet.tokens).toBe(ECON.wallet.taskTokens);
    claimTask(s, 1);
    claimTask(s, 2);
    const b = claimBonus(s)!;
    expect(b).toEqual(expect.objectContaining({ gems: ECON.wallet.allDoneGems, tokens: ECON.wallet.allDoneTokens }));
    expect(s.wallet.gems).toBe(ECON.wallet.allDoneGems);
    expect(s.wallet.tokens).toBe(3 * ECON.wallet.taskTokens + ECON.wallet.allDoneTokens);
    expect(bonusReward(s).gems).toBe(ECON.wallet.allDoneGems);
  });

  it('the calendar pays the listed gems and tokens, a double claim pays once', () => {
    const s = open();
    const r = calendarReward(s);
    expect(claimCalendar(s)).not.toBeNull();
    expect(claimCalendar(s)).toBeNull();
    expect(s.wallet.gems).toBe(r.gems);
    expect(s.wallet.tokens).toBe(r.tokens);
    expect(ECON.wallet.calendarGems.length).toBe(ECON.daily.calendar.length);
    expect(ECON.wallet.calendarTokens.length).toBe(ECON.daily.calendar.length);
  });

  it('medals pay gems from Silver up, the cash is unchanged', () => {
    expect(ECON.wallet.medalGems.length).toBe(ECON.achievements.medals.length);
    expect(medalGems(0)).toBe(0);
    expect(medalGems(3)).toBe(ECON.wallet.medalGems[3]);
    expect(medalGems(99)).toBe(ECON.wallet.medalGems[3]);
    const s = newGame(NOON, 1);
    s.stats.legendaryFound = 10_000; // all four tiers
    const paid: number[] = [];
    for (let tier = 0; tier < ECON.achievements.medals.length; tier++) {
      const cash = awardReward(s, tier);
      const r = claimAward(s, 'legendary')!;
      expect(r.cash).toBe(cash);
      expect(r.gems).toBe(medalGems(tier));
      paid.push(r.gems);
    }
    expect(paid).toEqual([...ECON.wallet.medalGems]);
    expect(s.wallet.gems).toBe(ECON.wallet.medalGems.reduce<number>((a, b) => a + b, 0));
    expect(s.wallet.gems).toBe(s.wallet.gemsEarned);
  });
});

describe('wallet across saves and sales', () => {
  it('is kept when the empire is sold', () => {
    const s = open();
    addGems(s, 7);
    addTokens(s, 4);
    s.lifetimeEarnings = 1e10;
    expect(sellEmpire(s, NOON + 1000)).not.toBeNull();
    expect(s.wallet).toMatchObject({ gems: 7, tokens: 4, gemsEarned: 7, tokensEarned: 4 });
  });

  it('round-trips, an old save starts empty, junk is repaired', () => {
    const s = newGame(NOON, 1);
    addGems(s, 12);
    addTokens(s, 3);
    expect(deserialize(serialize(s, NOON), NOON)!.state.wallet).toEqual(s.wallet);
    const junk = newGame(NOON, 1);
    junk.wallet = { gems: -4.5, tokens: 1e12, gemsEarned: NaN, tokensEarned: 2 } as unknown as GameState['wallet'];
    sanitizeWallet(junk);
    expect(junk.wallet.gems).toBe(0);
    expect(junk.wallet.tokens).toBe(ECON.wallet.maxTokens);
    expect(junk.wallet.gemsEarned).toBe(0);
    expect(junk.wallet.tokensEarned).toBe(ECON.wallet.maxTokens);
    (junk as unknown as Record<string, unknown>).wallet = undefined;
    sanitizeWallet(junk);
    expect(junk.wallet).toEqual(newWallet());
  });
});
