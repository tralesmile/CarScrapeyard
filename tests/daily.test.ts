// Daily tasks and the 7-day login calendar (P1.5a).
import { describe, expect, it } from 'vitest';
import { ECON } from '../src/core/config';
import {
  availableKinds,
  calendarIndex,
  calendarReward,
  canClaimBonus,
  canClaimCalendar,
  carsWorth,
  claimBonus,
  claimCalendar,
  claimTask,
  dailyHasClaim,
  dailyUnlocked,
  gameDay,
  msToReset,
  newDaily,
  refreshDaily,
  rollKinds,
  sanitizeDaily,
  trackDaily,
  DAILY_KINDS,
} from '../src/core/daily';
import { sellEmpire } from '../src/core/legacy';
import { deserialize, serialize } from '../src/core/save';
import { tick } from '../src/core/sim';
import { newGame, type GameState } from '../src/core/state';

const D = ECON.daily;
// 2027-01-15 12:00 UTC.
const NOON = Date.UTC(2027, 0, 15, 12);
const HOUR = 3_600_000;

function open(seed = 1, now = NOON): GameState {
  const s = newGame(now, seed);
  s.carsSold = D.unlockCarsSold;
  refreshDaily(s, now);
  return s;
}

describe('game day', () => {
  it('turns over at the fixed UTC hour, not at midnight', () => {
    const reset = Date.UTC(2027, 0, 15, D.resetHourUtc);
    expect(gameDay(reset - 1)).toBe(gameDay(reset) - 1);
    expect(gameDay(reset)).toBe(gameDay(reset + 23 * HOUR + 59 * 60_000));
    expect(gameDay(Date.UTC(2027, 0, 15, 0))).toBe(gameDay(reset) - 1);
    expect(msToReset(reset)).toBe(24 * HOUR);
    expect(msToReset(reset - 1000)).toBe(1000);
  });
});

describe('daily tasks', () => {
  it('stay hidden until the unlock, then roll three tasks for the day', () => {
    const s = newGame(NOON, 1);
    expect(dailyUnlocked(s)).toBe(false);
    expect(refreshDaily(s, NOON)).toBe(false);
    expect(s.daily.tasks).toEqual([]);
    s.carsSold = D.unlockCarsSold;
    expect(refreshDaily(s, NOON)).toBe(true);
    expect(s.daily.day).toBe(gameDay(NOON));
    expect(s.daily.tasks.length).toBe(D.tasksPerDay);
    expect(new Set(s.daily.tasks.map((t) => t.kind)).size).toBe(D.tasksPerDay);
    expect(refreshDaily(s, NOON + HOUR)).toBe(false);
  });

  it('only roll kinds whose feature is open, and the picks do not touch the game RNG', () => {
    const s = open();
    const kinds = availableKinds(s);
    expect(kinds).toContain('sell');
    expect(kinds).not.toContain('garage');
    for (const t of s.daily.tasks) expect(kinds).toContain(t.kind);
    const t = newGame(NOON, 1);
    t.carsSold = D.unlockCarsSold;
    const rng = t.rng;
    refreshDaily(t, NOON);
    expect(t.rng).toBe(rng);
    s.businesses.opened.garage = true;
    expect(availableKinds(s)).toContain('garage');
  });

  it('picks vary from day to day and are the same for the same day', () => {
    const all = [...DAILY_KINDS];
    const seen = new Set<string>();
    for (let d = 20_000; d < 20_030; d++) {
      const k = rollKinds(all, d);
      expect(k).toEqual(rollKinds(all, d));
      expect(k.length).toBe(3);
      seen.add(k.join());
    }
    expect(seen.size).toBeGreaterThan(10);
    expect(rollKinds(['sell'], 1)).toEqual(['sell']);
  });

  it('progress follows counters, caps at the target, and survives a counter reset', () => {
    const s = open();
    s.daily.tasks = [{ kind: 'sell', target: 5, progress: 0, last: s.carsSold, claimed: false }];
    s.carsSold += 3;
    trackDaily(s);
    expect(s.daily.tasks[0]!.progress).toBe(3);
    s.carsSold = 0; // Sell Empire
    trackDaily(s);
    expect(s.daily.tasks[0]!.progress).toBe(3);
    s.carsSold = 10;
    trackDaily(s);
    expect(s.daily.tasks[0]!.progress).toBe(5);
  });

  it('tick tracks progress', () => {
    const s = open();
    s.daily.tasks = [{ kind: 'crush', target: 3, progress: 0, last: s.stats.carsCrushed, claimed: false }];
    s.stats.carsCrushed += 2;
    tick(s, 0.1);
    expect(s.daily.tasks[0]!.progress).toBe(2);
  });

  it('claims pay once, and all three claimed add the bonus', () => {
    const s = open();
    expect(dailyHasClaim(s)).toBe(true); // the calendar
    claimCalendar(s);
    expect(dailyHasClaim(s)).toBe(false);
    const cash = s.cash;
    expect(claimTask(s, 0)).toBeNull();
    for (const t of s.daily.tasks) t.progress = t.target;
    expect(dailyHasClaim(s)).toBe(true);
    const r = claimTask(s, 0)!;
    expect(r.cash).toBe(carsWorth(s, D.tasks[s.daily.tasks[0]!.kind].rewardCars));
    expect(s.cash).toBe(cash + r.cash);
    expect(claimTask(s, 0)).toBeNull();
    expect(canClaimBonus(s)).toBe(false);
    claimTask(s, 1);
    claimTask(s, 2);
    expect(canClaimBonus(s)).toBe(true);
    const before = s.lifetimeEarnings;
    const b = claimBonus(s)!;
    expect(b.cash).toBe(carsWorth(s, D.allDoneBonusCars));
    expect(s.lifetimeEarnings).toBe(before + b.cash);
    expect(claimBonus(s)).toBeNull();
    expect(dailyHasClaim(s)).toBe(false);
  });

  it('a new day replaces unfinished tasks', () => {
    const s = open();
    s.daily.tasks[0]!.progress = 1;
    s.lastSeen = NOON;
    expect(refreshDaily(s, NOON + 24 * HOUR)).toBe(true);
    expect(s.daily.tasks.every((t) => t.progress === 0 && !t.claimed)).toBe(true);
    expect(s.daily.bonusClaimed).toBe(false);
  });

  it('rewards grow with the game: worth more cars later and in Motor City', () => {
    const s = open();
    const early = carsWorth(s, 10);
    s.carsSold = 300;
    s.levels.quality = 40;
    expect(carsWorth(s, 10)).toBeGreaterThan(early * 5);
    const big = carsWorth(s, 10);
    s.legacy.city = 'motorCity';
    expect(carsWorth(s, 10)).toBeGreaterThan(big * 2);
  });
});

describe('login calendar', () => {
  it('one claim per game day, seven steps, a gift car on day 7, then it starts again', () => {
    const s = open();
    let now = NOON;
    for (let i = 0; i < 7; i++) {
      expect(calendarIndex(s)).toBe(i);
      expect(canClaimCalendar(s)).toBe(true);
      const r = claimCalendar(s)!;
      expect(r.gift).toBe(i === 6);
      expect(canClaimCalendar(s)).toBe(false);
      expect(claimCalendar(s)).toBeNull();
      now += 24 * HOUR;
      s.lastSeen = now;
      refreshDaily(s, now);
    }
    expect(s.daily.giftCars).toBe(1);
    expect(calendarIndex(s)).toBe(0);
    expect(calendarReward(s).cash).toBeGreaterThan(0);
  });

  it('a missed day does not reset the calendar', () => {
    const s = open();
    claimCalendar(s);
    s.lastSeen = NOON + 5 * 24 * HOUR;
    refreshDaily(s, s.lastSeen);
    expect(calendarIndex(s)).toBe(1);
    expect(canClaimCalendar(s)).toBe(true);
  });

  it('winding the clock back gives no extra day', () => {
    const s = open();
    claimCalendar(s);
    s.lastSeen = NOON;
    expect(refreshDaily(s, NOON - 3 * 24 * HOUR)).toBe(false);
    expect(canClaimCalendar(s)).toBe(false);
  });

  it('the gift car takes the next arrival as an Epic', () => {
    const s = open();
    s.daily.giftCars = 1;
    s.cars = [];
    s.arrivalTimer = ECON.arrivalInterval;
    const ev = tick(s, 0.05);
    const gift = ev.find((e) => e.type === 'giftCar');
    expect(gift).toBeDefined();
    expect(s.cars[0]!.rarity).toBe(D.giftRarity);
    expect(s.daily.giftCars).toBe(0);
  });
});

describe('daily state across saves and sales', () => {
  it('is kept when the empire is sold, and progress is not lost', () => {
    const s = open();
    claimCalendar(s);
    s.daily.tasks[0]!.progress = 2;
    s.lifetimeEarnings = 1e10;
    expect(sellEmpire(s, NOON + 1000)).not.toBeNull();
    expect(s.daily.claims).toBe(1);
    expect(s.daily.tasks[0]!.progress).toBe(2);
    trackDaily(s);
    expect(s.daily.tasks[0]!.progress).toBe(2);
    expect(dailyUnlocked(s)).toBe(true);
  });

  it('round-trips, old saves start fresh, junk is repaired', () => {
    const s = open();
    claimCalendar(s);
    const back = deserialize(serialize(s, NOON), NOON)!.state;
    expect(back.daily).toEqual(s.daily);
    const d = { ...newDaily(), day: 5, claims: -3, claimedDay: 99, giftCars: 1e9, bonusClaimed: 'yes' as unknown as boolean };
    d.tasks = [
      { kind: 'sell', target: 1, progress: 1e9, last: -5, claimed: false },
      { kind: 'sell', target: 1, progress: 0, last: 0, claimed: false },
      { kind: 'nope' as never, target: 1, progress: 0, last: 0, claimed: false },
    ];
    sanitizeDaily(d);
    expect(d.claims).toBe(0);
    expect(d.claimedDay).toBe(5);
    expect(d.giftCars).toBe(7);
    expect(d.bonusClaimed).toBe(false);
    expect(d.tasks).toEqual([{ kind: 'sell', target: D.tasks.sell.target, progress: D.tasks.sell.target, last: 0, claimed: false }]);
  });
});

describe('daily texts (P1.5b)', () => {
  it('labels, reset countdown and calendar cells', async () => {
    const { calendarCells, resetText, taskLabel } = await import('../src/ui/dailyView');
    expect(taskLabel('sell', 40)).toBe('💰 Sell 40 cars');
    expect(taskLabel('contract', 1)).toBe('📋 Finish 1 job');
    expect(resetText(5 * HOUR + 12 * 60_000 + 5000)).toMatch(/^New tasks in 5h 1[23]m$/);
    expect(resetText(30_000)).toBe('New tasks in 1m');
    expect(resetText(12 * 60_000)).toBe('New tasks in 12m');
    const s = open();
    let cells = calendarCells(s);
    expect(cells.map((c) => c.state)).toEqual(['today', 'later', 'later', 'later', 'later', 'later', 'later']);
    expect(cells[6]!.gift).toBe(true);
    claimCalendar(s);
    cells = calendarCells(s);
    expect(cells.map((c) => c.state).slice(0, 2)).toEqual(['claimed', 'next']);
  });
});

describe('dailies outside the scrapyard (P1.5d)', () => {
  it('the welcome-back popup lists what waits: calendar, finished tasks, bonus and medals', async () => {
    const { waitingLines, taskDoneToast } = await import('../src/ui/dailyView');
    const locked = newGame(NOON, 1);
    expect(waitingLines(locked)).toEqual([]);
    const s = open();
    expect(waitingLines(s)).toEqual(["📅 Daily: today's reward on the scrapyard's Jobs board"]);
    claimCalendar(s);
    expect(waitingLines(s)).toEqual([]);
    s.daily.tasks[0]!.progress = s.daily.tasks[0]!.target;
    s.daily.tasks[1]!.progress = s.daily.tasks[1]!.target;
    expect(waitingLines(s)[0]).toBe("📅 Daily: 2 finished tasks on the scrapyard's Jobs board");
    for (const t of s.daily.tasks) t.progress = t.target;
    claimTask(s, 0);
    claimTask(s, 1);
    claimTask(s, 2);
    expect(waitingLines(s)[0]).toBe("📅 Daily: the all-done bonus on the scrapyard's Jobs board");
    claimBonus(s);
    s.stats.carsCrushed = 10;
    expect(waitingLines(s)).toEqual(['🏅 1 medal to claim in the 📒 book']);
    expect(taskDoneToast('garage', 25)).toBe("📅 Daily task done: 🔧 Fix 25 cars in the garage. Claim it on the scrapyard's Jobs board");
  });
});
