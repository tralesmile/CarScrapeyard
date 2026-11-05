// Sound effects synthesised with Web Audio: no audio files to download.
// Browsers block audio until the first user gesture, so `unlock()` is
// called on the first pointer press.

type Wave = OscillatorType;

class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private lastWash = 0;
  enabled = true;

  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
    const len = this.ctx.sampleRate * 0.5;
    this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  }

  /** Pause audio when the app is hidden (phone call, lock screen, tab switch). */
  suspend(): void {
    void this.ctx?.suspend();
  }
  resume(): void {
    void this.ctx?.resume();
  }

  private tone(freq: number, dur: number, wave: Wave = 'sine', vol = 0.3, slideTo?: number, delay = 0): void {
    if (!this.enabled || !this.ctx || !this.master) return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private noise(dur: number, freq: number, vol: number): void {
    if (!this.enabled || !this.ctx || !this.master || !this.noiseBuffer) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    filter.Q.value = 0.8;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + dur);
  }

  tap() {
    this.tone(520, 0.06, 'square', 0.08);
  }
  wash() {
    const now = performance.now();
    if (now - this.lastWash < 70) return;
    this.lastWash = now;
    this.noise(0.12, 2400 + Math.random() * 800, 0.12);
  }
  washed() {
    this.tone(880, 0.12, 'sine', 0.2);
    this.tone(1320, 0.18, 'sine', 0.18, undefined, 0.08);
  }
  wrench() {
    this.noise(0.05, 4000, 0.2);
    this.tone(180 + Math.random() * 60, 0.07, 'square', 0.1);
  }
  repaired() {
    this.tone(392, 0.12, 'triangle', 0.25);
    this.tone(523, 0.12, 'triangle', 0.25, undefined, 0.1);
    this.tone(784, 0.25, 'triangle', 0.25, undefined, 0.2);
  }
  coin() {
    this.tone(988, 0.08, 'square', 0.12);
    this.tone(1319, 0.2, 'square', 0.12, undefined, 0.07);
  }
  buy() {
    this.tone(660, 0.08, 'triangle', 0.2, 990);
  }
  denied() {
    this.tone(220, 0.15, 'sawtooth', 0.08, 160);
  }
  engine() {
    this.tone(70, 0.6, 'sawtooth', 0.12, 160);
  }
  /** Hydraulic press: hiss, then a heavy metal crunch. */
  crushStart() {
    this.noise(0.25, 900, 0.12);
    this.tone(110, 0.25, 'sawtooth', 0.08, 70);
  }
  crush() {
    this.noise(0.45, 300, 0.45);
    this.noise(0.25, 1800, 0.2);
    this.tone(55, 0.5, 'square', 0.22, 35);
  }
  parts() {
    this.tone(1200, 0.05, 'square', 0.08);
    this.tone(1600, 0.08, 'square', 0.08, undefined, 0.05);
  }
  /** Shop doorbell: a customer walks into the yard. */
  bell() {
    this.tone(1568, 0.25, 'sine', 0.12);
    this.tone(1175, 0.35, 'sine', 0.12, undefined, 0.12);
  }
  fanfare() {
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.22, undefined, i * 0.12));
  }
}

export const sfx = new Sfx();
