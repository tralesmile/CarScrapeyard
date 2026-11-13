// Procedural music score (P1.8): pure data and functions, no Web Audio, so it is unit-tested.
// One looping groove per city; every business you open adds a layer, and the business you are
// looking at gets its layer pushed forward. `music.ts` plays the notes this file describes.

import type { BusinessId, CityId } from '../core/config';

export type LayerId = 'bass' | 'beat' | 'pluck' | 'ratchet' | 'pad' | 'lead';
export const LAYER_IDS: readonly LayerId[] = ['bass', 'beat', 'pluck', 'ratchet', 'pad', 'lead'];

/** Which business brings which layer in. The scrapyard owns the base groove. */
export const BUSINESS_LAYERS: Record<BusinessId, LayerId[]> = {
  scrapyard: ['bass', 'beat', 'pluck'],
  garage: ['ratchet'],
  carlot: ['pad'],
  paint: ['lead'],
};

export const STEPS_PER_BAR = 16;
export const BARS_PER_LOOP = 4;

export interface MusicPlan {
  bpm: number;
  /** MIDI note of the key's root, in the bass octave. */
  root: number;
  /** Semitone offset of each bar's chord root from `root`. */
  chords: readonly number[];
  /** Third above the chord root: 4 = major, 3 = minor. */
  third: 3 | 4;
  /** Scale degrees (semitones) the lead may use. */
  scale: readonly number[];
}

const PLANS: Record<CityId, MusicPlan> = {
  rustValley: { bpm: 96, root: 43, chords: [0, 7, 9, 5], third: 4, scale: [0, 2, 4, 7, 9] },
  motorCity: { bpm: 108, root: 38, chords: [0, 8, 3, 10], third: 3, scale: [0, 3, 5, 7, 10] },
};

export function planFor(city: CityId): MusicPlan {
  return PLANS[city] ?? PLANS.rustValley;
}

export interface Note {
  /** MIDI note number. */
  midi: number;
  /** Length in steps. */
  steps: number;
  /** 0..1. */
  vel: number;
  /** Percussion hits are noise bursts (kick is a low sine drop) rather than pitched notes. */
  hit?: 'kick' | 'hat' | 'tick';
}

const BASS_STEPS = [0, 3, 6, 8, 11, 14];
const LEAD_BARS: readonly (readonly (readonly [number, number])[])[] = [
  [[0, 0], [4, 2], [6, 3], [10, 2]],
  [[0, 3], [3, 2], [8, 4], [12, 3]],
  [[0, 4], [4, 3], [8, 2], [11, 0]],
  [[2, 2], [6, 3], [8, 2], [12, 0]],
];

/** Layer volumes (0 = silent). Opened businesses play; the one on screen is louder. */
export function layerGains(opened: Record<BusinessId, boolean>, active: BusinessId): Record<LayerId, number> {
  const out = { bass: 0, beat: 0, pluck: 0, ratchet: 0, pad: 0, lead: 0 } as Record<LayerId, number>;
  for (const id of Object.keys(BUSINESS_LAYERS) as BusinessId[]) {
    if (id !== 'scrapyard' && !opened[id]) continue;
    for (const layer of BUSINESS_LAYERS[id]) out[layer] = id === active ? 1 : id === 'scrapyard' ? 0.8 : 0.55;
  }
  return out;
}

/** Number of layers audible: grows from 3 to 6 as businesses open. */
export function layerCount(gains: Record<LayerId, number>): number {
  return LAYER_IDS.filter((l) => gains[l] > 0).length;
}

/** The notes one layer plays at one step of the loop (bar 0..3, step 0..15). */
export function stepNotes(layer: LayerId, plan: MusicPlan, bar: number, step: number): Note[] {
  const b = ((bar % BARS_PER_LOOP) + BARS_PER_LOOP) % BARS_PER_LOOP;
  const chord = plan.root + (plan.chords[b] ?? 0);
  switch (layer) {
    case 'bass':
      return BASS_STEPS.includes(step) ? [{ midi: chord, steps: step === 8 ? 3 : 2, vel: step === 0 ? 1 : 0.75 }] : [];
    case 'beat': {
      const out: Note[] = [];
      if (step === 0 || step === 8) out.push({ midi: 0, steps: 1, vel: step === 0 ? 1 : 0.7, hit: 'kick' });
      if (step === 4 || step === 12) out.push({ midi: 0, steps: 1, vel: 0.6, hit: 'hat' });
      return out;
    }
    case 'pluck': {
      if (step % 2 !== 0) return [];
      const arp = [0, plan.third, 7, 12, 7, plan.third, 12, 7];
      return [{ midi: chord + 24 + (arp[(step / 2) % arp.length] ?? 0), steps: 1, vel: step % 8 === 0 ? 0.8 : 0.5 }];
    }
    case 'ratchet':
      return step % 2 === 0 ? [{ midi: 0, steps: 1, vel: step % 4 === 0 ? 0.6 : 0.3, hit: 'tick' }] : [];
    case 'pad':
      return step === 0 ? [0, plan.third, 7].map((o) => ({ midi: chord + 36 + o, steps: STEPS_PER_BAR, vel: 0.55 })) : [];
    case 'lead': {
      const hit = (LEAD_BARS[b] ?? []).find(([s]) => s === step);
      if (!hit) return [];
      const degree = plan.scale[hit[1] % plan.scale.length] ?? 0;
      return [{ midi: plan.root + 48 + degree, steps: 3, vel: 0.7 }];
    }
  }
}

export function midiToHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function stepSeconds(plan: MusicPlan): number {
  return 60 / plan.bpm / 4;
}
