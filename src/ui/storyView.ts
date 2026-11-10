// Story scenes (P1.6): the words of chapters 1 and 2, the small view model the modal is built from. Strings stay here
// live in the i18n catalog (src/i18n/en.ts, keys `story.*`, P1.9b).

import { CHAPTERS, storySeen, type ChapterId, type StoryBeatId } from '../core/story';
import { cityInfo } from '../core/cities';
import type { GameState } from '../core/state';
import { t, type BaseKey } from '../i18n';

export type Speaker = 'joe' | 'vince';

export function speaker(who: Speaker): { name: string; title: string } {
  return { name: t(`story.speaker.${who}.name` as BaseKey), title: t(`story.speaker.${who}.title` as BaseKey) };
}

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

/** Who speaks each line of a scene, and whether it has a footer; the words live in the i18n catalog (`story.<id>.*`). */
const SCENE_SHAPE: Record<StoryBeatId, { who: Speaker[]; footer?: boolean }> = {
  vinceVisit: { who: ["vince", "vince", "joe"] },
  joeGarage: { who: ["joe", "joe"] },
  vinceAuction: { who: ["vince", "vince", "joe"], footer: true },
  vincePaint: { who: ["vince", "joe"] },
  chapter1End: { who: ["vince", "vince", "joe"], footer: true },
  vinceCity: { who: ["vince", "vince", "joe"] },
  vinceMidtown: { who: ["vince", "joe"] },
  vinceMall: { who: ["vince", "joe"] },
  vinceNeon: { who: ["vince", "joe"] },
  chapter2End: { who: ["vince", "vince", "joe"], footer: true },
};

/** The scene for a beat, in the current language. */
export function storyScene(id: StoryBeatId): StoryScene {
  const shape = SCENE_SHAPE[id];
  const scene: StoryScene = {
    title: t(`story.${id}.title` as BaseKey),
    lines: shape.who.map((who, i) => ({ who, text: t(`story.${id}.${i}` as BaseKey) })),
    button: t(`story.${id}.button` as BaseKey),
  };
  if (shape.footer) scene.footer = t(`story.${id}.footer` as BaseKey);
  return scene;
}

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
    const beats = c.beats.map((id) => ({ id, title: storyScene(id).title, seen: storySeen(state, id) }));
    const n = beats.filter((b) => b.seen).length;
    have += n;
    of += beats.length;
    if (n > 0) chapters.push({ id: c.id, title: t(`story.chapter.${c.id}` as BaseKey), city: cityInfo(c.city).name, have: n, of: beats.length, beats });
    else if (next === null) next = t('story.next', { id: c.id, city: cityInfo(c.city).name });
  }
  return { chapters, next, have, of };
}

/** Toast when Vince takes something (flavour, P1.6). */
export function rivalToast(kind: 'lot' | 'buyer', wins: number): string {
  const tally = wins > 1 ? t('story.rival.tally', { wins }) : '';
  return t(kind === 'lot' ? 'story.rival.lot' : 'story.rival.buyer', { tally });
}

/** Vince's toasts stay rare: his first three wins, then every tenth. */
export function rivalToastDue(wins: number): boolean {
  return wins > 0 && (wins <= 3 || wins % 10 === 0);
}
