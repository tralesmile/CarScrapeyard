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
import { BUYER_H, BUYER_W, paintBuyer } from './buyerArt';
import { SHAPES, WHEEL_Y, carTextureSize, paintCar, paintRust } from './carArt';
import { SCRAPPER_H, SCRAPPER_W, paintForeman } from './crewArt';
import {
  BAY_ROW,
  BAY_ROW_BOTTOM,
  CUSTOMER_RUST,
  GARAGE_AREA_TOP,
  LIFT_RISE,
  SPEECH_TIME,
  customerKind,
  customerLine,
  liftPosts,
  paintGarageBackdrop,
  paintTyre,
} from './garageArt';
import { pruneFloaters, stackY, type Floater } from './floatStack';

/** Where the fault bubble points on the car, as a fraction of the car's width/height from its centre. */
const FAULT_SPOT: Record<GarageJob['fault'], [number, number]> = {
  tyre: [0.3, 0.26],
  battery: [0.3, -0.08],
  brakes: [-0.3, 0.26],
  exhaust: [-0.46, 0.18],
  engine: [0.32, -0.12],
};

/** Height of the waiting customer and the Foreman on screen, CSS px. */
const PERSON_H = 82;
/** Top of the tallest body (van) as a fraction of the car texture's height: the garage sign stays above it. */
const ROOF_FRAC = Math.min(...Object.values(SHAPES).map((sh) => Math.min(...sh.body.map((p) => p[1]))));

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
  /** Lift height 0 (down) .. 1 (raised by LIFT_RISE) and the little dip on each tap, both tweened. */
  private lift = { v: 0 };
  private bump = { v: 0 };
  /** The car is still driving in: no bubble yet, the lift waits. */
  private arriving = false;
  private shadowG!: Phaser.GameObjects.Graphics;
  private liftG!: Phaser.GameObjects.Graphics;
  private faultG!: Phaser.GameObjects.Graphics;
  private zap!: Phaser.GameObjects.Particles.ParticleEmitter;
  private zapTimer = 0;
  private customer!: Phaser.GameObjects.Image;
  private foreman!: Phaser.GameObjects.Image;
  private clock = 0;
  /** The customer's speech bubble (P1.1f): what's wrong, said once per job as they step out. */
  private speech!: Phaser.GameObjects.Container;
  private speechText!: Phaser.GameObjects.Text;
  private speechUntil = 0;
  private spoken = new Set<number>();
  /** A new tyre rolling in and fitted on the front wheel after a flat-tyre fix (P1.1f). */
  private tyre!: Phaser.GameObjects.Image;
  private tyreFit: { roll: { v: number }; fromX: number; dx: number; dy: number; r: number } | null = null;

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
    const areaTop = top + GARAGE_AREA_TOP;
    const areaBottom = this.cssH - bottom;
    const carW = Math.min(this.cssW * 0.8, 400);
    return { cx: this.cssW / 2, cy: areaTop + (areaBottom - areaTop) * 0.55, carW, top: areaTop, bottom: areaBottom, rowY: top + BAY_ROW.y };
  }

  create() {
    const size = carTextureSize(this.px(this.focusArea().carW));
    this.texW = size.w;
    this.texH = size.h;
    this.bg = this.add.image(0, 0, '__WHITE').setOrigin(0, 0).setVisible(false);
    this.shadowG = this.add.graphics();
    this.liftG = this.add.graphics();
    this.bigCar = this.add.image(0, 0, '__WHITE').setVisible(false);
    this.bigRust = this.add.image(0, 0, '__WHITE').setVisible(false);

    this.faultG = this.add.graphics().setDepth(1);
    this.foreman = this.add
      .image(0, 0, this.paintedTexture('crew-foreman', SCRAPPER_W, SCRAPPER_H, paintForeman))
      .setOrigin(0.5, 1)
      .setDepth(2)
      .setVisible(false);
    this.customer = this.add.image(0, 0, '__WHITE').setOrigin(0.5, 1).setDepth(2).setVisible(false);
    const bubbleBg = this.add.graphics();
    this.bubbleText = this.add
      .text(0, 0, '', { fontFamily: 'Nunito, sans-serif', fontStyle: '800', fontSize: `${this.px(14)}px`, color: '#1e2430' })
      .setOrigin(0.5);
    this.bubble = this.add.container(0, 0, [bubbleBg, this.bubbleText]).setDepth(5).setVisible(false);
    this.barG = this.add.graphics().setDepth(5);
    this.speechText = this.add
      .text(0, 0, '', { fontFamily: 'Nunito, sans-serif', fontStyle: '800', fontSize: `${this.px(13)}px`, color: '#1e2430' })
      .setOrigin(0.5);
    this.speech = this.add.container(0, 0, [this.add.graphics(), this.speechText]).setDepth(7).setVisible(false);
    this.tyre = this.add
      .image(0, 0, this.paintedTexture('garage-tyre', 64, 64, (ctx) => paintTyre(ctx, 32)))
      .setDepth(1)
      .setVisible(false);
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
    // Battery fault: little blue electric sparks at the front of the car.
    this.zap = this.add.particles(0, 0, 'spark', {
      speed: { min: 60, max: 220 },
      angle: { min: 180, max: 360 },
      gravityY: 300,
      lifespan: 260,
      scale: { start: 0.7, end: 0 },
      tint: 0x8fd3ff,
      blendMode: 'ADD',
      emitting: false,
    });
    this.zap.setDepth(3);
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
      sign: ECON.businesses.list.garage.name.toUpperCase(),
      // Keep the sign clear of the bay row even before a 2nd bay is bought.
      reservedTop: this.px(this.bridge.insets().top + BAY_ROW_BOTTOM),
      roofY: this.px(a.cy - a.carW / 4 + ROOF_FRAC * (a.carW / 2) - LIFT_RISE),
    });
    tex.refresh();
    this.bg.setTexture('garage-backdrop').setPosition(0, 0).setVisible(true);
    this.children.sendToBack(this.bg);
  }

  update(_time: number, deltaMs: number) {
    const dt = Math.min(deltaMs / 1000, 0.25);
    const events = tick(this.bridge.state, dt);
    if (events.length) this.handleEvents(events);
    this.clock += dt;
    this.syncBigCar();
    this.poseCar();
    this.syncPeople();
    this.syncBays();
    this.watchInsets(dt);

    const job = this.focused();
    this.zapTimer -= dt;
    if (job && !this.carLeaving && !this.arriving && job.fault === 'battery' && this.zapTimer <= 0 && this.bigCar.visible) {
      this.zapTimer = 0.55 + Math.random() * 0.5;
      this.zap.explode(this.calm ? 2 : 6, this.bigCar.x + this.bigCar.displayWidth * 0.44, this.bigCar.y + this.bigCar.displayHeight * 0.03);
    }
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
      [key, (ctx: CanvasRenderingContext2D) => paintCar(ctx, { family: job.family, paint: job.paint, rarity: 'common' }, this.texW, this.texH, { shadow: false })],
      // Customer cars are not wrecks: a few light patches, not the scrapyard's full rust.
      [`grust-${job.id}`, (ctx: CanvasRenderingContext2D) => void paintRust(ctx, job.family, this.texW, this.texH, job.id + 7, CUSTOMER_RUST)],
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
      this.speechUntil = 0;
      this.speech.setVisible(false);
      this.bigCar.setTexture(this.ensureTextures(job)).setVisible(true);
      this.bigRust.setTexture(`grust-${job.id}`).setVisible(true);
      this.placeBigCar();
      // Drive in through the roller door on the left, then the lift raises the car and the customer steps out.
      const tx = this.bigCar.x;
      this.tweens.killTweensOf(this.lift);
      this.lift.v = 0;
      this.arriving = true;
      for (const o of [this.bigCar, this.bigRust]) {
        o.x = -this.bigCar.displayWidth;
        this.tweens.add({ targets: o, x: tx, duration: this.calm ? 1 : 600, ease: 'Back.easeOut' });
      }
      this.time.delayedCall(this.calm ? 1 : 620, () => this.carArrived(job.id));
      sfx.engine();
      this.drawBubble(job);
    }
    if (this.arriving) {
      this.bubble.setVisible(false);
      this.barG.clear();
      this.label.setText(`${job.model} · ${formatCash(job.fee)}`);
      return;
    }
    const max = ECON.garage.faults[job.fault].work;
    const left = Phaser.Math.Clamp(job.work / max, 0, 1);
    this.bigRust.setAlpha(0.08 + 0.42 * left);
    this.label.setText(`${job.model} · ${formatCash(job.fee)}`);
    // The customer is about to say or still says what's wrong: the fault bubble pops up after.
    if (this.clock < this.speechUntil) {
      this.bubble.setVisible(false);
      this.barG.clear();
      return;
    }
    if (this.speech.visible) {
      this.speech.setVisible(false);
      if (!this.calm) {
        this.bubble.setScale(0.6);
        this.tweens.add({ targets: this.bubble, scale: 1, duration: 220, ease: 'Back.easeOut' });
      }
    }
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
  }

  private carArrived(id: number) {
    if (this.bigJobId !== id) return;
    this.arriving = false;
    this.tweens.add({ targets: this.lift, v: 1, duration: this.calm ? 1 : 420, ease: 'Sine.easeInOut' });
    const job = this.focused();
    if (!job) return;
    const kind = customerKind(job.id);
    const spot = this.customerSpot();
    this.tweens.killTweensOf(this.customer);
    this.customer
      .setTexture(this.paintedTexture(`buyer-${kind}`, BUYER_W, BUYER_H, (ctx) => paintBuyer(ctx, kind)))
      .setScale(this.px(PERSON_H) / (BUYER_H * 2))
      .setPosition(this.bigCar.x + this.bigCar.displayWidth * 0.1, spot.y)
      .setAlpha(0)
      .setVisible(true);
    this.tweens.add({ targets: this.customer, x: spot.x, alpha: 1, duration: this.calm ? 1 : 450, ease: 'Sine.easeOut' });
    if (!this.spoken.has(job.id)) {
      this.spoken.add(job.id);
      if (this.spoken.size > 50) this.spoken = new Set([...this.spoken].slice(-10));
      const delay = this.calm ? 0.001 : 0.38;
      // Keep the fault bubble back until the customer has spoken (say() sets the real end time).
      this.speechUntil = this.clock + delay + 0.5;
      this.time.delayedCall(delay * 1000, () => this.say(job.id));
    }
  }

  /** The customer's speech bubble above their head, pointing down at them. */
  private say(id: number) {
    const job = this.focused();
    if (!job || job.id !== id || this.bigJobId !== id || this.carLeaving || !this.customer.visible) {
      this.speechUntil = 0;
      return;
    }
    this.speechText.setText(customerLine(job));
    const w = this.speechText.width + this.px(22);
    const h = this.px(32);
    const spot = this.customerSpot();
    const headY = spot.y - this.px(PERSON_H) - this.px(4);
    const half = w / 2 + this.px(4);
    const cx = Phaser.Math.Clamp(spot.x - w * 0.25, half, this.scale.width - half);
    const cy = headY - this.px(10) - h / 2;
    const tail = Phaser.Math.Clamp(spot.x - cx, -w / 2 + h / 2, w / 2 - h / 2);
    const g = this.speech.list[0] as Phaser.GameObjects.Graphics;
    g.clear();
    g.fillStyle(0x000000, 0.18).fillRoundedRect(-w / 2 + this.px(2), -h / 2 + this.px(3), w, h, h / 2);
    g.fillStyle(0xffffff, 1).fillRoundedRect(-w / 2, -h / 2, w, h, h / 2);
    g.fillTriangle(tail - this.px(6), h / 2 - this.px(1), tail + this.px(6), h / 2 - this.px(1), tail + this.px(2), h / 2 + this.px(10));
    g.lineStyle(this.px(2), 0x1e2430, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, h / 2);
    g.lineBetween(tail - this.px(6), h / 2, tail + this.px(2), h / 2 + this.px(10));
    g.lineBetween(tail + this.px(6), h / 2, tail + this.px(2), h / 2 + this.px(10));
    this.speech.setPosition(cx, cy).setVisible(true).setAlpha(1);
    this.speechUntil = this.clock + SPEECH_TIME;
    this.tweens.killTweensOf(this.speech);
    if (!this.calm) {
      this.speech.setScale(0.5);
      this.tweens.add({ targets: this.speech, scale: 1, duration: 200, ease: 'Back.easeOut' });
    }
    sfx.tap();
  }

  /** Feet of the waiting customer (right of the car) and the Foreman (left of it), device px. */
  private customerSpot() {
    const a = this.focusArea();
    const half = (PERSON_H * BUYER_W) / BUYER_H / 2;
    const x = Math.min(a.cx + a.carW / 2 + 8, this.cssW - half - 2);
    return { x: this.px(x), y: this.px(a.cy + a.carW * 0.13 + 14) };
  }

  private foremanSpot() {
    const a = this.focusArea();
    const half = (PERSON_H * SCRAPPER_W) / SCRAPPER_H / 2;
    const x = Math.max(a.cx - a.carW / 2 - 8, half + 2);
    return { x: this.px(x), y: this.px(a.cy + a.carW * 0.13 + 14) };
  }

  /** Paint a Canvas 2D texture once (2x for sharpness); textures are shared with the yard scene. */
  private paintedTexture(key: string, w: number, h: number, paint: (ctx: CanvasRenderingContext2D) => void): string {
    if (!this.textures.exists(key)) {
      const tex = this.textures.createCanvas(key, w * 2, h * 2);
      if (tex) {
        const ctx = tex.getContext();
        ctx.scale(2, 2);
        paint(ctx);
        tex.refresh();
      }
    }
    return key;
  }

  /**
   * Per frame: the car's height on the lift (and the tap dip), the tilt of a flat tyre, the floor shadow, the lift
   * arms under the sills, and the fault overlays (flat tyre bulge, glowing brake disc).
   */
  private poseCar() {
    const a = this.focusArea();
    const baseY = this.px(a.cy);
    const car = this.bigCar;
    const job = this.carLeaving ? undefined : this.focused();
    const left = job ? Math.min(1, job.work / ECON.garage.faults[job.fault].work) : 0;
    const y = baseY - this.lift.v * this.px(LIFT_RISE) + this.bump.v * this.px(3);
    const tilt = job && job.fault === 'tyre' && !this.arriving ? 2.2 * left : 0;
    for (const o of [this.bigCar, this.bigRust]) o.setY(y).setAngle(tilt);
    // From the layout, not the image: a hidden image may hold a stock texture of another size.
    const dw = this.px(a.carW);
    const dh = (dw * this.texH) / this.texW;
    this.shadowG.clear();
    this.liftG.clear();
    this.faultG.clear();
    // Lift carriages on the posts, at sill height when a car sits on the lift.
    const [l, r] = liftPosts({ lift: { cx: this.px(a.cx), groundY: 0, carW: this.px(a.carW) } });
    const armY = car.visible ? y + dh * 0.22 : baseY + dh * 0.22;
    this.liftG.fillStyle(0x2b2f36, 1);
    for (const x of [l, r]) this.liftG.fillRoundedRect(x - this.px(9), armY - this.px(8), this.px(18), this.px(16), this.px(3));
    this.poseTyre(y, dh);
    if (!car.visible) return;
    const parked = Math.abs(car.x - this.px(a.cx)) < this.px(4);
    if (parked) {
      this.liftG.fillStyle(0x5d6674, 1);
      this.liftG.fillRect(l, armY - this.px(3), this.px(a.carW) * 0.18, this.px(6));
      this.liftG.fillRect(r - this.px(a.carW) * 0.18, armY - this.px(3), this.px(a.carW) * 0.18, this.px(6));
    }
    const floorY = baseY + dh * 0.42;
    this.shadowG.fillStyle(0x000000, 0.2 - 0.07 * this.lift.v);
    this.shadowG.fillEllipse(car.x, floorY, dw * 0.88 * (1 - 0.08 * this.lift.v), dh * 0.09);
    if (!job || this.arriving) return;
    const shape = SHAPES[job.family];
    const wr = shape.wheelR * dh;
    const wy = y + (WHEEL_Y - 0.5) * dh;
    if (job.fault === 'tyre') {
      // Flat front tyre: the rubber bulges out at the bottom; it rounds out as the repair goes on.
      const wx = car.x + (shape.wheels[1] - 0.5) * dw;
      this.faultG.fillStyle(0x1f2228, 1);
      this.faultG.fillEllipse(wx, wy + wr * 0.86, wr * (2 + 0.5 * left), wr * (0.2 + 0.4 * left));
    } else if (job.fault === 'brakes') {
      // Hot brake disc glowing through the rear wheel.
      const wx = car.x + (shape.wheels[0] - 0.5) * dw;
      const pulse = this.calm ? 0.5 : 0.5 + 0.5 * Math.sin(this.clock * 6);
      this.faultG.fillStyle(0xff5a1f, (0.25 + 0.3 * pulse) * left);
      this.faultG.fillCircle(wx, wy, wr * 0.62);
    }
  }

  /** The new tyre: rolls in from the right, then rides on the front wheel as the car drives off. */
  private poseTyre(carY: number, dh: number) {
    const t = this.tyreFit;
    if (!t) return;
    const v = t.roll.v;
    const x = t.fromX + (this.bigCar.x + t.dx - t.fromX) * v;
    const y = carY + t.dy * dh;
    this.tyre.setPosition(x, v < 1 ? y + (1 - v) * this.px(LIFT_RISE) : y).setAngle(-(1 - v) * 720);
  }

  /** Start the tyre change for a car fixed on the lift. */
  private fitTyre(job: GarageJob) {
    const a = this.focusArea();
    const shape = SHAPES[job.family];
    const dw = this.px(a.carW);
    const dh = (dw * this.texH) / this.texW;
    const r = shape.wheelR * dh;
    this.tyreFit = { roll: { v: this.calm ? 1 : 0 }, fromX: this.scale.width + r * 1.5, dx: (shape.wheels[1] - 0.5) * dw, dy: WHEEL_Y - 0.5, r };
    this.tyre.setDisplaySize(r * 2.04, r * 2.04).setVisible(true).setAlpha(1);
    if (!this.calm) this.tweens.add({ targets: this.tyreFit.roll, v: 1, duration: 340, ease: 'Quad.easeOut', onComplete: () => sfx.wrench() });
  }

  /** The waiting customer and the Foreman (who bobs while he works on the car on the lift). */
  private syncPeople() {
    const g = this.bridge.state.garage;
    const spot = this.foremanSpot();
    this.foreman.setVisible(g.foreman);
    if (!g.foreman) return;
    this.foreman.setScale(this.px(PERSON_H) / (SCRAPPER_H * 2)).setX(spot.x);
    const working = !this.carLeaving && !this.arriving && g.jobs[0] !== undefined && g.jobs[0].id === this.bigJobId;
    const t = working && !this.calm ? this.clock * 7 : 0;
    this.foreman.setY(spot.y - Math.abs(Math.sin(t)) * this.px(3)).setAngle(Math.sin(t) * 4);
  }

  private customerLeaves() {
    if (!this.customer.visible) return;
    this.tweens.killTweensOf(this.customer);
    const y = this.customer.y;
    // A happy hop, then off to the right after the car.
    this.tweens.add({ targets: this.customer, y: y - this.px(10), duration: 130, yoyo: true, repeat: this.calm ? 0 : 1, ease: 'Sine.easeOut' });
    this.tweens.add({
      targets: this.customer,
      x: this.scale.width + this.px(40),
      delay: this.calm ? 0 : 260,
      duration: this.calm ? 1 : 700,
      ease: 'Sine.easeIn',
      onComplete: () => this.customer.setVisible(false),
    });
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
        const { w, h, gap } = BAY_ROW;
        const total = g.bays * w + (g.bays - 1) * gap;
        for (let i = 0; i < g.bays; i++) {
          const job = g.jobs[i];
          const x = this.px(a.cx - total / 2 + i * (w + gap) + w / 2);
          const y = this.px(a.rowY);
          const frame = this.add.graphics();
          const focused = job && job.id === g.focusedId;
          frame.fillStyle(0x1e2430, BAY_ROW.alpha).fillRoundedRect(-this.px(w / 2), -this.px(h / 2), this.px(w), this.px(h), this.px(10));
          frame.lineStyle(this.px(focused ? 3 : 1.5), focused ? 0xf5b700 : 0xfbf3e4, focused ? 1 : 0.4);
          frame.strokeRoundedRect(-this.px(w / 2), -this.px(h / 2), this.px(w), this.px(h), this.px(10));
          const bar = this.add.graphics();
          const items: Phaser.GameObjects.GameObject[] = [frame, bar];
          if (job) {
            const img = this.add.image(-this.px(6), -this.px(4), this.ensureTextures(job));
            img.setScale(this.px(w - 24) / this.texW);
            const icon = this.add.text(this.px(w / 2 - 13), -this.px(h / 2 - 12), ECON.garage.faults[job.fault].icon, { fontSize: `${this.px(12)}px` }).setOrigin(0.5);
            items.push(img, icon);
          } else {
            items.push(this.add.text(0, 0, 'Free bay', { fontFamily: 'Nunito, sans-serif', fontStyle: '700', fontSize: `${this.px(11)}px`, color: '#fbf3e4' }).setOrigin(0.5).setAlpha(0.7));
          }
          const container = this.add.container(x, y, items).setDepth(4);
          container.setSize(this.px(w), this.px(h));
          this.bays.push({ jobId: job?.id ?? -1, container, frame, bar });
        }
      }
    }
    for (const b of this.bays) {
      const job = findJob(this.bridge.state, b.jobId);
      b.bar.clear();
      if (!job) continue;
      const left = Phaser.Math.Clamp(job.work / ECON.garage.faults[job.fault].work, 0, 1);
      const bw = BAY_ROW.w - 20;
      const by = BAY_ROW.h / 2 - 9;
      b.bar.fillStyle(0x0b0e13, 0.8).fillRoundedRect(-this.px(bw / 2), this.px(by), this.px(bw), this.px(4), this.px(2));
      if (left < 0.95) b.bar.fillStyle(0x3bc45a, 1).fillRoundedRect(-this.px(bw / 2), this.px(by), this.px(bw) * (1 - left), this.px(4), this.px(2));
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
    if (!this.calm) {
      this.tweens.killTweensOf(this.bump);
      this.bump.v = 0;
      this.tweens.add({ targets: this.bump, v: 1, yoyo: true, duration: 60 });
    }
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
    const from = big ? { x: this.bigCar.x, y: this.bigCar.y } : { x: this.scale.width / 2, y: this.px(this.focusArea().rowY) };
    if (big) {
      sfx.repaired();
      this.glitter.explode(18, this.bigCar.x, this.bigCar.y - this.bigCar.displayHeight * 0.2);
      this.bubble.setVisible(false);
      this.speech.setVisible(false);
      this.barG.clear();
      if (job.fault === 'tyre') this.fitTyre(job);
      this.driveOff(job.id, job.fault === 'tyre' && !this.calm ? 380 : 0);
      const note = parts > 0 ? `Yard parts −${parts} ⚙` : `Parts bill −${Math.round(ECON.garage.partsBill * 100)}%`;
      this.floatText(from.x, from.y - this.bigCar.displayHeight * 0.45, note, parts > 0 ? '#f5b700' : '#c9d1d9', 18);
    } else this.time.delayedCall(800, () => this.releaseTextures(job.id));
    this.coinBurst(from.x, from.y, amount);
  }

  private driveOff(id: number, wait = 0) {
    this.carLeaving = true;
    this.arriving = false;
    this.bigJobId = null;
    this.customerLeaves();
    this.tweens.killTweensOf(this.lift);
    this.speech.setVisible(false);
    // Lower the lift, then drive out to the right.
    this.tweens.add({ targets: this.lift, v: 0, duration: this.calm ? 1 : 220, ease: 'Sine.easeIn' });
    this.tweens.add({
      targets: [this.bigCar, this.bigRust],
      x: this.scale.width + this.bigCar.displayWidth,
      delay: this.calm ? 0 : 240 + wait,
      onStart: () => sfx.engine(),
      duration: this.calm ? 1 : 520,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        this.carLeaving = false;
        // Point the images at a stock texture before freeing the car's: poseCar() reads their size every frame.
        this.bigCar.setTexture('__WHITE').setVisible(false);
        this.bigRust.setTexture('__WHITE').setVisible(false);
        this.tyre.setVisible(false);
        this.tyreFit = null;
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
