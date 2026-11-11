import Phaser from 'phaser';
import { removeTexturesSafely } from './textureSafe';
import { sfx } from '../audio/sfx';
import { currentCity } from '../core/cities';
import { ECON } from '../core/config';
import { formatCash } from '../core/format';
import { barnHasAction } from '../core/barn';
import { carStage, crusherUnlocked, findCar, focusCar, repairTap, tick, washCar, type GameEvent } from '../core/sim';
import type { Car } from '../core/state';
import type { Bridge } from './bridge';
import { carTextureSize, mudSpots, paintCar, paintRust } from './carArt';
import { BUYER_H, BUYER_W, paintBuyer } from './buyerArt';
import { BARN_BODY_W, BARN_BOX_H, BARN_BOX_W, BARN_GROUND, paintBarn, paintTarp, type BarnLook } from './barnArt';
import type { BuyerKind } from '../core/config';
import { paintBackdrop } from './backdropArt';
import { pruneFloaters, stackY, type Floater } from './floatStack';
import { PLATE_H, PLATE_W, PRESS_H, PRESS_W, SCRAPPER_H, SCRAPPER_W, paintPlate, paintPress, paintScrapper } from './crewArt';

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
  /** Backdrop image (Canvas 2D texture 'backdrop'). */
  private bg!: Phaser.GameObjects.Image;

  private bigCar!: Phaser.GameObjects.Image;
  private bigRust!: Phaser.GameObjects.Image;
  private bigDirt!: Phaser.GameObjects.RenderTexture;
  private shine!: Phaser.GameObjects.Rectangle;
  private bigCarId: number | null = null;
  private bigScale = 1;
  /** Car texture size: a power of two near the bay's size in device pixels, so WebGL can mipmap it (P0.14h). */
  private texW = 1024;
  private texH = 512;
  /** Texture size / the 720 px design size the brush and mud blobs were drawn for. */
  private texK = 1;
  private carLeaving = false;

  private slots: SlotView[] = [];
  private sparks!: Phaser.GameObjects.Particles.ParticleEmitter;
  private drops!: Phaser.GameObjects.Particles.ParticleEmitter;
  private glitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  private smoke!: Phaser.GameObjects.Particles.ParticleEmitter;

  private barnG!: Phaser.GameObjects.Graphics;
  private barnLabel!: Phaser.GameObjects.Text;
  private barnKey = '';
  private barnRect = new Phaser.Geom.Rectangle();
  private barnImg!: Phaser.GameObjects.Image;
  private barnTexKey = '';
  /** True while the restored car is out of the barn for the reveal. */
  private barnCarOut = false;
  private barnFx = 0;
  /** Red "something to do" dot on the barn sign (same rule as the Yard tab dot). */
  private barnDot!: Phaser.GameObjects.Arc;
  /** The waiting customer standing in the yard (mirrors state.buyer). */
  private buyerSprite: Phaser.GameObjects.Image | null = null;
  private buyerShown: BuyerKind | null = null;
  /** The Scrapper's station on the horizon (press + worker), shown once the Scrapper is hired. */
  private station: { scrapper: Phaser.GameObjects.Image; press: Phaser.GameObjects.Image; plate: Phaser.GameObjects.Image } | null = null;

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

  /** Reduce motion: the player's setting or the OS preference. */
  private get calm(): boolean {
    return this.bridge.state.settings.reduceMotion || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
  }

  private shake(ms: number, intensity: number) {
    if (!this.calm) this.cameras.main.shake(ms, intensity);
  }

  // ---- lifecycle -----------------------------------------------------------

  create() {
    const size = carTextureSize(this.px(this.focusArea().carW));
    this.texW = size.w;
    this.texH = size.h;
    this.texK = size.w / 720;
    this.makeTextures();
    this.bg = this.add.image(0, 0, '__WHITE').setVisible(false);
    this.barnImg = this.add.image(0, 0, '__WHITE').setVisible(false);
    this.barnG = this.add.graphics();
    this.barnLabel = this.add
      .text(0, 0, '', {
        fontFamily: 'Nunito, sans-serif',
        fontStyle: '800',
        fontSize: `${this.px(11)}px`,
        color: '#1e2430',
        backgroundColor: '#f5b700',
        padding: { x: this.px(6), y: this.px(2) },
      })
      .setOrigin(0.5, 1)
      .setVisible(false);
    this.barnDot = this.add.circle(0, 0, this.px(5), 0xe5484d).setStrokeStyle(this.px(1.5), 0xffffff).setVisible(false);

    this.bigCar = this.add.image(0, 0, '__WHITE').setVisible(false);
    this.bigRust = this.add.image(0, 0, '__WHITE').setVisible(false);
    // One texel taller than the car texture: a power-of-two render texture would get mipmaps that go stale as mud is
    // washed off.
    this.bigDirt = this.add.renderTexture(0, 0, this.texW, this.texH + 1).setVisible(false);
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

    this.scale.on('resize', () => {
      if (this.sys.isActive()) this.layout();
    });
    // Back from the garage: cars may have been sold or crushed while the yard slept, so start fresh.
    this.events.on(Phaser.Scenes.Events.WAKE, () => this.onWake());
    this.layout();
    this.bridge.onYardReady();
  }

  private onWake() {
    if (!this.carLeaving) this.hideBigCar();
    this.layout();
    const live = new Set(this.bridge.state.cars.map((c) => c.id));
    for (const key of this.textures.getTextureKeys()) {
      const m = /^(car|rust)-(\d+)$/.exec(key);
      if (m && !live.has(Number(m[2]))) this.textures.remove(key);
    }
  }

  /** Insets the last layout used ("top,bottom"), and seconds until the next check (P1.1x). */
  private layoutInsets = '';
  /** Whether the backdrop on screen was painted with the night look (P1.3d3c): repainted when the clock or setting flips it. */
  private drawnNight = false;
  private insetCheck = 0;

  /**
   * The HUD can change height without a resize (the customer strip appears after ~10 sales), which moves the
   * horizon and the slot row. Check twice a second and lay out again when the insets moved.
   */
  private watchInsets(dt: number) {
    this.insetCheck -= dt;
    if (this.insetCheck > 0) return;
    this.insetCheck = 0.5;
    const { top, bottom } = this.bridge.insets();
    const key = `${Math.round(top)},${Math.round(bottom)}`;
    if (key !== this.layoutInsets) this.layout();
    else if (this.bridge.night() !== this.drawnNight) this.drawBackground();
  }

  /** Re-place everything after a resize or orientation change. */
  layout() {
    const ins = this.bridge.insets();
    this.layoutInsets = `${Math.round(ins.top)},${Math.round(ins.bottom)}`;
    this.insetCheck = 0.5;
    this.drawBackground();
    if (this.buyerSprite) {
      const spot = this.buyerSpot();
      this.buyerSprite.setPosition(spot.x, spot.y);
    }
    this.barnKey = '';
    this.destroyStation();
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
    this.syncBarn();
    this.barnActivity(deltaMs);
    this.syncBuyer();
    this.syncStation();
    this.watchInsets(dt);

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
    circle('mud', Math.round(16 * this.texK), MUD);

    // Soft brush for the pressure washer.
    g.clear();
    const br = Math.round(40 * this.texK);
    for (let i = 10; i > 0; i--) {
      g.fillStyle(0xffffff, 0.12);
      g.fillCircle(br, br, (i * br) / 10);
    }
    g.generateTexture('brush', br * 2, br * 2);

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
    this.canvasTexture(key, (ctx) => paintCar(ctx, car, this.texW, this.texH));
    this.canvasTexture(`rust-${car.id}`, (ctx) => paintRust(ctx, car.family, this.texW, this.texH, car.id));
    return key;
  }

  /** Paint a texture with the Canvas 2D API (antialiased on every renderer). */
  private canvasTexture(key: string, paint: (ctx: CanvasRenderingContext2D) => void) {
    const tex = this.textures.createCanvas(key, this.texW, this.texH);
    if (!tex) return;
    paint(tex.getContext());
    tex.refresh();
  }

  private releaseCarTextures(id: number) {
    removeTexturesSafely(this, [`car-${id}`, `rust-${id}`]);
  }

  // ---- background ----------------------------------------------------------

  /** Paint the backdrop (sky, hills, junk, fence, ground, bay) into one Canvas 2D texture sized to the game. */
  private drawBackground() {
    const W = Math.round(this.scale.width);
    const H = Math.round(this.scale.height);
    const a = this.focusArea();
    const horizon = this.px(a.top + (a.cy - a.top) * 0.55);
    const bay = { cx: W / 2, cy: this.px(a.cy + a.carW * 0.2), w: this.px(a.carW * 1.08), h: this.px(a.carW * 0.2), r: this.px(14) };
    if (this.textures.exists('backdrop')) this.textures.remove('backdrop');
    const tex = this.textures.createCanvas('backdrop', W, H);
    if (!tex) return;
    paintBackdrop(tex.getContext(), { w: W, h: H, horizon, s: this.dpr, bay, city: currentCity(this.bridge.state), night: (this.drawnNight = this.bridge.night()) });
    tex.refresh();
    this.bg.setTexture('backdrop').setOrigin(0, 0).setPosition(0, 0).setVisible(true);
  }

  // ---- barn find (covered classic at the back of the yard) ------------------

  /** Where the customer stands: across the yard from the barn, on the horizon behind the bay. */
  private buyerSpot() {
    const geo = this.barnGeometry();
    return { x: this.px(this.cssW - geo.x), y: this.px(geo.bottom + 6) };
  }

  private buyerTexture(kind: BuyerKind): string {
    const key = `buyer-${kind}`;
    if (!this.textures.exists(key)) {
      const tex = this.textures.createCanvas(key, BUYER_W * 2, BUYER_H * 2);
      if (tex) {
        const ctx = tex.getContext();
        ctx.scale(2, 2);
        paintBuyer(ctx, kind);
        tex.refresh();
      }
    }
    return key;
  }

  /** A customer walks in when one arrives and walks off when served or tired of waiting. */
  private syncBuyer() {
    const want = this.bridge.state.buyer?.kind ?? null;
    if (want === this.buyerShown) return;
    const spot = this.buyerSpot();
    const scale = this.px(Math.min(60, this.cssW * 0.15)) / (BUYER_H * 2);
    const old = this.buyerSprite;
    if (old) {
      this.tweens.killTweensOf(old);
      if (this.calm) old.destroy();
      else {
        old.setFlipX(false);
        this.tweens.add({ targets: old, x: this.scale.width + old.displayWidth, duration: 900, ease: 'Quad.easeIn', onComplete: () => old.destroy() });
      }
    }
    this.buyerSprite = null;
    this.buyerShown = want;
    if (!want) return;
    const img = this.add.image(spot.x, spot.y, this.buyerTexture(want)).setOrigin(0.5, 1).setScale(scale);
    // Behind the bay car, in front of the backdrop.
    this.children.moveBelow(img as Phaser.GameObjects.GameObject, this.bigCar as Phaser.GameObjects.GameObject);
    img.setData('kind', want);
    this.buyerSprite = img;
    if (this.calm) return;
    // Walk in from the right edge (facing left), with a little bounce per step, then idle-bob.
    img.setX(this.scale.width + img.displayWidth).setFlipX(true);
    this.tweens.add({
      targets: img,
      x: spot.x,
      duration: 1100,
      ease: 'Sine.easeOut',
      onComplete: () => {
        img.setFlipX(false);
        this.tweens.add({ targets: img, scaleY: scale * 1.03, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      },
    });
    this.tweens.add({ targets: img, y: spot.y - this.px(3), duration: 140, yoyo: true, repeat: 3, ease: 'Sine.easeOut' });
  }

  // ---- the Scrapper's station (press + worker beside the barn) -------------

  /** Paint a Canvas 2D texture once (2x for sharpness). */
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

  /** Station geometry in CSS px: the press stands right of the barn, the Scrapper beside it. */
  private stationGeometry() {
    const geo = this.barnGeometry();
    const pressH = Math.min(38, geo.w * 0.58);
    const pressW = (pressH * PRESS_W) / PRESS_H;
    const pressX = geo.x + geo.w * 0.65 + 8 + pressW / 2;
    const workerH = pressH * 1.35;
    return { pressX, pressW, pressH, workerX: pressX + pressW / 2 + 8, workerH, bottom: geo.bottom + 2 };
  }

  private destroyStation() {
    if (!this.station) return;
    for (const o of Object.values(this.station)) {
      this.tweens.killTweensOf(o);
      o.destroy();
    }
    this.station = null;
  }

  private syncStation() {
    const st = this.bridge.state;
    const want = st.managers.scrapper && crusherUnlocked(st);
    if (want === !!this.station) return;
    if (!want) return this.destroyStation();
    const g = this.stationGeometry();
    const press = this.add
      .image(this.px(g.pressX), this.px(g.bottom), this.paintedTexture('station-press', PRESS_W, PRESS_H, paintPress))
      .setOrigin(0.5, 1)
      .setScale(this.px(g.pressH) / (PRESS_H * 2));
    const ps = press.scale;
    const plate = this.add
      .image(press.x, this.plateRestY(press), this.paintedTexture('station-plate', PLATE_W, PLATE_H, paintPlate))
      .setOrigin(0.5, 0)
      .setScale(ps);
    const scrapper = this.add
      .image(this.px(g.workerX), this.px(g.bottom + 2), this.paintedTexture('crew-scrapper', SCRAPPER_W, SCRAPPER_H, paintScrapper))
      .setOrigin(0.5, 1)
      .setScale(this.px(g.workerH) / (SCRAPPER_H * 2));
    // Behind the bay car (and the customer), in front of the backdrop.
    for (const o of [press, plate, scrapper]) this.children.moveBelow(o as Phaser.GameObjects.GameObject, this.bigCar as Phaser.GameObjects.GameObject);
    this.station = { scrapper, press, plate };
    if (!this.calm) {
      const sy = scrapper.scaleY;
      this.tweens.add({ targets: scrapper, scaleY: sy * 1.03, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
  }

  /** Plate y (top edge) when raised: just under the piston rod. In texture px x scale. */
  private plateRestY(press: Phaser.GameObjects.Image): number {
    return press.y - press.displayHeight + 34 * 2 * press.scaleY;
  }

  /** The Scrapper pulls the lever: the little press slams once. */
  private stationCrush() {
    const s = this.station;
    if (!s) return;
    const base = s.press.y - 14 * 2 * s.press.scaleY - s.plate.displayHeight;
    const rest = this.plateRestY(s.press);
    this.tweens.killTweensOf(s.plate);
    s.plate.setY(rest);
    if (this.calm) return;
    this.tweens.add({
      targets: s.plate,
      y: base,
      duration: 180,
      ease: 'Quad.easeIn',
      yoyo: true,
      hold: 260,
      onYoyo: () => {
        this.sparks.explode(10, s.press.x, base + s.plate.displayHeight);
        this.smoke.emitParticleAt(s.press.x, s.press.y, 2);
      },
    });
    this.tweens.add({ targets: s.scrapper, y: s.scrapper.y - this.px(5), duration: 120, yoyo: true, repeat: 1, ease: 'Sine.easeOut' });
  }

  private barnGeometry() {
    const a = this.focusArea();
    const horizon = a.top + (a.cy - a.top) * 0.55;
    const w = Math.min(70, this.cssW * 0.17);
    const h = w * 0.8;
    return { x: Math.max(w * 0.6 + 6, this.cssW * 0.12), bottom: horizon + 4, w, h };
  }

  private syncBarn() {
    const b = this.bridge.state.barn;
    const g = this.barnG;
    const visible = b.status !== 'locked';
    g.setVisible(visible);
    this.barnImg.setVisible(visible);
    if (!visible) {
      this.barnLabel.setVisible(false);
      this.barnDot.setVisible(false);
      return;
    }
    const geo = this.barnGeometry();
    const key = `${b.status}:${b.stage}:${b.family}:${b.paint}:${this.barnCarOut}`;
    if (key !== this.barnKey) {
      this.barnKey = key;
      this.drawBarn(geo);
    }
    // Little sign above the roof.
    let label = '';
    if (b.status === 'covered') label = b.stage === 0 ? 'Barn find!' : `${b.stage}/${ECON.barn.stages.length}`;
    else if (b.status === 'working') {
      const t = Math.ceil(b.timeLeft);
      label = `🔧 ${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
    } else if (b.status === 'finished') label = '✨ Reveal!';
    else if (b.status === 'revealed') label = '💰 Sell!';
    this.barnLabel.setVisible(label !== '');
    if (this.barnLabel.text !== label) this.barnLabel.setText(label);
    const pulse = b.status === 'finished' || b.status === 'revealed' ? 1 + 0.08 * Math.sin(this.time.now / 160) : 1;
    this.barnLabel.setPosition(this.px(geo.x), this.px(geo.bottom - geo.h - 14)).setScale(pulse);
    const dot = this.barnLabel.visible && barnHasAction(this.bridge.state);
    this.barnDot.setVisible(dot);
    if (dot) {
      const r = this.barnLabel.getBounds();
      this.barnDot.setPosition(r.right - this.px(1), r.top + this.px(1)).setScale(this.calm ? 1 : 1 + 0.15 * Math.sin(this.time.now / 200));
    }
  }

  /** The barn (Canvas 2D texture per restoration state) and the stage pips under it. */
  private drawBarn(geo: { x: number; bottom: number; w: number; h: number }) {
    const b = this.bridge.state.barn;
    const look: BarnLook = { status: b.status, stage: b.stage, family: b.family, paint: b.paint, empty: this.barnCarOut };
    const key = `barn-${b.status}-${b.stage}-${b.family}-${b.paint}-${this.barnCarOut ? 1 : 0}`;
    if (!this.textures.exists(key)) {
      // Keep one barn texture at a time.
      if (this.barnTexKey && this.textures.exists(this.barnTexKey)) this.textures.remove(this.barnTexKey);
      const tex = this.textures.createCanvas(key, BARN_BOX_W * 2, BARN_BOX_H * 2);
      if (tex) {
        const ctx = tex.getContext();
        ctx.scale(2, 2);
        paintBarn(ctx, look);
        tex.refresh();
      }
    }
    this.barnTexKey = key;
    const scale = this.px(geo.w) / (BARN_BODY_W * 2);
    this.barnImg
      .setTexture(key)
      .setOrigin(0.5, BARN_GROUND / BARN_BOX_H)
      .setScale(scale)
      .setPosition(this.px(geo.x), this.px(geo.bottom))
      .setVisible(true);
    const g = this.barnG;
    g.clear();
    const x = this.px(geo.x);
    const w = this.px(geo.w);
    const h = this.px(geo.h);
    const bottom = this.px(geo.bottom);
    const top = bottom - h;
    // Stage pips under the barn.
    const n = ECON.barn.stages.length;
    for (let i = 0; i < n; i++) {
      const px = x + (i - (n - 1) / 2) * this.px(9);
      g.fillStyle(i < b.stage ? 0xf5b700 : 0x1e2430, i < b.stage ? 1 : 0.5);
      g.fillCircle(px, bottom + this.px(7), this.px(3));
    }
    this.barnRect.setTo(x - w * 0.65, top - this.px(20), w * 1.3, h + this.px(32));
  }

  /** Doorway of the barn in canvas px (where the restored car drives out). */
  private barnDoor() {
    const geo = this.barnGeometry();
    const wall = geo.h * 0.62;
    return { x: this.px(geo.x), y: this.px(geo.bottom - wall * 0.3), carW: this.px(geo.w * 0.74 * 0.86) };
  }

  /** While working, a little activity at the barn door: dust, sparks or paint mist. */
  private barnActivity(dtMs: number) {
    const b = this.bridge.state.barn;
    if (b.status !== 'working' || this.calm || !this.barnImg.visible) return;
    this.barnFx -= dtMs;
    if (this.barnFx > 0) return;
    this.barnFx = 650;
    const d = this.barnDoor();
    if (b.stage === 1 || b.stage === 2) this.sparks.explode(3, d.x + (b.stage === 1 ? d.carW * 0.3 : -d.carW * 0.1), d.y);
    else this.smoke.emitParticleAt(d.x + Phaser.Math.Between(-10, 10), d.y + this.px(6), 1);
  }

  /** Slow-motion reveal with light rays. Calls `shown` once the car is uncovered; returns a closer. */
  barnReveal(shown: () => void): () => void {
    const W = this.scale.width;
    const H = this.scale.height;
    const b = this.bridge.state.barn;
    const key = `barncar-${b.family}-${b.paint}`;
    if (!this.textures.exists(key)) {
      this.canvasTexture(key, (ctx) => paintCar(ctx, { family: b.family, paint: b.paint, rarity: 'legendary' }, this.texW, this.texH));
    }
    const cx = W / 2;
    const cy = H * 0.3;
    const carScale = this.px(Math.min(this.cssW * 0.8, 400)) / this.texW;
    const dim = this.add.rectangle(cx, H / 2, W, H, 0x0b0f17, 1).setDepth(20).setAlpha(0);
    const rays = this.add.graphics().setDepth(21).setPosition(cx, cy).setBlendMode(Phaser.BlendModes.ADD);
    const R = Math.max(W, H);
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      rays.fillStyle(i % 2 ? 0xffd34d : 0xfff1b8, 0.16);
      rays.fillTriangle(0, 0, Math.cos(a - 0.11) * R, Math.sin(a - 0.11) * R, Math.cos(a + 0.11) * R, Math.sin(a + 0.11) * R);
    }
    rays.setScale(0.01);
    const car = this.add.image(cx, cy, key).setScale(carScale * 0.85).setDepth(22).setAlpha(0);
    if (!this.textures.exists('reveal-tarp')) {
      this.canvasTexture('reveal-tarp', (ctx) => paintTarp(ctx, this.texW * 0.02, this.texW * 0.98, this.texH * 0.93, this.texH, true));
    }
    const tarp = this.add.image(cx, cy, 'reveal-tarp').setDepth(23).setScale(carScale * 0.85).setAlpha(0);
    const tw = this.texW * carScale;
    const th = this.texH * carScale;
    const sparkle = this.add
      .particles(0, 0, 'star', {
        speed: { min: 80, max: 420 },
        angle: { min: 0, max: 360 },
        lifespan: 1400,
        scale: { start: 1.4, end: 0 },
        rotate: { min: 0, max: 360 },
        blendMode: 'ADD',
        emitting: false,
      })
      .setDepth(24);
    const objs: Phaser.GameObjects.GameObject[] = [dim, rays, car, tarp, sparkle];
    // The covered car rolls out of the barn door and up to the front first (skipped with reduce motion).
    const lead = this.calm ? 0 : 1000;
    this.tweens.add({ targets: dim, alpha: 0.8, duration: 350, delay: lead * 0.5 });
    if (lead > 0) {
      this.barnCarOut = true;
      const door = this.barnDoor();
      const k = door.carW / (tw * 0.85);
      car.setPosition(door.x, door.y).setScale(carScale * 0.85 * k).setAlpha(1);
      tarp.setPosition(door.x, door.y).setScale(carScale * 0.85 * k).setAlpha(1);
      sfx.engine();
      this.tweens.add({ targets: car, x: cx, y: cy, scale: carScale * 0.85, duration: lead, ease: 'Cubic.easeInOut' });
      this.tweens.add({ targets: tarp, x: cx, y: cy, scale: carScale * 0.85, duration: lead, ease: 'Cubic.easeInOut' });
      for (let i = 0; i < 5; i++) {
        this.time.delayedCall(i * 160, () => this.smoke.emitParticleAt(car.x - car.displayWidth * 0.4, car.y + car.displayHeight * 0.3, 2));
      }
    } else this.tweens.add({ targets: [car, tarp], alpha: 1, duration: 350 });
    if (!this.calm) this.tweens.add({ targets: rays, angle: 360, duration: 14000, repeat: -1 });
    // Pause, wiggle the tarp, then whip it off.
    this.tweens.add({ targets: tarp, angle: { from: -2, to: 2 }, yoyo: true, repeat: 2, duration: 120, delay: lead + 450 });
    this.time.delayedCall(lead + 1150, () => {
      this.tweens.add({ targets: tarp, y: cy - H * 0.35, x: cx + W * 0.2, angle: -25, alpha: 0, duration: 550, ease: 'Cubic.easeIn' });
      this.tweens.add({ targets: rays, scale: 1, duration: 700, ease: 'Back.easeOut' });
      this.tweens.add({ targets: car, scale: carScale, duration: 500, ease: 'Back.easeOut' });
      if (!this.calm) this.cameras.main.flash(300, 255, 240, 200);
      sparkle.explode(40, cx, cy);
      this.floatText(cx, cy - th * 0.45, 'LEGENDARY CLASSIC!', '#f5b700', 30, 25);
      this.time.delayedCall(800, shown);
    });
    let closed = false;
    return () => {
      if (closed) return;
      closed = true;
      this.tweens.add({
        targets: objs,
        alpha: 0,
        duration: 300,
        onComplete: () => {
          for (const o of objs) o.destroy();
          this.barnCarOut = false;
          this.barnKey = '';
        },
      });
    };
  }

  // ---- the big car in the bay ----------------------------------------------

  private focused(): Car | undefined {
    return findCar(this.bridge.state, this.bridge.state.focusedId);
  }

  private placeBigCar() {
    const a = this.focusArea();
    this.bigScale = this.px(a.carW) / this.texW;
    for (const o of [this.bigCar, this.bigRust, this.bigDirt]) {
      o.setScale(this.bigScale);
      if (!this.carLeaving) o.setPosition(this.px(a.cx), this.px(a.cy));
    }
  }

  private fillDirt(car: Car) {
    const rt = this.bigDirt;
    rt.clear();
    rt.draw(`car-${car.id}`, 0, 0, 1, MUD);
    for (const s of mudSpots(car.family, this.texW, this.texH, car.id)) {
      const r = Math.round(16 * this.texK);
      rt.draw('mud', s.x - r, s.y - r, 0.9, 0x4a3220);
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
    // The covered car at the back of the yard opens its card.
    if (this.barnG.visible && this.barnRect.contains(p.x, p.y)) {
      this.bridge.onBarnTap();
      return;
    }
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
      this.shake(60, 0.002);
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
    const k = this.texK;
    this.bigDirt.erase('brush', local.x - 40 * k, local.y - 40 * k);
    this.bigDirt.erase('brush', local.x - 30 * k, local.y - 50 * k);
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
    // Same depth as the backdrop (depth sorts before display order), then sent behind the lot cars.
    const g = this.add.graphics();
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
    const imgScale = (geo.w * 0.86) / this.texW;
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
          if (e.buyer && e.carId === this.bigCarId) {
            const b = ECON.buyers.kinds[e.buyer];
            this.floatText(this.bigCar.x, this.bigCar.y - this.bigCar.displayHeight * 0.55, `${b.icon} ${b.name} +${Math.round(b.bonus * 100)}%`, '#f5b700', 22);
          }
          break;
        case 'legendary':
          sfx.fanfare();
          break;
        case 'crushed':
          if (e.auto) {
            this.stationCrush();
            this.floatText(this.scale.width / 2, this.px(this.focusArea().cy) - this.px(70), '♻ Scrapper', '#e8762b', 22);
          }
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

  private floaters: Floater[] = [];

  /** Start y for a floating text, moved up past any reward text that just appeared at the same spot. */
  private placeFloater(x: number, y: number, size: number): number {
    const now = this.time.now;
    const h = this.px(size * 1.15);
    this.floaters = pruneFloaters(this.floaters, now);
    const sy = stackY(this.floaters, x, y, h, now, this.px(160));
    this.floaters.push({ x, y: sy, h, born: now });
    return sy;
  }

  private floatText(x: number, y0: number, msg: string, color: string, size: number, depth = 11) {
    const y = this.placeFloater(x, y0, size);
    const text = this.add
      .text(x, y, msg, {
        fontFamily: '"Lilita One", sans-serif',
        fontSize: `${this.px(size)}px`,
        color,
        stroke: '#1e2430',
        strokeThickness: this.px(5),
      })
      .setOrigin(0.5)
      .setDepth(depth);
    this.tweens.add({ targets: text, y: y - this.px(50), alpha: 0, duration: 1300, ease: 'Cubic.easeOut', onComplete: () => text.destroy() });
  }

  private onCrushed(carId: number, parts: number, cash: number) {
    if (carId !== this.bigCarId) {
      const slot = this.slots.find((s) => s.carId === carId);
      const x = slot?.container.x ?? this.scale.width / 2;
      const y = slot?.container.y ?? this.scale.height / 2;
      if (slot && !this.calm) this.miniCrush(slot);
      this.floatText(x, y, `+${parts} ⚙`, '#f5b700', 24);
      this.time.delayedCall(1200, () => this.releaseCarTextures(carId));
      return;
    }
    this.crushAnimation(carId, parts, cash);
  }

  /** A small press slams onto a lot thumbnail: the car folds flat and fades (the slot itself is rebuilt next frame). */
  private miniCrush(slot: SlotView) {
    const img = slot.image;
    const x = slot.container.x + img.x;
    const groundY = slot.container.y + img.y + img.displayHeight * 0.42;
    const ghost = this.add.image(x, groundY, img.texture.key).setOrigin(0.5, 0.92).setScale(img.scaleX).setDepth(6);
    const w = img.displayWidth * 1.05;
    const plateH = this.px(8);
    const plate = this.add.graphics().setDepth(7);
    plate.fillStyle(0x4a5263, 1);
    plate.fillRect(-w / 2, -plateH, w, plateH);
    plate.fillStyle(0xf5b700, 1);
    plate.fillRect(-w / 2, -this.px(3), w, this.px(2));
    plate.fillStyle(0x2b2f36, 1);
    plate.fillRect(-this.px(4), -plateH - this.px(120), this.px(8), this.px(120));
    const topY = groundY - img.displayHeight * 0.9;
    plate.setPosition(x, topY - this.px(40));
    const crushedH = img.displayHeight * 0.25;
    this.tweens.add({
      targets: plate,
      y: groundY - crushedH,
      duration: 220,
      ease: 'Quad.easeIn',
      onComplete: () => {
        this.sparks.explode(8, x, groundY - crushedH / 2);
        this.tweens.add({ targets: plate, y: topY - this.px(60), alpha: 0, delay: 200, duration: 300, onComplete: () => plate.destroy() });
      },
    });
    this.tweens.add({
      targets: ghost,
      scaleY: img.scaleY * 0.25,
      scaleX: img.scaleX * 0.85,
      delay: 160,
      duration: 70,
      ease: 'Quad.easeIn',
      onComplete: () =>
        this.tweens.add({ targets: ghost, alpha: 0, y: groundY + this.px(4), delay: 350, duration: 300, onComplete: () => ghost.destroy() }),
    });
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
            this.shake(220, 0.012);
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
      .text(x, this.placeFloater(x, y - this.px(40), 30), `+${formatCash(amount)}`, {
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
