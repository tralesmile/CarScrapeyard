// DOM UI: top bar, hints, sell button, upgrade panel, modals.
// DOM instead of canvas for UI: crisp text, accessibility, easy translation.

import { sfx } from '../audio/sfx';
import { ECON, type ManagerKind, type UpgradeKind } from '../core/config';
import { bulkCost, nextMilestone, qualityMultiplier, slotCost, stationPower } from '../core/formulas';
import { formatCash, formatDuration } from '../core/format';
import { buySlot, buyUpgrade, carStage, findCar, hireManager, sellCar, type GameEvent } from '../core/sim';
import type { GameState } from '../core/state';

type Tab = 'upgrades' | 'crew' | 'yard';
type BuyMode = 1 | 10 | 'max';

export interface UiDeps {
  state: () => GameState;
  onEvents: (events: GameEvent[]) => void;
  onChange: () => void;
  incomePerSecond: () => number;
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
  private soundBtn!: HTMLButtonElement;
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

  constructor(
    mount: HTMLElement,
    private deps: UiDeps,
  ) {
    this.root = mount;
    this.build();
  }

  // ---- layout info for the scene -------------------------------------------

  insets() {
    const hudBottom = this.cash.parentElement!.getBoundingClientRect().bottom - this.root.getBoundingClientRect().top;
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
    this.soundBtn = el('button', 'icon-btn') as HTMLButtonElement;
    this.soundBtn.setAttribute('aria-label', 'Toggle sound');
    this.soundBtn.onclick = () => {
      const s = this.deps.state();
      s.settings.sound = !s.settings.sound;
      sfx.enabled = s.settings.sound;
      this.deps.onChange();
      this.render();
    };
    hud.append(this.cash, this.rate, el('div', 'spacer'), this.soundBtn);

    this.hint = el('div', 'hint hidden');
    this.sell = el('button', 'sell display hidden') as HTMLButtonElement;
    this.sell.onclick = () => this.onSell();

    this.banner = el('div', 'banner display');

    this.panel = el('div', 'panel');
    const head = el('div', 'panel-head');
    const tabs = el('div', 'tabs');
    const tabNames: [Tab, string][] = [
      ['upgrades', 'Upgrades'],
      ['crew', 'Crew'],
      ['yard', 'Yard'],
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

    this.root.append(hud, this.hint, this.sell, this.banner, this.panel);
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
      if (kind === 'quality') {
        setText(desc, `Better wrecks: cars worth x${qualityMultiplier(level).toFixed(2)}`);
      } else {
        const what = kind === 'wash' ? 'Wash power' : 'Repair power';
        setText(desc, `${what} x${stationPower(level).toFixed(2)}${ms ? ` · x2 at Lv ${ms}` : ''}`);
      }
      if (kind !== 'quality' && ms) {
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
    const root = el('div', 'card');
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
    if (this.tab === 'upgrades') this.cards = (['wash', 'repair', 'quality'] as UpgradeKind[]).map((k) => this.upgradeCard(k));
    else if (this.tab === 'crew') this.cards = (['mechanic', 'washer', 'seller'] as ManagerKind[]).map((k) => this.managerCard(k));
    else this.cards = [this.slotCard(), this.teaserCard()];
    for (const c of this.cards) this.cardsBox.append(c.root);
    for (const b of this.modeButtons.values()) b.style.display = this.tab === 'upgrades' ? '' : 'none';
  }

  // ---- actions -------------------------------------------------------------

  private onSell() {
    const s = this.deps.state();
    const car = findCar(s, s.focusedId);
    if (!car) return;
    const events = sellCar(s, car.id);
    if (events.length) {
      this.deps.onEvents(events);
      this.deps.onChange();
      this.render();
    }
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

    const car = findCar(s, s.focusedId);
    const ready = car && carStage(car) === 'ready';
    this.sell.classList.toggle('hidden', !ready);
    if (ready && car) this.sell.innerHTML = `Sell ${formatCash(car.value)}<small>${car.model}</small>`;

    this.renderHint(s);

    for (const c of this.cards) c.update(s);
    for (const [t, b] of this.tabButtons) {
      b.classList.toggle('active', t === this.tab);
      b.querySelector('.dot')!.classList.toggle('on', t !== this.tab && this.tabHasAction(s, t));
    }
    for (const [m, b] of this.modeButtons) b.classList.toggle('active', String(this.mode) === m);
  }

  private tabHasAction(s: GameState, t: Tab): boolean {
    if (t === 'crew') return (Object.keys(ECON.managers) as ManagerKind[]).some((k) => !s.managers[k] && s.cash >= ECON.managers[k].cost);
    if (t === 'yard') {
      const c = slotCost(s.slots);
      return c !== null && s.cash >= c;
    }
    return false;
  }

  private renderHint(s: GameState) {
    let text = '';
    const car = findCar(s, s.focusedId);
    const learning = s.carsSold < 3;
    if (this.modalOpen) text = '';
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
    // Sits where the sell button appears; the two never show at the same time.
    const { bottom } = this.insets();
    const h = this.root.getBoundingClientRect().height;
    this.hint.style.setProperty('--hint-top', `${h - bottom + 10}px`);
  }

  // ---- banners, toasts and modals -----------------------------------------

  showBanner(title: string, sub: string) {
    this.banner.innerHTML = `${title}<small>${sub}</small>`;
    this.banner.classList.add('show');
    setTimeout(() => this.banner.classList.remove('show'), 2600);
  }

  toast(message: string, ms = 4000) {
    const t = el('div', 'toast', '');
    t.textContent = message;
    this.root.append(t);
    setTimeout(() => t.remove(), ms);
  }

  modal(opts: { title: string; body: string; big?: string; button: string; secondary?: string; onClose?: () => void }) {
    this.modalOpen = true;
    const back = el('div', 'modal-back');
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
    const close = () => {
      if (!back.isConnected) return;
      back.remove();
      this.modalOpen = false;
      sfx.unlock();
      sfx.tap();
      opts.onClose?.();
      this.render();
    };
    const btn = el('button', 'buy', opts.button) as HTMLButtonElement;
    btn.onclick = close;
    box.append(btn);
    if (opts.secondary) {
      const sec = el('button', 'secondary', opts.secondary) as HTMLButtonElement;
      sec.onclick = close;
      box.append(sec);
    }
    back.append(box);
    this.root.append(back);
    btn.focus();
  }

  offlineModal(seconds: number, earned: number, onCollect: () => void) {
    this.modal({
      title: 'Welcome back!',
      body: `<p>Your crew kept working for ${formatDuration(seconds)}.</p>`,
      big: formatCash(earned),
      button: 'Collect',
      onClose: onCollect,
    });
  }
}
