// Story scenes (P1.6): the words of chapter 1 and the small view model the modal is built from. Strings stay here
// (short, one place) so they move into a translation file with P1.9.

import type { StoryBeatId } from '../core/story';

export type Speaker = 'joe' | 'vince';

export const SPEAKERS: Record<Speaker, { name: string; title: string }> = {
  joe: { name: 'Grandpa Joe', title: 'Your grandpa' },
  vince: { name: 'Vince Valvano', title: 'Valvano Motors' },
};

export interface StoryLine {
  who: Speaker;
  text: string;
}

export interface StoryScene {
  title: string;
  lines: StoryLine[];
  button: string;
  /** Shown under the lines (e.g. "Chapter 1 complete"). */
  footer?: string;
}

export const STORY_SCENES: Record<StoryBeatId, StoryScene> = {
  vinceVisit: {
    title: 'A Gold Convertible',
    lines: [
      { who: 'vince', text: "Cute pile of rust, kid. I'm Vince Valvano. Valvano Motors sells every car in Rust Valley." },
      { who: 'vince', text: "When you get tired of washing wrecks, I'll take this dump off your hands. One dollar. Generous, right?" },
      { who: 'joe', text: "Don't mind him. Vince has wanted this yard for forty years. Let's show him what it can do." },
    ],
    button: 'Not a chance!',
  },
  joeGarage: {
    title: 'Your First Workshop',
    lines: [
      { who: 'joe', text: 'A real garage! I fixed my first carburettor in a place just like this, with one spanner and a lot of swearing.' },
      { who: 'joe', text: 'Fix their cars right and they come back. That is the whole secret, kid.' },
    ],
    button: 'Open the doors',
  },
  vinceAuction: {
    title: 'Outbid!',
    lines: [
      { who: 'vince', text: 'Sold, to the man in the gold jacket! You blinked, kid.' },
      { who: 'vince', text: 'Every car on this board has my name on it. Bid fast or go home.' },
      { who: 'joe', text: 'He can grab a few. Watch the timers, and hire an agent when you can.' },
    ],
    button: "I'll be faster",
    footer: 'Vince wins some lots you let go. Lots you buy are always yours.',
  },
  vincePaint: {
    title: 'Vince Is Worried',
    lines: [
      { who: 'vince', text: "A paint shop? My customers keep asking about YOUR cars now. This isn't over." },
      { who: 'joe', text: "Ha! I haven't seen Vince sweat since the '78 county fair. Keep going." },
    ],
    button: 'Keep going',
  },
  chapter1End: {
    title: 'Rust Valley Is Yours',
    lines: [
      { who: 'vince', text: "Fine. Rust Valley's too small for me anyway. I'm taking Valvano Motors to Motor City." },
      { who: 'vince', text: 'Big city, big money, big cars. Try to keep up, kid.' },
      { who: 'joe', text: "You did it. A buyer wants the whole empire. Sell it, start over bigger, and let's follow him." },
    ],
    button: 'On to the map',
    footer: '📖 Chapter 1 complete: Rust Valley',
  },
};

/** The scene for a beat. */
export function storyScene(id: StoryBeatId): StoryScene {
  return STORY_SCENES[id];
}

/** Toast when Vince takes something (flavour, P1.6). */
export function rivalToast(kind: 'lot' | 'buyer', wins: number): string {
  const tally = wins > 1 ? ` (Vince: ${wins})` : '';
  return kind === 'lot' ? `😎 Vince Valvano grabbed a lot you let go${tally}` : `😎 Vince lured a customer to his lot${tally}`;
}

/** Vince's toasts stay rare: his first three wins, then every tenth. */
export function rivalToastDue(wins: number): boolean {
  return wins > 0 && (wins <= 3 || wins % 10 === 0);
}
