// DOM UI: top bar, hints, sell button, upgrade panel, modals.
// DOM instead of canvas for UI: crisp text, accessibility, easy translation.

import { haptics } from '../platform/haptics';
import { sfx } from '../audio/sfx';
import { ECON, type ManagerKind, type UpgradeKind } from '../core/config';
import { bulkCost, crusherCooldown, crushParts, nextMilestone, qualityMultiplier, slotCost, stationPower } from '../core/formulas';
import { formatCash, formatDuration, setNumberFormat, type NumberFormat } from '../core/format';
import { version } from '../../package.json';
import { canRerollContract, claimContract, contractLabel, contractsUnlocked } from '../core/contracts';
import {
  buySlot,
  buyUpgrade,
  canCrush,
  carStage,
  crushCar,
  rerollContract,
  crusherUnlocked,
  findCar,
  hireManager,
  holdForHaggle,
  sellCar,
  type GameEvent,
} from '../core/sim';
import type { Car, GameState } from '../core/state';
import { buyerMatches, buyerMultiplier, buyersUnlocked } from '../core/buyers';
import { barnHasAction, barnStageCost, barnUnlocked, barnValue, nextBarnStage, revealBarn, sellBarnCar, startBarnStage } from '../core/barn';
import { haggleGrade, haggleMultiplier, hagglePosition, isHaggleLesson, wantsHaggle } from '../core/haggle';

type Tab = 'upgrades' | 'crew' | 'yard' | 'jobs';
type BuyMode = 1 | 10 | 'max';

export interface UiDeps {
  state: () => GameState;
  onEvents: (events: GameEvent[]) => void;
  onChange: () => void;
  incomePerSecond: () => number;
  /** Play the barn reveal in the scene; `shown` runs when the car is on screen. Returns a function that closes it. */
  barnReveal: (shown: () => void) => () => void;
  /** Delete every save and start over (after the player confirmed). */
  resetProgress: () => void;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, html?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

function setText(e: HTMLElement, text: string) {
  if (e.textContent !== text) e.textContent = text;
}

interface CardView {
  root: HTMLElement;
  lvl: HTMLElement;
  desc: HTMLElement;
  bar?: HTMLElement;
  btn: HTMLButtonElement;
  update: (s: GameState) => void;
}

export class Ui {
  readonly root: HTMLElement;
  private cash!: HTMLElement;
  private rate!: HTMLElement;
  private partsEl!: HTMLElement;
  private crush!: HTMLButtonElement;
  private soundBtn!: HTMLButtonElement;
  private settingsBtn!: HTMLButtonElement;
  private hint!: HTMLElement;
  private sell!: HTMLButtonElement;
  private panel!: HTMLElement;
  private cardsBox!: HTMLElement;
  private tabButtons = new Map<Tab, HTMLButtonElement>();
  private modeButtons = new Map<string, HTMLButtonElement>();
  private banner!: HTMLElement;
  private cards: CardView[] = [];
  private tab: Tab = 'upgrades';
  private mode: BuyMode = 1;
  private lastCash = -1;
  private modalOpen = false;
  private buyerEl!: HTMLElement;
  private buyerText!: HTMLElement;
  private buyerBar!: HTMLElement;
  private haggleEl!: HTMLElement;
  private haggleNeedle!: HTMLElement;
  private haggleLabel!: HTMLElement;
  /** Car id being haggled over, or null. */
  private haggling: number | null = null;

  constructor(
    mount: HTMLElement,
    private deps: UiDeps,
  ) {
    this.root = mount;
    this.build();
  }

  // ---- layout info for the scene -------------------------------------------

  insets() {
    const topEl = this.buyerEl.classList.contains('hidden') ? this.cash.parentElement! : this.buyerEl;
    const hudBottom = topEl.getBoundingClientRect().bottom - this.root.getBoundingClientRect().top;
    const panelTop = this.panel.getBoundingClientRect().top - this.root.getBoundingClientRect().top;
    const h = this.root.getBoundingClientRect().height;
    // Leave room for the sell button above the panel.
    return { top: hudBottom, bottom: h - panelTop + 64 };
  }

  cashTarget() {
    const r = this.cash.getBoundingClientRect();
    const root = this.root.getBoundingClientRect();
    return { x: r.left - root.left + 20, y: r.top - root.top + r.height / 2 };
  }

  // ---- building -------------------------------------------------------------

  private build() {
    const hud = el('div', 'hud');
    this.cash = el('div', 'cash display', '$0');
    this.cash.setAttribute('aria-live', 'polite');
    this.rate = el('div', 'rate', '');
    this.partsEl = el('div', 'parts hidden', '');
    this.partsEl.title = 'Parts';
    this.soundBtn = el('button', 'icon-btn') as HTMLButtonElement;
    this.soundBtn.setAttribute('aria-label', 'Toggle sound');
    this.soundBtn.onclick = () => {
      const s = this.deps.state();
      s.settings.sound = !s.settings.sound;
      sfx.enabled = s.settings.sound;
      this.deps.onChange();
      this.render();
    };
    this.settingsBtn = el('button', 'icon-btn settings-btn', '☰') as HTMLButtonElement;
    this.settingsBtn.setAttribute('aria-label', 'Settings');
    this.settingsBtn.onclick = () => this.openSettings();
    hud.append(this.cash, this.rate, el('div', 'spacer'), this.partsEl, this.soundBtn, this.settingsBtn);

    this.hint = el('div', 'hint hidden');
    this.sell = el('button', 'sell display hidden') as HTMLButtonElement;
    this.sell.onclick = () => this.onSell();
    this.crush = el('button', 'crush display hidden') as HTMLButtonElement;
    this.crush.setAttribute('aria-label', 'Crush this wreck for parts');
    this.crush.onclick = () => this.onCrush();

    this.banner = el('div', 'banner display');

    // Customer waiting in the yard.
    this.buyerEl = el('div', 'buyer hidden');
    this.buyerText = el('div', 'buyer-text');
    const bw = el('div', 'buyer-bar');
    this.buyerBar = el('i');
    bw.append(this.buyerBar);
    this.buyerEl.append(this.buyerText, bw);

    // Haggle slider (replaces the sell button while open).
    this.haggleEl = el('button', 'haggle hidden') as HTMLButtonElement;
    this.haggleEl.setAttribute('aria-label', 'Tap to stop the needle and close the deal');
    this.haggleLabel = el('div', 'haggle-label display', 'Tap to close the deal!');
    const track = el('div', 'haggle-track');
    track.append(el('span', 'zone-perfect'));
    this.haggleNeedle = el('i', 'haggle-needle');
    track.append(this.haggleNeedle);
    this.haggleEl.append(this.haggleLabel, track);

    this.panel = el('div', 'panel');
    const head = el('div', 'panel-head');
    const tabs = el('div', 'tabs');
    const tabNames: [Tab, string][] = [
      ['upgrades', 'Upgrades'],
      ['crew', 'Crew'],
      ['yard', 'Yard'],
      ['jobs', 'Jobs'],
    ];
    for (const [id, label] of tabNames) {
      const b = el('button', 'tab', `${label}<span class="dot"></span>`) as HTMLButtonElement;
      b.onclick = () => {
        this.tab = id;
        sfx.tap();
        this.buildCards();
        this.render();
      };
      this.tabButtons.set(id, b);
      tabs.append(b);
    }
    head.append(tabs);
    for (const m of [1, 10, 'max'] as BuyMode[]) {
      const b = el('button', 'mode', m === 'max' ? 'Max' : `x${m}`) as HTMLButtonElement;
      b.onclick = () => {
        this.mode = m;
        sfx.tap();
        this.render();
      };
      this.modeButtons.set(String(m), b);
      head.append(b);
    }
    this.cardsBox = el('div', 'cards');
    this.panel.append(head, this.cardsBox);

    this.root.append(hud, this.buyerEl, this.hint, this.sell, this.haggleEl, this.crush, this.banner, this.panel);
    this.buildCards();
  }

  private upgradeCard(kind: UpgradeKind): CardView {
    const info = ECON.upgrades[kind];
    const root = el('div', 'card');
    const title = el('div', 'title display');
    const lvl = el('span', 'lvl');
    title.append(document.createTextNode(info.name), lvl);
    const desc = el('div', 'desc');
    const barWrap = el('div', 'bar');
    const bar = el('i');
    barWrap.append(bar);
    const btn = el('button', 'buy') as HTMLButtonElement;
    root.append(title, desc, barWrap, btn);
    btn.onclick = () => {
      const s = this.deps.state();
      if (buyUpgrade(s, kind, this.mode)) {
        sfx.buy();
        this.deps.onChange();
        this.render();
      } else sfx.denied();
    };
    const update = (s: GameState) => {
      const level = s.levels[kind];
      setText(lvl, `Lv ${level}`);
      const ms = nextMilestone(level);
      // Crusher-only cards stay hidden until the crusher unlocks.
      root.style.display = kind === 'press' && !crusherUnlocked(s) ? 'none' : '';
      if (kind === 'quality') {
        setText(desc, `Better wrecks: cars worth x${qualityMultiplier(level).toFixed(2)}`);
      } else if (kind === 'press') {
        setText(desc, `Crush every ${crusherCooldown(level).toFixed(1)}s · +${crushParts('common', level)} ⚙ per wreck`);
      } else {
        const what = kind === 'wash' ? 'Wash power' : 'Repair power';
        setText(desc, `${what} x${stationPower(level).toFixed(2)}${ms ? ` · x2 at Lv ${ms}` : ''}`);
      }
      if (kind !== 'quality' && kind !== 'press' && ms) {
        const prev = [...ECON.milestones].reverse().find((m) => m <= level) ?? 1;
        bar.style.width = `${((level - prev) / (ms - prev)) * 100}%`;
        barWrap.style.visibility = 'visible';
      } else barWrap.style.visibility = 'hidden';
      const { levels, cost } = bulkCost(kind, level, this.mode, s.cash);
      const n = Math.max(levels, 1);
      const shownCost = levels === 0 ? bulkCost(kind, level, 1, 0).cost : cost;
      setText(btn, `${this.mode === 'max' ? `+${n} ` : this.mode === 10 ? '+10 ' : ''}${formatCash(shownCost)}`);
      const affordable = levels > 0 && cost <= s.cash;
      btn.disabled = !affordable;
      root.classList.toggle('ready', affordable);
    };
    return { root, lvl, desc, bar, btn, update };
  }

  private managerCard(kind: ManagerKind): CardView {
    const info = ECON.managers[kind];
    const blurbs: Record<ManagerKind, string> = {
      mechanic: 'Repairs washed cars for you',
      washer: 'Pressure-washes new wrecks',
      seller: 'Sells finished cars, even offline',
      scrapper: `Crushes a fresh Common wreck now and then to keep ${ECON.crusher.scrapperKeepParts}+ ⚙ in the bin (more if the barn needs it)`,
    };
    const root = el('div', 'card');
    const title = el('div', 'title display');
    const lvl = el('span', 'lvl');
    title.append(document.createTextNode(info.name), lvl);
    const desc = el('div', 'desc', blurbs[kind]);
    const btn = el('button', 'buy') as HTMLButtonElement;
    root.append(title, desc, btn);
    btn.onclick = () => {
      const s = this.deps.state();
      if (hireManager(s, kind)) {
        sfx.fanfare();
        this.deps.onChange();
        this.render();
      } else sfx.denied();
    };
    const update = (s: GameState) => {
      root.style.display = kind === 'scrapper' && !crusherUnlocked(s) ? 'none' : '';
      const hired = s.managers[kind];
      setText(lvl, hired ? 'Hired' : '');
      btn.classList.toggle('done', hired);
      setText(btn, hired ? 'Working' : `Hire ${formatCash(info.cost)}`);
      btn.disabled = hired || s.cash < info.cost;
      root.classList.toggle('ready', !hired && s.cash >= info.cost);
    };
    return { root, lvl, desc, btn, update };
  }

  private slotCard(): CardView {
    const root = el('div', 'card slot');
    const title = el('div', 'title display');
    const lvl = el('span', 'lvl');
    title.append(document.createTextNode('Lot Space'), lvl);
    const desc = el('div', 'desc', 'Room for one more car at a time');
    const btn = el('button', 'buy') as HTMLButtonElement;
    root.append(title, desc, btn);
    btn.onclick = () => {
      const s = this.deps.state();
      if (buySlot(s)) {
        sfx.buy();
        this.deps.onChange();
        this.render();
      } else sfx.denied();
    };
    const update = (s: GameState) => {
      const cost = slotCost(s.slots);
      setText(lvl, `${s.slots} / ${ECON.slots.start + ECON.slots.costs.length}`);
      btn.classList.toggle('done', cost === null);
      setText(btn, cost === null ? 'Full' : formatCash(cost));
      btn.disabled = cost === null || s.cash < cost;
      root.classList.toggle('ready', cost !== null && s.cash >= cost);
    };
    return { root, lvl, desc, btn, update };
  }

  private crusherCard(): CardView {
    const root = el('div', 'card crusher');
    const title = el('div', 'title display');
    const lvl = el('span', 'lvl');
    title.append(document.createTextNode('Car Crusher'), lvl);
    const desc = el('div', 'desc');
    const btn = el('button', 'buy') as HTMLButtonElement;
    root.append(title, desc, btn);
    btn.onclick = () => this.onCrush();
    const update = (s: GameState) => {
      const unlocked = crusherUnlocked(s);
      setText(lvl, unlocked ? `⚙ ${s.parts}` : '');
      if (!unlocked) {
        const left = ECON.crusher.unlockCarsSold - s.carsSold;
        setText(desc, `Opens after ${left} more sale${left === 1 ? '' : 's'}`);
        setText(btn, 'Locked');
        btn.disabled = true;
        root.classList.remove('ready');
        return;
      }
      setText(desc, `Crush wrecks for Parts. ${ECON.crusher.partsPerFix} parts halve a washed car's damage.`);
      const car = findCar(s, s.focusedId);
      const ok = canCrush(s, car);
      setText(btn, ok && car ? `Crush +${crushParts(car.rarity, s.levels.press)} ⚙` : s.crusherCooldown > 0 ? 'Cooling…' : 'No wreck');
      btn.disabled = !ok;
    };
    return { root, lvl, desc, btn, update };
  }

  private contractCard(index: number): CardView {
    const root = el('div', 'card contract');
    const title = el('div', 'title display');
    const name = el('span');
    const lvl = el('span', 'lvl');
    title.append(name, lvl);
    const desc = el('div', 'desc');
    const barWrap = el('div', 'bar');
    const bar = el('i');
    barWrap.append(bar);
    const btn = el('button', 'buy') as HTMLButtonElement;
    root.append(title, desc, barWrap, btn);
    btn.onclick = () => {
      const s = this.deps.state();
      const c = s.contracts[index];
      if (!c) return;
      if (canRerollContract(c)) {
        const events = rerollContract(s, c.id);
        if (events.length) {
          sfx.buy();
          this.deps.onEvents(events);
          this.deps.onChange();
          this.render();
        }
        return;
      }
      const reward = claimContract(s, c.id);
      if (reward.cash > 0 || reward.parts > 0) {
        sfx.fanfare();
        this.showBanner('PAID!', `+${formatCash(reward.cash)}${reward.parts ? ` · +${reward.parts} ⚙` : ''}`);
        this.deps.onChange();
        this.render();
      }
    };
    const update = (s: GameState) => {
      const c = s.contracts[index];
      root.classList.toggle('ready', c?.status === 'done');
      btn.classList.toggle('swap', canRerollContract(c));
      if (!c || c.status === 'empty') {
        setText(name, 'New order');
        setText(lvl, '');
        setText(desc, c ? `Arrives in ${formatDuration(Math.ceil(c.timeLeft))}` : 'Arriving…');
        bar.style.width = '0%';
        setText(btn, 'Waiting');
        btn.disabled = true;
        return;
      }
      setText(name, contractLabel(c));
      setText(lvl, `${c.progress}/${c.target}`);
      const reward = `${formatCash(c.rewardCash)}${c.rewardParts ? ` + ${c.rewardParts} ⚙` : ''}`;
      bar.style.width = `${(c.progress / c.target) * 100}%`;
      if (c.status === 'done') {
        setText(desc, 'Order complete!');
        setText(btn, `Claim ${reward}`);
        btn.disabled = false;
      } else {
        setText(desc, `Reward ${reward} · ${formatDuration(Math.ceil(c.timeLeft))} left`);
        const swap = canRerollContract(c);
        setText(btn, swap ? '🔄 Swap order (free)' : 'In progress');
        btn.disabled = !swap;
      }
    };
    return { root, lvl, desc, bar, btn, update };
  }

  private barnCard(): CardView {
    const root = el('div', 'card barn');
    const title = el('div', 'title display');
    const lvl = el('span', 'lvl');
    title.append(document.createTextNode('Barn Find'), lvl);
    const desc = el('div', 'desc');
    const barWrap = el('div', 'bar');
    const bar = el('i');
    barWrap.append(bar);
    const btn = el('button', 'buy') as HTMLButtonElement;
    root.append(title, desc, barWrap, btn);
    btn.onclick = () => this.onBarn();
    const stages = ECON.barn.stages.length;
    const update = (s: GameState) => {
      const b = s.barn;
      root.classList.toggle('ready', this.barnHasAction(s));
      btn.classList.remove('done');
      if (!barnUnlocked(s)) {
        const left = ECON.barn.unlockCarsSold - s.carsSold;
        setText(lvl, '');
        setText(desc, `Something is hiding under a tarp… Opens after ${left} more sale${left === 1 ? '' : 's'}`);
        bar.style.width = '0%';
        setText(btn, 'Locked');
        btn.disabled = true;
        return;
      }
      setText(lvl, b.status === 'away' ? '' : `${Math.min(b.stage + (b.status === 'working' ? 1 : 0), stages)}/${stages}`);
      if (b.status === 'covered') {
        const st = nextBarnStage(s)!;
        const cost = barnStageCost(s);
        setText(desc, `${b.stage === 0 ? 'A covered classic! ' : ''}Next: ${st.name}. Sells for about ${formatCash(barnValue(s))}`);
        bar.style.width = `${(b.stage / stages) * 100}%`;
        setText(btn, `${formatCash(cost.cash)}${cost.parts ? ` + ${cost.parts} ⚙` : ''}`);
        btn.disabled = s.cash < cost.cash || s.parts < cost.parts;
      } else if (b.status === 'working') {
        const st = ECON.barn.stages[b.stage]!;
        setText(desc, `${st.name}… ${formatDuration(Math.ceil(b.timeLeft))} left (keeps going while you're away)`);
        bar.style.width = `${((b.stage + 1 - b.timeLeft / st.seconds) / stages) * 100}%`;
        setText(btn, 'Working…');
        btn.disabled = true;
      } else if (b.status === 'finished') {
        setText(desc, 'Restoration complete! Pull off the tarp.');
        bar.style.width = '100%';
        setText(btn, 'Reveal!');
        btn.disabled = false;
      } else if (b.status === 'revealed') {
        setText(desc, `${b.model}, Legendary classic. A collector is waiting.`);
        bar.style.width = '100%';
        setText(btn, `Sell ${formatCash(b.value)}`);
        btn.disabled = false;
      } else {
        setText(desc, `Grandpa Joe is asking around for the next barn find… ${formatDuration(Math.ceil(b.timeLeft))}`);
        bar.style.width = '0%';
        setText(btn, `Restored: ${b.restored}`);
        btn.classList.add('done');
        btn.disabled = true;
      }
    };
    return { root, lvl, desc, bar, btn, update };
  }

  private teaserCard(): CardView {
    const root = el('div', 'card');
    const title = el('div', 'title display', 'Repair Garage');
    const desc = el('div', 'desc', 'Your second business. Opens in the next update.');
    const btn = el('button', 'buy', 'Coming soon') as HTMLButtonElement;
    btn.disabled = true;
    root.append(title, desc, btn);
    return { root, lvl: title, desc, btn, update: () => {} };
  }

  private buildCards() {
    this.cardsBox.innerHTML = '';
    if (this.tab === 'upgrades') this.cards = (['wash', 'repair', 'quality', 'press'] as UpgradeKind[]).map((k) => this.upgradeCard(k));
    else if (this.tab === 'crew') this.cards = (['mechanic', 'washer', 'seller', 'scrapper'] as ManagerKind[]).map((k) => this.managerCard(k));
    else if (this.tab === 'yard') {
      // Once the barn is open it leads the tab, so it is never below the fold on a phone.
      const barnFirst = barnUnlocked(this.deps.state());
      const barn = this.barnCard();
      const rest = [this.slotCard(), this.crusherCard()];
      this.cards = barnFirst ? [barn, ...rest, this.teaserCard()] : [...rest, barn, this.teaserCard()];
    }
    else this.cards = Array.from({ length: ECON.contracts.board }, (_, i) => this.contractCard(i));
    for (const c of this.cards) this.cardsBox.append(c.root);
    for (const b of this.modeButtons.values()) b.style.display = this.tab === 'upgrades' ? '' : 'none';
  }

  // ---- actions -------------------------------------------------------------

  private onSell() {
    const s = this.deps.state();
    const car = findCar(s, s.focusedId);
    if (!car || this.haggling !== null) return;
    if (wantsHaggle(s, car)) {
      this.startHaggle(s, car);
      return;
    }
    this.finishSale(car.id, 1);
  }

  private finishSale(carId: number, haggle: number) {
    const events = sellCar(this.deps.state(), carId, haggle);
    if (events.length) {
      this.deps.onEvents(events);
      this.deps.onChange();
    }
    this.render();
  }

  /** Timing slider: a needle sweeps the bar; tapping stops it. The centre pays most. */
  private startHaggle(s: GameState, car: Car) {
    const lesson = isHaggleLesson(s);
    const speed = lesson ? ECON.haggle.lessonSweepsPerSec : ECON.haggle.sweepsPerSec;
    holdForHaggle(s, car.id);
    this.haggling = car.id;
    sfx.tap();
    const hg = this.haggleEl;
    hg.classList.remove('hidden', 'stopped', 'perfect', 'great', 'good', 'poor');
    hg.classList.toggle('lesson', lesson);
    setText(this.haggleLabel, lesson ? 'Haggle! Stop the needle in the green' : 'Tap to close the deal!');
    const start = performance.now();
    let done = false;
    let raf = 0;
    const frame = () => {
      if (done) return;
      const pos = hagglePosition((performance.now() - start) / 1000, speed);
      this.haggleNeedle.style.left = `${pos * 100}%`;
      if (performance.now() - start > ECON.haggle.timeout * 1000) finish(null);
      else raf = requestAnimationFrame(frame);
    };
    const finish = (pos: number | null) => {
      if (done) return;
      done = true;
      cancelAnimationFrame(raf);
      hg.onpointerdown = null;
      const mult = pos === null ? 1 : haggleMultiplier(pos, lesson);
      const grade = haggleGrade(mult);
      hg.classList.add('stopped', grade);
      const words = { perfect: 'PERFECT!', great: 'Great deal!', good: 'Deal!', poor: 'Ouch…' } as const;
      setText(this.haggleLabel, pos === null ? 'Sold at asking price' : `${words[grade]} x${mult.toFixed(2)}`);
      if (grade === 'perfect') sfx.fanfare();
      else if (grade === 'poor') sfx.denied();
      else sfx.buy();
      setTimeout(() => {
        hg.classList.add('hidden');
        this.haggling = null;
        this.finishSale(car.id, mult);
      }, 650);
    };
    hg.onpointerdown = (ev) => {
      ev.preventDefault();
      sfx.unlock();
      const pos = hagglePosition((performance.now() - start) / 1000, speed);
      this.haggleNeedle.style.left = `${pos * 100}%`;
      finish(pos);
    };
    raf = requestAnimationFrame(frame);
  }

  /** Open the Yard tab (the scene calls this when the barn is tapped). */
  showYard() {
    if (this.tab !== 'yard' || !this.cardsBox.firstElementChild?.classList.contains('barn')) {
      this.tab = 'yard';
      this.buildCards();
    }
    sfx.tap();
    this.render();
    const card = this.cardsBox.querySelector<HTMLElement>('.card.barn');
    if (card) {
      card.scrollIntoView({ block: 'nearest', behavior: this.deps.state().settings.reduceMotion ? 'auto' : 'smooth' });
      card.classList.remove('flash');
      void card.offsetWidth; // restart the animation
      card.classList.add('flash');
    }
  }

  private onBarn() {
    const s = this.deps.state();
    const b = s.barn;
    if (b.status === 'covered') {
      if (startBarnStage(s)) {
        sfx.buy();
        this.deps.onChange();
      } else sfx.denied();
    } else if (b.status === 'finished') {
      if (!revealBarn(s)) return;
      this.deps.onChange();
      this.showBarnReveal();
    } else if (b.status === 'revealed') {
      this.showBarnReveal();
    }
    this.render();
  }

  /** The big moment: light rays in the scene, then a sale offer. */
  private showBarnReveal() {
    const s = this.deps.state();
    this.modalOpen = true;
    sfx.reveal();
    // Banners (e.g. "RESTORED!") stay out of the way of the reveal.
    this.banner.classList.add('muted');
    const reveal = this.deps.barnReveal(() => {
      this.modal({
        title: 'Legendary classic!',
        body: `<p>Under the tarp: a fully restored <b>${s.barn.model}</b>. A collector wants it right now.</p>`,
        big: formatCash(s.barn.value),
        button: 'Sell it!',
        secondary: 'Later',
        cls: 'reveal',
        onClose: () => {
          close();
          const paid = sellBarnCar(s);
          if (paid > 0) {
            this.deps.onEvents([{ type: 'barnSold', amount: paid }]);
            this.deps.onChange();
            sfx.fanfare();
          }
        },
        onSecondary: () => close(),
      });
    });
    const close = () => {
      this.banner.classList.remove('muted');
      reveal();
    };
  }

  private onCrush() {
    const s = this.deps.state();
    const car = findCar(s, s.focusedId);
    if (!canCrush(s, car)) {
      sfx.denied();
      return;
    }
    const doCrush = () => {
      const events = crushCar(s, car.id);
      if (events.length) {
        this.deps.onEvents(events);
        this.deps.onChange();
        this.render();
      }
    };
    // Rare finds are worth far more sold: ask first.
    if (car.rarity === 'epic' || car.rarity === 'legendary') {
      this.modal({
        title: 'Crush this beauty?',
        body: `<p>This ${ECON.rarity[car.rarity].label} ${car.model} sells for ${formatCash(car.value)} once fixed.</p>`,
        button: 'Keep it',
        secondary: `Crush for ${crushParts(car.rarity, s.levels.press)} parts`,
        onSecondary: doCrush,
      });
      return;
    }
    doCrush();
  }

  // ---- render --------------------------------------------------------------

  render() {
    const s = this.deps.state();
    setText(this.cash, formatCash(s.cash));
    if (s.cash > this.lastCash && this.lastCash >= 0) {
      this.cash.classList.add('bump');
      setTimeout(() => this.cash.classList.remove('bump'), 120);
    }
    this.lastCash = s.cash;
    const ips = this.deps.incomePerSecond();
    setText(this.rate, ips > 0 ? `+${formatCash(ips)}/s` : '');
    setText(this.soundBtn, s.settings.sound ? '🔊' : '🔇');
    this.root.classList.toggle('reduce-motion', s.settings.reduceMotion);

    const car = findCar(s, s.focusedId);
    const ready = car && carStage(car) === 'ready';
    this.sell.classList.toggle('hidden', !ready || this.haggling !== null);
    if (ready && car) {
      const bm = buyerMultiplier(s, car);
      const who = bm > 1 && s.buyer ? ECON.buyers.kinds[s.buyer.kind] : null;
      const sub = who ? `${who.icon} ${who.name} pays +${Math.round(who.bonus * 100)}%` : car.model;
      const html = `Sell ${formatCash(Math.round(car.value * bm))}<small>${sub}</small>`;
      if (this.sell.innerHTML !== html) this.sell.innerHTML = html;
      this.sell.classList.toggle('match', !!who);
    }
    this.renderBuyer(s, car);

    const crusherOn = crusherUnlocked(s);
    this.partsEl.classList.toggle('hidden', !crusherOn);
    setText(this.partsEl, `⚙ ${s.parts}`);
    const showCrush = crusherOn && !!car && !ready && !this.modalOpen;
    this.crush.classList.toggle('hidden', !showCrush);
    if (showCrush && car) {
      const cd = s.crusherCooldown;
      this.crush.disabled = cd > 0;
      const html = cd > 0 ? `Crush<small>${cd.toFixed(1)}s</small>` : `Crush<small>+${crushParts(car.rarity, s.levels.press)} ⚙</small>`;
      if (this.crush.innerHTML !== html) this.crush.innerHTML = html;
    }

    // Unlock announcements (once per save).
    if (crusherOn && !s.tutorial.crusherSeen && !this.modalOpen) {
      s.tutorial.crusherSeen = true;
      this.showBanner('CAR CRUSHER!', 'Crush wrecks for Parts');
      sfx.fanfare();
      this.deps.onChange();
    }
    const jobsOn = contractsUnlocked(s);
    this.tabButtons.get('jobs')!.style.display = jobsOn ? '' : 'none';
    if (jobsOn && !s.tutorial.contractsSeen && !this.modalOpen && s.tutorial.crusherSeen) {
      s.tutorial.contractsSeen = true;
      setTimeout(() => this.showBanner('CONTRACTS!', 'New orders on the Jobs board'), 2700);
      this.deps.onChange();
    }

    if (barnUnlocked(s) && !s.tutorial.barnSeen && !this.modalOpen && s.tutorial.crusherSeen) {
      s.tutorial.barnSeen = true;
      setTimeout(() => this.showBanner('BARN FIND!', 'A covered classic at the back of the yard'), 2700);
      this.deps.onChange();
    }

    this.renderHint(s);

    for (const c of this.cards) c.update(s);
    for (const [t, b] of this.tabButtons) {
      b.classList.toggle('active', t === this.tab);
      b.querySelector('.dot')!.classList.toggle('on', t !== this.tab && this.tabHasAction(s, t));
    }
    for (const [m, b] of this.modeButtons) b.classList.toggle('active', String(this.mode) === m);
  }

  private renderBuyer(s: GameState, car: Car | undefined) {
    const on = buyersUnlocked(s);
    this.buyerEl.classList.toggle('hidden', !on);
    if (!on) return;
    const b = s.buyer;
    if (!b) {
      setText(this.buyerText, 'Next customer is on the way…');
      this.buyerBar.style.width = '0%';
      this.buyerEl.classList.remove('match');
      return;
    }
    const info = ECON.buyers.kinds[b.kind];
    setText(this.buyerText, `${info.icon} ${info.name} wants ${info.wants} · pays +${Math.round(info.bonus * 100)}%`);
    this.buyerBar.style.width = `${Math.max(0, b.timeLeft / ECON.buyers.patience) * 100}%`;
    this.buyerEl.classList.toggle('match', !!car && buyerMatches(b.kind, car));
  }

  private tabHasAction(s: GameState, t: Tab): boolean {
    if (t === 'crew')
      return (Object.keys(ECON.managers) as ManagerKind[]).some(
        (k) => !s.managers[k] && s.cash >= ECON.managers[k].cost && (k !== 'scrapper' || crusherUnlocked(s)),
      );
    if (t === 'yard') {
      const c = slotCost(s.slots);
      return (c !== null && s.cash >= c) || this.barnHasAction(s);
    }
    if (t === 'jobs') return s.contracts.some((c) => c.status === 'done');
    return false;
  }

  private barnHasAction(s: GameState): boolean {
    return barnHasAction(s);
  }

  private renderHint(s: GameState) {
    let text = '';
    const car = findCar(s, s.focusedId);
    const learning = s.carsSold < 3;
    if (this.modalOpen || this.haggling !== null) text = '';
    else if (!car && s.carsSold === 0) text = 'A wreck is on its way...';
    else if (car && learning) {
      const stage = carStage(car);
      text = stage === 'dirty' ? '👆 Swipe to wash it!' : stage === 'damaged' ? '👆 Tap to fix it!' : '';
    } else if (s.tutorial.firstSale && !s.tutorial.firstUpgrade && s.cash >= ECON.upgrades.wash.baseCost) {
      text = '👇 Buy your first upgrade';
    } else if (!s.managers.mechanic && s.cash >= ECON.managers.mechanic.cost) {
      text = '👇 Hire a Mechanic in Crew';
    }
    setText(this.hint, text);
    this.hint.classList.toggle('hidden', text === '');
    this.hint.classList.toggle('beside-crush', !this.crush.classList.contains('hidden'));
    // Sits where the sell button appears; the two never show at the same time.
    const { bottom } = this.insets();
    const h = this.root.getBoundingClientRect().height;
    this.hint.style.setProperty('--hint-top', `${h - bottom + 10}px`);
  }

  // ---- banners, toasts and modals -----------------------------------------

  private bannerQueue: [string, string][] = [];
  private bannerBusy = false;

  /** Big centre banner. Banners that arrive while one is showing wait their turn instead of replacing it. */
  showBanner(title: string, sub: string) {
    if (this.bannerBusy) {
      if (this.bannerQueue.length < 4) this.bannerQueue.push([title, sub]);
      return;
    }
    this.bannerBusy = true;
    this.banner.innerHTML = `${title}<small>${sub}</small>`;
    this.banner.classList.add('show');
    setTimeout(() => {
      this.banner.classList.remove('show');
      setTimeout(() => {
        this.bannerBusy = false;
        const next = this.bannerQueue.shift();
        if (next) this.showBanner(next[0], next[1]);
      }, 300);
    }, 2600);
  }

  toast(message: string, ms = 4000) {
    const t = el('div', 'toast', '');
    t.textContent = message;
    this.root.append(t);
    setTimeout(() => t.remove(), ms);
  }

  modal(opts: {
    title: string;
    body: string;
    big?: string;
    button: string;
    secondary?: string;
    onClose?: () => void;
    /** Called instead of onClose when the secondary button is used. */
    onSecondary?: () => void;
    /** Extra class on the backdrop (e.g. 'reveal' keeps the top of the screen visible). */
    cls?: string;
  }) {
    this.modalOpen = true;
    const back = el('div', `modal-back${opts.cls ? ` ${opts.cls}` : ''}`);
    const box = el('div', 'modal');
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    const h = el('h2', 'display');
    h.textContent = opts.title;
    box.append(h);
    const p = el('div');
    p.innerHTML = opts.body;
    box.append(p);
    if (opts.big) box.append(el('div', 'big display', opts.big));
    const close = (secondary = false) => {
      if (!back.isConnected) return;
      back.remove();
      this.modalOpen = false;
      sfx.unlock();
      sfx.tap();
      if (secondary && opts.onSecondary) opts.onSecondary();
      else opts.onClose?.();
      this.render();
    };
    const btn = el('button', 'buy', opts.button) as HTMLButtonElement;
    btn.onclick = () => close();
    box.append(btn);
    if (opts.secondary) {
      const sec = el('button', 'secondary', opts.secondary) as HTMLButtonElement;
      sec.onclick = () => close(true);
      box.append(sec);
    }
    back.append(box);
    this.root.append(back);
    btn.focus();
  }

  /** Settings sheet: sound, music, motion, number format, reset, credits. */
  openSettings() {
    if (this.modalOpen) return;
    const s = this.deps.state();
    this.modalOpen = true;
    sfx.tap();
    const back = el('div', 'modal-back');
    const box = el('div', 'modal settings');
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', 'Settings');
    const h = el('h2', 'display', 'Settings');
    box.append(h);
    const close = () => {
      if (!back.isConnected) return;
      back.remove();
      this.modalOpen = false;
      this.render();
    };
    const toggle = (label: string, note: string, get: () => boolean, set: (v: boolean) => void) => {
      const row = el('div', 'set-row');
      const text = el('div', 'set-label', label);
      if (note) text.append(el('small', '', note));
      const btn = el('button', 'toggle') as HTMLButtonElement;
      btn.setAttribute('role', 'switch');
      const paint = () => {
        btn.setAttribute('aria-checked', String(get()));
        btn.classList.toggle('on', get());
        btn.textContent = get() ? 'On' : 'Off';
      };
      btn.setAttribute('aria-label', label);
      btn.onclick = () => {
        set(!get());
        paint();
        sfx.tap();
        this.deps.onChange();
        this.render();
      };
      paint();
      row.append(text, btn);
      return row;
    };
    box.append(
      toggle('Sound effects', '', () => s.settings.sound, (v) => {
        s.settings.sound = v;
        sfx.enabled = v;
      }),
      toggle('Music', 'Arrives in a later update', () => s.settings.music, (v) => (s.settings.music = v)),
      toggle('Reduce motion', 'No screen shake or flashes', () => s.settings.reduceMotion, (v) => (s.settings.reduceMotion = v)),
      toggle('Skip haggling', 'Sell at the asking price, no slider', () => s.settings.skipHaggle, (v) => (s.settings.skipHaggle = v)),
      toggle('Vibration', haptics.supported ? 'Buzz on taps, sales and crushes' : 'Not supported on this device', () => s.settings.vibration, (v) => {
        s.settings.vibration = v;
        haptics.enabled = v;
        haptics.play('tap');
      }),
    );
    // Number format: two-way switch.
    const fmtRow = el('div', 'set-row');
    fmtRow.append(el('div', 'set-label', 'Numbers'));
    const seg = el('div', 'seg');
    const opts: [NumberFormat, string][] = [
      ['short', '1.5M'],
      ['scientific', '1.5e6'],
    ];
    const segBtns = opts.map(([fmt, label]) => {
      const b = el('button', 'seg-btn', label) as HTMLButtonElement;
      b.dataset.fmt = fmt;
      b.onclick = () => {
        s.settings.numberFormat = fmt;
        setNumberFormat(fmt);
        for (const x of segBtns) x.classList.toggle('on', x === b);
        sfx.tap();
        this.deps.onChange();
        this.render();
      };
      b.classList.toggle('on', s.settings.numberFormat === fmt);
      return b;
    });
    seg.append(...segBtns);
    fmtRow.append(seg);
    box.append(fmtRow);

    const reset = el('button', 'danger', 'Reset progress') as HTMLButtonElement;
    reset.onclick = () => {
      close();
      this.modal({
        title: 'Start over?',
        body: '<p>This deletes your yard, cash, crew and everything else on this device. It cannot be undone.</p>',
        button: 'Keep playing',
        secondary: 'Delete everything',
        onSecondary: () => this.deps.resetProgress(),
      });
    };
    const credits = el(
      'div',
      'credits',
      `<b>Junkyard to Supercar Empire</b> v${version}<br>Design, code, art and sound: Claude, for the owner<br>Engine: Phaser 3 (MIT) · Fonts: Lilita One, Nunito (SIL OFL)<br>All car brands are fictional.`,
    );
    const done = el('button', 'buy', 'Done') as HTMLButtonElement;
    done.onclick = () => {
      sfx.tap();
      close();
    };
    box.append(reset, credits, done);
    back.onclick = (e) => {
      if (e.target === back) close();
    };
    back.append(box);
    this.root.append(back);
    done.focus();
  }

  offlineModal(seconds: number, earned: number, parts: number, onCollect: () => void) {
    const scrap = parts > 0 ? `<p class="offline-parts">♻ The Scrapper topped up the parts bin: +${parts} ⚙</p>` : '';
    this.modal({
      title: 'Welcome back!',
      body: `<p>Your crew kept working for ${formatDuration(seconds)}.</p>${scrap}`,
      big: formatCash(earned),
      button: 'Collect',
      onClose: onCollect,
    });
  }
}
