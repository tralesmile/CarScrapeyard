// Daily tasks and login calendar texts (P1.5b). Pure: no DOM.

import { ECON } from '../core/config';
import { calendarIndex, canClaimBonus, canClaimCalendar, dailyUnlocked, taskDone, type DailyKind } from '../core/daily';
import { awardsToClaim } from '../core/achievements';
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

/**
 * What waits to be claimed, for the welcome-back popup (P1.5d): today's calendar reward and finished daily tasks (on
 * the scrapyard's Jobs board) and medals (in the book). Empty when nothing waits.
 */
export function waitingLines(state: GameState): string[] {
  const out: string[] = [];
  if (dailyUnlocked(state)) {
    const ready = state.daily.tasks.filter((t) => !t.claimed && taskDone(t)).length;
    const cal = canClaimCalendar(state);
    const bits = [cal ? "today's reward" : '', ready > 0 ? `${ready} finished task${ready === 1 ? '' : 's'}` : '', canClaimBonus(state) ? 'the all-done bonus' : ''].filter(Boolean);
    if (bits.length) out.push(`📅 Daily: ${bits.join(' and ')} on the scrapyard's Jobs board`);
  }
  const medals = awardsToClaim(state).length;
  if (medals > 0) out.push(`🏅 ${medals} medal${medals === 1 ? '' : 's'} to claim in the 📒 book`);
  return out;
}

/** Toast when a daily task finishes while another business is on screen (P1.5d). */
export function taskDoneToast(kind: DailyKind, target: number): string {
  return `📅 Daily task done: ${taskLabel(kind, target)}. Claim it on the scrapyard's Jobs board`;
}
