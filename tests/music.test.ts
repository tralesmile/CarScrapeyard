import { describe, expect, it } from 'vitest';
import {
  BARS_PER_LOOP,
  BUSINESS_LAYERS,
  LAYER_IDS,
  STEPS_PER_BAR,
  layerCount,
  layerGains,
  midiToHz,
  planFor,
  stepNotes,
  stepSeconds,
  type LayerId,
} from '../src/audio/musicScore';

const closed = { scrapyard: true, garage: false, carlot: false, paint: false };

describe('music layers per business', () => {
  it('a new game plays the three base layers only', () => {
    const g = layerGains(closed, 'scrapyard');
    expect(LAYER_IDS.filter((l) => g[l] > 0)).toEqual(['bass', 'beat', 'pluck']);
    expect(layerCount(g)).toBe(3);
  });

  it('each opened business adds its layer and all four give six', () => {
    expect(layerCount(layerGains({ ...closed, garage: true }, 'scrapyard'))).toBe(4);
    expect(layerCount(layerGains({ ...closed, garage: true, carlot: true }, 'scrapyard'))).toBe(5);
    const all = layerGains({ scrapyard: true, garage: true, carlot: true, paint: true }, 'scrapyard');
    expect(layerCount(all)).toBe(6);
  });

  it('a business that is not open adds nothing, even if it is somehow active', () => {
    const g = layerGains(closed, 'paint');
    expect(g.lead).toBe(0);
  });

  it('the business on screen is the loudest', () => {
    const open = { scrapyard: true, garage: true, carlot: true, paint: true };
    const g = layerGains(open, 'carlot');
    expect(g.pad).toBe(1);
    expect(g.ratchet).toBeLessThan(g.pad);
    expect(g.lead).toBeLessThan(g.pad);
    expect(g.bass).toBeLessThan(g.pad);
    const home = layerGains(open, 'scrapyard');
    expect(home.bass).toBe(1);
    expect(home.pad).toBeLessThan(1);
  });

  it('every layer belongs to exactly one business', () => {
    const owners = new Map<LayerId, number>();
    for (const layers of Object.values(BUSINESS_LAYERS)) for (const l of layers) owners.set(l, (owners.get(l) ?? 0) + 1);
    expect([...owners.keys()].sort()).toEqual([...LAYER_IDS].sort());
    expect([...owners.values()].every((n) => n === 1)).toBe(true);
  });
});

describe('music score', () => {
  const plans = [planFor('rustValley'), planFor('motorCity')];

  it('Motor City is faster, lower and minor', () => {
    const [rv, mc] = plans;
    expect(mc!.bpm).toBeGreaterThan(rv!.bpm);
    expect(mc!.root).toBeLessThan(rv!.root);
    expect(rv!.third).toBe(4);
    expect(mc!.third).toBe(3);
  });

  it('every layer makes notes somewhere in the loop and stays in a playable range', () => {
    for (const plan of plans) {
      for (const layer of LAYER_IDS) {
        let count = 0;
        for (let bar = 0; bar < BARS_PER_LOOP; bar++) {
          for (let step = 0; step < STEPS_PER_BAR; step++) {
            for (const n of stepNotes(layer, plan, bar, step)) {
              count++;
              expect(n.vel).toBeGreaterThan(0);
              expect(n.vel).toBeLessThanOrEqual(1);
              expect(n.steps).toBeGreaterThan(0);
              if (!n.hit) {
                const hz = midiToHz(n.midi);
                expect(hz).toBeGreaterThan(30);
                expect(hz).toBeLessThan(3000);
              }
            }
          }
        }
        expect(count, `${layer} is silent`).toBeGreaterThan(0);
      }
    }
  });

  it('the score is deterministic and loops', () => {
    const plan = plans[1]!;
    for (const layer of LAYER_IDS) {
      expect(stepNotes(layer, plan, 1, 6)).toEqual(stepNotes(layer, plan, 1, 6));
      expect(stepNotes(layer, plan, 5, 6)).toEqual(stepNotes(layer, plan, 1, 6));
    }
  });

  it('the bass follows the chord progression', () => {
    const plan = plans[0]!;
    const roots = [0, 1, 2, 3].map((bar) => stepNotes('bass', plan, bar, 0)[0]!.midi - plan.root);
    expect(roots).toEqual([...plan.chords]);
  });

  it('a step is a sixteenth note and midi 69 is 440 Hz', () => {
    expect(stepSeconds({ ...plans[0]!, bpm: 120 })).toBeCloseTo(0.125, 5);
    expect(midiToHz(69)).toBeCloseTo(440, 5);
    expect(midiToHz(57)).toBeCloseTo(220, 5);
  });
});
