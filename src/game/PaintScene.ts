// Paint & Tuning scene (P1.2e): the customer's car stands on the booth's grate with an order ticket above it (one icon
// per service, the current one ringed, a progress bar and the quick-finish tip timer). Tap the car to work: a respray
// or wrap sweeps the new colour across the car, custom rims fade in, a tune lights a flame decal and spits fire from
// the exhaust. When the last service is done the customer pays (plus the tip) and drives off. Like the other scenes,
// this one runs the core tick for every business and forwards every event to the bridge.

import Phaser from 'phaser';
import { sfx } from '../audio/sfx';
import { ECON, type PaintService } from '../core/config';
import { formatCash } from '../core/format';
import { currentService, findPaintJob, focusPaintJob, paintTap, tipDeadline, tipFor } from '../core/paint';
import { tick, type GameEvent } from '../core/sim';
import type { PaintJob } from '../core/state';
import type { Bridge } from './bridge';
import { BUYER_H, BUYER_W, paintBuyer } from './buyerArt';
import { SHAPES, WHEEL_Y, carTextureSize, paintCar } from './carArt';
import { customerKind } from './garageArt';
import {
  BOOTH_AREA_TOP,
  BOOTH_ROW,
  exhaustSpot,
  paintBoothBackdrop,
  paintPainter,
  paintRimsOverlay,
  paintTuneOverlay,
  paintWrapStripes,
  serviceReveal,
  stepProgress,
  TICKET,
  ticketTop,
  ticketWidth,
  type ServiceReveal,
} from './paintArt';
import { pruneFloaters, stackY, type Floater } from './floatStack';

const PERSON_H = 82;
const ROOF_FRAC = Math.min(...Object.values(SHAPES).map((sh) => Math.min(...sh.body.map((p) => p[1]))));

interface BoothView {
  jobId: number;
  container: Phaser.GameObjects.Container;
  bar: Phaser.GameObjects.Graphics;
}

export class PaintScene extends Phaser.Scene {
  private bridge!: Bridge;
  private bg!: Phaser.GameObjects.Image;
  private shadowG!: Phaser.GameObjects.Graphics;
  /** The car as it came in, the new colour (cropped while it is sprayed on), then the stripes, rims and tune layers. */
  private bigCar!: Phaser.GameObjects.Image;
  private newCar!: Phaser.GameObjects.Image;
  private stripes!: Phaser.GameObjects.Image;
  private rims!: Phaser.GameObjects.Image;
  private tune!: Phaser.GameObjects.Image;
  private bigScale = 1;
  private bigId: number | null = null;
  private texW = 512;
  private texH = 256;
  private carLeaving = false;
  private arriving = false;
  private label!: Phaser.GameObjects.Text;
  private ticket!: Phaser.GameObjects.Container;
  private ticketG!: Phaser.GameObjects.Graphics;
  private ticketIcons: Phaser.GameObjects.Text[] = [];
  private ticketTip!: Phaser.GameObjects.Text;
  private ticketW = 170;
  private mist!: Phaser.GameObjects.Particles.ParticleEmitter;
  private glitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  private flame!: Phaser.GameObjects.Particles.ParticleEmitter;
  private smoke!: Phaser.GameObjects.Particles.ParticleEmitter;
  private painter!: Phaser.GameObjects.Image;
  private customer!: Phaser.GameObjects.Image;
  private booths: BoothView[] = [];
  private boothsKey = '';
  private floaters: Floater[] = [];
  private layoutInsets = '';
  private insetCheck = 0;
  private painterTimer = 0;
  private bump = { v: 0 };
  private clock = 0;
  private shown: ServiceReveal = { colour: 0, stripes: 0, rims: 0, tune: 0 };

  constructor() {
    super('paint');
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

  /** Same geometry as the garage and the lot: booth thumbnails under the HUD, the car in the middle. */
  private focusArea() {
    const { top, bottom } = this.bridge.insets();
    const areaTop = top + BOOTH_AREA_TOP;
    const areaBottom = this.cssH - bottom;
    const carW = Math.min(this.cssW * 0.8, 400);
    return { cx: this.cssW / 2, cy: areaTop + (areaBottom - areaTop) * 0.55, carW, top: areaTop, bottom: areaBottom, rowY: top + BOOTH_ROW.y, hudTop: top };
  }

  create() {
    const size = carTextureSize(this.px(this.focusArea().carW));
    this.texW = size.w;
    this.texH = size.h;
    this.bg = this.add.image(0, 0, '__WHITE').setOrigin(0, 0).setVisible(false);
    this.shadowG = this.add.graphics();
    this.bigCar = this.add.image(0, 0, '__WHITE').setVisible(false);
    this.newCar = this.add.image(0, 0, '__WHITE').setVisible(false);
    this.stripes = this.add.image(0, 0, '__WHITE').setVisible(false);
    this.tune = this.add.image(0, 0, '__WHITE').setVisible(false);
    this.rims = this.add.image(0, 0, '__WHITE').setVisible(false);
    this.painter = this.add
      .image(0, 0, this.paintedTexture('crew-painter', BUYER_W, BUYER_H, paintPainter))
      .setOrigin(0.5, 1)
      .setDepth(2)
      .setVisible(false);
    this.customer = this.add.image(0, 0, '__WHITE').setOrigin(0.5, 1).setDepth(2).setVisible(false);
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
    this.ticketG = this.add.graphics();
    this.ticketTip = this.add
      .text(0, 0, '', { fontFamily: 'Nunito, sans-serif', fontStyle: '800', fontSize: `${this.px(11)}px`, color: '#1e2430', align: 'center', lineSpacing: -this.px(2) })
      .setOrigin(0.5);
    this.ticket = this.add.container(0, 0, [this.ticketG, this.ticketTip]).setDepth(6).setVisible(false);

    this.mist = this.add.particles(0, 0, 'puff', {
      speedX: { min: -40, max: 40 },
      speedY: { min: -50, max: 10 },
      lifespan: 700,
      scale: { start: 0.35, end: 1.1 },
      alpha: { start: 0.55, end: 0 },
      emitting: false,
    });
    this.mist.setDepth(3);
    this.glitter = this.add.particles(0, 0, 'star', {
      speed: { min: 40, max: 200 },
      angle: { min: 0, max: 360 },
      lifespan: 900,
      scale: { start: 1.1, end: 0 },
      blendMode: 'ADD',
      emitting: false,
    });
    this.glitter.setDepth(7);
    this.flame = this.add.particles(0, 0, 'spark', {
      speedX: { min: -420, max: -180 },
      speedY: { min: -40, max: 40 },
      lifespan: 320,
      scale: { start: 1.6, end: 0 },
      tint: [0xfff1b8, 0xf5b700, 0xe8762b, 0xe5484d],
      blendMode: 'ADD',
      emitting: false,
    });
    this.flame.setDepth(3);
    this.smoke = this.add.particles(0, 0, 'puff', {
      speedX: { min: -80, max: -30 },
      speedY: { min: -40, max: -10 },
      lifespan: 900,
      scale: { start: 0.3, end: 1.2 },
      alpha: { start: 0.35, end: 0 },
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
    this.boothsKey = '';
    if (this.customer.visible && !this.carLeaving) {
      const spot = this.customerSpot();
      this.customer.setPosition(spot.x, spot.y);
    }
  }

  private watchInsets(dt: number) {
    this.insetCheck -= dt;
    if (this.insetCheck > 0) return;
    this.insetCheck = 0.5;
    const { top, bottom } = this.bridge.insets();
    if (`${Math.round(top)},${Math.round(bottom)}` !== this.layoutInsets) this.layout();
  }

  private roofY(): number {
    const a = this.focusArea();
    return a.cy - a.carW / 4 + ROOF_FRAC * (a.carW / 2);
  }

  private drawBackground() {
    const W = Math.round(this.scale.width);
    const H = Math.round(this.scale.height);
    const a = this.focusArea();
    if (this.textures.exists('paint-backdrop')) this.textures.remove('paint-backdrop');
    const tex = this.textures.createCanvas('paint-backdrop', W, H);
    if (!tex) return;
    paintBoothBackdrop(tex.getContext(), {
      w: W,
      h: H,
      floorY: this.px(a.top + (a.cy - a.top) * 0.62),
      s: this.dpr,
      stage: { cx: W / 2, groundY: this.px(a.cy + a.carW * 0.13), carW: this.px(a.carW) },
      sign: ECON.businesses.list.paint.name.toUpperCase(),
      reservedTop: this.px(a.hudTop + BOOTH_ROW.y + BOOTH_ROW.h / 2 + 4),
      // The sign hangs above the order ticket, which sits on the car's roof.
      roofY: this.px(ticketTop(this.roofY()) - 4),
    });
    tex.refresh();
    this.bg.setTexture('paint-backdrop').setPosition(0, 0).setVisible(true);
    this.children.sendToBack(this.bg);
  }

  update(_time: number, deltaMs: number) {
    const dt = Math.min(deltaMs / 1000, 0.25);
    const events = tick(this.bridge.state, dt);
    if (events.length) this.handleEvents(events);
    this.clock += dt;
    this.syncBigCar();
    this.poseCar();
    this.syncPainter();
    this.syncBooths();
    this.watchInsets(dt);
    // The Painter's spray on the car he works on (the oldest order).
    const p = this.bridge.state.paint;
    this.painterTimer -= dt;
    const job = p.jobs[0];
    if (p.painter && job && job.id === this.bigId && !this.carLeaving && !this.arriving && this.painterTimer <= 0) {
      this.painterTimer = 0.45;
      this.serviceFx(job, false);
    }
  }

  // ---- the car in the booth -------------------------------------------------

  private focused(): PaintJob | undefined {
    return findPaintJob(this.bridge.state, this.bridge.state.paint.focusedId);
  }

  private makeTexture(key: string, paint: (ctx: CanvasRenderingContext2D) => void) {
    if (this.textures.exists(key)) return;
    const tex = this.textures.createCanvas(key, this.texW, this.texH);
    if (!tex) return;
    paint(tex.getContext());
    tex.refresh();
  }

  /** The car's textures: as it came in, in its new colour, its wrap stripes; rims and tune layers are per family. */
  private ensureTextures(job: PaintJob): string {
    const key = `pcar-${job.id}`;
    const { texW: w, texH: h } = this;
    this.makeTexture(key, (ctx) => paintCar(ctx, { family: job.family, paint: job.paint, rarity: 'common' }, w, h, { shadow: false }));
    if (job.services.includes('respray') || job.services.includes('wrap'))
      this.makeTexture(`pnew-${job.id}`, (ctx) => paintCar(ctx, { family: job.family, paint: job.newPaint, rarity: 'common' }, w, h, { shadow: false }));
    if (job.services.includes('wrap')) this.makeTexture(`pstripe-${job.id}`, (ctx) => paintWrapStripes(ctx, job.family, w, h, job.newPaint));
    if (job.services.includes('rims')) this.makeTexture(`prims-${job.family}`, (ctx) => paintRimsOverlay(ctx, job.family, w, h));
    if (job.services.includes('tune')) this.makeTexture(`ptune-${job.family}`, (ctx) => paintTuneOverlay(ctx, job.family, w, h));
    return key;
  }

  private releaseTextures(id: number) {
    for (const k of [`pcar-${id}`, `pnew-${id}`, `pstripe-${id}`]) if (this.textures.exists(k)) this.textures.remove(k);
  }

  private layers() {
    return [this.bigCar, this.newCar, this.stripes, this.tune, this.rims];
  }

  private placeBigCar() {
    const a = this.focusArea();
    this.bigScale = this.px(a.carW) / this.texW;
    for (const o of this.layers()) {
      o.setScale(this.bigScale);
      if (!this.carLeaving) o.setPosition(this.px(a.cx), this.px(a.cy));
    }
    this.label.setPosition(this.px(a.cx), this.px(a.cy + a.carW * 0.16));
  }

  private syncBigCar() {
    const job = this.carLeaving ? undefined : this.focused();
    if (!job) {
      if (!this.carLeaving && this.bigId !== null) {
        this.bigId = null;
        for (const o of this.layers()) o.setTexture('__WHITE').setVisible(false);
      }
      this.ticket.setVisible(false);
      if (!this.carLeaving) this.label.setText('');
      return;
    }
    if (job.id !== this.bigId) {
      this.bigId = job.id;
      this.bigCar.setTexture(this.ensureTextures(job)).setVisible(true);
      const has = (k: PaintService) => job.services.includes(k);
      this.newCar.setTexture(has('respray') || has('wrap') ? `pnew-${job.id}` : '__WHITE').setVisible(has('respray') || has('wrap'));
      this.stripes.setTexture(has('wrap') ? `pstripe-${job.id}` : '__WHITE').setVisible(has('wrap'));
      this.rims.setTexture(has('rims') ? `prims-${job.family}` : '__WHITE').setVisible(has('rims'));
      this.tune.setTexture(has('tune') ? `ptune-${job.family}` : '__WHITE').setVisible(has('tune'));
      this.placeBigCar();
      this.buildTicket(job);
      // Drive in from the left, then the customer steps out on the right.
      const tx = this.bigCar.x;
      this.arriving = true;
      for (const o of this.layers()) {
        o.x = -this.bigCar.displayWidth;
        this.tweens.add({ targets: o, x: tx, duration: this.calm ? 1 : 600, ease: 'Back.easeOut' });
      }
      this.time.delayedCall(this.calm ? 1 : 620, () => this.carArrived(job.id));
      sfx.engine();
    }
    this.label.setText(job.lotCarId !== undefined ? `${job.model} · your lot car` : `${job.model} · ${formatCash(job.fee)}`);
    this.applyReveal(job);
    if (this.arriving) {
      this.ticket.setVisible(false);
      return;
    }
    this.drawTicket(job);
  }

  /** Show each service's layer as far as it is done: the new colour and the stripes sweep in from the back. */
  private applyReveal(job: PaintJob) {
    const r = serviceReveal(job);
    this.shown = r;
    const { texW: w, texH: h } = this;
    if (this.newCar.visible) this.newCar.setCrop(0, 0, Math.round(w * r.colour), h);
    if (this.stripes.visible) this.stripes.setCrop(0, 0, Math.round(w * r.stripes), h);
    this.rims.setAlpha(r.rims);
    this.tune.setAlpha(r.tune);
  }

  private carArrived(id: number) {
    if (this.bigId !== id) return;
    this.arriving = false;
    const job = this.focused();
    if (!job) return;
    if (!this.calm) {
      this.ticket.setScale(0.6);
      this.tweens.add({ targets: this.ticket, scale: 1, duration: 220, ease: 'Back.easeOut' });
    }
    // Your own lot car has no customer waiting for it.
    if (job.lotCarId !== undefined) {
      this.tweens.killTweensOf(this.customer);
      this.customer.setVisible(false);
      return;
    }
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
  }

  private customerSpot() {
    const a = this.focusArea();
    const half = (PERSON_H * BUYER_W) / BUYER_H / 2;
    const x = Math.min(a.cx + a.carW / 2 + 8, this.cssW - half - 2);
    return { x: this.px(x), y: this.px(a.cy + a.carW * 0.13 + 14) };
  }

  private painterSpot() {
    const a = this.focusArea();
    const half = (PERSON_H * BUYER_W) / BUYER_H / 2;
    const x = Math.max(a.cx - a.carW / 2 - 8, half + 2);
    return { x: this.px(x), y: this.px(a.cy + a.carW * 0.13 + 14) };
  }

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

  /** The car's floor shadow and the little dip on each tap. */
  private poseCar() {
    const a = this.focusArea();
    const y = this.px(a.cy) + this.bump.v * this.px(3);
    for (const o of this.layers()) o.setY(y);
    this.shadowG.clear();
    if (!this.bigCar.visible) return;
    const dw = this.px(a.carW);
    const dh = (dw * this.texH) / this.texW;
    this.shadowG.fillStyle(0x000000, 0.22).fillEllipse(this.bigCar.x, this.px(a.cy) + dh * 0.42, dw * 0.88, dh * 0.09);
  }

  private syncPainter() {
    const p = this.bridge.state.paint;
    this.painter.setVisible(p.painter);
    if (!p.painter) return;
    const spot = this.painterSpot();
    this.painter.setScale(this.px(PERSON_H) / (BUYER_H * 2)).setX(spot.x);
    const working = !this.carLeaving && !this.arriving && p.jobs[0] !== undefined && p.jobs[0].id === this.bigId;
    const t = working && !this.calm ? this.clock * 6 : 0;
    this.painter.setY(spot.y - Math.abs(Math.sin(t)) * this.px(2)).setAngle(Math.sin(t) * 3);
  }

  // ---- order ticket -----------------------------------------------------------

  private buildTicket(job: PaintJob) {
    for (const t of this.ticketIcons) t.destroy();
    this.ticketW = ticketWidth(job.services.length);
    this.ticketIcons = job.services.map((k, i) =>
      this.add
        .text(this.slotX(i), -this.px(4), ECON.paint.services[k].icon, { fontSize: `${this.px(14)}px` })
        .setOrigin(0.5),
    );
    this.ticket.add(this.ticketIcons);
    this.ticketTip.setPosition(this.px(this.ticketW / 2 - TICKET.tipW / 2 - 2), -this.px(3));
  }

  /** Centre x of service slot `i` on the ticket, device px from the ticket's centre. */
  private slotX(i: number): number {
    return this.px(-this.ticketW / 2 + TICKET.pad + TICKET.slot / 2 + i * TICKET.slot);
  }

  /** Where the ticket hangs: over the car's roof (the sign is laid out above it), below the HUD. */
  private ticketPos() {
    const a = this.focusArea();
    const y = Math.max(a.hudTop + TICKET.h / 2 + 4, ticketTop(this.roofY()) + TICKET.h / 2);
    return { x: this.px(a.cx), y: this.px(y) };
  }

  private drawTicket(job: PaintJob) {
    const { x, y } = this.ticketPos();
    this.ticket.setPosition(x, y).setVisible(true);
    const g = this.ticketG;
    const w = this.px(this.ticketW);
    const h = this.px(TICKET.h);
    const n = job.services.length;
    g.clear();
    g.fillStyle(0x000000, 0.2).fillRoundedRect(-w / 2 + this.px(2), -h / 2 + this.px(3), w, h, this.px(10));
    g.fillStyle(0xfbf3e4, 1).fillRoundedRect(-w / 2, -h / 2, w, h, this.px(10));
    g.lineStyle(this.px(2.5), 0x8b5cf6, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, this.px(10));
    // One slot per service: green with a tick when done, orange ring on the current one.
    job.services.forEach((_k, i) => {
      const cx = this.slotX(i);
      const cy = -this.px(4);
      const r = this.px(12);
      if (i < job.step) {
        g.fillStyle(0x3bc45a, 0.28).fillCircle(cx, cy, r);
        const tx = cx + r * 0.72;
        const ty = cy - r * 0.62;
        g.fillStyle(0x3bc45a, 1).fillCircle(tx, ty, this.px(5.5));
        g.lineStyle(this.px(2), 0xffffff, 1);
        g.lineBetween(tx - this.px(3), ty, tx - this.px(1), ty + this.px(2.5));
        g.lineBetween(tx - this.px(1), ty + this.px(2.5), tx + this.px(3), ty - this.px(2.5));
      } else if (i === job.step) {
        g.fillStyle(0xe8762b, 0.18).fillCircle(cx, cy, r);
        g.lineStyle(this.px(2.5), 0xe8762b, 1).strokeCircle(cx, cy, r);
      } else g.fillStyle(0x1e2430, 0.08).fillCircle(cx, cy, r);
      this.ticketIcons[i]?.setAlpha(i > job.step ? 0.45 : 1);
    });
    // Progress of the whole order under the slots (the current slot fills as it is worked on).
    const bx = this.px(-this.ticketW / 2 + TICKET.pad);
    const bw = this.px(n * TICKET.slot);
    const by = h / 2 - this.px(8);
    const bh = this.px(5);
    g.fillStyle(0x1e2430, 0.16).fillRoundedRect(bx, by, bw, bh, bh / 2);
    const done = (job.step + stepProgress(job)) / n;
    if (done > 0) g.fillStyle(0x3bc45a, 1).fillRoundedRect(bx, by, Math.max(bh, bw * done), bh, bh / 2);
    // Divider, then the tip column: the tip on offer and the seconds left, with a draining gold bar.
    const dx = bx + bw + this.px(5);
    g.lineStyle(this.px(1.5), 0x8b5cf6, 0.35).lineBetween(dx, -h / 2 + this.px(7), dx, h / 2 - this.px(7));
    const left = tipDeadline(job) - job.age;
    const tipOn = left > 0;
    const lot = job.lotCarId !== undefined;
    const t = lot ? `🏷️ +${formatCash(job.fee)}\nsticker` : tipOn ? `⚡ +${formatCash(tipFor(job))}\ntip · ${Math.ceil(left)}s` : `${job.step}/${n}\ndone`;
    if (this.ticketTip.text !== t) this.ticketTip.setText(t);
    this.ticketTip.setColor(lot ? '#6d28d9' : tipOn ? '#b45309' : '#5d6674');
    if (tipOn && !lot) {
      const tw = this.px(TICKET.tipW - 18);
      const frac = Math.max(0, Math.min(1, left / tipDeadline(job)));
      const tx = this.ticketTip.x - tw / 2;
      g.fillStyle(0x1e2430, 0.12).fillRoundedRect(tx, by, tw, bh, bh / 2);
      g.fillStyle(0xf5b700, 1).fillRoundedRect(tx, by, Math.max(bh, tw * frac), bh, bh / 2);
    }
  }

  // ---- booth thumbnails (2+ booths) -------------------------------------------

  private syncBooths() {
    const p = this.bridge.state.paint;
    const key = `${p.booths}|${p.jobs.map((j) => `${j.id}:${j.step}`).join(',')}|${p.focusedId}`;
    if (key !== this.boothsKey) {
      this.boothsKey = key;
      for (const b of this.booths) b.container.destroy();
      this.booths = [];
      if (p.booths > 1) {
        const a = this.focusArea();
        const { w, h, gap } = BOOTH_ROW;
        const total = p.booths * w + (p.booths - 1) * gap;
        for (let i = 0; i < p.booths; i++) {
          const job = p.jobs[i];
          const x = this.px(a.cx - total / 2 + i * (w + gap) + w / 2);
          const frame = this.add.graphics();
          const focused = job && job.id === p.focusedId;
          frame.fillStyle(0x1e2430, BOOTH_ROW.alpha).fillRoundedRect(-this.px(w / 2), -this.px(h / 2), this.px(w), this.px(h), this.px(10));
          frame.lineStyle(this.px(focused ? 3 : 1.5), focused ? 0xf5b700 : 0xfbf3e4, focused ? 1 : 0.4);
          frame.strokeRoundedRect(-this.px(w / 2), -this.px(h / 2), this.px(w), this.px(h), this.px(10));
          const bar = this.add.graphics();
          const items: Phaser.GameObjects.GameObject[] = [frame, bar];
          if (job) {
            this.ensureTextures(job);
            const recolored = serviceReveal(job).colour >= 1;
            const img = this.add.image(-this.px(6), -this.px(4), recolored ? `pnew-${job.id}` : `pcar-${job.id}`);
            img.setScale(this.px(w - 24) / this.texW);
            const svc = currentService(job);
            const icon = this.add.text(this.px(w / 2 - 13), -this.px(h / 2 - 12), svc ? ECON.paint.services[svc].icon : '✓', { fontSize: `${this.px(12)}px` }).setOrigin(0.5);
            items.push(img, icon);
          } else {
            items.push(this.add.text(0, 0, 'Free booth', { fontFamily: 'Nunito, sans-serif', fontStyle: '700', fontSize: `${this.px(11)}px`, color: '#fbf3e4' }).setOrigin(0.5).setAlpha(0.7));
          }
          const container = this.add.container(x, this.px(a.rowY), items).setDepth(4);
          container.setSize(this.px(w), this.px(h));
          this.booths.push({ jobId: job?.id ?? -1, container, bar });
        }
      }
    }
    for (const b of this.booths) {
      const job = findPaintJob(this.bridge.state, b.jobId);
      b.bar.clear();
      if (!job) continue;
      const done = (job.step + stepProgress(job)) / job.services.length;
      const bw = BOOTH_ROW.w - 20;
      const by = BOOTH_ROW.h / 2 - 9;
      b.bar.fillStyle(0x0b0e13, 0.8).fillRoundedRect(-this.px(bw / 2), this.px(by), this.px(bw), this.px(4), this.px(2));
      if (done > 0.03) b.bar.fillStyle(0x8b5cf6, 1).fillRoundedRect(-this.px(bw / 2), this.px(by), this.px(bw) * done, this.px(4), this.px(2));
    }
  }

  // ---- input --------------------------------------------------------------

  private onPointerDown(p: Phaser.Input.Pointer) {
    this.bridge.onInput();
    sfx.unlock();
    for (const b of this.booths) {
      if (b.jobId < 0) continue;
      if (b.container.getBounds().contains(p.x, p.y)) {
        focusPaintJob(this.bridge.state, b.jobId);
        sfx.tap();
        return;
      }
    }
    const job = this.focused();
    if (!job || this.carLeaving || this.arriving || !this.bigCar.visible) return;
    if (!this.bigCar.getBounds().contains(p.x, p.y)) return;
    this.serviceFx(job, true);
    if (!this.calm) {
      this.tweens.killTweensOf(this.bump);
      this.bump.v = 0;
      this.tweens.add({ targets: this.bump, v: 1, yoyo: true, duration: 60 });
    }
    this.handleEvents(paintTap(this.bridge.state, job.id));
  }

  /** The effect of one bit of work on the current service: spray mist at the colour's edge, a glint on a rim, a
   * flame from the exhaust. `sound` is off for the Painter's work (he works quietly). */
  private serviceFx(job: PaintJob, sound: boolean) {
    const svc = currentService(job);
    if (!svc) return;
    const car = this.bigCar;
    const dw = car.displayWidth;
    const dh = car.displayHeight;
    const left = car.x - dw / 2;
    const top = car.y - dh / 2;
    const n = this.calm ? 1 : 3;
    if (svc === 'respray' || svc === 'wrap') {
      const edge = left + dw * Math.min(0.97, Math.max(0.05, stepProgress(job)));
      this.mist.setParticleTint(job.newPaint);
      this.mist.explode(n, edge, top + dh * Phaser.Math.FloatBetween(0.35, 0.65));
      if (sound) sfx.spray();
    } else if (svc === 'rims') {
      const wheels = SHAPES[job.family].wheels;
      const fx = wheels[Math.floor(Math.random() * 2)] ?? wheels[0];
      this.glitter.explode(this.calm ? 1 : 2, left + dw * fx, top + dh * WHEEL_Y);
      if (sound) sfx.wrench();
    } else {
      const [ex, ey] = exhaustSpot(job.family);
      this.flame.explode(this.calm ? 2 : 6, left + dw * ex, top + dh * ey);
      this.smoke.emitParticleAt(left + dw * ex, top + dh * ey, 1);
      if (sound) sfx.rev();
    }
  }

  // ---- events -------------------------------------------------------------

  handleEvents(events: GameEvent[]) {
    for (const e of events) {
      if (e.type === 'paintStepDone' && e.job.id === this.bigId && e.job.step < e.job.services.length) this.onStepDone(e.job, e.service);
      if (e.type === 'paintDone') this.onDone(e.job, e.amount, e.tip);
      if (e.type === 'paintLotCarDone') this.onDone(e.job, 0, 0, e.value);
    }
    this.bridge.onEvents(events);
  }

  private onStepDone(job: PaintJob, service: PaintService) {
    const car = this.bigCar;
    sfx.repaired();
    this.glitter.explode(this.calm ? 4 : 10, car.x, car.y - car.displayHeight * 0.15);
    this.floatText(car.x, car.y - car.displayHeight * 0.4, `✓ ${ECON.paint.services[service].name}`, '#c7b8e8', 18);
    if (service === 'tune') this.tuneBurst(job);
  }

  private tuneBurst(job: PaintJob) {
    const car = this.bigCar;
    const [ex, ey] = exhaustSpot(job.family);
    const x = car.x - car.displayWidth / 2 + car.displayWidth * ex;
    const y = car.y - car.displayHeight / 2 + car.displayHeight * ey;
    this.flame.explode(this.calm ? 4 : 16, x, y);
    sfx.rev();
  }

  /** An order is done: the car drives off. A lot car (P1.2f) pays nothing here; its sticker went up by `lotValue`. */
  private onDone(job: PaintJob, amount: number, tip: number, lotValue = 0) {
    const big = job.id === this.bigId;
    const from = big ? { x: this.bigCar.x, y: this.bigCar.y } : { x: this.scale.width / 2, y: this.px(this.focusArea().rowY) };
    if (big) {
      sfx.repaired();
      if (job.services.includes('tune') && job.services[job.services.length - 1] === 'tune') this.tuneBurst(job);
      this.glitter.explode(this.calm ? 6 : 20, this.bigCar.x, this.bigCar.y - this.bigCar.displayHeight * 0.2);
      this.ticket.setVisible(false);
      // Show the finished car fully while it leaves.
      this.applyReveal({ ...job, step: job.services.length, work: 0 });
      this.driveOff(job.id);
    } else this.time.delayedCall(800, () => this.releaseTextures(job.id));
    if (job.lotCarId !== undefined) this.floatText(from.x, from.y - this.px(40), `🏷️ Back to the lot +${formatCash(lotValue)}`, '#c7b8e8', 22);
    else this.coinBurst(from.x, from.y, amount - tip);
    if (tip > 0) {
      this.floatText(from.x, from.y - this.px(70), `⚡ Quick tip +${formatCash(tip)}`, '#f5b700', 22);
      sfx.bonus();
    }
  }

  private customerLeaves() {
    if (!this.customer.visible) return;
    this.tweens.killTweensOf(this.customer);
    const y = this.customer.y;
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

  private driveOff(id: number) {
    this.carLeaving = true;
    this.arriving = false;
    this.bigId = null;
    this.customerLeaves();
    this.tweens.add({
      targets: this.layers(),
      x: this.scale.width + this.bigCar.displayWidth,
      delay: this.calm ? 0 : 260,
      onStart: () => sfx.engine(),
      duration: this.calm ? 1 : 520,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        this.carLeaving = false;
        for (const o of this.layers()) o.setTexture('__WHITE').setVisible(false);
        this.label.setText('');
        this.placeBigCar();
        this.releaseTextures(id);
      },
    });
  }

  private floatText(x: number, y0: number, msg: string, color: string, size: number) {
    const now = this.time.now;
    const h = this.px(size * 1.15);
    this.floaters = pruneFloaters(this.floaters, now);
    const y = stackY(this.floaters, x, y0, h, now, this.px(160));
    this.floaters.push({ x, y, h, born: now });
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

  /** State for the browser test. */
  debugView() {
    const job = this.focused();
    return {
      bigId: this.bigId,
      carVisible: this.bigCar.visible,
      arriving: this.arriving,
      leaving: this.carLeaving,
      painter: this.painter.visible,
      customer: this.customer.visible,
      booths: this.booths.length,
      ticket: this.ticket.visible,
      ticketIcons: this.ticketIcons.map((t) => t.text).join(''),
      tipText: this.ticketTip.text,
      /** What the car shows (colour/stripes crop width and rims/tune alpha, 0..1), as last applied. */
      shown: { ...this.shown },
      reveal: job ? serviceReveal(job) : null,
    };
  }
}
