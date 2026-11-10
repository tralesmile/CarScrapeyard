// Analytics adapter (P1.11). The game reports a small set of named events here; what happens to
// them depends on the build: nothing (default, until accounts exist), a memory log (debug and
// tests), or later Firebase / a portal SDK. Nothing leaves the device without consent, and no
// event carries personal data: only counts, ids of game things and small numbers.

import type { BusinessId, CityId } from '../core/config';
import type { GameState } from '../core/state';

/** The event taxonomy. Adding an event means adding it here, so the list stays reviewable. */
export const EVENT_NAMES = [
  'session_start',
  'sales_milestone',
  'business_opened',
  'empire_sold',
  'city_changed',
  'collection_family',
  'tutorial_done',
] as const;
export type EventName = (typeof EVENT_NAMES)[number];

export type Params = Record<string, string | number | boolean>;

export interface Sink {
  send(name: EventName, params: Params): void;
}

export interface LoggedEvent {
  name: EventName;
  params: Params;
}

/** Keeps the last events in memory: the debug sink and what the browser test reads. */
export class MemorySink implements Sink {
  readonly events: LoggedEvent[] = [];
  constructor(private readonly max = 200) {}
  send(name: EventName, params: Params): void {
    this.events.push({ name, params });
    if (this.events.length > this.max) this.events.shift();
  }
}

export class Analytics {
  /** Off until the player agrees (consent screen arrives with the mobile build, P2.7). */
  consent = false;
  private sink: Sink | null = null;

  setSink(sink: Sink | null): void {
    this.sink = sink;
  }

  track(name: EventName, params: Params = {}): boolean {
    if (!this.consent || !this.sink) return false;
    try {
      this.sink.send(name, params);
    } catch {
      return false; // analytics must never break the game
    }
    return true;
  }
}

/** Sales counts that count as milestones (D1 retention depends on getting past the first ten). */
export const SALES_MILESTONES = [1, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000] as const;

/** What the tracker remembers between looks at the game. */
export interface Snapshot {
  carsSold: number;
  opened: Record<BusinessId, boolean>;
  empiresSold: number;
  city: CityId;
  families: number;
  introSeen: boolean;
}

export function snapshot(state: GameState): Snapshot {
  return {
    carsSold: state.carsSold,
    opened: { ...state.businesses.opened },
    empiresSold: state.legacy.sold,
    city: state.legacy.city,
    families: Object.values(state.collection.sold).filter((n) => n > 0).length,
    introSeen: state.tutorial.introSeen,
  };
}

/** Events for what changed between two looks. Pure, so it is unit-tested. */
export function diffEvents(prev: Snapshot, now: Snapshot): { name: EventName; params: Params }[] {
  const out: { name: EventName; params: Params }[] = [];
  for (const m of SALES_MILESTONES) if (prev.carsSold < m && now.carsSold >= m) out.push({ name: 'sales_milestone', params: { sales: m } });
  for (const id of Object.keys(now.opened) as BusinessId[]) {
    if (now.opened[id] && !prev.opened[id]) out.push({ name: 'business_opened', params: { business: id, sales: now.carsSold } });
  }
  if (now.empiresSold > prev.empiresSold) out.push({ name: 'empire_sold', params: { empires: now.empiresSold, city: now.city } });
  if (now.city !== prev.city) out.push({ name: 'city_changed', params: { city: now.city } });
  if (now.families > prev.families) out.push({ name: 'collection_family', params: { families: now.families } });
  if (now.introSeen && !prev.introSeen) out.push({ name: 'tutorial_done', params: {} });
  return out;
}

/** Watches the game and reports changes. Call `look` now and then (once a second is plenty). */
export class Tracker {
  private last: Snapshot;
  constructor(
    private readonly analytics: Analytics,
    state: GameState,
  ) {
    this.last = snapshot(state);
  }

  look(state: GameState): number {
    const now = snapshot(state);
    // A reset or a reload into a new empire can lower counts: just take the new baseline.
    const events = now.carsSold < this.last.carsSold ? [] : diffEvents(this.last, now);
    this.last = now;
    let sent = 0;
    for (const e of events) if (this.analytics.track(e.name, e.params)) sent++;
    return sent;
  }
}

export const analytics = new Analytics();
