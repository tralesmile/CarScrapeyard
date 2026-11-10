import { describe, expect, it } from 'vitest';
import { Analytics, EVENT_NAMES, MemorySink, SALES_MILESTONES, Tracker, diffEvents, snapshot } from '../src/platform/analytics';
import { newGame } from '../src/core/state';

const T0 = 1_800_000_000_000;

describe('analytics adapter', () => {
  it('sends nothing without consent or without a sink', () => {
    const a = new Analytics();
    const sink = new MemorySink();
    expect(a.track('session_start')).toBe(false);
    a.setSink(sink);
    expect(a.track('session_start')).toBe(false);
    expect(sink.events).toHaveLength(0);
    a.consent = true;
    expect(a.track('session_start', { v: 1 })).toBe(true);
    expect(sink.events).toEqual([{ name: 'session_start', params: { v: 1 } }]);
  });

  it('a throwing sink never breaks the game', () => {
    const a = new Analytics();
    a.consent = true;
    a.setSink({
      send() {
        throw new Error('network down');
      },
    });
    expect(a.track('session_start')).toBe(false);
  });

  it('the memory sink keeps only the latest events', () => {
    const s = new MemorySink(3);
    for (let i = 0; i < 5; i++) s.send('sales_milestone', { i });
    expect(s.events.map((e) => e.params.i)).toEqual([2, 3, 4]);
  });

  it('every event name is unique and snake_case', () => {
    expect(new Set(EVENT_NAMES).size).toBe(EVENT_NAMES.length);
    for (const n of EVENT_NAMES) expect(n).toMatch(/^[a-z]+(_[a-z]+)*$/);
  });
});

describe('milestone events', () => {
  it('reports each sales milestone once, even when a jump crosses several', () => {
    const s = newGame(T0, 1);
    const before = snapshot(s);
    s.carsSold = 30;
    const events = diffEvents(before, snapshot(s));
    expect(events.map((e) => e.params.sales)).toEqual([1, 10, 25]);
    expect(diffEvents(snapshot(s), snapshot(s))).toEqual([]);
    expect(SALES_MILESTONES).toEqual([...SALES_MILESTONES].sort((a, b) => a - b));
  });

  it('reports a newly opened business, a sold empire, a city change and a new car family', () => {
    const s = newGame(T0, 1);
    const before = snapshot(s);
    s.businesses.opened.garage = true;
    s.legacy.sold = 1;
    s.legacy.city = 'motorCity';
    s.collection.sold.van = 1;
    s.tutorial.introSeen = true;
    const names = diffEvents(before, snapshot(s)).map((e) => e.name);
    expect(names).toEqual(['business_opened', 'empire_sold', 'city_changed', 'collection_family', 'tutorial_done']);
  });

  it('the tracker sends events only with consent and re-baselines after a reset', () => {
    const s = newGame(T0, 1);
    const a = new Analytics();
    const sink = new MemorySink();
    a.setSink(sink);
    const t = new Tracker(a, s);
    s.carsSold = 12;
    expect(t.look(s)).toBe(0); // no consent: nothing sent, but the baseline moves on
    a.consent = true;
    s.carsSold = 26;
    expect(t.look(s)).toBe(1);
    expect(sink.events[0]).toEqual({ name: 'sales_milestone', params: { sales: 25 } });
    s.carsSold = 0; // reset progress
    expect(t.look(s)).toBe(0);
    s.carsSold = 1;
    expect(t.look(s)).toBe(1);
  });

  it('event params hold no personal data: only strings, numbers and booleans', () => {
    const s = newGame(T0, 1);
    const before = snapshot(s);
    s.carsSold = 100;
    s.businesses.opened.paint = true;
    for (const e of diffEvents(before, snapshot(s))) {
      for (const v of Object.values(e.params)) expect(['string', 'number', 'boolean']).toContain(typeof v);
    }
  });
});
