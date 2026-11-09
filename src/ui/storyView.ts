// Story scenes (P1.6): the words of chapters 1 and 2, the small view model the modal is built from. Strings stay here
// (short, one place) so they move into a translation file with P1.9.

import { CHAPTERS, storySeen, type ChapterId, type StoryBeatId } from '../core/story';
import { cityInfo } from '../core/cities';
import type { GameState } from '../core/state';

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
  vinceCity: {
    title: 'Welcome to Motor City',
    lines: [
      { who: 'vince', text: 'Well, well. The kid from the junkyard. Welcome to MY city.' },
      { who: 'vince', text: 'See the gold tower by the harbour? Valvano Motors HQ. Forty floors of cars.' },
      { who: 'joe', text: 'Bigger city, same game. Wash them, fix them, sell them. We start again from a yard.' },
    ],
    button: "Let's go",
  },
  vinceMidtown: {
    title: 'Midtown Garage',
    lines: [
      { who: 'vince', text: 'A garage in Midtown? My mechanics fix half the cars in this city.' },
      { who: 'joe', text: 'Half the city, and a lot of them unhappy. Treat every customer right, kid.' },
    ],
    button: 'Open the doors',
  },
  vinceMall: {
    title: 'The Auto Mall',
    lines: [
      { who: 'vince', text: 'The Auto Mall auctions are my turf. I buy the best lots before breakfast.' },
      { who: 'joe', text: 'Then we get up earlier. Lots you buy are yours, whatever he says.' },
    ],
    button: 'Bring it on',
  },
  vinceNeon: {
    title: 'Neon Customs',
    lines: [
      { who: 'vince', text: 'My own nephew wants his car painted at YOUR shop. Do you know how that makes me look?' },
      { who: 'joe', text: 'Like a man who should have opened a paint shop. Ha!' },
    ],
    button: 'Ha!',
  },
  chapter2End: {
    title: 'Motor City Is Yours',
    lines: [
      { who: 'vince', text: "Alright, kid. You win. Nobody in Motor City buys from Valvano anymore." },
      { who: 'vince', text: "I'm selling the tower. There's always another city, and I'll get there first." },
      { who: 'joe', text: "Forty years I waited to see that. Sell up when you're ready, kid. We'll follow him." },
    ],
    button: 'On to the map',
    footer: '📖 Chapter 2 complete: Motor City',
  },
};

/** Chapter titles for the story log. */
export const CHAPTER_TITLES: Record<ChapterId, string> = { 1: 'The Rival', 2: 'The Big City' };

export interface StoryLogChapter {
  id: ChapterId;
  title: string;
  city: string;
  have: number;
  of: number;
  /** Seen scenes can be read again; unseen ones show as a locked row. */
  beats: { id: StoryBeatId; title: string; seen: boolean }[];
}

/**
 * The story log (P1.6c): every chapter that has started, its scenes in order. A chapter with no scene seen yet is
 * shown only as a teaser line (`next`), so the log never spoils it.
 */
export function storyLog(state: Pick<GameState, 'story'>): { chapters: StoryLogChapter[]; next: string | null; have: number; of: number } {
  const chapters: StoryLogChapter[] = [];
  let next: string | null = null;
  let have = 0;
  let of = 0;
  for (const c of CHAPTERS) {
    const beats = c.beats.map((id) => ({ id, title: STORY_SCENES[id].title, seen: storySeen(state, id) }));
    const n = beats.filter((b) => b.seen).length;
    have += n;
    of += beats.length;
    if (n > 0) chapters.push({ id: c.id, title: CHAPTER_TITLES[c.id], city: cityInfo(c.city).name, have: n, of: beats.length, beats });
    else if (next === null) next = `Chapter ${c.id} starts in ${cityInfo(c.city).name}`;
  }
  return { chapters, next, have, of };
}

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
