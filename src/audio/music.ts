// Procedural music player (P1.8). Schedules the notes from musicScore.ts a little ahead of
// time on the shared Web Audio clock; each layer has its own gain so businesses fade in and out.

import type { BusinessId, CityId } from '../core/config';
import { sfx } from './sfx';
import {
  BARS_PER_LOOP,
  LAYER_IDS,
  STEPS_PER_BAR,
  layerGains,
  midiToHz,
  planFor,
  stepNotes,
  stepSeconds,
  type LayerId,
  type MusicPlan,
  type Note,
} from './musicScore';

const LOOKAHEAD = 0.3;
const FADE = 1.2;

interface Input {
  enabled: boolean;
  opened: Record<BusinessId, boolean>;
  active: BusinessId;
  city: CityId;
}

class Music {
  private timer: ReturnType<typeof setInterval> | null = null;
  private layerNodes: Partial<Record<LayerId, GainNode>> = {};
  private ctx: AudioContext | null = null;
  private plan: MusicPlan = planFor('rustValley');
  private gains = layerGains({ scrapyard: true, garage: false, carlot: false, paint: false }, 'scrapyard');
  private nextTime = 0;
  private step = 0;
  private bar = 0;
  private playing = false;

  /** Layers currently audible (for tests and debugging). */
  get audible(): LayerId[] {
    return LAYER_IDS.filter((l) => this.gains[l] > 0);
  }
  get isPlaying(): boolean {
    return this.playing;
  }

  /** Call whenever the settings, the active business or the city may have changed. */
  sync(input: Input): void {
    this.plan = planFor(input.city);
    this.gains = layerGains(input.opened, input.active);
    const out = sfx.musicOutput();
    if (!input.enabled || !out) {
      this.stop();
      return;
    }
    if (this.ctx !== out.ctx) {
      this.ctx = out.ctx;
      this.layerNodes = {};
    }
    for (const l of LAYER_IDS) {
      let node = this.layerNodes[l];
      if (!node) {
        node = out.ctx.createGain();
        node.gain.value = 0;
        node.connect(out.bus);
        this.layerNodes[l] = node;
      }
      node.gain.setTargetAtTime(this.gains[l] * 0.9, out.ctx.currentTime, FADE / 3);
    }
    if (!this.timer) {
      this.playing = true;
      this.nextTime = out.ctx.currentTime + 0.1;
      this.timer = setInterval(() => this.pump(out), 100);
    }
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.playing = false;
  }

  private pump(out: { ctx: AudioContext; noise: AudioBuffer }): void {
    const { ctx } = out;
    if (ctx.state !== 'running') {
      this.nextTime = Math.max(this.nextTime, ctx.currentTime + 0.1);
      return;
    }
    if (this.nextTime < ctx.currentTime) this.nextTime = ctx.currentTime + 0.05;
    const dt = stepSeconds(this.plan);
    while (this.nextTime < ctx.currentTime + LOOKAHEAD) {
      for (const l of LAYER_IDS) {
        if (this.gains[l] <= 0) continue;
        for (const n of stepNotes(l, this.plan, this.bar, this.step)) this.play(out, l, n, this.nextTime, dt);
      }
      this.nextTime += dt;
      this.step += 1;
      if (this.step >= STEPS_PER_BAR) {
        this.step = 0;
        this.bar = (this.bar + 1) % BARS_PER_LOOP;
      }
    }
  }

  private play(out: { ctx: AudioContext; noise: AudioBuffer }, layer: LayerId, n: Note, t: number, dt: number): void {
    const dest = this.layerNodes[layer];
    if (!dest) return;
    const { ctx } = out;
    const len = n.steps * dt;
    const g = ctx.createGain();
    g.connect(dest);
    if (n.hit === 'kick') {
      const o = ctx.createOscillator();
      o.frequency.setValueAtTime(130, t);
      o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
      g.gain.setValueAtTime(0.5 * n.vel, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      o.connect(g);
      o.start(t);
      o.stop(t + 0.22);
      return;
    }
    if (n.hit) {
      const src = ctx.createBufferSource();
      src.buffer = out.noise;
      const f = ctx.createBiquadFilter();
      f.type = 'highpass';
      f.frequency.value = n.hit === 'hat' ? 7000 : 3500;
      g.gain.setValueAtTime(0.16 * n.vel, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + (n.hit === 'hat' ? 0.07 : 0.03));
      src.connect(f).connect(g);
      src.start(t);
      src.stop(t + 0.1);
      return;
    }
    const o = ctx.createOscillator();
    o.frequency.value = midiToHz(n.midi);
    const motor = this.plan.third === 3;
    let attack = 0.01;
    let peak = 0.22 * n.vel;
    let end = Math.min(len, 0.35);
    switch (layer) {
      case 'bass':
        o.type = 'triangle';
        peak = 0.4 * n.vel;
        end = len * 0.9;
        break;
      case 'pluck':
        o.type = motor ? 'square' : 'triangle';
        peak = (motor ? 0.07 : 0.16) * n.vel;
        end = 0.22;
        break;
      case 'pad':
        o.type = 'sine';
        attack = 0.5;
        peak = 0.09 * n.vel;
        end = len;
        break;
      default:
        o.type = motor ? 'sawtooth' : 'square';
        peak = 0.07 * n.vel;
        end = len * 0.9;
    }
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(end, attack + 0.05));
    o.connect(g);
    o.start(t);
    o.stop(t + Math.max(end, attack + 0.05) + 0.02);
  }
}

export const music = new Music();
