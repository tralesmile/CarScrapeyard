// Daily tasks and login calendar texts (P1.5b). Pure: no DOM.

import { ECON } from '../core/config';
import { calendarIndex, canClaimCalendar, type DailyKind } from '../core/daily';
import { formatDuration } from '../core/format';
import type { GameState } from '../core/state';

const LABELS: Record<DailyKind, (n: number) => string> = {
  sell: (n) => `Sell ${n} cars`,
  haggle: (n) => `Haggle ${n} sales`,
  buyer: (n) => `Serve ${n} customers`,
  crush: (n) => `Crush ${n} wrecks`,
  contract: (n) => `Finish ${n} job${n === 1 ? '' : 's'}`,
  garage: (n) => `Fix ${n} cars in the garage`,
  lot: (n) => `Sell ${n} lot cars`,
  paint: (n) => `Finish ${n} paint orders`,
};

const ICONS: Record<DailyKind, string> = { sell: '💰', haggle: '🗣️', buyer: '🙋', crush: '🗜️', contract: '📋', garage: '🔧', lot: '🚗', paint: '🎨' };

export function taskLabel(kind: DailyKind, target: number): string {
  return `${ICONS[kind]} ${LABELS[kind](target)}`;
}

/** A wait in whole minutes, rounded up: "5h 12m", "12m" (at least "1m"). */
export function waitText(ms: number): string {
  const min = Math.max(1, Math.ceil(ms / 60_000));
  return min >= 60 ? formatDuration(min * 60) : `${min}m`;
}

/** "New tasks in 5h 12m". */
export function resetText(ms: number): string {
  return `New tasks in ${waitText(ms)}`;
}

export type CalendarCellState = 'claimed' | 'today' | 'next' | 'later';

export interface CalendarCell {
  day: number;
  state: CalendarCellState;
  gift: boolean;
}

/**
 * The seven cells of the calendar: earlier days of this week claimed, today's reward (claimable) or the next one
 * (tomorrow), then the rest.
 */
export function calendarCells(state: GameState): CalendarCell[] {
  const idx = calendarIndex(state);
  const open = canClaimCalendar(state);
  return ECON.daily.calendar.map((c, i) => ({
    day: i + 1,
    gift: 'gift' in c && c.gift === true,
    state: i < idx ? 'claimed' : i === idx ? (open ? 'today' : 'next') : 'later',
  }));
}
