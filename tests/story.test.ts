import { describe, expect, it } from 'vitest';
import { ECON } from '../src/core/config';
import { tickCarLot } from '../src/core/carlot';
import { tickBuyers } from '../src/core/buyers';
import { earningsForTotalPoints, sellEmpire } from '../src/core/legacy';
import { checksum, deserialize, serialize } from '../src/core/save';
import { newGame, type GameState } from '../src/core/state';
import { CHAPTER_1, CHAPTER_2, STORY_BEATS, beatReady, chapterOf, rivalHqShown, chapterDone, dueBeat, markBeatSeen, noteBuyerLost, noteLotLost, sanitizeStory, vinceMet } from '../src/core/story';
import { storyScene, rivalToast, rivalToastDue, storyLog } from '../src/ui/storyView';
import { cityMapSvg, rivalRow } from '../src/ui/cityMap';

const T0 = 1_800_000_000_000;

function game(): GameState {
  const s = newGame(T0, 21);
  s.stats.playSeconds = 100;
  return s;
}

/** Show the due beat and move the clock past the gap. */
function show(s: GameState): string | null {
  const id = dueBeat(s);
  if (id) markBeatSeen(s, id);
  s.stats.playSeconds += ECON.story.gapSeconds;
  return id;
}

describe('story chapter 1 (P1.6)', () => {
  it('a new game has no scene due; Vince visits after the first sales', () => {
    const s = game();
    expect(dueBeat(s)).toBeNull();
    s.carsSold = ECON.story.vinceVisitSales - 1;
    expect(dueBeat(s)).toBeNull();
    s.carsSold = ECON.story.vinceVisitSales;
    expect(dueBeat(s)).toBe('vinceVisit');
    markBeatSeen(s, 'vinceVisit');
    expect(vinceMet(s)).toBe(true);
    expect(dueBeat(s)).toBeNull();
  });

  it('plays the beats in story order, one at a time, with a gap of play time between them', () => {
    const s = game();
    s.carsSold = 500;
    s.businesses.opened.garage = true;
    s.businesses.opened.carlot = true;
    s.businesses.opened.paint = true;
    s.story.lotsLost = 1;
    s.lifetimeEarnings = earningsForTotalPoints(ECON.legacy.minPoints);
    expect(dueBeat(s)).toBe('vinceVisit');
    markBeatSeen(s, 'vinceVisit');
    s.stats.playSeconds += ECON.story.gapSeconds - 1;
    expect(dueBeat(s)).toBeNull();
    s.stats.playSeconds += 1;
    const order = ['joeGarage', 'vinceAuction', 'vincePaint', 'chapter1End'];
    expect([show(s), show(s), show(s), show(s), show(s)]).toEqual([...order, null]);
    expect(s.story.seen).toEqual(CHAPTER_1);
    expect(chapterDone(s)).toBe(true);
  });

  it('a skipped business does not block the rest of the chapter', () => {
    const s = game();
    s.carsSold = 500;
    markBeatSeen(s, 'vinceVisit');
    s.stats.playSeconds += ECON.story.gapSeconds;
    s.lifetimeEarnings = earningsForTotalPoints(ECON.legacy.minPoints);
    expect(dueBeat(s)).toBe('chapter1End');
  });

  it('Vince takes the first lot let go once he is in the story, then every third by id', () => {
    const s = game();
    expect(noteLotLost(s, 7)).toBe(false); // before Vince visits: not his
    markBeatSeen(s, 'vinceVisit');
    const s2 = game();
    markBeatSeen(s2, 'vinceVisit');
    expect(noteLotLost(s2, 7)).toBe(true); // the first one is his
    expect(noteLotLost(s2, 8)).toBe(false);
    expect(noteLotLost(s2, 9)).toBe(true);
    expect(s2.story.lotsLost).toBe(3);
    expect(s2.story.rivalWins).toBe(2);
    expect(beatReady(s2, 'vinceAuction')).toBe(false); // the lot is not open
    s2.businesses.opened.carlot = true;
    expect(beatReady(s2, 'vinceAuction')).toBe(true);
  });

  it('the auction board and the yard customers report Vince on their events, without touching the RNG', () => {
    const s = game();
    markBeatSeen(s, 'vinceVisit');
    s.businesses.opened.carlot = true;
    for (let i = 0; i < 100 && s.carlot.board.some((b) => !b); i++) tickCarLot(s, 0.1, []);
    const rng = s.rng;
    const events: { type: string; rival?: boolean }[] = [];
    tickCarLot(s, ECON.carlot.lotSeconds + 0.1, events);
    const lost = events.filter((e) => e.type === 'lotExpired');
    expect(lost.length).toBeGreaterThan(0);
    expect(lost[0]!.rival).toBe(true);
    expect(s.story.lotsLost).toBe(lost.length);

    const y = game();
    markBeatSeen(y, 'vinceVisit');
    y.carsSold = 200;
    y.buyer = { kind: 'bargain', timeLeft: 0.05 };
    const ev: { type: string; rival?: boolean }[] = [];
    y.story.buyersLost = ECON.story.rivalEvery - 1;
    tickBuyers(y, 0.1, ev);
    expect(ev).toEqual([{ type: 'buyerLeft', kind: 'bargain', rival: true }]);
    expect(noteBuyerLost(y)).toBe(false);
    expect(s.rng).toBe(rng);
  });

  it('chapter 1 plays in Rust Valley only', () => {
    const s = game();
    s.carsSold = 100;
    s.legacy.city = 'motorCity';
    expect(CHAPTER_1.some((id) => beatReady(s, id))).toBe(false);
    expect(dueBeat(s)).toBe('vinceCity'); // chapter 2 instead
  });

  it('is kept on a Sell Empire, so no scene repeats in a later empire', () => {
    const s = game();
    s.carsSold = 100;
    markBeatSeen(s, 'vinceVisit');
    s.story.rivalWins = 4;
    s.lifetimeEarnings = earningsForTotalPoints(ECON.legacy.minPoints);
    expect(sellEmpire(s, T0 + 1000, 'rustValley')).not.toBeNull();
    expect(s.carsSold).toBe(0);
    expect(s.story.seen).toEqual(['vinceVisit']);
    expect(s.story.rivalWins).toBe(4);
    s.carsSold = 100;
    expect(dueBeat(s)).toBeNull();
  });

  it('saves and loads, old saves start with an empty story, and junk is repaired', () => {
    const s = game();
    markBeatSeen(s, 'vinceVisit');
    s.story.lotsLost = 4;
    const back = deserialize(serialize(s, T0), T0)!.state;
    expect(back.story).toEqual(s.story);
    const st = { seen: ['vinceVisit', 'nope', 'vinceVisit', 3] as never[], lastAt: NaN, lotsLost: -2, buyersLost: 2.7, rivalWins: Infinity };
    sanitizeStory(st);
    expect(st).toEqual({ seen: ['vinceVisit'], lastAt: -1, lotsLost: 0, buyersLost: 2, rivalWins: 0 });
    const old = JSON.parse(JSON.stringify(s)) as Record<string, unknown>;
    delete old.story;
    const data = JSON.stringify(old);
    const env = JSON.parse(serialize(s, T0)) as { data: string; sum: string };
    const oldBack = deserialize(JSON.stringify({ ...env, data, sum: checksum(data) }), T0)!.state;
    expect(oldBack.story).toEqual({ seen: [], lastAt: -1, lotsLost: 0, buyersLost: 0, rivalWins: 0 });
  });

  it('every beat has a scene with lines and a button; Vince toasts stay rare', () => {
    for (const id of STORY_BEATS) {
      const sc = storyScene(id);
      expect(sc.lines.length).toBeGreaterThan(0);
      expect(sc.lines.length).toBeLessThanOrEqual(3);
      expect(sc.button.length).toBeGreaterThan(0);
      for (const l of sc.lines) expect(l.text.length).toBeLessThan(130);
    }
    expect([1, 2, 3, 4, 9, 10, 11, 20].map(rivalToastDue)).toEqual([true, true, true, false, false, true, false, true]);
    expect(rivalToastDue(0)).toBe(false);
    expect(rivalToast('lot', 1)).not.toContain('(');
    expect(rivalToast('buyer', 3)).toContain('(Vince: 3)');
  });
});

/** A fresh empire in Motor City (sold twice before). */
function motorCity(): GameState {
  const s = game();
  s.legacy.sold = 2;
  s.legacy.city = 'motorCity';
  return s;
}

describe('story chapter 2, Motor City (P1.6b)', () => {
  it('Vince greets you after the first sales in Motor City, then the businesses follow in order', () => {
    const s = motorCity();
    s.carsSold = ECON.story.cityArrivalSales - 1;
    expect(dueBeat(s)).toBeNull();
    s.carsSold = ECON.story.cityArrivalSales;
    s.businesses.opened.garage = true;
    s.businesses.opened.carlot = true;
    s.businesses.opened.paint = true;
    s.lifetimeEarnings = earningsForTotalPoints(ECON.legacy.minPoints);
    expect(beatReady(s, 'vinceMidtown')).toBe(false); // not before Vince's welcome
    expect([show(s), show(s), show(s), show(s), show(s), show(s)]).toEqual([...CHAPTER_2, null]);
    expect(chapterDone(s, 2)).toBe(true);
    expect(chapterDone(s, 1)).toBe(false);
    expect(CHAPTER_2.every((id) => chapterOf(id) === 2) && CHAPTER_1.every((id) => chapterOf(id) === 1)).toBe(true);
  });

  it('does not need chapter 1 (an old save may already be in Motor City) and never plays in Rust Valley', () => {
    const s = motorCity();
    s.carsSold = 50;
    expect(dueBeat(s)).toBe('vinceCity');
    markBeatSeen(s, 'vinceCity');
    expect(vinceMet(s)).toBe(true); // Vince now takes lots here too
    const r = game();
    r.carsSold = 50;
    markBeatSeen(r, 'vinceVisit');
    r.stats.playSeconds += ECON.story.gapSeconds;
    r.businesses.opened.garage = true;
    expect(CHAPTER_2.some((id) => beatReady(r, id))).toBe(false);
  });

  it('a skipped business does not block the end of chapter 2', () => {
    const s = motorCity();
    s.carsSold = 50;
    markBeatSeen(s, 'vinceCity');
    s.stats.playSeconds += ECON.story.gapSeconds;
    s.lifetimeEarnings = earningsForTotalPoints(ECON.legacy.minPoints);
    expect(dueBeat(s)).toBe('chapter2End');
  });

  it("Vince's HQ is on the Motor City map once he has greeted you, with a line in the list", () => {
    const s = motorCity();
    expect(rivalHqShown(s)).toBe(false);
    expect(cityMapSvg(s)).not.toContain('rival-hq');
    expect(rivalRow(s)).toBeNull();
    markBeatSeen(s, 'vinceCity');
    expect(rivalHqShown(s)).toBe(true);
    const svg = cityMapSvg(s);
    expect(svg).toContain('class="rival-hq"');
    expect((svg.match(/class="roof"/g) ?? []).length).toBe(9); // the HQ takes one rooftop's place
    expect(rivalRow(s)!.line).toMatch(/rival/);
    s.story.rivalWins = 1;
    expect(rivalRow(s)!.line).toMatch(/beaten you 1 time$/);
    s.story.rivalWins = 5;
    expect(rivalRow(s)!.line).toMatch(/5 times/);
    markBeatSeen(s, 'chapter2End');
    expect(rivalRow(s)!.line).toMatch(/for sale/i);
    s.legacy.city = 'rustValley';
    expect(rivalHqShown(s)).toBe(false);
    expect(cityMapSvg(s)).not.toContain('rival-hq');
  });

  it('old saves with only chapter 1 beats keep them; chapter 2 beats survive save repair', () => {
    const st = { seen: ['vinceVisit', 'vinceCity', 'chapter2End', 'vinceCity'] as never[], lastAt: 5, lotsLost: 0, buyersLost: 0, rivalWins: 0 };
    sanitizeStory(st);
    expect(st.seen).toEqual(['vinceVisit', 'vinceCity', 'chapter2End']);
  });
});

describe('story log (P1.6c)', () => {
  it('lists started chapters with their scenes, hides unseen titles, and teases the next chapter', () => {
    const s = game();
    let log = storyLog(s);
    expect(log.chapters).toEqual([]);
    expect(log.have).toBe(0);
    expect(log.of).toBe(STORY_BEATS.length);
    expect(log.next).toBe('Chapter 1 starts in Rust Valley');
    markBeatSeen(s, 'vinceVisit');
    markBeatSeen(s, 'vincePaint');
    log = storyLog(s);
    expect(log.chapters.length).toBe(1);
    const c1 = log.chapters[0]!;
    expect(c1).toMatchObject({ id: 1, city: 'Rust Valley', have: 2, of: 5 });
    expect(c1.beats.map((b) => b.seen)).toEqual([true, false, false, true, false]);
    expect(c1.beats[0]!.title).toBe(storyScene('vinceVisit').title);
    expect(log.next).toBe('Chapter 2 starts in Motor City');
    markBeatSeen(s, 'vinceCity');
    log = storyLog(s);
    expect(log.chapters.map((c) => c.id)).toEqual([1, 2]);
    expect(log.next).toBeNull();
    expect(log.have).toBe(3);
  });
});
