// Repair Garage scene (P1.1c): the customer's car stands on the lift with its fault shown in a bubble; tap it to
// fix it, then the customer pays and drives off. The scrapyard keeps ticking (the core tick runs everything), so this
// scene forwards every event to the bridge just like the yard does.

import Phaser from 'phaser';
import { sfx } from '../audio/sfx';
import { ECON } from '../core/config';
import { formatCash } from '../core/format';
import { findJob, focusJob, garageTap } from '../core/garage';
import { tick, type GameEvent } from '../core/sim';
import type { GarageJob } from '../core/state';
import type { Bridge } from './bridge';
import { carTextureSize, paintCar, paintRust } from './carArt';
import { paintGarageBackdrop } from './garageArt';
import { pruneFloaters, stackY, type Floater } from './floatStack';

/** Where the fault bubble points on the car, as a fraction of the car's width/height from its centre. */
const FAULT_SPOT: Record<GarageJob['fault'], [number, number]> = {
  tyre: [0.3, 0.26],
  battery: [0.3, -0.08],
  brakes: [-0.3, 0.26],
  exhaust: [-0.46, 0.18],
  engine: [0.32, -0.12],
};

interface BayView {
  jobId: number;
  container: Phaser.GameObjects.Container;
  frame: Phaser.GameObjects.Graphics;
  bar: Phaser.GameObjects.Graphics;
}

export class GarageScene extends Phaser.Scene {
  private bridge!: Bridge;
  private bg!: Phaser.GameObjects.Image;
  private bigCar!: Phaser.GameObjects.Image;
  private bigRust!: Phaser.GameObjects.Image;
  private bigScale = 1;
  private bigJobId: number | null = null;
  private carLeaving = false;
  private texW = 1024;
  private texH = 512;
  private bubble!: Phaser.GameObjects.Container;
  private bubbleText!: Phaser.GameObjects.Text;
  private barG!: Phaser.GameObjects.Graphics;
  private label!: Phaser.GameObjects.Text;
  private sparks!: Phaser.GameObjects.Particles.ParticleEmitter;
  private smoke!: Phaser.GameObjects.Particles.ParticleEmitter;
  private glitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  private bays: BayView[] = [];
  private baysKey = '';
  private smokeTimer = 0;
  private foremanTimer = 0;
  private floaters: Floater[] = [];
  private layoutInsets = '';
  private insetCheck = 0;

  constructor() {
    super('garage');
  }

  init(data: { bridge: Bridge }) {
    this.bridge = data.bridge;
  }

  private get dpr() {
    return this.bridge.dpr;
  }
  private px(css: number) {
    return css * this.dpr;
  }
  private get cssW() {
    return this.scale.width / this.dpr;
  }
  private get cssH() {
    return this.scale.height / this.dpr;
  }
  private get calm(): boolean {
    return this.bridge.state.settings.reduceMotion || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
  }

  /** Same geometry as the yard: a row of bay thumbnails under the HUD, the big car in the middle. */
  private focusArea() {
    const { top, bottom } = this.bridge.insets();
    const areaTop = top + 96;
    const areaBottom = this.cssH - bottom;
    const carW = Math.min(this.cssW * 0.8, 400);
    return { cx: this.cssW / 2, cy: areaTop + (areaBottom - areaTop) * 0.55, carW, top: areaTop, bottom: areaBottom, rowY: top + 8 };
  }

  create() {
    const size = carTextureSize(this.px(this.focusArea().carW));
    this.texW = size.w;
    this.texH = size.h;
    this.bg = this.add.image(0, 0, '__WHITE').setOrigin(0, 0).setVisible(false);
    this.bigCar = this.add.image(0, 0, '__WHITE').setVisible(false);
    this.bigRust = this.add.image(0, 0, '__WHITE').setVisible(false);

    const bubbleBg = this.add.graphics();
    this.bubbleText = this.add
      .text(0, 0, '', { fontFamily: 'Nunito, sans-serif', fontStyle: '800', fontSize: `${this.px(14)}px`, color: '#1e2430' })
      .setOrigin(0.5);
    this.bubble = this.add.container(0, 0, [bubbleBg, this.bubbleText]).setDepth(5).setVisible(false);
    this.barG = this.add.graphics().setDepth(5);
    this.label = this.add
      .text(0, 0, '', {
        fontFamily: '"Lilita One", sans-serif',
        fontSize: `${this.px(18)}px`,
        color: '#fbf3e4',
        stroke: '#1e2430',
        strokeThickness: this.px(4),
      })
      .setOrigin(0.5, 0)
      .setDepth(5);
    this.barG.setDepth(6);

    this.sparks = this.add.particles(0, 0, 'spark', {
      speed: { min: 150, max: 450 },
      angle: { min: 0, max: 360 },
      gravityY: 700,
      lifespan: 420,
      scale: { start: 1, end: 0 },
      blendMode: 'ADD',
      emitting: false,
    });
    this.smoke = this.add.particles(0, 0, 'puff', {
      speedY: { min: -60, max: -20 },
      speedX: { min: -15, max: 15 },
      lifespan: 1400,
      scale: { start: 0.5, end: 1.6 },
      alpha: { start: 0.35, end: 0 },
      emitting: false,
    });
    this.glitter = this.add.particles(0, 0, 'star', {
      speed: { min: 40, max: 200 },
      angle: { min: 0, max: 360 },
      lifespan: 900,
      scale: { start: 1.1, end: 0 },
      blendMode: 'ADD',
      emitting: false,
    });

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onPointerDown(p));
    this.scale.on('resize', () => this.layout());
    this.events.on(Phaser.Scenes.Events.WAKE, () => this.layout());
    this.layout();
  }

  layout() {
    if (!this.sys.isActive() && !this.sys.isVisible()) return;
    const ins = this.bridge.insets();
    this.layoutInsets = `${Math.round(ins.top)},${Math.round(ins.bottom)}`;
    this.insetCheck = 0.5;
    this.drawBackground();
    this.placeBigCar();
    this.baysKey = '';
  }

  private watchInsets(dt: number) {
    this.insetCheck -= dt;
    if (this.insetCheck > 0) return;
    this.insetCheck = 0.5;
    const { top, bottom } = this.bridge.insets();
    if (`${Math.round(top)},${Math.round(bottom)}` !== this.layoutInsets) this.layout();
  }

  private drawBackground() {
    const W = Math.round(this.scale.width);
    const H = Math.round(this.scale.height);
    const a = this.focusArea();
    const groundY = this.px(a.cy + a.carW * 0.13);
    const floorY = this.px(a.top + (a.cy - a.top) * 0.62);
    if (this.textures.exists('garage-backdrop')) this.textures.remove('garage-backdrop');
    const tex = this.textures.createCanvas('garage-backdrop', W, H);
    if (!tex) return;
    paintGarageBackdrop(tex.getContext(), {
      w: W,
      h: H,
      floorY,
      s: this.dpr,
      lift: { cx: W / 2, groundY, carW: this.px(a.carW) },
      sign: '',
    });
    tex.refresh();
    this.bg.setTexture('garage-backdrop').setPosition(0, 0).setVisible(true);
    this.children.sendToBack(this.bg);
  }

  update(_time: number, deltaMs: number) {
    const dt = Math.min(deltaMs / 1000, 0.25);
    const events = tick(this.bridge.state, dt);
    if (events.length) this.handleEvents(events);
    this.syncBigCar();
    this.syncBays();
    this.watchInsets(dt);

    const job = this.focused();
    this.smokeTimer -= dt;
    if (job && !this.carLeaving && (job.fault === 'engine' || job.fault === 'exhaust') && this.smokeTimer <= 0) {
      this.smokeTimer = 0.4;
      const [fx, fy] = FAULT_SPOT[job.fault];
      this.smoke.emitParticleAt(this.bigCar.x + this.bigCar.displayWidth * fx, this.bigCar.y + this.bigCar.displayHeight * fy, 1);
    }
    // The Foreman's sparks on the car he works on (the oldest one).
    const g = this.bridge.state.garage;
    this.foremanTimer -= dt;
    if (g.foreman && !this.carLeaving && g.jobs[0] && g.jobs[0].id === this.bigJobId && this.foremanTimer <= 0) {
      this.foremanTimer = 0.6;
      const [fx, fy] = FAULT_SPOT[g.jobs[0].fault];
      this.sparks.explode(4, this.bigCar.x + this.bigCar.displayWidth * fx, this.bigCar.y + this.bigCar.displayHeight * fy);
    }
  }

  // ---- the car on the lift --------------------------------------------------

  private focused(): GarageJob | undefined {
    return findJob(this.bridge.state, this.bridge.state.garage.focusedId);
  }

  private ensureTextures(job: GarageJob): string {
    const key = `gcar-${job.id}`;
    if (this.textures.exists(key)) return key;
    for (const [k, paint] of [
      [key, (ctx: CanvasRenderingContext2D) => paintCar(ctx, { family: job.family, paint: job.paint, rarity: 'common' }, this.texW, this.texH)],
      [`grust-${job.id}`, (ctx: CanvasRenderingContext2D) => paintRust(ctx, job.family, this.texW, this.texH, job.id + 7)],
    ] as const) {
      const tex = this.textures.createCanvas(k, this.texW, this.texH);
      if (!tex) continue;
      paint(tex.getContext());
      tex.refresh();
    }
    return key;
  }

  private releaseTextures(id: number) {
    for (const k of [`gcar-${id}`, `grust-${id}`, `gthumb-${id}`]) if (this.textures.exists(k)) this.textures.remove(k);
  }

  private placeBigCar() {
    const a = this.focusArea();
    this.bigScale = this.px(a.carW) / this.texW;
    for (const o of [this.bigCar, this.bigRust]) {
      o.setScale(this.bigScale);
      if (!this.carLeaving) o.setPosition(this.px(a.cx), this.px(a.cy));
    }
    this.label.setPosition(this.px(a.cx), this.px(a.cy + a.carW * 0.16));
  }

  private syncBigCar() {
    const job = this.carLeaving ? undefined : this.focused();
    if (!job) {
      if (!this.carLeaving && this.bigJobId !== null) {
        this.bigJobId = null;
        this.bigCar.setVisible(false);
        this.bigRust.setVisible(false);
      }
      this.bubble.setVisible(false);
      this.barG.clear();
      if (!this.carLeaving) this.label.setText('');
      return;
    }
    if (job.id !== this.bigJobId) {
      this.bigJobId = job.id;
      this.bigCar.setTexture(this.ensureTextures(job)).setVisible(true);
      this.bigRust.setTexture(`grust-${job.id}`).setVisible(true);
      this.placeBigCar();
      // Drive in through the roller door on the left.
      const tx = this.bigCar.x;
      for (const o of [this.bigCar, this.bigRust]) {
        o.x = -this.bigCar.displayWidth;
        this.tweens.add({ targets: o, x: tx, duration: this.calm ? 1 : 600, ease: 'Back.easeOut' });
      }
      sfx.engine();
      this.drawBubble(job);
    }
    const max = ECON.garage.faults[job.fault].work;
    const left = job.work / max;
    this.bigRust.setAlpha(0.1 + 0.5 * left);
    const [fx, fy] = FAULT_SPOT[job.fault];
    // Keep the bubble on screen (the fault spot can be near the car's edge on a narrow phone).
    const half = this.bubbleW / 2 + this.px(6);
    const bx = Phaser.Math.Clamp(this.bigCar.x + this.bigCar.displayWidth * fx, half, this.scale.width - half);
    const by = this.bigCar.y + this.bigCar.displayHeight * fy - this.px(62);
    this.bubble.setPosition(bx, by).setVisible(true);
    // Repair progress inside the bubble, under the fault's name.
    const w = this.bubbleW - this.px(24);
    const h = this.px(7);
    const x = bx - w / 2;
    const y = by + this.px(9);
    this.barG.clear();
    this.barG.fillStyle(0x1e2430, 0.25).fillRoundedRect(x, y, w, h, h / 2);
    this.barG.fillStyle(0x3bc45a, 1).fillRoundedRect(x, y, Math.max(h, w * (1 - left)), h, h / 2);
    this.label.setText(`${job.model} · ${formatCash(job.fee)}`);
  }

  private bubbleW = 100;

  private drawBubble(job: GarageJob) {
    const f = ECON.garage.faults[job.fault];
    this.bubbleText.setText(`${f.icon} ${f.name}`).setY(-this.px(6));
    const g = this.bubble.list[0] as Phaser.GameObjects.Graphics;
    const w = Math.max(this.bubbleText.width + this.px(24), this.px(120));
    this.bubbleW = w;
    const h = this.px(44);
    g.clear();
    g.fillStyle(0x000000, 0.18).fillRoundedRect(-w / 2 + this.px(2), -h / 2 + this.px(3), w, h, h / 2);
    g.fillStyle(0xfbf3e4, 1).fillRoundedRect(-w / 2, -h / 2, w, h, h / 2);
    g.lineStyle(this.px(2.5), 0xe8762b, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, h / 2);
    // Pointer towards the fault.
    g.fillStyle(0xfbf3e4, 1).fillTriangle(-this.px(7), h / 2 - this.px(1), this.px(7), h / 2 - this.px(1), 0, h / 2 + this.px(14));
    g.lineStyle(this.px(2.5), 0xe8762b, 1);
    g.lineBetween(-this.px(7), h / 2, 0, h / 2 + this.px(14));
    g.lineBetween(this.px(7), h / 2, 0, h / 2 + this.px(14));
  }

  // ---- bay thumbnails (2+ bays) ------------------------------------------------

  private syncBays() {
    const g = this.bridge.state.garage;
    const key = `${g.bays}|${g.jobs.map((j) => j.id).join(',')}|${g.focusedId}`;
    if (key !== this.baysKey) {
      this.baysKey = key;
      for (const b of this.bays) b.container.destroy();
      this.bays = [];
      if (g.bays > 1) {
        const a = this.focusArea();
        const w = 100;
        const gap = 10;
        const total = g.bays * w + (g.bays - 1) * gap;
        for (let i = 0; i < g.bays; i++) {
          const job = g.jobs[i];
          const x = this.px(a.cx - total / 2 + i * (w + gap) + w / 2);
          const y = this.px(a.rowY + 38);
          const frame = this.add.graphics();
          const focused = job && job.id === g.focusedId;
          frame.fillStyle(0x1e2430, 0.55).fillRoundedRect(-this.px(w / 2), -this.px(36), this.px(w), this.px(72), this.px(10));
          frame.lineStyle(this.px(focused ? 3 : 1.5), focused ? 0xf5b700 : 0xfbf3e4, focused ? 1 : 0.4);
          frame.strokeRoundedRect(-this.px(w / 2), -this.px(36), this.px(w), this.px(72), this.px(10));
          const bar = this.add.graphics();
          const items: Phaser.GameObjects.GameObject[] = [frame, bar];
          if (job) {
            const img = this.add.image(0, -this.px(6), this.ensureTextures(job));
            img.setScale(this.px(w - 14) / this.texW);
            const icon = this.add.text(0, this.px(18), ECON.garage.faults[job.fault].icon, { fontSize: `${this.px(14)}px` }).setOrigin(0.5);
            items.push(img, icon);
          } else {
            items.push(this.add.text(0, 0, 'Free bay', { fontFamily: 'Nunito, sans-serif', fontStyle: '700', fontSize: `${this.px(11)}px`, color: '#fbf3e4' }).setOrigin(0.5).setAlpha(0.7));
          }
          const container = this.add.container(x, y, items).setDepth(4);
          container.setSize(this.px(w), this.px(72));
          this.bays.push({ jobId: job?.id ?? -1, container, frame, bar });
        }
      }
    }
    for (const b of this.bays) {
      const job = findJob(this.bridge.state, b.jobId);
      b.bar.clear();
      if (!job) continue;
      const left = job.work / ECON.garage.faults[job.fault].work;
      b.bar.fillStyle(0x1e2430, 0.8).fillRect(-this.px(40), this.px(28), this.px(80), this.px(4));
      b.bar.fillStyle(0x3bc45a, 1).fillRect(-this.px(40), this.px(28), this.px(80) * (1 - left), this.px(4));
    }
  }

  // ---- input --------------------------------------------------------------

  private onPointerDown(p: Phaser.Input.Pointer) {
    this.bridge.onInput();
    sfx.unlock();
    for (const b of this.bays) {
      if (b.jobId < 0) continue;
      const r = b.container.getBounds();
      if (r.contains(p.x, p.y)) {
        focusJob(this.bridge.state, b.jobId);
        sfx.tap();
        return;
      }
    }
    const job = this.focused();
    if (!job || this.carLeaving || !this.bigCar.visible) return;
    if (!this.bigCar.getBounds().contains(p.x, p.y)) return;
    this.sparks.explode(10, p.x, p.y);
    sfx.wrench();
    if (!this.calm) this.tweens.add({ targets: [this.bigCar, this.bigRust], y: this.bigCar.y + this.px(3), yoyo: true, duration: 60 });
    const events = garageTap(this.bridge.state, job.id);
    this.handleEvents(events);
  }

  // ---- events -------------------------------------------------------------

  handleEvents(events: GameEvent[]) {
    for (const e of events) {
      if (e.type === 'garageFixed') this.onFixed(e.job, e.amount, e.parts);
    }
    this.bridge.onEvents(events);
  }

  private onFixed(job: GarageJob, amount: number, parts: number) {
    const big = job.id === this.bigJobId;
    const from = big ? { x: this.bigCar.x, y: this.bigCar.y } : { x: this.scale.width / 2, y: this.px(this.focusArea().rowY + 38) };
    if (big) {
      sfx.repaired();
      this.glitter.explode(18, this.bigCar.x, this.bigCar.y - this.bigCar.displayHeight * 0.2);
      this.bubble.setVisible(false);
      this.barG.clear();
      this.driveOff(job.id);
      const note = parts > 0 ? `Yard parts −${parts} ⚙` : `Parts bill −${Math.round(ECON.garage.partsBill * 100)}%`;
      this.floatText(from.x, from.y - this.bigCar.displayHeight * 0.45, note, parts > 0 ? '#f5b700' : '#c9d1d9', 18);
    } else this.time.delayedCall(800, () => this.releaseTextures(job.id));
    this.coinBurst(from.x, from.y, amount);
  }

  private driveOff(id: number) {
    this.carLeaving = true;
    this.bigJobId = null;
    sfx.engine();
    this.tweens.add({
      targets: [this.bigCar, this.bigRust],
      x: this.scale.width + this.bigCar.displayWidth,
      duration: this.calm ? 1 : 520,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        this.carLeaving = false;
        this.bigCar.setVisible(false);
        this.bigRust.setVisible(false);
        this.label.setText('');
        this.placeBigCar();
        this.releaseTextures(id);
      },
    });
  }

  private placeFloater(x: number, y: number, size: number): number {
    const now = this.time.now;
    const h = this.px(size * 1.15);
    this.floaters = pruneFloaters(this.floaters, now);
    const sy = stackY(this.floaters, x, y, h, now, this.px(160));
    this.floaters.push({ x, y: sy, h, born: now });
    return sy;
  }

  private floatText(x: number, y0: number, msg: string, color: string, size: number) {
    const y = this.placeFloater(x, y0, size);
    const text = this.add
      .text(x, y, msg, { fontFamily: '"Lilita One", sans-serif', fontSize: `${this.px(size)}px`, color, stroke: '#1e2430', strokeThickness: this.px(5) })
      .setOrigin(0.5)
      .setDepth(11);
    this.tweens.add({ targets: text, y: y - this.px(50), alpha: 0, duration: 1300, ease: 'Cubic.easeOut', onComplete: () => text.destroy() });
  }

  private coinBurst(x: number, y: number, amount: number) {
    const target = this.bridge.cashTarget();
    const tx = this.px(target.x);
    const ty = this.px(target.y);
    const n = Phaser.Math.Clamp(Math.round(Math.log10(amount + 1) * 3), 5, 16);
    for (let i = 0; i < n; i++) {
      const coin = this.add.image(x, y, 'coin').setScale(this.dpr * 0.6).setDepth(10);
      this.tweens.add({
        targets: coin,
        x: x + Phaser.Math.Between(-this.px(90), this.px(90)),
        y: y - Phaser.Math.Between(this.px(30), this.px(110)),
        duration: 260,
        ease: 'Quad.easeOut',
        onComplete: () =>
          this.tweens.add({
            targets: coin,
            x: tx,
            y: ty,
            scale: this.dpr * 0.35,
            duration: 420,
            delay: i * 35,
            ease: 'Quad.easeIn',
            onComplete: () => {
              coin.destroy();
              if (i === 0) sfx.coin();
            },
          }),
      });
    }
    this.floatText(x, y - this.px(40), `+${formatCash(amount)}`, '#3bc45a', 30);
  }
}
