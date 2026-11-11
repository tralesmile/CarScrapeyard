// Used Car Lot scene (P1.2b): the car you bought at the auction stands on the display platform, as rusty as its
// condition grade; tap it to refurbish it, then sell it (the Sell button with the haggle slider) or let a walk-up buyer
// take it at the list price. Owned cars show in the spot row above. The other businesses keep ticking (the core tick
// runs everything), so this scene forwards every event to the bridge like the yard and the garage.

import { removeTexturesSafely } from './textureSafe';
import Phaser from 'phaser';
import { sfx } from '../audio/sfx';
import { businessName } from '../core/businesses';
import { currentCity } from '../core/cities';
import { ECON, type BuyerKind, type LotBuyerKind } from '../core/config';
import { findLotCar, focusLotCar, listPrice, lotBuyerBonus, lotCarHere, lotCarReady, refurbTap } from '../core/carlot';
import { formatCash } from '../core/format';
import { tick, type GameEvent } from '../core/sim';
import type { LotCar } from '../core/state';
import type { Bridge } from './bridge';
import { BUYER_H, BUYER_W, paintBuyer } from './buyerArt';
import { SHAPES, carTextureSize, paintCar, paintRust } from './carArt';
import { CONDITION_RUST, LOT_AREA_TOP, SPOT_ROW, conditionStars, lotBuyerLine, paintDetailer, paintLotBackdrop } from './carlotArt';
import { carLabelTop, customerKind } from './garageArt';
import { pruneFloaters, stackY, type Floater } from './floatStack';

/** Height of the people on screen, CSS px. */
const PERSON_H = 82;
/** Top of the tallest body as a fraction of the car texture's height: the sign stays above it. */
const ROOF_FRAC = Math.min(...Object.values(SHAPES).map((sh) => Math.min(...sh.body.map((p) => p[1]))));

interface SpotView {
  carId: number;
  container: Phaser.GameObjects.Container;
  bar: Phaser.GameObjects.Graphics;
}

export class CarLotScene extends Phaser.Scene {
  private bridge!: Bridge;
  private bg!: Phaser.GameObjects.Image;
  private bigCar!: Phaser.GameObjects.Image;
  private bigRust!: Phaser.GameObjects.Image;
  private bigId: number | null = null;
  private carLeaving = false;
  private arriving = false;
  private texW = 1024;
  private texH = 512;
  private label!: Phaser.GameObjects.Text;
  private barG!: Phaser.GameObjects.Graphics;
  private tag!: Phaser.GameObjects.Container;
  private tagText!: Phaser.GameObjects.Text;
  private glitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  private suds!: Phaser.GameObjects.Particles.ParticleEmitter;
  private detailer!: Phaser.GameObjects.Image;
  private buyer!: Phaser.GameObjects.Image;
  /** Car the walk-up buyer stands next to and looks over (P1.2c), or null. */
  private lookingId: number | null = null;
  /** True while the buyer walks up to the car (no looking pose yet). */
  private buyerWalking = false;
  private speech!: Phaser.GameObjects.Container;
  private speechText!: Phaser.GameObjects.Text;
  private spots: SpotView[] = [];
  private spotsKey = '';
  private floaters: Floater[] = [];
  private layoutInsets = '';
  /** Whether the backdrop on screen was painted with the night look (P1.3d3c): repainted when the clock or setting flips it. */
  private drawnNight = false;
  private insetCheck = 0;
  private bump = { v: 0 };
  private clock = 0;
  private detailTimer = 0;

  constructor() {
    super('carlot');
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

  /** Same geometry as the garage: a row of spot thumbnails under the HUD, the big car in the middle. */
  focusArea() {
    const { top, bottom } = this.bridge.insets();
    const areaTop = top + LOT_AREA_TOP;
    const areaBottom = this.cssH - bottom;
    const carW = Math.min(this.cssW * 0.8, 400);
    return { cx: this.cssW / 2, cy: areaTop + (areaBottom - areaTop) * 0.55, carW, top: areaTop, bottom: areaBottom, rowY: top + SPOT_ROW.y };
  }

  create() {
    const size = carTextureSize(this.px(this.focusArea().carW));
    this.texW = size.w;
    this.texH = size.h;
    this.bg = this.add.image(0, 0, '__WHITE').setOrigin(0, 0).setVisible(false);
    this.bigCar = this.add.image(0, 0, '__WHITE').setVisible(false);
    this.bigRust = this.add.image(0, 0, '__WHITE').setVisible(false);
    this.detailer = this.add
      .image(0, 0, this.paintedTexture('crew-detailer', BUYER_W, BUYER_H, paintDetailer))
      .setOrigin(0.5, 1)
      .setDepth(2)
      .setVisible(false);
    this.buyer = this.add.image(0, 0, '__WHITE').setOrigin(0.5, 1).setDepth(2).setVisible(false);
    this.speechText = this.add
      .text(0, 0, '', { fontFamily: 'Nunito, sans-serif', fontStyle: '800', fontSize: `${this.px(13)}px`, color: '#1e2430' })
      .setOrigin(0.5);
    this.speech = this.add.container(0, 0, [this.add.graphics(), this.speechText]).setDepth(7).setVisible(false);
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
    this.barG = this.add.graphics().setDepth(5);
    // "FOR SALE" price tag hanging from the windscreen once the car is refurbished.
    this.tagText = this.add
      .text(0, 0, '', { fontFamily: '"Lilita One", sans-serif', fontSize: `${this.px(15)}px`, color: '#1e2430', align: 'center' })
      .setOrigin(0.5);
    this.tag = this.add.container(0, 0, [this.add.graphics(), this.tagText]).setDepth(6).setVisible(false);
    this.glitter = this.add.particles(0, 0, 'star', {
      speed: { min: 40, max: 200 },
      angle: { min: 0, max: 360 },
      lifespan: 900,
      scale: { start: 1.1, end: 0 },
      blendMode: 'ADD',
      emitting: false,
    });
    this.suds = this.add.particles(0, 0, 'puff', {
      speed: { min: 30, max: 120 },
      angle: { min: 200, max: 340 },
      gravityY: 160,
      lifespan: 600,
      scale: { start: 0.35, end: 0.05 },
      alpha: { start: 0.8, end: 0 },
      tint: 0xeaf6ff,
      emitting: false,
    });
    this.glitter.setDepth(7);
    this.suds.setDepth(7);

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
    this.spotsKey = '';
    if (this.lookingId !== null && !this.buyerWalking && !this.carLeaving) {
      const spot = this.buyerSpot();
      this.buyer.setPosition(spot.x, spot.y);
      if (this.speech.visible) this.placeSpeech();
    }
  }

  private watchInsets(dt: number) {
    this.insetCheck -= dt;
    if (this.insetCheck > 0) return;
    this.insetCheck = 0.5;
    const { top, bottom } = this.bridge.insets();
    if (`${Math.round(top)},${Math.round(bottom)}` !== this.layoutInsets) this.layout();
    else if (this.bridge.night() !== this.drawnNight) this.drawBackground();
  }

  private drawBackground() {
    const W = Math.round(this.scale.width);
    const H = Math.round(this.scale.height);
    const a = this.focusArea();
    const groundY = this.px(a.cy + a.carW * 0.13);
    const floorY = this.px(a.top + (a.cy - a.top) * 0.62);
    if (this.textures.exists('carlot-backdrop')) this.textures.remove('carlot-backdrop');
    const tex = this.textures.createCanvas('carlot-backdrop', W, H);
    if (!tex) return;
    paintLotBackdrop(tex.getContext(), {
      w: W,
      h: H,
      floorY,
      s: this.dpr,
      stage: { cx: W / 2, groundY, carW: this.px(a.carW) },
      sign: businessName(this.bridge.state, 'carlot').toUpperCase(),
      reservedTop: this.px(this.bridge.insets().top + SPOT_ROW.y + SPOT_ROW.h / 2 + 4),
      roofY: this.px(a.cy - a.carW / 4 + ROOF_FRAC * (a.carW / 2)),
      city: currentCity(this.bridge.state), night: (this.drawnNight = this.bridge.night()),
    });
    tex.refresh();
    this.bg.setTexture('carlot-backdrop').setPosition(0, 0).setVisible(true);
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
    this.syncBuyer();
    this.syncSpots();
    this.watchInsets(dt);
    // Suds from the Detailer's cloth on the car he works on.
    const l = this.bridge.state.carlot;
    const working = l.cars.find((c) => !lotCarReady(c));
    this.detailTimer -= dt;
    if (l.crew.detailer && working && working.id === this.bigId && !this.carLeaving && !this.arriving && this.detailTimer <= 0) {
      this.detailTimer = 0.5;
      this.suds.explode(this.calm ? 1 : 3, this.bigCar.x - this.bigCar.displayWidth * 0.3, this.bigCar.y);
    }
  }

  // ---- the car on the platform ---------------------------------------------

  private focused(): LotCar | undefined {
    return findLotCar(this.bridge.state, this.bridge.state.carlot.focusedId);
  }

  private ensureTextures(car: LotCar): string {
    // The colour is in the key: a respray at Paint & Tuning (P1.2f) brings the car back in a new colour.
    const key = `lcar-${car.id}-${car.paint.toString(16)}`;
    if (this.textures.exists(key)) return key;
    for (const [k, paint] of [
      [key, (ctx: CanvasRenderingContext2D) => paintCar(ctx, { family: car.family, paint: car.paint, rarity: 'common' }, this.texW, this.texH, { shadow: false })],
      [`lrust-${car.id}`, (ctx: CanvasRenderingContext2D) => void paintRust(ctx, car.family, this.texW, this.texH, car.id + 11, CONDITION_RUST[car.condition])],
    ] as const) {
      const tex = this.textures.createCanvas(k, this.texW, this.texH);
      if (!tex) continue;
      paint(tex.getContext());
      tex.refresh();
    }
    return key;
  }

  private releaseTextures(id: number) {
    const keys = this.textures.getTextureKeys().filter((k) => k.startsWith(`lcar-${id}-`));
    removeTexturesSafely(this, [...keys, `lrust-${id}`]);
  }

  private placeBigCar() {
    const a = this.focusArea();
    const scale = this.px(a.carW) / this.texW;
    for (const o of [this.bigCar, this.bigRust]) {
      o.setScale(scale);
      if (!this.carLeaving) o.setPosition(this.px(a.cx), this.px(a.cy));
    }
    this.label.setPosition(this.px(a.cx), this.px(carLabelTop(a.cy, a.carW, this.cssH - this.bridge.insets().bottom)));
  }

  private syncBigCar() {
    const car = this.carLeaving ? undefined : this.focused();
    if (!car) {
      if (!this.carLeaving && this.bigId !== null) {
        this.bigId = null;
        this.bigCar.setVisible(false);
        this.bigRust.setVisible(false);
      }
      this.tag.setVisible(false);
      this.barG.clear();
      // The hint says it during the first sales; after that the empty platform says where to go.
      const l = this.bridge.state.carlot;
      const away = l.cars.some((c) => !lotCarHere(c));
      if (!this.carLeaving) this.label.setText(away ? `Your car is at ${businessName(this.bridge.state, 'paint')} 🎨` : l.cars.length === 0 && l.sold >= 3 ? 'Buy a car in the Auction tab' : '');
      return;
    }
    if (car.id !== this.bigId || this.bigCar.texture.key !== this.ensureTextures(car)) {
      this.bigId = car.id;
      this.bigCar.setTexture(this.ensureTextures(car)).setVisible(true);
      this.bigRust.setTexture(`lrust-${car.id}`).setVisible(true);
      this.placeBigCar();
      // Drive in from the left onto the platform.
      const tx = this.bigCar.x;
      this.arriving = true;
      for (const o of [this.bigCar, this.bigRust]) {
        o.x = -this.bigCar.displayWidth;
        this.tweens.add({ targets: o, x: tx, duration: this.calm ? 1 : 560, ease: 'Back.easeOut' });
      }
      this.time.delayedCall(this.calm ? 1 : 580, () => {
        if (this.bigId === car.id) this.arriving = false;
      });
      sfx.engine();
    }
    const max = ECON.carlot.conditions[car.condition].work;
    const left = Phaser.Math.Clamp(car.work / max, 0, 1);
    this.bigRust.setAlpha(left);
    const ready = lotCarReady(car);
    // Once it is ready the FOR SALE tag and the Sell button say it all (the label would sit under the button).
    this.label.setText(ready ? '' : `${car.model} · ${conditionStars(car.condition)}`);
    this.barG.clear();
    if (!ready && !this.arriving) {
      // Refurbish progress under the name.
      const a = this.focusArea();
      const w = this.px(150);
      const h = this.px(8);
      const x = this.px(a.cx) - w / 2;
      const y = this.label.y + this.px(26);
      this.barG.fillStyle(0x1e2430, 0.55).fillRoundedRect(x, y, w, h, h / 2);
      this.barG.fillStyle(0x3bc45a, 1).fillRoundedRect(x, y, Math.max(h, w * (1 - left)), h, h / 2);
    }
    this.showTag(ready && !this.arriving ? car : undefined);
  }

  private tagKey = '';

  /** The swinging "FOR SALE" tag on the windscreen with the list price. */
  private showTag(car: LotCar | undefined) {
    if (!car) {
      this.tag.setVisible(false);
      this.tagKey = '';
      return;
    }
    // A car back from Paint & Tuning shows what it had done next to the price.
    const price = `${car.tuned ? `${ECON.paint.services[car.tuned].icon} ` : ''}${formatCash(listPrice(this.bridge.state, car))}`;
    const key = `${car.id}|${price}`;
    if (key !== this.tagKey) {
      const fresh = !this.tagKey.startsWith(`${car.id}|`);
      this.tagKey = key;
      this.tagText.setText(`FOR SALE\n${price}`);
      const w = this.tagText.width + this.px(18);
      const h = this.tagText.height + this.px(10);
      const g = this.tag.list[0] as Phaser.GameObjects.Graphics;
      g.clear();
      g.lineStyle(this.px(2), 0x1e2430, 1).lineBetween(0, -h / 2 - this.px(14), 0, -h / 2);
      g.fillStyle(0x000000, 0.2).fillRoundedRect(-w / 2 + this.px(2), -h / 2 + this.px(3), w, h, this.px(6));
      g.fillStyle(0xf5b700, 1).fillRoundedRect(-w / 2, -h / 2, w, h, this.px(6));
      g.lineStyle(this.px(2.5), 0x1e2430, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, this.px(6));
      g.fillStyle(0x1e2430, 1).fillCircle(0, -h / 2 + this.px(5), this.px(2.5));
      if (fresh && !this.calm) {
        this.tag.setScale(0.4);
        this.tweens.add({ targets: this.tag, scale: 1, duration: 260, ease: 'Back.easeOut' });
      }
    }
    const swing = this.calm ? 0 : Math.sin(this.clock * 2.4) * 5;
    this.tag
      .setPosition(this.bigCar.x + this.bigCar.displayWidth * 0.06, this.bigCar.y - this.bigCar.displayHeight * 0.02)
      .setAngle(swing)
      .setVisible(true);
  }

  /** The tap dip on the platform. */
  private poseCar() {
    const a = this.focusArea();
    const y = this.px(a.cy) + this.bump.v * this.px(3);
    for (const o of [this.bigCar, this.bigRust]) o.setY(y);
  }

  /** The Detailer stands left of the platform and polishes while a car still needs work. */
  private syncPeople() {
    const l = this.bridge.state.carlot;
    this.detailer.setVisible(l.crew.detailer);
    if (!l.crew.detailer) return;
    const a = this.focusArea();
    const half = (PERSON_H * BUYER_W) / BUYER_H / 2;
    const x = Math.max(a.cx - a.carW / 2 - 8, half + 2);
    const working = l.cars.some((c) => !lotCarReady(c)) && !this.carLeaving;
    const t = working && !this.calm ? this.clock * 6 : 0;
    this.detailer
      .setScale(this.px(PERSON_H) / (BUYER_H * 2))
      .setPosition(this.px(x), this.px(a.cy + a.carW * 0.13 + 14) - Math.abs(Math.sin(t)) * this.px(3))
      .setAngle(Math.sin(t) * 4);
  }

  // ---- the walk-up buyer (P1.2c) --------------------------------------------

  /** Feet of the buyer, right of the platform, device px. */
  private buyerSpot() {
    const a = this.focusArea();
    const half = (PERSON_H * BUYER_W) / BUYER_H / 2;
    return { x: this.px(Math.min(a.cx + a.carW / 2 + 8, this.cssW - half - 2)), y: this.px(a.cy + a.carW * 0.13 + 14) };
  }

  private buyerLook(kind: BuyerKind): string {
    return this.paintedTexture(`buyer-${kind}`, BUYER_W, BUYER_H, (ctx) => paintBuyer(ctx, kind));
  }

  /**
   * The buyer in the core state stands by the car on the platform and looks it over (a slow lean and a speech bubble),
   * then the sale event drives the car away. A buyer looking at a car in the spot row shows as an icon on its thumbnail.
   */
  private syncBuyer() {
    if (this.carLeaving) return;
    const b = this.bridge.state.carlot.buyer;
    const here = b && b.carId === this.bigId && !this.arriving ? b : null;
    if (here && this.lookingId !== here.carId) {
      this.lookingId = here.carId;
      const spot = this.buyerSpot();
      this.tweens.killTweensOf(this.buyer);
      this.buyer.setTexture(this.buyerLook(here.kind)).setScale(this.px(PERSON_H) / (BUYER_H * 2)).setAngle(0).setAlpha(1).setVisible(true);
      this.buyer.setPosition(this.scale.width + this.px(30), spot.y);
      this.buyerWalking = true;
      const car = findLotCar(this.bridge.state, here.carId);
      this.tweens.add({
        targets: this.buyer,
        x: spot.x,
        duration: this.calm ? 1 : 520,
        ease: 'Sine.easeOut',
        onComplete: () => {
          this.buyerWalking = false;
          if (car && this.lookingId === car.id) this.say(lotBuyerLine(here.kind, lotBuyerBonus(here.kind, car), car.id));
        },
      });
      sfx.bell();
    } else if (!here && this.lookingId !== null) {
      this.lookingId = null;
      this.buyerWalking = false;
      this.speech.setVisible(false);
      this.tweens.killTweensOf(this.buyer);
      this.tweens.add({
        targets: this.buyer,
        x: this.scale.width + this.px(40),
        duration: this.calm ? 1 : 420,
        ease: 'Sine.easeIn',
        onComplete: () => this.buyer.setVisible(false),
      });
    }
    if (this.lookingId !== null && !this.buyerWalking) {
      // Looking it over: lean in towards the car and back.
      this.buyer.setAngle(this.calm ? -3 : -3 + Math.sin(this.clock * 2.2) * 4);
    }
  }

  private say(line: string) {
    this.speechText.setText(line);
    this.placeSpeech();
    this.speech.setVisible(true).setAlpha(1);
    this.tweens.killTweensOf(this.speech);
    if (!this.calm) {
      this.speech.setScale(0.5);
      this.tweens.add({ targets: this.speech, scale: 1, duration: 200, ease: 'Back.easeOut' });
    }
  }

  /** The speech bubble above the buyer's head, pointing down at them (kept on screen). */
  private placeSpeech() {
    const w = this.speechText.width + this.px(22);
    const h = this.px(32);
    const spot = this.buyerSpot();
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
    this.speech.setPosition(cx, cy);
  }

  /** Paint a Canvas 2D texture once (2x for sharpness); textures are shared with the other scenes. */
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

  // ---- spot thumbnails ------------------------------------------------------

  private syncSpots() {
    const l = this.bridge.state.carlot;
    const key = `${l.spots}|${l.cars.map((c) => `${c.id}${lotCarReady(c) ? 'r' : ''}${c.atShop ? 's' : ''}${c.paint}`).join(',')}|${l.focusedId}|${l.buyer ? `${l.buyer.kind}${l.buyer.carId}` : ''}`;
    if (key !== this.spotsKey) {
      this.spotsKey = key;
      for (const v of this.spots) v.container.destroy();
      this.spots = [];
      const a = this.focusArea();
      const { w, h, gap } = SPOT_ROW;
      const total = l.spots * w + (l.spots - 1) * gap;
      for (let i = 0; i < l.spots; i++) {
        const car = l.cars[i];
        const x = this.px(a.cx - total / 2 + i * (w + gap) + w / 2);
        const y = this.px(a.rowY);
        const frame = this.add.graphics();
        const focused = car && car.id === l.focusedId;
        frame.fillStyle(0x1e2430, SPOT_ROW.alpha).fillRoundedRect(-this.px(w / 2), -this.px(h / 2), this.px(w), this.px(h), this.px(10));
        frame.lineStyle(this.px(focused ? 3 : 1.5), focused ? 0xf5b700 : 0xfbf3e4, focused ? 1 : 0.4);
        frame.strokeRoundedRect(-this.px(w / 2), -this.px(h / 2), this.px(w), this.px(h), this.px(10));
        const bar = this.add.graphics();
        const items: Phaser.GameObjects.GameObject[] = [frame, bar];
        if (car) {
          const img = this.add.image(-this.px(6), -this.px(4), this.ensureTextures(car));
          img.setScale(this.px(w - 24) / this.texW);
          const away = !lotCarHere(car);
          const icon = this.add.text(this.px(w / 2 - 13), -this.px(h / 2 - 12), away ? '🎨' : lotCarReady(car) ? '🏷️' : '🧽', { fontSize: `${this.px(12)}px` }).setOrigin(0.5);
          // Away at the paint shop: the thumbnail fades and says so.
          if (away) img.setAlpha(0.35);
          items.push(img, icon);
          if (away) items.push(this.add.text(0, this.px(h / 2 - 12), 'At the shop', { fontFamily: 'Nunito, sans-serif', fontStyle: '800', fontSize: `${this.px(10)}px`, color: '#c7b8e8' }).setOrigin(0.5));
          // A buyer is looking this car over (shown on the platform when it is the big car).
          if (l.buyer && l.buyer.carId === car.id && car.id !== this.bigId) {
            const buyerIcon = ECON.buyers.kinds[l.buyer.kind].icon;
            items.push(this.add.text(-this.px(w / 2 - 13), -this.px(h / 2 - 12), buyerIcon, { fontSize: `${this.px(13)}px` }).setOrigin(0.5));
          }
        } else {
          items.push(this.add.text(0, 0, 'Free spot', { fontFamily: 'Nunito, sans-serif', fontStyle: '700', fontSize: `${this.px(11)}px`, color: '#fbf3e4' }).setOrigin(0.5).setAlpha(0.7));
        }
        const container = this.add.container(x, y, items).setDepth(4);
        container.setSize(this.px(w), this.px(h));
        this.spots.push({ carId: car?.id ?? -1, container, bar });
      }
    }
    for (const v of this.spots) {
      const car = findLotCar(this.bridge.state, v.carId);
      v.bar.clear();
      if (!car || lotCarReady(car)) continue;
      const left = Phaser.Math.Clamp(car.work / ECON.carlot.conditions[car.condition].work, 0, 1);
      const bw = SPOT_ROW.w - 20;
      const by = SPOT_ROW.h / 2 - 9;
      v.bar.fillStyle(0x0b0e13, 0.8).fillRoundedRect(-this.px(bw / 2), this.px(by), this.px(bw), this.px(4), this.px(2));
      if (left < 0.98) v.bar.fillStyle(0x3bc45a, 1).fillRoundedRect(-this.px(bw / 2), this.px(by), this.px(bw) * (1 - left), this.px(4), this.px(2));
    }
  }

  /** For the e2e test: what the scene shows. */
  debugView() {
    return {
      bigId: this.bigId,
      carVisible: this.bigCar.visible,
      tag: this.tag.visible,
      detailer: this.detailer.visible,
      spots: this.spots.length,
      leaving: this.carLeaving,
      arriving: this.arriving,
      buyerLooking: this.lookingId,
      buyerVisible: this.buyer.visible,
      buyerWalking: this.buyerWalking,
      speech: this.speech.visible ? this.speechText.text : '',
    };
  }

  // ---- input --------------------------------------------------------------

  private onPointerDown(p: Phaser.Input.Pointer) {
    this.bridge.onInput();
    sfx.unlock();
    for (const v of this.spots) {
      if (v.carId < 0) continue;
      if (v.container.getBounds().contains(p.x, p.y)) {
        focusLotCar(this.bridge.state, v.carId);
        sfx.tap();
        return;
      }
    }
    const car = this.focused();
    if (!car || this.carLeaving || this.arriving || !this.bigCar.visible || lotCarReady(car)) return;
    if (!this.bigCar.getBounds().contains(p.x, p.y)) return;
    this.suds.explode(this.calm ? 2 : 6, p.x, p.y);
    sfx.wash();
    if (!this.calm) {
      this.tweens.killTweensOf(this.bump);
      this.bump.v = 0;
      this.tweens.add({ targets: this.bump, v: 1, yoyo: true, duration: 60 });
    }
    this.handleEvents(refurbTap(this.bridge.state, car.id));
  }

  // ---- events -------------------------------------------------------------

  handleEvents(events: GameEvent[]) {
    for (const e of events) {
      if (e.type === 'lotRefurbished' && e.car.id === this.bigId) {
        sfx.repaired();
        this.glitter.explode(this.calm ? 6 : 18, this.bigCar.x, this.bigCar.y - this.bigCar.displayHeight * 0.2);
        this.floatText(this.bigCar.x, this.bigCar.y - this.bigCar.displayHeight * 0.5, 'Like new!', '#f5b700', 22);
      }
      if (e.type === 'lotSold') this.onSold(e.car, e.amount, e.profit, e.buyer, e.bonus);
    }
    this.bridge.onEvents(events);
  }

  private onSold(car: LotCar, amount: number, profit: number, buyer: LotBuyerKind | null, bonus: number) {
    const big = car.id === this.bigId;
    const from = big ? { x: this.bigCar.x, y: this.bigCar.y } : { x: this.scale.width / 2, y: this.px(this.focusArea().rowY) };
    if (big) {
      this.tag.setVisible(false);
      this.barG.clear();
      this.buyerTakes(car.id, buyer);
      this.floatText(from.x, from.y - this.bigCar.displayHeight * 0.45, `Profit ${formatCash(profit)}`, '#f5b700', 18);
    } else this.time.delayedCall(800, () => this.releaseTextures(car.id));
    if (buyer && bonus > 0) {
      this.floatText(from.x, from.y - this.px(70), `${ECON.carlot.buyers[buyer].name} paid +${Math.round(bonus * 100)}%`, '#fbf3e4', 16);
    }
    this.coinBurst(from.x, from.y, amount);
  }

  /** The buyer (already standing there after looking it over, or walking up now) drives the car away to the right. */
  private buyerTakes(id: number, kind: LotBuyerKind | null) {
    this.carLeaving = true;
    this.bigId = null;
    this.speech.setVisible(false);
    const standing = this.lookingId === id && this.buyer.visible && !this.buyerWalking;
    this.lookingId = null;
    this.buyerWalking = false;
    const spot = this.buyerSpot();
    this.tweens.killTweensOf(this.buyer);
    if (!standing) {
      const look: BuyerKind = kind ?? customerKind(id);
      this.buyer
        .setTexture(this.buyerLook(look))
        .setScale(this.px(PERSON_H) / (BUYER_H * 2))
        .setPosition(this.scale.width + this.px(30), spot.y)
        .setVisible(true);
    }
    this.buyer.setAngle(0).setAlpha(1);
    const walk = this.calm || standing ? 1 : kind ? 420 : 300;
    this.tweens.add({
      targets: this.buyer,
      x: spot.x,
      duration: walk,
      ease: 'Sine.easeOut',
      onComplete: () => this.buyer.setVisible(false),
    });
    this.tweens.add({
      targets: [this.bigCar, this.bigRust],
      x: this.scale.width + this.bigCar.displayWidth,
      delay: this.calm ? 0 : walk + 120,
      onStart: () => sfx.engine(),
      duration: this.calm ? 1 : 520,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        this.carLeaving = false;
        // Point the images at a stock texture before freeing the car's (see LESSONS run 12).
        this.bigCar.setTexture('__WHITE').setVisible(false);
        this.bigRust.setTexture('__WHITE').setVisible(false);
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
