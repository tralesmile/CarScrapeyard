import Phaser from 'phaser';
import { sfx } from '../audio/sfx';
import { ECON } from '../core/config';
import { formatCash } from '../core/format';
import { carStage, findCar, focusCar, repairTap, tick, washCar, type GameEvent } from '../core/sim';
import type { Car } from '../core/state';
import type { Bridge } from './bridge';
import { drawCar, drawRust, mudSpots } from './carArt';

/** Car textures are drawn at this size and scaled for display. */
const TEX_W = 720;
const TEX_H = 360;
/** Design width of the layout, in CSS pixels. Swipe distances are measured in this unit. */
const DESIGN_W = 390;

const MUD = 0x6b4a2b;

interface SlotView {
  carId: number;
  container: Phaser.GameObjects.Container;
  frame: Phaser.GameObjects.Graphics;
  image: Phaser.GameObjects.Image;
  dirt: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
  bar: Phaser.GameObjects.Graphics;
}

export class YardScene extends Phaser.Scene {
  private bridge!: Bridge;
  private bg!: Phaser.GameObjects.Graphics;
  private bay!: Phaser.GameObjects.Graphics;

  private bigCar!: Phaser.GameObjects.Image;
  private bigRust!: Phaser.GameObjects.Image;
  private bigDirt!: Phaser.GameObjects.RenderTexture;
  private shine!: Phaser.GameObjects.Rectangle;
  private bigCarId: number | null = null;
  private bigScale = 1;
  private carLeaving = false;

  private slots: SlotView[] = [];
  private sparks!: Phaser.GameObjects.Particles.ParticleEmitter;
  private drops!: Phaser.GameObjects.Particles.ParticleEmitter;
  private glitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  private smoke!: Phaser.GameObjects.Particles.ParticleEmitter;

  private lastPointer: Phaser.Math.Vector2 | null = null;
  private smokeTimer = 0;

  constructor() {
    super('yard');
  }

  init(data: { bridge: Bridge }) {
    this.bridge = data.bridge;
  }

  // ---- helpers -------------------------------------------------------------

  private get dpr() {
    return this.bridge.dpr;
  }
  /** CSS px -> canvas px */
  private px(css: number) {
    return css * this.dpr;
  }
  private get cssW() {
    return this.scale.width / this.dpr;
  }
  private get cssH() {
    return this.scale.height / this.dpr;
  }

  private focusArea() {
    const { top, bottom } = this.bridge.insets();
    const slotRowBottom = top + 86;
    const areaTop = slotRowBottom + 10;
    const areaBottom = this.cssH - bottom;
    const carW = Math.min(this.cssW * 0.88, 430);
    return {
      cx: this.cssW / 2,
      cy: areaTop + (areaBottom - areaTop) * 0.5,
      carW,
      top: areaTop,
      bottom: areaBottom,
      slotY: top + 8,
    };
  }

  // ---- lifecycle -----------------------------------------------------------

  create() {
    this.makeTextures();
    this.bg = this.add.graphics();
    this.bay = this.add.graphics();

    this.bigCar = this.add.image(0, 0, '__WHITE').setVisible(false);
    this.bigRust = this.add.image(0, 0, '__WHITE').setVisible(false);
    this.bigDirt = this.add.renderTexture(0, 0, TEX_W, TEX_H).setVisible(false);
    this.shine = this.add.rectangle(0, 0, 40, 10, 0xffffff, 0.55).setVisible(false).setBlendMode(Phaser.BlendModes.ADD);

    this.drops = this.add.particles(0, 0, 'drop', {
      speed: { min: 120, max: 380 },
      angle: { min: 200, max: 340 },
      gravityY: 900,
      lifespan: 500,
      scale: { start: 0.9, end: 0.2 },
      alpha: { start: 0.9, end: 0 },
      emitting: false,
    });
    this.sparks = this.add.particles(0, 0, 'spark', {
      speed: { min: 150, max: 450 },
      angle: { min: 0, max: 360 },
      gravityY: 700,
      lifespan: 420,
      scale: { start: 1, end: 0 },
      blendMode: 'ADD',
      emitting: false,
    });
    this.glitter = this.add.particles(0, 0, 'star', {
      speed: { min: 40, max: 200 },
      angle: { min: 0, max: 360 },
      lifespan: 900,
      scale: { start: 1.1, end: 0 },
      rotate: { min: 0, max: 360 },
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

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onPointerDown(p));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.onPointerMove(p));
    this.input.on('pointerup', () => (this.lastPointer = null));
    this.input.on('pointerupoutside', () => (this.lastPointer = null));

    this.scale.on('resize', () => this.layout());
    this.layout();
  }

  /** Re-place everything after a resize or orientation change. */
  layout() {
    this.drawBackground();
    this.placeBigCar();
    this.rebuildSlots();
  }

  update(_time: number, deltaMs: number) {
    // Phaser caps delta after a hidden tab; long gaps are handled by applyElapsed in main.
    const dt = Math.min(deltaMs / 1000, 0.25);
    const events = tick(this.bridge.state, dt);
    if (events.length) this.handleEvents(events);

    this.syncBigCar();
    this.syncSlots();

    // Smoke from damaged engines.
    const car = this.focused();
    this.smokeTimer -= dt;
    if (car && !this.carLeaving && car.dirt === 0 && car.damage > 0.3 && this.smokeTimer <= 0) {
      this.smokeTimer = 0.35;
      this.smoke.emitParticleAt(this.bigCar.x + this.bigCar.displayWidth * 0.38, this.bigCar.y - this.bigCar.displayHeight * 0.05, 1);
    }
  }

  // ---- textures ------------------------------------------------------------

  private makeTextures() {
    const g = this.make.graphics({}, false);
    const circle = (key: string, r: number, color: number, alpha = 1) => {
      g.clear();
      g.fillStyle(color, alpha);
      g.fillCircle(r, r, r);
      g.generateTexture(key, r * 2, r * 2);
    };
    circle('drop', 6, 0x9fd8ff);
    circle('spark', 5, 0xffd34d);
    circle('puff', 18, 0x9aa4b2, 0.8);
    circle('mud', 16, MUD);

    // Soft brush for the pressure washer.
    g.clear();
    for (let i = 10; i > 0; i--) {
      g.fillStyle(0xffffff, 0.12);
      g.fillCircle(40, 40, i * 4);
    }
    g.generateTexture('brush', 80, 80);

    // Coin.
    g.clear();
    g.fillStyle(0xb98a00, 1);
    g.fillCircle(16, 16, 16);
    g.fillStyle(0xf5b700, 1);
    g.fillCircle(16, 15, 13);
    g.fillStyle(0xffe27a, 1);
    g.fillCircle(13, 12, 5);
    g.generateTexture('coin', 32, 32);

    // Star.
    g.clear();
    g.fillStyle(0xffffff, 1);
    const pts: Phaser.Math.Vector2[] = [];
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? 12 : 4;
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      pts.push(new Phaser.Math.Vector2(12 + Math.cos(a) * r, 12 + Math.sin(a) * r));
    }
    g.fillPoints(pts, true);
    g.generateTexture('star', 24, 24);
    g.destroy();
  }

  /** Make (once) the clean and rust textures for a car. */
  private ensureCarTextures(car: Car) {
    const key = `car-${car.id}`;
    if (this.textures.exists(key)) return key;
    const g = this.make.graphics({}, false);
    drawCar(g, car, TEX_W, TEX_H);
    g.generateTexture(key, TEX_W, TEX_H);
    g.clear();
    drawRust(g, car.family, TEX_W, TEX_H, car.id);
    g.generateTexture(`rust-${car.id}`, TEX_W, TEX_H);
    g.destroy();
    return key;
  }

  private releaseCarTextures(id: number) {
    for (const k of [`car-${id}`, `rust-${id}`]) if (this.textures.exists(k)) this.textures.remove(k);
  }

  // ---- background ----------------------------------------------------------

  private drawBackground() {
    const W = this.scale.width;
    const H = this.scale.height;
    const g = this.bg;
    const a = this.focusArea();
    const horizon = this.px(a.top + (a.cy - a.top) * 0.55);
    g.clear();

    // Sky.
    g.fillGradientStyle(0x7ec8e3, 0x7ec8e3, 0xf6d8a8, 0xf6d8a8, 1);
    g.fillRect(0, 0, W, horizon);
    g.fillStyle(0xffe7a3, 0.9);
    g.fillCircle(W * 0.8, horizon * 0.45, this.px(26));

    // Hills.
    g.fillStyle(0xc9a27a, 1);
    g.fillEllipse(W * 0.2, horizon, W * 0.8, this.px(90));
    g.fillStyle(0xb88e66, 1);
    g.fillEllipse(W * 0.85, horizon, W * 0.7, this.px(70));

    // Junk piles behind the fence.
    const pile = (x: number, w: number, h: number, c: number) => {
      g.fillStyle(c, 1);
      g.fillTriangle(x - w / 2, horizon, x, horizon - h, x + w / 2, horizon);
    };
    pile(W * 0.12, this.px(150), this.px(55), 0x7d6a5a);
    pile(W * 0.3, this.px(110), this.px(38), 0x8e7967);
    pile(W * 0.88, this.px(160), this.px(60), 0x7a6656);
    // Tyres on the piles.
    g.fillStyle(0x2b2f36, 1);
    for (const [x, y] of [[0.1, 22], [0.15, 34], [0.86, 30], [0.9, 18]] as const) {
      g.fillCircle(W * x, horizon - this.px(y), this.px(7));
    }

    // Ground.
    g.fillStyle(0xa4835f, 1);
    g.fillRect(0, horizon, W, H - horizon);
    g.fillStyle(0x94744f, 1);
    for (let i = 0; i < 18; i++) {
      const x = ((i * 97) % 100) / 100;
      const y = ((i * 61) % 100) / 100;
      g.fillEllipse(W * x, horizon + (H - horizon) * y, this.px(30), this.px(6));
    }

    // Fence.
    g.lineStyle(this.px(2), 0x5b4636, 1);
    g.lineBetween(0, horizon - this.px(18), W, horizon - this.px(18));
    g.lineBetween(0, horizon - this.px(6), W, horizon - this.px(6));
    for (let x = this.px(10); x < W; x += this.px(28)) {
      g.fillStyle(0x6e5442, 1);
      g.fillRect(x, horizon - this.px(28), this.px(5), this.px(28));
    }

    // Work bay under the car.
    const bay = this.bay;
    bay.clear();
    const bw = this.px(a.carW * 1.08);
    const bh = this.px(a.carW * 0.2);
    const by = this.px(a.cy + a.carW * 0.2);
    bay.fillStyle(0xc4c9d1, 1);
    bay.fillRoundedRect(W / 2 - bw / 2, by - bh / 2, bw, bh, this.px(14));
    bay.lineStyle(this.px(3), 0xf5b700, 1);
    bay.strokeRoundedRect(W / 2 - bw / 2 + this.px(6), by - bh / 2 + this.px(6), bw - this.px(12), bh - this.px(12), this.px(10));
  }

  // ---- the big car in the bay ----------------------------------------------

  private focused(): Car | undefined {
    return findCar(this.bridge.state, this.bridge.state.focusedId);
  }

  private placeBigCar() {
    const a = this.focusArea();
    this.bigScale = this.px(a.carW) / TEX_W;
    for (const o of [this.bigCar, this.bigRust, this.bigDirt]) {
      o.setScale(this.bigScale);
      if (!this.carLeaving) o.setPosition(this.px(a.cx), this.px(a.cy));
    }
  }

  private fillDirt(car: Car) {
    const rt = this.bigDirt;
    rt.clear();
    rt.draw(`car-${car.id}`, 0, 0, 1, MUD);
    for (const s of mudSpots(car.family, TEX_W, TEX_H, car.id)) {
      rt.draw('mud', s.x - 16, s.y - 16, 0.9, 0x4a3220);
    }
  }

  /** Show whichever car is focused; animate a new one driving in. */
  private syncBigCar() {
    if (this.carLeaving) return;
    const car = this.focused();
    if (!car) {
      if (this.bigCarId !== null) this.hideBigCar();
      return;
    }
    if (car.id !== this.bigCarId) {
      const key = this.ensureCarTextures(car);
      this.bigCarId = car.id;
      this.bigCar.setTexture(key).setVisible(true);
      this.bigRust.setTexture(`rust-${car.id}`).setVisible(true);
      if (car.dirt > 0) this.fillDirt(car);
      else this.bigDirt.clear();
      this.bigDirt.setVisible(true);
      this.placeBigCar();
      // Drive in from the left.
      const targetX = this.bigCar.x;
      for (const o of [this.bigCar, this.bigRust, this.bigDirt]) {
        o.x = -this.bigCar.displayWidth;
        this.tweens.add({ targets: o, x: targetX, duration: 550, ease: 'Back.easeOut' });
      }
      sfx.engine();
    }
    this.bigRust.setAlpha(car.dirt > 0 ? 1 : car.damage);
    this.bigDirt.setAlpha(car.dirt > 0 ? 0.3 + 0.7 * car.dirt : 0);
  }

  private hideBigCar() {
    this.bigCarId = null;
    this.bigCar.setVisible(false);
    this.bigRust.setVisible(false);
    this.bigDirt.setVisible(false);
  }

  private carBounds(): Phaser.Geom.Rectangle {
    return this.bigCar.getBounds();
  }

  private onPointerDown(p: Phaser.Input.Pointer) {
    this.bridge.onInput();
    sfx.unlock();
    // Tapping a car in the lot row focuses it.
    for (const s of this.slots) {
      if (s.container.getBounds().contains(p.x, p.y)) {
        focusCar(this.bridge.state, s.carId);
        sfx.tap();
        return;
      }
    }
    const car = this.focused();
    if (!car || this.carLeaving || !this.carBounds().contains(p.x, p.y)) return;
    this.lastPointer = new Phaser.Math.Vector2(p.x, p.y);
    const stage = carStage(car);
    if (stage === 'damaged') {
      const events = repairTap(this.bridge.state, car.id);
      this.sparks.explode(14, p.x, p.y);
      sfx.wrench();
      this.tweens.add({ targets: [this.bigCar, this.bigRust], angle: { from: -1.2, to: 0 }, duration: 120 });
      this.cameras.main.shake(60, 0.002);
      if (events.length) this.handleEvents(events);
    } else if (stage === 'dirty') {
      this.washAt(car, p.x, p.y, 0);
    }
  }

  private onPointerMove(p: Phaser.Input.Pointer) {
    if (!p.isDown || !this.lastPointer) return;
    const car = this.focused();
    if (!car || this.carLeaving || car.dirt <= 0) return;
    const dist = Phaser.Math.Distance.Between(p.x, p.y, this.lastPointer.x, this.lastPointer.y);
    this.lastPointer.set(p.x, p.y);
    if (!this.carBounds().contains(p.x, p.y)) return;
    // Convert to design pixels so swipe effort is the same on every screen size.
    const designPx = (dist / this.dpr) * (DESIGN_W / this.cssW);
    this.washAt(car, p.x, p.y, designPx);
  }

  private washAt(car: Car, x: number, y: number, designPx: number) {
    const local = this.bigDirt.getLocalPoint(x, y);
    this.bigDirt.erase('brush', local.x - 40, local.y - 40);
    this.bigDirt.erase('brush', local.x - 30, local.y - 50);
    this.drops.explode(3, x, y);
    sfx.wash();
    if (designPx > 0) {
      const events = washCar(this.bridge.state, car.id, designPx);
      if (events.length) this.handleEvents(events);
    }
  }

  // ---- lot row (small cars) -------------------------------------------------

  private rebuildSlots() {
    for (const s of this.slots) s.container.destroy();
    this.slots = [];
    this.syncSlots();
  }

  private slotGeometry(index: number, count: number) {
    const a = this.focusArea();
    const w = Math.min(86, (this.cssW - 20 - 8 * (count - 1)) / count);
    const total = count * w + (count - 1) * 8;
    const x0 = (this.cssW - total) / 2;
    return { x: this.px(x0 + index * (w + 8) + w / 2), y: this.px(a.slotY + 38), w: this.px(w), h: this.px(76) };
  }

  private syncSlots() {
    const st = this.bridge.state;
    const cars = st.cars;
    const count = st.slots;
    // Rebuild when the set of cars or slot count changes.
    const ids = cars.map((c) => c.id).join(',');
    const viewIds = this.slots.map((s) => s.carId).join(',');
    if (ids !== viewIds || (this.slots[0] && this.slots.length !== cars.length) || this.slotCount !== count) {
      for (const s of this.slots) s.container.destroy();
      this.slots = cars.map((c, i) => this.makeSlot(c, i, count));
      this.slotCount = count;
      this.drawEmptySlots(count, cars.length);
    }
    for (const s of this.slots) {
      const car = findCar(st, s.carId);
      if (!car) continue;
      const focusedNow = car.id === st.focusedId;
      const geo = this.slotGeometry(this.slots.indexOf(s), count);
      s.frame.clear();
      s.frame.fillStyle(0x1e2430, 0.75);
      s.frame.fillRoundedRect(-geo.w / 2, -geo.h / 2, geo.w, geo.h, this.px(12));
      s.frame.lineStyle(this.px(focusedNow ? 3 : 1.5), focusedNow ? 0xe8762b : 0xffffff, focusedNow ? 1 : 0.2);
      s.frame.strokeRoundedRect(-geo.w / 2, -geo.h / 2, geo.w, geo.h, this.px(12));
      s.dirt.setAlpha(car.dirt * 0.85);
      const stage = carStage(car);
      const label = stage === 'dirty' ? 'Dirty' : stage === 'damaged' ? 'Repair' : 'Ready!';
      if (s.label.text !== label) s.label.setText(label);
      s.label.setColor(stage === 'ready' ? '#3bc45a' : '#f6f7f9');
      const progress =
        stage === 'dirty' ? 1 - car.dirt : stage === 'damaged' ? 1 - car.damage : car.sellProgress / ECON.sellerDelay;
      s.bar.clear();
      s.bar.fillStyle(0xffffff, 0.15);
      s.bar.fillRoundedRect(-geo.w / 2 + this.px(8), geo.h / 2 - this.px(10), geo.w - this.px(16), this.px(4), this.px(2));
      s.bar.fillStyle(stage === 'ready' ? 0x3bc45a : 0xf5b700, 1);
      s.bar.fillRoundedRect(-geo.w / 2 + this.px(8), geo.h / 2 - this.px(10), (geo.w - this.px(16)) * Phaser.Math.Clamp(progress, 0, 1), this.px(4), this.px(2));
    }
  }

  private slotCount = 0;
  private emptySlots?: Phaser.GameObjects.Graphics;

  private drawEmptySlots(count: number, used: number) {
    this.emptySlots?.destroy();
    const g = this.add.graphics();
    g.setDepth(-0.5);
    for (let i = used; i < count; i++) {
      const geo = this.slotGeometry(i, count);
      g.lineStyle(this.px(1.5), 0xffffff, 0.35);
      g.fillStyle(0x1e2430, 0.3);
      g.fillRoundedRect(geo.x - geo.w / 2, geo.y - geo.h / 2, geo.w, geo.h, this.px(12));
      g.strokeRoundedRect(geo.x - geo.w / 2, geo.y - geo.h / 2, geo.w, geo.h, this.px(12));
    }
    this.emptySlots = g;
    this.children.sendToBack(g);
    this.children.sendToBack(this.bg);
  }

  private makeSlot(car: Car, index: number, count: number): SlotView {
    const geo = this.slotGeometry(index, count);
    const key = this.ensureCarTextures(car);
    const frame = this.add.graphics();
    const imgScale = (geo.w * 0.86) / TEX_W;
    const image = this.add.image(0, -this.px(6), key).setScale(imgScale);
    const dirt = this.add.image(0, -this.px(6), key).setScale(imgScale).setTint(MUD);
    const label = this.add
      .text(0, geo.h / 2 - this.px(22), '', {
        fontFamily: 'Nunito, sans-serif',
        fontStyle: '800',
        fontSize: `${this.px(12)}px`,
        color: '#f6f7f9',
      })
      .setOrigin(0.5);
    const bar = this.add.graphics();
    const container = this.add.container(geo.x, geo.y, [frame, image, dirt, label, bar]);
    container.setSize(geo.w, geo.h);
    return { carId: car.id, container, frame, image, dirt, label, bar };
  }

  // ---- events and juice ----------------------------------------------------

  handleEvents(events: GameEvent[]) {
    for (const e of events) {
      switch (e.type) {
        case 'washed':
          if (e.carId === this.bigCarId) {
            this.bigDirt.clear();
            this.glitter.explode(24, this.bigCar.x, this.bigCar.y);
            sfx.washed();
          }
          break;
        case 'repaired':
          if (e.carId === this.bigCarId) this.celebrateRepair();
          break;
        case 'sold':
          this.onSold(e.carId, e.amount);
          break;
        case 'legendary':
          sfx.fanfare();
          break;
        case 'crushed':
          this.onCrushed(e.car.id, e.parts, e.cash);
          break;
        case 'partsUsed':
          if (e.carId === this.bigCarId) {
            sfx.parts();
            this.floatText(this.bigCar.x, this.bigCar.y - this.bigCar.displayHeight * 0.4, `Spare parts! −${e.parts} ⚙`, '#f5b700', 20);
          }
          break;
        case 'arrived':
          break;
      }
    }
    this.bridge.onEvents(events);
  }

  private celebrateRepair() {
    sfx.repaired();
    const b = this.carBounds();
    this.shine.setPosition(b.left, b.centerY).setSize(this.px(36), b.height * 1.2).setAngle(18).setVisible(true);
    this.tweens.add({
      targets: this.shine,
      x: b.right,
      duration: 500,
      ease: 'Sine.easeInOut',
      onComplete: () => this.shine.setVisible(false),
    });
    this.glitter.explode(16, b.centerX, b.top + b.height * 0.3);
    this.tweens.add({ targets: [this.bigCar, this.bigRust, this.bigDirt], scale: this.bigScale * 1.05, yoyo: true, duration: 140 });
  }

  private onSold(carId: number, amount: number) {
    let from: { x: number; y: number };
    if (carId === this.bigCarId) {
      from = { x: this.bigCar.x, y: this.bigCar.y };
      this.driveOff(carId);
    } else {
      const slot = this.slots.find((s) => s.carId === carId);
      from = slot ? { x: slot.container.x, y: slot.container.y } : { x: this.scale.width / 2, y: this.scale.height / 2 };
      this.time.delayedCall(800, () => this.releaseCarTextures(carId));
    }
    this.coinBurst(from.x, from.y, amount);
  }

  private floatText(x: number, y: number, msg: string, color: string, size: number) {
    const text = this.add
      .text(x, y, msg, {
        fontFamily: '"Lilita One", sans-serif',
        fontSize: `${this.px(size)}px`,
        color,
        stroke: '#1e2430',
        strokeThickness: this.px(5),
      })
      .setOrigin(0.5)
      .setDepth(11);
    this.tweens.add({ targets: text, y: y - this.px(50), alpha: 0, duration: 1300, ease: 'Cubic.easeOut', onComplete: () => text.destroy() });
  }

  private onCrushed(carId: number, parts: number, cash: number) {
    if (carId !== this.bigCarId) {
      const slot = this.slots.find((s) => s.carId === carId);
      const x = slot?.container.x ?? this.scale.width / 2;
      const y = slot?.container.y ?? this.scale.height / 2;
      this.floatText(x, y, `+${parts} ⚙`, '#f5b700', 24);
      this.time.delayedCall(800, () => this.releaseCarTextures(carId));
      return;
    }
    this.crushAnimation(carId, parts, cash);
  }

  /** A hydraulic press slams down, the car folds into a cube, the cube slides away. */
  private crushAnimation(carId: number, parts: number, cash: number) {
    this.carLeaving = true;
    this.bigCarId = null;
    const targets = [this.bigCar, this.bigRust, this.bigDirt];
    const b = this.bigCar.getBounds();
    const groundY = b.bottom - b.height * 0.08;
    const crushedH = b.height * 0.28;
    const plateW = b.width * 1.08;
    const plateH = this.px(34);

    const plate = this.add.graphics().setDepth(5);
    plate.fillStyle(0x4a5263, 1);
    plate.fillRect(-plateW / 2, -plateH / 2, plateW, plateH);
    // Hazard stripes.
    plate.fillStyle(0xf5b700, 1);
    const stripe = this.px(16);
    for (let x = -plateW / 2; x < plateW / 2; x += stripe * 2) {
      plate.fillTriangle(x, plateH / 2, x + stripe, plateH / 2, x + stripe * 1.6, plateH / 2 - this.px(10));
    }
    plate.fillStyle(0x2b2f36, 1);
    plate.fillRect(-this.px(14), -plateH / 2 - this.px(400), this.px(28), this.px(400));
    plate.setPosition(b.centerX, -plateH);

    sfx.crushStart();
    const impactY = groundY - crushedH - plateH / 2;
    this.tweens.add({
      targets: plate,
      y: b.top - plateH / 2,
      duration: 260,
      ease: 'Quad.easeIn',
      onComplete: () => {
        // Squash the car under the plate.
        this.tweens.add({ targets: plate, y: impactY, duration: 160, ease: 'Quad.easeIn' });
        this.tweens.add({
          targets: targets,
          scaleY: this.bigScale * 0.28,
          scaleX: this.bigScale * 0.82,
          y: groundY - crushedH / 2,
          duration: 160,
          ease: 'Quad.easeIn',
          onComplete: () => {
            sfx.crush();
            this.cameras.main.shake(220, 0.012);
            this.sparks.explode(26, b.centerX, groundY - crushedH * 0.2);
            for (let i = 0; i < 8; i++) {
              this.smoke.emitParticleAt(b.centerX + (i - 3.5) * (b.width / 9), groundY, 2);
            }
            this.floatText(b.centerX, groundY - crushedH - this.px(60), `+${parts} ⚙ Parts`, '#f5b700', 30);
            if (cash > 0) this.coinBurst(b.centerX, groundY - crushedH, cash);
            // Raise the press, slide the cube away.
            this.tweens.add({ targets: plate, y: -plateH * 2, duration: 420, delay: 250, ease: 'Quad.easeOut', onComplete: () => plate.destroy() });
            this.tweens.add({
              targets: targets,
              x: this.scale.width + b.width,
              delay: 450,
              duration: 450,
              ease: 'Cubic.easeIn',
              onComplete: () => {
                for (const o of targets) o.setScale(this.bigScale);
                this.carLeaving = false;
                this.hideBigCar();
                this.placeBigCar();
                this.releaseCarTextures(carId);
              },
            });
          },
        });
      },
    });
  }

  private driveOff(carId: number) {
    this.carLeaving = true;
    this.bigCarId = null;
    sfx.engine();
    this.tweens.add({
      targets: [this.bigCar, this.bigRust, this.bigDirt],
      x: this.scale.width + this.bigCar.displayWidth,
      duration: 500,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        this.carLeaving = false;
        this.hideBigCar();
        this.placeBigCar();
        this.releaseCarTextures(carId);
      },
    });
  }

  private coinBurst(x: number, y: number, amount: number) {
    const target = this.bridge.cashTarget();
    const tx = this.px(target.x);
    const ty = this.px(target.y);
    const n = Phaser.Math.Clamp(Math.round(Math.log10(amount + 1) * 3), 5, 16);
    for (let i = 0; i < n; i++) {
      const coin = this.add.image(x, y, 'coin').setScale(this.dpr * 0.6).setDepth(10);
      const midX = x + Phaser.Math.Between(-this.px(90), this.px(90));
      const midY = y - Phaser.Math.Between(this.px(30), this.px(110));
      this.tweens.add({
        targets: coin,
        x: midX,
        y: midY,
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
    const text = this.add
      .text(x, y - this.px(40), `+${formatCash(amount)}`, {
        fontFamily: '"Lilita One", sans-serif',
        fontSize: `${this.px(30)}px`,
        color: '#3bc45a',
        stroke: '#1e2430',
        strokeThickness: this.px(5),
      })
      .setOrigin(0.5)
      .setDepth(11);
    this.tweens.add({ targets: text, y: text.y - this.px(60), alpha: 0, duration: 1100, ease: 'Cubic.easeOut', onComplete: () => text.destroy() });
  }
}
