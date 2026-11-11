// DOM UI: top bar, hints, sell button, upgrade panel, modals.
// DOM instead of canvas for UI: crisp text, accessibility, easy translation.

import { bookUnlocked, inShowcase, markBookSeen, unseenEntries, type CollectionEvent } from '../core/collection';
import { bookView, pctText, showcaseLine, type BookPage } from './collectionView';
import { awardsView, medalToast } from './awardsView';
import { walletText } from '../core/wallet';
import { buyShopItem, shopItems } from '../core/shop';
import { AWARD_IDS, awardsToClaim, claimAward, tiersReached, type AwardId } from '../core/achievements';
import { THUMB_H, THUMB_W, carThumb } from '../game/bookArt';
import { haptics } from '../platform/haptics';
import { sfx } from '../audio/sfx';
import { ECON, type ManagerKind, type UpgradeKind } from '../core/config';
import { bulkCost, crusherCooldown, crushParts, managerCost, nextMilestone, qualityMultiplier, slotCost, stationPower, upgradeCost } from '../core/formulas';
import { cityInfo, cityScale, currentCity } from '../core/cities';
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
import type { Car, GameState, LotCar } from '../core/state';
import { buyerMatches, buyerMultiplier, buyersUnlocked } from '../core/buyers';
import {
  bonusReward,
  calendarIndex,
  calendarReward,
  canClaimCalendar,
  claimBonus,
  claimCalendar,
  claimTask,
  dailyHasClaim,
  dailyUnlocked,
  msToReset,
  taskDone,
  taskReward,
  type DailyReward,
} from '../core/daily';
import { calendarCells, resetText, taskDoneToast, taskLabel, waitText, waitingLines } from './dailyView';
import { barnHasAction, barnStageCost, barnUnlocked, barnValue, canKeepBarnCar, keepBarnCar, nextBarnStage, revealBarn, sellBarnCar, startBarnStage } from '../core/barn';
import { MAX_TIER, businessName, mapUnlocked, nextBusiness, openBusiness, switchBusiness, canOpenBusiness } from '../core/businesses';
import { cityMapSvg, mapRows, rivalRow } from './cityMap';
import { LEGACY_ICON, awayText, grandpaLine, legacyBadge, legacyTreeView, nextSaleLine, perkChip, sellEmpirePreview, sellEmpireRow, tabPerks, treeHasBuy, type PerkChip } from './legacyView';
import { canSellEmpire, type SoldEmpire } from '../core/legacy';
import { dueBeat, markBeatSeen, type StoryBeatId } from '../core/story';
import { speaker, storyLog, storyScene } from './storyView';
import { portraitUrl } from '../game/portraitArt';
import {
  buyGarageBay,
  buyGarageUpgrade,
  findJob,
  foremanRate,
  garageBayCost,
  garageUpgradeCost,
  foremanCost,
  garageWorkPerTap,
  hireForeman,
  repMultiplier,
} from '../core/garage';
import type { BusinessId, CityId, CityLights, CarLotCrewKind, CarLotUpgradeKind, GarageUpgradeKind, LegacyBranch, PaintUpgradeKind } from '../core/config';
import { boothCost, painterCost, buyBooth, buyPaintUpgrade, currentService, findPaintJob, hirePainter, hypeMultiplier, lotCarService, lotSendBlock, lotTuneValue, paintUpgradeCost, paintWorkPerTap, painterRate, sendLotCarToShop } from '../core/paint';
import {
  buyCarLotUpgrade,
  buyLot,
  buySpot,
  canBuyLot,
  carlotUpgradeCost,
  lotCrewCost,
  detailerRate,
  findLotCar,
  hasFreeSpot,
  hireLotCrew,
  holdLotCar,
  listPrice,
  lotCarReady,
  lotProfit,
  refurbPerTap,
  sellLotCar,
  showroomMultiplier,
  spotCost,
} from '../core/carlot';
import { conditionStars } from '../game/carlotArt';
import { HINT_BELOW_AREA } from '../game/garageArt';
import { haggleGrade, haggleMultiplier, hagglePosition, isHaggleLesson, wantsHaggle } from '../core/haggle';
import { barnStageSeconds, buyNode, offlineCap, perfectZone, respecTree } from '../core/legacyTree';
import { t } from '../i18n';

/** Yard tabs, the Repair Garage's and the Used Car Lot's own tabs (each set shows while that business is on screen). */
type Tab = 'upgrades' | 'crew' | 'yard' | 'jobs' | 'gupgrades' | 'gcrew' | 'auction' | 'lupgrades' | 'lcrew' | 'pupgrades' | 'pcrew';
const BUSINESS_TABS: Record<BusinessId, Tab[]> = {
  scrapyard: ['upgrades', 'crew', 'yard', 'jobs'],
  garage: ['gupgrades', 'gcrew'],
  carlot: ['auction', 'lupgrades', 'lcrew'],
  paint: ['pupgrades', 'pcrew'],
};
type BuyMode = 1 | 10 | 'max';

export interface UiDeps {
  state: () => GameState;
  onEvents: (events: GameEvent[]) => void;
  onChange: () => void;
  incomePerSecond: () => number;
  /** Platform clock (ms), for the daily reset countdown. */
  now: () => number;
  /** Play the barn reveal in the scene; `shown` runs when the car is on screen. Returns a function that closes it. */
  barnReveal: (shown: () => void) => () => void;
  /** Delete every save and start over (after the player confirmed). */
  resetProgress: () => void;
  /** The business on screen changed (city map "Go"): swap the Phaser scene. */
  onSwitchBusiness: () => void;
  /** Sell the empire (P1.3b): stop the scenes, apply the sale and save it. Null when not allowed. */
  sellEmpire: (city: CityId) => SoldEmpire | null;
  /** Start the new empire's scenes fresh (a reload: every scene and texture is rebuilt from the saved game). */
  restart: () => void;
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
  /** Used Car Lot: send the refurbished car to Paint & Tuning for one service (P1.2f). */
  private tuneBtn!: HTMLButtonElement;
  private soundBtn!: HTMLButtonElement;
  private settingsBtn!: HTMLButtonElement;
  private mapBtn!: HTMLButtonElement;
  private bookBtn!: HTMLButtonElement;
  /** The 📒 button was on at the last render (null before the first): a toast when it first appears in play. */
  private bookWasOn: boolean | null = null;
  private bookPage: BookPage | 'awards' | 'story' | 'shop' = 'cars';
  /** Story log (P1.6c): the scene opened for reading in the book, if any. */
  private storyOpen: StoryBeatId | null = null;
  /** Medal tiers reached per award at the last render (null until the book opens up), for the "medal!" toast. */
  private awardTiers: Record<AwardId, number> | null = null;
  /** The map banner was shown this session (it repeats each session until the map is opened). */
  private mapAnnounced = false;
  /** The "empire for sale" banner was shown this session (P1.3b). */
  private legacyAnnounced = false;
  /** The Legacy tree's open branch tab (kept while the game runs). */
  private legacyTab: LegacyBranch = 'mechanic';
  /** HUD chip with the Legacy income multiplier, once the player owns points (P1.3b). */
  private legacyChip!: HTMLButtonElement;
  private hint!: HTMLElement;
  private sell!: HTMLButtonElement;
  private panel!: HTMLElement;
  private cardsBox!: HTMLElement;
  /** Owned Legacy perks that change this tab (P1.3e). */
  private perkStrip!: HTMLElement;
  private tabButtons = new Map<Tab, HTMLButtonElement>();
  private modeButtons = new Map<string, HTMLButtonElement>();
  private banner!: HTMLElement;
  private cards: CardView[] = [];
  private tab: Tab = 'upgrades';
  /** Auction card stamps (P1.2c): "SOLD!" when a lot went to another bidder, "YOURS!" when you won it. */
  private stamps: ({ text: string; cls: 'won' | 'lost' | 'rival'; until: number } | null)[] = [];
  /** Business the panel was last built for; the tab set swaps when it changes. */
  private shownBiz: string = 'scrapyard';
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
    this.partsEl.title = t('ui.hud.parts');
    this.soundBtn = el('button', 'icon-btn sound-btn') as HTMLButtonElement;
    this.soundBtn.setAttribute('aria-label', t('ui.hud.sound'));
    this.soundBtn.onclick = () => {
      const s = this.deps.state();
      s.settings.sound = !s.settings.sound;
      sfx.enabled = s.settings.sound;
      this.deps.onChange();
      this.render();
    };
    this.settingsBtn = el('button', 'icon-btn settings-btn', '☰') as HTMLButtonElement;
    this.settingsBtn.setAttribute('aria-label', t('settings.title'));
    this.settingsBtn.onclick = () => this.openSettings();
    this.mapBtn = el('button', 'icon-btn map-btn hidden', '🗺<span class="city-tag hidden" aria-hidden="true"></span><span class="dot"></span>') as HTMLButtonElement;
    this.mapBtn.setAttribute('aria-label', t('ui.hud.map'));
    this.mapBtn.onclick = () => this.openMap();
    this.bookBtn = el('button', 'icon-btn book-btn hidden', '📒<span class="dot"></span>') as HTMLButtonElement;
    this.bookBtn.setAttribute('aria-label', t('ui.hud.book'));
    this.bookBtn.title = t('ui.hud.book');
    this.bookBtn.onclick = () => this.openBook();
    this.legacyChip = el('button', 'legacy-chip hidden') as HTMLButtonElement;
    this.legacyChip.onclick = () => this.openLegacyInfo();
    const money = el('div', 'money');
    money.append(this.cash, this.rate);
    const chips = el('div', 'chips');
    chips.append(this.legacyChip, this.partsEl);
    hud.append(money, el('div', 'spacer'), chips, this.bookBtn, this.mapBtn, this.soundBtn, this.settingsBtn);

    this.hint = el('div', 'hint hidden');
    this.sell = el('button', 'sell display hidden') as HTMLButtonElement;
    this.sell.onclick = () => this.onSell();
    this.crush = el('button', 'crush display hidden') as HTMLButtonElement;
    this.crush.setAttribute('aria-label', t('ui.hud.crush'));
    this.crush.onclick = () => this.onCrush();
    this.tuneBtn = el('button', 'crush tune display hidden') as HTMLButtonElement;
    this.tuneBtn.setAttribute('aria-label', t('ui.hud.tune'));
    this.tuneBtn.onclick = () => this.onTuneLotCar();

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
    this.haggleEl.setAttribute('aria-label', t('ui.haggle.aria'));
    this.haggleLabel = el('div', 'haggle-label display', t('ui.haggle.close'));
    const track = el('div', 'haggle-track');
    track.append(el('span', 'zone-perfect'));
    this.haggleNeedle = el('i', 'haggle-needle');
    track.append(this.haggleNeedle);
    this.haggleEl.append(this.haggleLabel, track);

    this.panel = el('div', 'panel');
    const head = el('div', 'panel-head');
    const tabs = el('div', 'tabs');
    const tabNames: [Tab, string][] = [
      ['upgrades', t('ui.tab.upgrades')],
      ['crew', t('ui.tab.crew')],
      ['yard', t('ui.tab.yard')],
      ['jobs', t('ui.tab.jobs')],
      ['gupgrades', t('ui.tab.gupgrades')],
      ['gcrew', t('ui.tab.crew')],
      ['auction', t('ui.tab.auction')],
      ['lupgrades', t('ui.tab.lupgrades')],
      ['lcrew', t('ui.tab.crew')],
      ['pupgrades', t('ui.tab.pupgrades')],
      ['pcrew', t('ui.tab.crew')],
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
    this.perkStrip = el('div', 'perk-strip hidden');
    this.perkStrip.setAttribute('aria-label', t('aria.perks'));
    this.panel.append(head, this.perkStrip, this.cardsBox);

    this.root.append(hud, this.buyerEl, this.hint, this.sell, this.haggleEl, this.crush, this.tuneBtn, this.banner, this.panel);
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
      const { levels, cost } = bulkCost(kind, level, this.mode, s.cash, cityScale(s));
      const n = Math.max(levels, 1);
      const shownCost = levels === 0 ? bulkCost(kind, level, 1, 0, cityScale(s)).cost : cost;
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
      mechanic: t('ui.crew.mechanic'),
      washer: t('ui.crew.washer'),
      seller: t('ui.crew.seller'),
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
      setText(lvl, hired ? t('ui.crew.hired') : '');
      btn.classList.toggle('done', hired);
      const cost = managerCost(s, kind);
      setText(btn, hired ? t('ui.crew.working') : t('ui.crew.hire', { cost: formatCash(cost) }));
      btn.disabled = hired || s.cash < cost;
      root.classList.toggle('ready', !hired && s.cash >= cost);
    };
    return { root, lvl, desc, btn, update };
  }

  private slotCard(): CardView {
    const root = el('div', 'card slot');
    const title = el('div', 'title display');
    const lvl = el('span', 'lvl');
    title.append(document.createTextNode(t('ui.slot.title')), lvl);
    const desc = el('div', 'desc', t('ui.slot.desc'));
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
      const cost = slotCost(s.slots, cityScale(s));
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
        setText(btn, t('ui.locked'));
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

  // ---- Daily tasks and login calendar (P1.5b) -------------------------------

  private dailyPaid(r: DailyReward, title: string) {
    sfx.fanfare();
    const bits = [r.cash > 0 ? `+${formatCash(r.cash)}` : '', r.parts ? `+${r.parts} ⚙` : '', walletText(r.gems, r.tokens), r.gift ? t('banner.gift') : ''].filter(Boolean);
    this.showBanner(title, bits.join(' · '));
    this.deps.onChange();
    this.render();
  }

  private calendarCard(): CardView {
    const root = el('div', 'card daily calendar');
    const title = el('div', 'title display');
    const lvl = el('span', 'lvl');
    title.append(document.createTextNode(t('daily.cal.title')), lvl);
    const strip = el('div', 'cal-strip');
    strip.setAttribute('aria-hidden', 'true');
    const desc = el('div', 'desc');
    const btn = el('button', 'buy') as HTMLButtonElement;
    root.append(title, strip, desc, btn);
    let key = '';
    btn.onclick = () => {
      const r = claimCalendar(this.deps.state());
      if (r) this.dailyPaid(r, r.gift ? t('daily.cal.bannerGift') : t('daily.cal.banner'));
    };
    const update = (s: GameState) => {
      const cells = calendarCells(s);
      const k = cells.map((c) => c.state[0]).join('');
      if (k !== key) {
        key = k;
        strip.innerHTML = cells.map((c) => `<span class="cal-cell ${c.state}">${c.state === 'claimed' ? '✓' : c.gift ? '🎁' : c.day}</span>`).join('');
      }
      const open = canClaimCalendar(s);
      const idx = calendarIndex(s);
      const r = calendarReward(s);
      const what = r.gift ? t('daily.cal.giftWhat', { rarity: ECON.rarity[ECON.daily.giftRarity].label }) : `${formatCash(r.cash)}${r.parts ? ` + ${r.parts} ⚙` : ''}${r.gems ? ` + ${r.gems} 💎` : ''}${r.tokens ? ` + ${r.tokens} 🎟` : ''}`;
      root.classList.toggle('ready', open);
      setText(lvl, t('daily.cal.day', { n: idx + 1, total: ECON.daily.calendar.length }));
      setText(desc, open ? t('daily.cal.today', { what }) : t('daily.cal.tomorrow', { what }));
      setText(btn, open ? (r.gift ? t('daily.cal.claimGift') : t('daily.claim', { reward: formatCash(r.cash) })) : t('daily.cal.next', { wait: waitText(msToReset(this.deps.now())) }));
      btn.disabled = !open;
    };
    return { root, lvl, desc, btn, update };
  }

  private dailyTaskCard(index: number): CardView {
    const root = el('div', 'card daily task');
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
      const r = claimTask(s, index);
      if (!r) return;
      // The third claim also pays the all-done bonus.
      const b = claimBonus(s);
      this.dailyPaid(b ? { cash: r.cash + b.cash, parts: r.parts + b.parts, gift: false, gems: r.gems + b.gems, tokens: r.tokens + b.tokens } : r, b ? t('daily.task.bannerAll') : t('daily.task.banner'));
    };
    const update = (s: GameState) => {
      const task = s.daily.tasks[index];
      root.style.display = task ? '' : 'none';
      if (!task) return;
      const done = taskDone(task);
      root.classList.toggle('ready', done && !task.claimed);
      root.classList.toggle('claimed', task.claimed);
      setText(name, taskLabel(task.kind, task.target));
      setText(lvl, `${task.progress}/${task.target}`);
      bar.style.width = `${(task.progress / task.target) * 100}%`;
      const r = taskReward(s, task);
      const reward = `${formatCash(r.cash)}${r.parts ? ` + ${r.parts} ⚙` : ''} + ${r.tokens} 🎟`;
      const left = s.daily.tasks.filter((x) => !x.claimed).length;
      const bonus = !s.daily.bonusClaimed && left > 0 ? t('daily.task.bonus', { count: s.daily.tasks.length, cash: formatCash(bonusReward(s).cash) }) : '';
      setText(desc, task.claimed ? t('daily.task.claimedDesc', { reset: resetText(msToReset(this.deps.now())) }) : t('daily.task.reward', { reward, bonus }));
      setText(btn, task.claimed ? t('daily.task.claimed') : done ? t('daily.claim', { reward }) : t('daily.task.progress'));
      btn.disabled = task.claimed || !done;
    };
    return { root, lvl, desc, bar, btn, update };
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
        this.showBanner(t('ui.contract.paid'), `+${formatCash(reward.cash)}${reward.parts ? ` · +${reward.parts} ⚙` : ''}`);
        this.deps.onChange();
        this.render();
      }
    };
    const update = (s: GameState) => {
      const c = s.contracts[index];
      root.classList.toggle('ready', c?.status === 'done');
      btn.classList.toggle('swap', canRerollContract(c));
      if (!c || c.status === 'empty') {
        setText(name, t('ui.contract.new'));
        setText(lvl, '');
        setText(desc, c ? t('ui.contract.arrives', { time: formatDuration(Math.ceil(c.timeLeft)) }) : t('ui.contract.arriving'));
        bar.style.width = '0%';
        setText(btn, t('ui.contract.waiting'));
        btn.disabled = true;
        return;
      }
      setText(name, contractLabel(c));
      setText(lvl, `${c.progress}/${c.target}`);
      const reward = `${formatCash(c.rewardCash)}${c.rewardParts ? ` + ${c.rewardParts} ⚙` : ''}`;
      bar.style.width = `${(c.progress / c.target) * 100}%`;
      if (c.status === 'done') {
        setText(desc, t('ui.contract.complete'));
        setText(btn, t('ui.claim', { reward }));
        btn.disabled = false;
      } else {
        setText(desc, t('ui.contract.reward', { reward, time: formatDuration(Math.ceil(c.timeLeft)) }));
        const swap = canRerollContract(c);
        setText(btn, swap ? t('ui.contract.swap') : t('ui.inProgress'));
        btn.disabled = !swap;
      }
    };
    return { root, lvl, desc, bar, btn, update };
  }

  private barnCard(): CardView {
    const root = el('div', 'card barn');
    const title = el('div', 'title display');
    const lvl = el('span', 'lvl');
    title.append(document.createTextNode(t('ui.barn.card')), lvl);
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
        setText(desc, t('ui.barn.locked', { count: left }));
        bar.style.width = '0%';
        setText(btn, t('ui.locked'));
        btn.disabled = true;
        return;
      }
      setText(lvl, b.status === 'away' ? '' : `${Math.min(b.stage + (b.status === 'working' ? 1 : 0), stages)}/${stages}`);
      if (b.status === 'covered') {
        const st = nextBarnStage(s)!;
        const cost = barnStageCost(s);
        setText(desc, t('ui.barn.next', { intro: b.stage === 0 ? t('ui.barn.intro') : '', name: st.name, value: formatCash(barnValue(s)) }));
        bar.style.width = `${(b.stage / stages) * 100}%`;
        setText(btn, `${formatCash(cost.cash)}${cost.parts ? ` + ${cost.parts} ⚙` : ''}`);
        btn.disabled = s.cash < cost.cash || s.parts < cost.parts;
      } else if (b.status === 'working') {
        const st = ECON.barn.stages[b.stage]!;
        setText(desc, t('ui.barn.working', { name: st.name, time: formatDuration(Math.ceil(b.timeLeft)) }));
        bar.style.width = `${((b.stage + 1 - b.timeLeft / Math.max(1e-6, barnStageSeconds(s, b.stage))) / stages) * 100}%`;
        setText(btn, t('ui.working'));
        btn.disabled = true;
      } else if (b.status === 'finished') {
        setText(desc, t('ui.barn.finished'));
        bar.style.width = '100%';
        setText(btn, t('ui.barn.reveal'));
        btn.disabled = false;
      } else if (b.status === 'revealed') {
        setText(desc, t('ui.barn.revealed', { model: b.model, keep: canKeepBarnCar(s) ? t('ui.barn.keepHint') : '' }));
        bar.style.width = '100%';
        setText(btn, t('ui.sell', { value: formatCash(b.value) }));
        btn.disabled = false;
      } else {
        setText(desc, t('ui.barn.waiting', { time: formatDuration(Math.ceil(b.timeLeft)) }));
        bar.style.width = '0%';
        setText(btn, t('ui.barn.restored', { count: b.restored }));
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
    const btn = el('button', 'buy', t('ui.comingSoon')) as HTMLButtonElement;
    btn.disabled = true;
    root.append(title, desc, btn);
    return { root, lvl: title, desc, btn, update: () => {} };
  }

  // ---- Repair Garage cards -------------------------------------------------

  private simpleCard(cls: string, name: string, blurb: string, onBuy: (s: GameState) => boolean, okSound: () => void) {
    const root = el('div', `card ${cls}`);
    const title = el('div', 'title display');
    const lvl = el('span', 'lvl');
    title.append(document.createTextNode(name), lvl);
    const desc = el('div', 'desc', blurb);
    const btn = el('button', 'buy') as HTMLButtonElement;
    root.append(title, desc, btn);
    btn.onclick = () => {
      if (onBuy(this.deps.state())) {
        okSound();
        this.deps.onChange();
        this.render();
      } else sfx.denied();
    };
    return { root, lvl, desc, btn };
  }

  private garageUpgradeCard(kind: GarageUpgradeKind): CardView {
    const info = ECON.garage.upgrades[kind];
    const v = this.simpleCard(`garage-${kind}`, info.name, '', (s) => buyGarageUpgrade(s, kind), () => sfx.buy());
    const update = (s: GameState) => {
      const level = s.garage.levels[kind];
      setText(v.lvl, `Lv ${level}`);
      if (kind === 'tools') {
        const ms = nextMilestone(level);
        setText(v.desc, `${garageWorkPerTap(s).toFixed(2)} work per tap${ms ? ` · x2 at Lv ${ms}` : ''}`);
      } else setText(v.desc, `Fees x${repMultiplier(level).toFixed(2)} for new customers`);
      const cost = garageUpgradeCost(kind, level, cityScale(s));
      setText(v.btn, formatCash(cost));
      v.btn.disabled = s.cash < cost;
      v.root.classList.toggle('ready', s.cash >= cost);
    };
    return { ...v, update };
  }

  private garageBayCard(): CardView {
    const v = this.simpleCard('garage-bay', t('ui.bay.title'), t('ui.bay.desc'), (s) => buyGarageBay(s), () => sfx.buy());
    const update = (s: GameState) => {
      const cost = garageBayCost(s.garage.bays, cityScale(s));
      setText(v.lvl, `${s.garage.bays} / ${ECON.garage.bays.start + ECON.garage.bays.costs.length}`);
      v.btn.classList.toggle('done', cost === null);
      setText(v.btn, cost === null ? 'Full' : formatCash(cost));
      v.btn.disabled = cost === null || s.cash < cost;
      v.root.classList.toggle('ready', cost !== null && s.cash >= cost);
    };
    return { ...v, update };
  }

  private foremanCard(): CardView {
    const f = ECON.garage.foreman;
    const v = this.simpleCard('garage-foreman', f.name, t('ui.foreman.desc'), (s) => hireForeman(s), () => sfx.fanfare());
    const update = (s: GameState) => {
      const hired = s.garage.foreman;
      setText(v.lvl, hired ? t('ui.crew.hired') : '');
      setText(v.desc, hired ? t('ui.foreman.rate', { rate: foremanRate(s).toFixed(1) }) : t('ui.foreman.desc'));
      v.btn.classList.toggle('done', hired);
      const cost = foremanCost(s);
      setText(v.btn, hired ? t('ui.crew.working') : t('ui.crew.hire', { cost: formatCash(cost) }));
      v.btn.disabled = hired || s.cash < cost;
      v.root.classList.toggle('ready', !hired && s.cash >= cost);
    };
    return { ...v, update };
  }

  // ---- Used Car Lot cards --------------------------------------------------

  /** One lot on the auction board: everything about the car is shown before you bid. */
  private auctionCard(index: number): CardView {
    const root = el('div', 'card auction-lot');
    const title = el('div', 'title display');
    const name = document.createTextNode('');
    const lvl = el('span', 'lvl');
    title.append(name, lvl);
    const desc = el('div', 'desc');
    const bar = el('div', 'bar');
    const fill = el('i');
    bar.append(fill);
    const btn = el('button', 'buy') as HTMLButtonElement;
    const stamp = el('div', 'stamp display hidden');
    stamp.setAttribute('aria-live', 'polite');
    root.append(title, desc, bar, btn, stamp);
    let stampKey = '';
    btn.onclick = () => {
      const s = this.deps.state();
      const lot = s.carlot.board[index];
      if (!lot) return;
      const events = buyLot(s, lot.id);
      if (events.length) {
        // The gavel sound plays from the lotBought event (also when the Auction Agent bids).
        this.deps.onEvents(events);
        this.deps.onChange();
      } else sfx.denied();
      this.render();
    };
    const update = (s: GameState) => {
      const lot = s.carlot.board[index];
      const st = this.stamps[index];
      const key = st && st.until > performance.now() ? `${st.cls}|${st.until}` : '';
      if (key !== stampKey) {
        stampKey = key;
        stamp.classList.toggle('hidden', !key);
        stamp.classList.toggle('won', st?.cls === 'won');
        stamp.classList.toggle('lost', st?.cls === 'lost');
        stamp.classList.toggle('rival', st?.cls === 'rival');
        if (st && key) setText(stamp, st.text);
      }
      root.classList.toggle('empty', !lot);
      root.classList.toggle('closing', !!lot && lot.timeLeft <= ECON.carlot.auctionClosingSeconds);
      if (!lot) {
        name.textContent = t('ui.lot.next');
        setText(lvl, '');
        const left = Math.ceil(s.carlot.refill[index] ?? 0);
        setText(desc, left > 0 ? t('ui.lot.rollingIn', { s: left }) : t('ui.lot.rolling'));
        fill.style.width = '0%';
        setText(btn, '—');
        btn.disabled = true;
        root.classList.remove('ready');
        return;
      }
      name.textContent = lot.model;
      // Bid countdown: "Going, going…" in the last seconds.
      const secs = Math.max(0, Math.ceil(lot.timeLeft));
      setText(lvl, lot.timeLeft <= ECON.carlot.auctionClosingSeconds ? `🔨 Going… ${secs}s` : `⏱ ${secs}s`);
      const cond = ECON.carlot.conditions[lot.condition];
      const stars = conditionStars(lot.condition);
      const html =
        `<span class="stars" aria-label="${t('aria.condition', { n: lot.condition })}"><b>${stars.slice(0, lot.condition)}</b>${stars.slice(lot.condition)}</span> ` +
        `${cond.name} ${ECON.families[lot.family].name} · sells for ${formatCash(listPrice(s, lot))} · profit ${formatCash(lotProfit(s, lot))}`;
      if (desc.innerHTML !== html) desc.innerHTML = html;
      fill.style.width = `${Math.max(0, Math.min(1, lot.timeLeft / ECON.carlot.lotSeconds)) * 100}%`;
      const free = hasFreeSpot(s);
      setText(btn, free ? `Buy ${formatCash(lot.price)}` : 'Lot full');
      btn.disabled = !canBuyLot(s, lot.id);
      root.classList.toggle('ready', canBuyLot(s, lot.id));
    };
    return { root, lvl, desc, btn, update };
  }

  private carlotUpgradeCard(kind: CarLotUpgradeKind): CardView {
    const info = ECON.carlot.upgrades[kind];
    const v = this.simpleCard(`carlot-${kind}`, info.name, '', (s) => buyCarLotUpgrade(s, kind), () => sfx.buy());
    const update = (s: GameState) => {
      const level = s.carlot.levels[kind];
      setText(v.lvl, `Lv ${level}`);
      if (kind === 'valet') {
        const ms = nextMilestone(level);
        setText(v.desc, `${refurbPerTap(s).toFixed(2)} work per tap${ms ? ` · x2 at Lv ${ms}` : ''}`);
      } else setText(v.desc, `Sale prices x${showroomMultiplier(level).toFixed(2)}`);
      const cost = carlotUpgradeCost(kind, level, cityScale(s));
      setText(v.btn, formatCash(cost));
      v.btn.disabled = s.cash < cost;
      v.root.classList.toggle('ready', s.cash >= cost);
    };
    return { ...v, update };
  }

  private spotCard(): CardView {
    const v = this.simpleCard('carlot-spot', t('ui.spot.title'), t('ui.spot.desc'), (s) => buySpot(s), () => sfx.buy());
    const update = (s: GameState) => {
      const cost = spotCost(s.carlot.spots, cityScale(s));
      setText(v.lvl, `${s.carlot.spots} / ${ECON.carlot.spots.start + ECON.carlot.spots.costs.length}`);
      v.btn.classList.toggle('done', cost === null);
      setText(v.btn, cost === null ? 'Full' : formatCash(cost));
      v.btn.disabled = cost === null || s.cash < cost;
      v.root.classList.toggle('ready', cost !== null && s.cash >= cost);
    };
    return { ...v, update };
  }

  private lotCrewCard(kind: CarLotCrewKind): CardView {
    const info = ECON.carlot.crew[kind];
    const blurb = kind === 'detailer' ? t('ui.lot.detailer') : t('ui.lot.agent');
    const v = this.simpleCard(`carlot-${kind}`, info.name, blurb, (s) => hireLotCrew(s, kind), () => sfx.fanfare());
    const update = (s: GameState) => {
      const hired = s.carlot.crew[kind];
      setText(v.lvl, hired ? t('ui.crew.hired') : '');
      if (kind === 'detailer') setText(v.desc, hired ? `Polishing ${detailerRate(s).toFixed(1)} work/s, even offline` : blurb);
      else setText(v.desc, hired ? `Bids when you have ${ECON.carlot.agentReserve}x the price · with the Detailer the lot runs offline` : blurb);
      v.btn.classList.toggle('done', hired);
      const cost = lotCrewCost(s, kind);
      setText(v.btn, hired ? t('ui.crew.working') : t('ui.crew.hire', { cost: formatCash(cost) }));
      v.btn.disabled = hired || s.cash < cost;
      v.root.classList.toggle('ready', !hired && s.cash >= cost);
    };
    return { ...v, update };
  }

  // ---- Paint & Tuning cards -------------------------------------------------

  private paintUpgradeCard(kind: PaintUpgradeKind): CardView {
    const info = ECON.paint.upgrades[kind];
    const v = this.simpleCard(`paint-${kind}`, info.name, '', (s) => buyPaintUpgrade(s, kind), () => sfx.buy());
    const update = (s: GameState) => {
      const level = s.paint.levels[kind];
      setText(v.lvl, `Lv ${level}`);
      if (kind === 'booth') {
        const ms = nextMilestone(level);
        setText(v.desc, `${paintWorkPerTap(s).toFixed(2)} work per tap${ms ? ` · x2 at Lv ${ms}` : ''}`);
      } else setText(v.desc, `Fees x${hypeMultiplier(level).toFixed(2)} for new customers`);
      const cost = paintUpgradeCost(kind, level, cityScale(s));
      setText(v.btn, formatCash(cost));
      v.btn.disabled = s.cash < cost;
      v.root.classList.toggle('ready', s.cash >= cost);
    };
    return { ...v, update };
  }

  private boothCard(): CardView {
    const v = this.simpleCard('paint-booths', t('ui.booth.title'), t('ui.bay.desc'), (s) => buyBooth(s), () => sfx.buy());
    const update = (s: GameState) => {
      const cost = boothCost(s.paint.booths, cityScale(s));
      setText(v.lvl, `${s.paint.booths} / ${ECON.paint.booths.start + ECON.paint.booths.costs.length}`);
      v.btn.classList.toggle('done', cost === null);
      setText(v.btn, cost === null ? 'Full' : formatCash(cost));
      v.btn.disabled = cost === null || s.cash < cost;
      v.root.classList.toggle('ready', cost !== null && s.cash >= cost);
    };
    return { ...v, update };
  }

  private painterCard(): CardView {
    const f = ECON.paint.painter;
    const blurb = 'Works through the orders for you, even offline (no quick tips)';
    const v = this.simpleCard('paint-painter', f.name, blurb, (s) => hirePainter(s), () => sfx.fanfare());
    const update = (s: GameState) => {
      const hired = s.paint.painter;
      setText(v.lvl, hired ? t('ui.crew.hired') : '');
      setText(v.desc, hired ? `Working ${painterRate(s).toFixed(1)} work/s, even offline` : blurb);
      v.btn.classList.toggle('done', hired);
      const cost = painterCost(s);
      setText(v.btn, hired ? t('ui.crew.working') : t('ui.crew.hire', { cost: formatCash(cost) }));
      v.btn.disabled = hired || s.cash < cost;
      v.root.classList.toggle('ready', !hired && s.cash >= cost);
    };
    return { ...v, update };
  }

  /** Swap the panel's tab set when the business on screen changed. */
  private syncBusinessTabs(s: GameState) {
    if (s.businesses.active === this.shownBiz) return;
    this.shownBiz = s.businesses.active;
    this.root.classList.toggle('in-garage', this.shownBiz === 'garage');
    this.root.classList.toggle('in-carlot', this.shownBiz === 'carlot');
    this.root.classList.toggle('in-paint', this.shownBiz === 'paint');
    this.tab = BUSINESS_TABS[s.businesses.active][0] ?? 'upgrades';
    this.buildCards();
  }

  /** Rebuild the Jobs tab's cards (a new day or the daily unlock changes them). */
  rebuildCards() {
    if (this.tab === 'jobs') this.buildCards();
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
    else if (this.tab === 'gupgrades') this.cards = [this.garageUpgradeCard('tools'), this.garageUpgradeCard('rep'), this.garageBayCard()];
    else if (this.tab === 'gcrew') this.cards = [this.foremanCard()];
    else if (this.tab === 'auction') this.cards = Array.from({ length: ECON.carlot.auctionLots }, (_, i) => this.auctionCard(i));
    else if (this.tab === 'lupgrades') this.cards = [this.carlotUpgradeCard('valet'), this.carlotUpgradeCard('showroom'), this.spotCard()];
    else if (this.tab === 'lcrew') this.cards = [this.lotCrewCard('detailer'), this.lotCrewCard('agent')];
    else if (this.tab === 'pupgrades') this.cards = [this.paintUpgradeCard('booth'), this.paintUpgradeCard('hype'), this.boothCard()];
    else if (this.tab === 'pcrew') this.cards = [this.painterCard()];
    else {
      this.cards = Array.from({ length: ECON.contracts.board }, (_, i) => this.contractCard(i));
      // Daily tasks and the calendar follow the timed orders (P1.5b).
      if (dailyUnlocked(this.deps.state())) this.cards.push(this.calendarCard(), ...Array.from({ length: ECON.daily.tasksPerDay }, (_, i) => this.dailyTaskCard(i)));
    }
    for (const c of this.cards) this.cardsBox.append(c.root);
    this.renderPerkStrip();
    for (const b of this.modeButtons.values()) b.style.display = this.tab === 'upgrades' ? '' : 'none';
  }

  /** The chip row of owned Legacy perks that apply to the open tab (hidden when none). */
  private renderPerkStrip() {
    const chips = tabPerks(this.deps.state(), this.tab);
    this.perkStrip.replaceChildren(...chips.map((c) => perkChipEl(c)));
    this.perkStrip.classList.toggle('hidden', chips.length === 0);
  }

  // ---- actions -------------------------------------------------------------

  private onSell() {
    const s = this.deps.state();
    if (s.businesses.active === 'carlot') return this.onSellLotCar(s);
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

  /** Used Car Lot: every manual sale is haggled (the walk-up buyers pay the list price). */
  private onSellLotCar(s: GameState) {
    const car = findLotCar(s, s.carlot.focusedId);
    if (!car || !lotCarReady(car) || this.haggling !== null) return;
    if (s.settings.skipHaggle) return this.finishLotSale(car.id, 1);
    holdLotCar(s, car.id);
    this.haggleSlider(car.id, false, (mult) => this.finishLotSale(car.id, mult));
  }

  /** Send the focused lot car to a free Paint & Tuning booth; it comes back with a higher sticker price. */
  private onTuneLotCar() {
    const s = this.deps.state();
    const id = s.carlot.focusedId;
    if (this.haggling !== null || id === null) return;
    const svc = lotCarService(findLotCar(s, id) ?? { family: 'sedan' });
    const events = sendLotCarToShop(s, id);
    if (!events.length) return;
    sfx.engine();
    this.toast(t('toast.tune', { shop: businessName(s, 'paint'), service: ECON.paint.services[svc].name.toLowerCase() }), 2500);
    this.deps.onEvents(events);
    this.deps.onChange();
    this.render();
  }

  private finishLotSale(carId: number, haggle: number) {
    const s = this.deps.state();
    const events = sellLotCar(s, carId, haggle);
    holdLotCar(s, null);
    if (events.length) {
      this.deps.onEvents(events);
      this.deps.onChange();
    }
    this.render();
  }

  /**
   * The Tune button beside Sell on the lot (P1.2f): shown for a refurbished car that hasn't been to the paint shop,
   * once Paint & Tuning is open. Greyed out while every booth is busy.
   */
  private renderTune(s: GameState, car: LotCar | undefined) {
    const block = car ? lotSendBlock(s, car.id) : 'missing';
    const show = !!car && this.haggling === null && !this.modalOpen && (block === null || block === 'boothsFull');
    this.tuneBtn.classList.toggle('hidden', !show);
    this.sell.classList.toggle('beside-tune', show);
    if (!show || !car) return;
    this.tuneBtn.disabled = block !== null;
    const svc = ECON.paint.services[lotCarService(car)];
    const sub = block === 'boothsFull' ? 'Booths busy' : `+${formatCash(lotTuneValue(s, car))}`;
    // Short names fit beside Sell: "Custom rims" -> "Rims", "Engine tune" -> "Tune".
    const word = svc.name.split(' ').pop() ?? svc.name;
    const html = `${svc.icon} ${word[0]!.toUpperCase()}${word.slice(1)}<small>${sub}</small>`;
    if (this.tuneBtn.innerHTML !== html) this.tuneBtn.innerHTML = html;
    if (!s.tutorial.lotTuneSeen) {
      s.tutorial.lotTuneSeen = true;
      this.toast(t('ui.toast.lotTune'), 4000);
      this.deps.onChange();
    }
  }

  /** Timing slider: a needle sweeps the bar; tapping stops it. The centre pays most. */
  private startHaggle(s: GameState, car: Car) {
    const lesson = isHaggleLesson(s);
    holdForHaggle(s, car.id);
    this.haggleSlider(car.id, lesson, (mult) => this.finishSale(car.id, mult));
  }

  private haggleSlider(carId: number, lesson: boolean, onDone: (mult: number) => void) {
    const speed = lesson ? ECON.haggle.lessonSweepsPerSec : ECON.haggle.sweepsPerSec;
    this.haggling = carId;
    sfx.tap();
    const hg = this.haggleEl;
    // Silver Tongue (legacy tree) widens the PERFECT zone: draw what the rules pay.
    const zone = perfectZone(this.deps.state());
    const zoneEl = hg.querySelector<HTMLElement>('.zone-perfect');
    if (zoneEl) {
      zoneEl.style.width = `${zone * 100}%`;
      zoneEl.style.left = `${50 - zone * 50}%`;
    }
    hg.classList.remove('hidden', 'stopped', 'perfect', 'great', 'good', 'poor');
    hg.classList.toggle('lesson', lesson);
    setText(this.haggleLabel, lesson ? t('ui.haggle.lesson') : t('ui.haggle.close'));
    const tongue = perkChip(this.deps.state(), 'silverTongue');
    if (tongue) this.haggleLabel.append(perkChipEl(tongue));
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
      const mult = pos === null ? 1 : haggleMultiplier(pos, lesson, zone);
      const grade = haggleGrade(mult);
      hg.classList.add('stopped', grade);
      const words = { perfect: t('ui.haggle.perfect'), great: t('ui.haggle.great'), good: t('ui.haggle.good'), poor: t('ui.haggle.poor') } as const;
      setText(this.haggleLabel, pos === null ? t('ui.haggle.asking') : `${words[grade]} x${mult.toFixed(2)}`);
      if (grade === 'perfect') sfx.fanfare();
      else if (grade === 'poor') sfx.denied();
      else sfx.buy();
      setTimeout(() => {
        hg.classList.add('hidden');
        this.haggling = null;
        onDone(mult);
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
      const keep = canKeepBarnCar(s);
      const bonus = pctText(ECON.collection.showcaseBonus);
      const note = keep
        ? `<p class="keep-note">Or keep it in your showcase: no cash, but <b>+${bonus} all income</b> for good, even after you sell your empire.</p>`
        : inShowcase(s, s.barn.model)
          ? `<p class="keep-note">You already have one in your showcase.</p>`
          : '';
      this.modal({
        title: t('ui.barn.title'),
        body: `<p>${t('ui.barn.body', { model: `<b>${s.barn.model}</b>` })}</p>${note}`,
        big: formatCash(s.barn.value),
        button: t('ui.barn.sell'),
        ...(keep
          ? {
              third: t('ui.barn.keep', { bonus }),
              onThird: () => {
                close();
                const book: CollectionEvent[] = [];
                if (!keepBarnCar(s, book)) return;
                this.deps.onEvents([{ type: 'barnKept', model: s.collection.showcase[s.collection.showcase.length - 1]!, count: s.collection.showcase.length }, ...book]);
                this.deps.onChange();
                this.showBanner(t('banner.showcase'), showcaseLine(s));
                sfx.fanfare();
              },
            }
          : {}),
        secondary: 'Later',
        cls: 'reveal',
        onClose: () => {
          close();
          const book: CollectionEvent[] = [];
          const paid = sellBarnCar(s, book);
          if (paid > 0) {
            this.deps.onEvents([{ type: 'barnSold', amount: paid }, ...book]);
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
        title: t('ui.crush.title'),
        body: `<p>${t('ui.crush.body', { rarity: ECON.rarity[car.rarity].label, model: car.model, value: formatCash(car.value) })}</p>`,
        button: t('ui.crush.keep'),
        secondary: t('ui.crush.go', { parts: crushParts(car.rarity, s.levels.press) }),
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

    this.syncBusinessTabs(s);
    const inGarage = s.businesses.active !== 'scrapyard';
    // In another business the yard's car controls stay hidden (the yard keeps running behind it).
    const car = inGarage ? undefined : findCar(s, s.focusedId);
    const ready = car && carStage(car) === 'ready';
    const lotCar = s.businesses.active === 'carlot' ? findLotCar(s, s.carlot.focusedId) : undefined;
    const lotReady = !!lotCar && lotCarReady(lotCar);
    this.sell.classList.toggle('hidden', !(ready || lotReady) || this.haggling !== null);
    if (lotReady && lotCar) {
      const html = `Sell ${formatCash(listPrice(s, lotCar))}<small>${s.settings.skipHaggle ? lotCar.model : 'Haggle for up to +30%'}</small>`;
      if (this.sell.innerHTML !== html) this.sell.innerHTML = html;
      this.sell.classList.remove('match');
    }
    this.renderTune(s, lotReady ? lotCar : undefined);
    if (ready && car) {
      const bm = buyerMultiplier(s, car);
      const who = bm > 1 && s.buyer ? ECON.buyers.kinds[s.buyer.kind] : null;
      const sub = who ? `${who.icon} ${who.name} pays +${Math.round(who.bonus * 100)}%` : car.model;
      const html = `Sell ${formatCash(Math.round(car.value * bm))}<small>${sub}</small>`;
      if (this.sell.innerHTML !== html) this.sell.innerHTML = html;
      this.sell.classList.toggle('match', !!who);
    }
    if (inGarage) this.buyerEl.classList.add('hidden');
    else this.renderBuyer(s, car);

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
      this.showBanner(t('banner.crusher'), t('banner.crusher.sub'));
      sfx.fanfare();
      this.deps.onChange();
    }
    const jobsOn = contractsUnlocked(s);
    const shownTabs = BUSINESS_TABS[s.businesses.active];
    for (const [t, b] of this.tabButtons) b.style.display = shownTabs.includes(t) && (t !== 'jobs' || jobsOn) ? '' : 'none';
    if (jobsOn && !s.tutorial.contractsSeen && !this.modalOpen && s.tutorial.crusherSeen) {
      s.tutorial.contractsSeen = true;
      setTimeout(() => this.showBanner(t('banner.contracts'), t('banner.contracts.sub')), 2700);
      this.deps.onChange();
    }

    if (jobsOn && dailyUnlocked(s) && !s.tutorial.dailySeen && !this.modalOpen && s.tutorial.contractsSeen) {
      s.tutorial.dailySeen = true;
      setTimeout(() => this.showBanner(t('banner.daily'), t('banner.daily.sub')), 2700);
      if (this.tab === 'jobs') this.buildCards();
      this.deps.onChange();
    }

    if (barnUnlocked(s) && !s.tutorial.barnSeen && !this.modalOpen && s.tutorial.crusherSeen) {
      s.tutorial.barnSeen = true;
      setTimeout(() => this.showBanner(t('banner.barn'), t('banner.barn.sub')), 2700);
      this.deps.onChange();
    }

    const mapOn = mapUnlocked(s);
    this.mapBtn.classList.toggle('hidden', !mapOn);
    // The map button names the city (P1.3d2); outside Rust Valley a small city icon sits on its corner.
    const city = cityInfo(currentCity(s));
    if (this.mapBtn.dataset.city !== currentCity(s)) {
      this.mapBtn.dataset.city = currentCity(s);
      this.mapBtn.setAttribute('aria-label', t('aria.mapBtn', { city: city.name }));
      this.mapBtn.title = `${city.name} map`;
      const tag = this.mapBtn.querySelector('.city-tag')!;
      tag.textContent = city.icon;
      tag.classList.toggle('hidden', currentCity(s) === 'rustValley');
    }
    this.mapBtn.querySelector('.dot')!.classList.toggle('on', mapOn && (!s.tutorial.mapSeen || this.mapHasAction(s) || (canSellEmpire(s) && !s.tutorial.legacyOffered)));
    const bookOn = bookUnlocked(s);
    this.bookBtn.classList.toggle('hidden', !bookOn);
    this.bookBtn.querySelector('.dot')!.classList.toggle('on', bookOn && (unseenEntries(s).length > 0 || awardsToClaim(s).length > 0));
    if (bookOn && this.bookWasOn === false) this.toast(t('ui.toast.book'), 4000);
    if (bookOn) this.checkMedals(s);
    this.checkDailyDone(s);
    this.bookWasOn = bookOn;
    const badge = legacyBadge(s);
    this.legacyChip.classList.toggle('hidden', badge === null);
    const chipHtml = badge === null ? '' : `${badge}${treeHasBuy(s) ? '<i class="dot on"></i>' : ''}`;
    if (badge !== null && this.legacyChip.innerHTML !== chipHtml) {
      this.legacyChip.innerHTML = chipHtml;
      this.legacyChip.setAttribute('aria-label', `Legacy: income ${badge.split(' ')[1]}`);
    }
    // Story scenes (P1.6) come before the sale banner, so chapter 1's ending leads into it.
    if (!this.modalOpen && this.haggling === null) {
      const beat = dueBeat(s);
      if (beat) this.openStory(beat);
    }
    if (mapOn && canSellEmpire(s) && !s.tutorial.legacyOffered && !this.legacyAnnounced && !this.modalOpen) {
      this.legacyAnnounced = true;
      this.showBanner(t('banner.empire'), t('banner.empire.sub'));
      sfx.fanfare();
    }
    if (mapOn && !s.tutorial.mapSeen && !this.mapAnnounced && !this.modalOpen && s.tutorial.crusherSeen) {
      this.mapAnnounced = true;
      setTimeout(() => this.showBanner(t('banner.map'), t('banner.map.sub')), 2700);
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

  private mapHasAction(s: GameState): boolean {
    return mapRows(s).some((r) => r.status === 'forSale' && canOpenBusiness(s, r.id));
  }

  /** City map: the scrapyard, the next businesses and how far away they are. */
  openMap() {
    if (this.modalOpen) return;
    const s = this.deps.state();
    this.modalOpen = true;
    sfx.tap();
    if (!s.tutorial.mapSeen) {
      s.tutorial.mapSeen = true;
      this.deps.onChange();
    }
    const back = el('div', 'modal-back');
    const box = el('div', 'modal city-map');
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', t('aria.cityMap'));
    box.append(el('h2', 'display', cityInfo(currentCity(s)).name));
    const art = el('div', 'map-art');
    const list = el('div', 'map-list');
    let timer = 0;
    const close = () => {
      if (!back.isConnected) return;
      window.clearInterval(timer);
      back.remove();
      this.modalOpen = false;
      this.render();
    };
    let lastKey = '';
    const paint = () => {
      const st = this.deps.state();
      // List the open businesses and the next goal; the later ones show on the map with their padlocks.
      const next = nextBusiness(st);
      const rows = mapRows(st).filter((r) => r.status === 'open' || r.id === next);
      // Rebuild only when something visible changed (progress is shown to the whole percent).
      const sellRow = sellEmpireRow(st);
      const teaser = nextSaleLine(st);
      const key = JSON.stringify([rows.map((r) => [r.status, r.active, Math.floor(r.progress * 100), r.action, canOpenBusiness(st, r.id), r.tier]), sellRow, teaser]);
      if (key === lastKey) return;
      lastKey = key;
      art.innerHTML = cityMapSvg(st);
      list.replaceChildren(
        ...rows.map((r) => {
          const row = el('div', `map-row ${r.status}${r.active ? ' active' : ''}`);
          row.dataset.biz = r.id;
          const icon = el('div', 'map-icon', r.icon);
          const text = el('div', 'map-text');
          const name = el('div', 'map-name display');
          name.textContent = r.name;
          if (r.tier > 0) {
            // Map tier (P1.1d): the business grows on the map with lot slots / repair bays.
            const stars = el('span', 'map-stars');
            stars.textContent = '★'.repeat(r.tier) + '☆'.repeat(Math.max(0, MAX_TIER - r.tier));
            stars.setAttribute('aria-label', t('aria.tier', { n: r.tier, max: MAX_TIER }));
            name.append(' ', stars);
          }
          const line = el('div', 'map-line');
          line.textContent = r.line;
          text.append(name, line);
          if (r.nextTier) text.append(el('div', 'map-next', `Next ★ with ${r.nextTier}`));
          if (r.status === 'locked') {
            const bar = el('div', 'bar');
            const fill = el('i');
            fill.style.width = `${Math.round(r.progress * 100)}%`;
            bar.append(fill);
            text.append(bar);
          }
          row.append(icon, text);
          if (r.action) {
            const b = el('button', 'buy small') as HTMLButtonElement;
            b.textContent = r.action;
            b.disabled = r.status === 'forSale' && !canOpenBusiness(st, r.id);
            b.onclick = () => {
              const cur = this.deps.state();
              if (r.status === 'forSale') {
                if (!openBusiness(cur, r.id)) return sfx.denied();
                sfx.fanfare();
                this.toast(t('toast.open', { icon: r.icon, name: r.name }));
              } else if (switchBusiness(cur, r.id)) {
                sfx.tap();
                close();
                this.driveTo(`${r.icon} ${r.name}`, () => this.deps.onSwitchBusiness());
              }
              this.deps.onChange();
              paint();
            };
            row.append(b);
          }
          return row;
        }),
      );
      // Story (P1.6b): Vince's HQ in Motor City.
      const rival = rivalRow(st);
      if (rival) {
        const row = el('div', 'map-row rival');
        const text = el('div', 'map-text');
        const name = el('div', 'map-name display');
        name.textContent = rival.name;
        const line = el('div', 'map-line');
        line.textContent = rival.line;
        text.append(name, line);
        row.append(el('div', 'map-icon', '😎'), text);
        list.append(row);
      }
      // Prestige (P1.3b): the Sell Empire row once a sale is worth it, else how far the next one is.
      if (sellRow) {
        const row = el('div', `map-row legacy${sellRow.glow ? ' glow' : ''}`);
        const text = el('div', 'map-text');
        const name = el('div', 'map-name display');
        name.textContent = t('ui.sell.row');
        const line = el('div', 'map-line');
        line.textContent = sellRow.line;
        text.append(name, line);
        const b = el('button', 'buy small sell-empire') as HTMLButtonElement;
        b.textContent = sellRow.action;
        b.onclick = () => {
          close();
          this.openSellEmpire();
        };
        row.append(el('div', 'map-icon', LEGACY_ICON), text, b);
        list.append(row);
      } else if (teaser) {
        const row = el('div', 'map-row legacy-next');
        const text = el('div', 'map-text');
        const line = el('div', 'map-line');
        line.textContent = teaser;
        text.append(line);
        row.append(el('div', 'map-icon', LEGACY_ICON), text);
        list.append(row);
      }
    };
    paint();
    // Live progress while the yard keeps earning behind the map.
    timer = window.setInterval(() => {
      if (!back.isConnected) return window.clearInterval(timer);
      paint();
    }, 500);
    const backTo: Record<BusinessId, string> = { scrapyard: 'Back to the yard', garage: 'Back to the garage', carlot: 'Back to the lot', paint: 'Back to the paint shop' };
    const done = el('button', 'buy', backTo[s.businesses.active]) as HTMLButtonElement;
    done.onclick = () => {
      sfx.tap();
      close();
    };
    box.append(art, list, done);
    back.onclick = (e) => {
      if (e.target === back) close();
    };
    back.append(box);
    this.root.append(back);
    done.focus({ preventScroll: true });
  }

  private tabHasAction(s: GameState, t: Tab): boolean {
    if (t === 'crew')
      return (Object.keys(ECON.managers) as ManagerKind[]).some(
        (k) => !s.managers[k] && s.cash >= managerCost(s, k) && (k !== 'scrapper' || crusherUnlocked(s)),
      );
    if (t === 'yard') {
      const c = slotCost(s.slots, cityScale(s));
      return (c !== null && s.cash >= c) || this.barnHasAction(s);
    }
    if (t === 'jobs') return s.contracts.some((c) => c.status === 'done') || dailyHasClaim(s);
    if (t === 'gcrew') return s.businesses.opened.garage && !s.garage.foreman && s.cash >= foremanCost(s);
    if (t === 'auction') return s.businesses.opened.carlot && s.carlot.cars.length === 0 && s.carlot.board.some((b) => !!b && canBuyLot(s, b.id));
    if (t === 'pcrew') return s.businesses.opened.paint && !s.paint.painter && s.cash >= painterCost(s);
    if (t === 'lcrew') return s.businesses.opened.carlot && (['detailer', 'agent'] as const).some((k) => !s.carlot.crew[k] && s.cash >= lotCrewCost(s, k));
    return false;
  }

  private barnHasAction(s: GameState): boolean {
    return barnHasAction(s);
  }

  private renderHint(s: GameState) {
    let text = '';
    const car = findCar(s, s.focusedId);
    const learning = s.carsSold < 3;
    const job = findJob(s, s.garage.focusedId);
    if (this.modalOpen || this.haggling !== null) text = '';
    else if (s.businesses.active === 'carlot') {
      const l = s.carlot;
      const lc = findLotCar(s, l.focusedId);
      if (l.sold < 3) {
        if (l.cars.length === 0) text = '👇 Buy a car at the auction';
        else if (lc && !lotCarReady(lc)) text = '👆 Tap the car to refurbish it!';
      }
    } else if (s.businesses.active === 'paint') {
      const pj = findPaintJob(s, s.paint.focusedId);
      const svc = pj ? currentService(pj) : null;
      if (!pj && s.paint.jobsDone === 0) text = 'A customer is on the way...';
      else if (pj && svc && s.paint.jobsDone < 3) text = `👆 Tap the car: ${ECON.paint.services[svc].name.toLowerCase()}!`;
    } else if (s.businesses.active === 'garage') {
      if (!job && s.garage.jobsDone === 0) text = 'A customer is on the way...';
      else if (job && s.garage.jobsDone < 3) text = `👆 Tap the car to fix the ${ECON.garage.faults[job.fault].name.toLowerCase()}!`;
    } else if (!car && s.carsSold === 0) text = 'A wreck is on its way...';
    else if (car && learning) {
      const stage = carStage(car);
      text = stage === 'dirty' ? '👆 Swipe to wash it!' : stage === 'damaged' ? '👆 Tap to fix it!' : '';
    } else if (s.tutorial.firstSale && !s.tutorial.firstUpgrade && s.cash >= upgradeCost('wash', 1, cityScale(s))) {
      text = '👇 Buy your first upgrade';
    } else if (!s.managers.mechanic && s.cash >= managerCost(s, 'mechanic')) {
      text = '👇 Hire a Mechanic in Crew';
    }
    setText(this.hint, text);
    this.hint.classList.toggle('hidden', text === '');
    this.hint.classList.toggle('beside-crush', !this.crush.classList.contains('hidden'));
    // Sits where the sell button appears; the two never show at the same time.
    const { bottom } = this.insets();
    const h = this.root.getBoundingClientRect().height;
    this.hint.style.setProperty('--hint-top', `${h - bottom + HINT_BELOW_AREA}px`);
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

  /**
   * The drive between businesses (P1.1d): a road wipe with the destination's sign crosses the screen; the scene swaps
   * while it covers the game. Reduce motion swaps at once.
   */
  driveTo(label: string, swap: () => void) {
    const calm = this.deps.state().settings.reduceMotion || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
    if (calm) {
      swap();
      return;
    }
    this.root.querySelector('.drive-wipe')?.remove();
    const wipe = el('div', 'drive-wipe');
    const sign = el('div', 'drive-sign display');
    sign.textContent = label;
    wipe.append(el('div', 'drive-road'), sign);
    this.root.append(wipe);
    sfx.engine();
    requestAnimationFrame(() => wipe.classList.add('in'));
    setTimeout(() => {
      swap();
      wipe.classList.add('out');
      setTimeout(() => wipe.remove(), 420);
    }, 460);
  }

  toast(message: string, ms = 4000) {
    // Toasts stack in one column under the top bar, so two at once never print over each other (found in run 31).
    let stack = this.root.querySelector<HTMLElement>(':scope > .toasts');
    if (!stack) {
      stack = el('div', 'toasts');
      stack.setAttribute('aria-live', 'polite');
    }
    // Above the game and the HUD, but under an open modal: a toast never covers a modal's title (found in run 31).
    const firstModal = this.root.querySelector(':scope > .modal-back');
    if (firstModal) this.root.insertBefore(stack, firstModal);
    else this.root.append(stack);
    const t = el('div', 'toast', '');
    t.textContent = message;
    stack.append(t);
    while (stack.childElementCount > 3) stack.firstElementChild?.remove();
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
    /** An optional middle choice between the main and the secondary button (e.g. keep a classic instead of selling). */
    third?: string;
    onThird?: () => void;
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
    const close = (which: 'main' | 'secondary' | 'third' = 'main') => {
      if (!back.isConnected) return;
      back.remove();
      this.modalOpen = false;
      sfx.unlock();
      sfx.tap();
      if (which === 'secondary' && opts.onSecondary) opts.onSecondary();
      else if (which === 'third' && opts.onThird) opts.onThird();
      else opts.onClose?.();
      this.render();
    };
    const btn = el('button', 'buy', opts.button) as HTMLButtonElement;
    btn.onclick = () => close();
    box.append(btn);
    if (opts.third) {
      const third = el('button', 'third', opts.third) as HTMLButtonElement;
      third.onclick = () => close('third');
      box.append(third);
    }
    if (opts.secondary) {
      const sec = el('button', 'secondary', opts.secondary) as HTMLButtonElement;
      sec.onclick = () => close('secondary');
      box.append(sec);
    }
    back.append(box);
    this.root.append(back);
    btn.focus({ preventScroll: true });
  }

  /** A story scene (P1.6): portraits with speech bubbles, Joe on the left, Vince on the right. Shown once. */
  openStory(id: StoryBeatId) {
    if (this.modalOpen) return;
    const s = this.deps.state();
    markBeatSeen(s, id);
    this.deps.onChange();
    const scene = storyScene(id);
    const lines = storyLinesHtml(id);
    const footer = scene.footer ? `<p class="story-footer">${scene.footer}</p>` : '';
    sfx.fanfare();
    this.modal({
      title: scene.title,
      body: `<div class="story-lines" data-beat="${id}">${lines}</div>${footer}`,
      button: scene.button,
      cls: 'story',
      onClose: () => {
        if ((id === 'chapter1End' || id === 'chapter2End') && mapUnlocked(s)) setTimeout(() => this.openMap(), 0);
      },
    });
  }

  /** Sell Empire preview (P1.3b): what the sale gives, what is kept and what resets. Confirming sells at once. */
  openSellEmpire() {
    if (this.modalOpen) return;
    const s = this.deps.state();
    if (!canSellEmpire(s)) return;
    if (!s.tutorial.legacyOffered) {
      s.tutorial.legacyOffered = true;
      this.deps.onChange();
    }
    const p = sellEmpirePreview(s);
    const li = (xs: string[]) => xs.map((x) => `<li>${x}</li>`).join('');
    let city: CityId = p.cities.find((c) => c.picked)?.id ?? currentCity(s);
    const picker = p.cities.length
      ? `<div class="city-pick" role="radiogroup" aria-label="${t('aria.nextCity')}">` +
        p.cities
          .map(
            (c) =>
              `<button type="button" role="radio" class="city-opt${c.picked ? ' on' : ''}" data-city="${c.id}" aria-checked="${c.picked}">` +
              `<span class="city-ic" aria-hidden="true">${c.icon}</span><b>${c.name}</b><small>${c.current ? 'Stay · ' : ''}${c.line}</small></button>`,
          )
          .join('') +
        `</div>`
      : '';
    this.modal({
      title: t('ui.sell.title'),
      cls: `sell-empire-preview${picker ? ' has-cities' : ''}`,
      body:
        `<p>${t('ui.sell.intro')}</p>` +
        `<div class="legacy-gain"><span class="display">+${p.points} ${LEGACY_ICON}</span><small>${t('ui.sell.points')}</small></div>` +
        `<p class="legacy-mult">All income <b>${p.multNow}</b> → <b class="next">${p.multNext}</b> forever</p>` +
        (picker ? `<p class="city-q"><b>Where next?</b></p>${picker}` : '') +
        `<div class="legacy-cols"><div class="keep"><b>You keep</b><ul>${li(p.keeps)}</ul></div><div class="lose"><b>Starts over</b><ul>${li(p.resets)}</ul></div></div>` +
        `<p class="legacy-run">This empire: ${p.earned} earned in ${p.runTime}</p>` +
        (p.cityTeaser ? `<p class="city-teaser">${p.cityTeaser}</p>` : ''),
      button: t('ui.sell.confirm', { points: p.points, icon: LEGACY_ICON }),
      secondary: t('ui.sell.notYet'),
      onSecondary: () => {},
      onClose: () => this.confirmSellEmpire(city),
    });
    const opts = Array.from(document.querySelectorAll<HTMLButtonElement>('.sell-empire-preview .city-opt'));
    for (const b of opts) {
      b.onclick = () => {
        city = b.dataset.city as CityId;
        sfx.tap();
        for (const o of opts) {
          const on = o === b;
          o.classList.toggle('on', on);
          o.setAttribute('aria-checked', String(on));
        }
      };
    }
  }

  private confirmSellEmpire(city: CityId) {
    const before = this.deps.state().legacy.sold;
    const from = this.deps.state().legacy.city;
    const sold = this.deps.sellEmpire(city);
    if (!sold) {
      sfx.denied();
      return;
    }
    sfx.fanfare();
    haptics.play('celebrate');
    const s = this.deps.state();
    // Scattered, not in a line: positions and delays step by coprime strides through the pieces.
    const confetti = Array.from({ length: 18 }, (_, i) => `<i style="--i:${i};--x:${3 + ((i * 7) % 18) * 5.3}%;--d:${1.5 + ((i * 5) % 7) * 0.12}s;--w:${-((i * 11) % 17) * 0.11}s"></i>`).join('');
    this.modal({
      title: t('ui.sold.title'),
      cls: 'legacy-celebrate',
      body:
        `<div class="confetti" aria-hidden="true">${confetti}</div>` +
        `<p>You sold an empire worth ${formatCash(sold.earned)} after ${formatDuration(sold.seconds)}.</p>` +
        (sold.city !== from ? `<p class="city-next">Next stop: <b>${cityInfo(sold.city).icon} ${cityInfo(sold.city).name}</b></p>` : '') +
        `<p class="note">${grandpaLine(before, sold.city, from)}<br>— Grandpa Joe</p>`,
      big: `+${sold.points} ${LEGACY_ICON}`,
      button: `Start again: income ${legacyBadge(s)?.split(' ')[1] ?? ''}`,
      onClose: () => this.deps.restart(),
    });
  }

  /**
   * Tapping the HUD's Legacy chip: the Legacy tree (P1.3c). Points, the income multiplier, three branch tabs with four
   * nodes each (bought in order), a free respec once per empire, and the old info lines (fastest empire, next sale).
   */
  openLegacyInfo() {
    if (this.modalOpen) return;
    this.modalOpen = true;
    sfx.tap();
    const back = el('div', 'modal-back legacy-tree');
    const box = el('div', 'modal');
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', t('aria.legacyTree'));
    box.append(el('h2', 'display', `${LEGACY_ICON} Legacy`));
    const header = el('p', 'tree-head');
    const tabs = el('div', 'tree-tabs');
    tabs.setAttribute('role', 'tablist');
    const list = el('div', 'tree-nodes');
    const foot = el('div', 'tree-foot');
    const close = () => {
      if (!back.isConnected) return;
      back.remove();
      this.modalOpen = false;
      this.renderPerkStrip();
      this.render();
    };
    let branch = this.legacyTab;
    const paint = () => {
      const v = legacyTreeView(this.deps.state());
      if (!v.branches.some((b) => b.id === branch)) branch = v.branches[0]!.id;
      header.innerHTML = `<b>${v.header}</b><small>Spent points keep their +2% income</small>`;
      tabs.replaceChildren(
        ...v.branches.map((b) => {
          const t = el('button', `tree-tab${b.id === branch ? ' on' : ''}`, `<span>${b.name}</span><small>${b.icon} ${b.owned}/4</small>${b.canBuy ? '<i class="dot on"></i>' : ''}`) as HTMLButtonElement;
          t.setAttribute('role', 'tab');
          t.setAttribute('aria-selected', String(b.id === branch));
          t.dataset.branch = b.id;
          t.onclick = () => {
            branch = b.id;
            this.legacyTab = b.id;
            sfx.tap();
            paint();
          };
          return t;
        }),
      );
      const bv = v.branches.find((b) => b.id === branch)!;
      list.replaceChildren(
        ...bv.nodes.map((n) => {
          const row = el('div', `tree-node ${n.status}`);
          row.dataset.node = n.id;
          const text = el('div', 'tree-text', `<b>${n.name}</b><small>${n.desc}</small>`);
          row.append(el('div', 'tree-icon', n.icon), text);
          if (n.status === 'owned') row.append(el('span', 'tree-owned', '✓ Owned'));
          else {
            const b = el('button', 'tree-buy', n.action) as HTMLButtonElement;
            b.disabled = !n.canBuy;
            b.setAttribute('aria-label', t(n.canBuy ? 'aria.nodeBuy' : 'aria.nodeCost', { name: n.name, cost: n.cost }));
            b.onclick = () => {
              if (!buyNode(this.deps.state(), n.id)) {
                sfx.denied();
                return;
              }
              sfx.fanfare();
              haptics.play('celebrate');
              this.deps.onChange();
              paint();
              this.nodeBought(list, header, n.id, n.cost);
            };
            row.append(b);
          }
          return row;
        }),
      );
      foot.replaceChildren();
      if (v.respec) {
        const r = el('button', 'secondary tree-respec', v.respec) as HTMLButtonElement;
        r.onclick = () => {
          const st = this.deps.state();
          if (respecTree(st) > 0) {
            sfx.tap();
            this.deps.onChange();
            paint();
          }
        };
        foot.append(r);
      } else if (v.respecNote) foot.append(el('small', 'tree-note', v.respecNote));
      const st = this.deps.state();
      const best = st.legacy.bestRunSeconds > 0 ? `Fastest empire: ${formatDuration(st.legacy.bestRunSeconds)} · empires sold: ${st.legacy.sold}. ` : '';
      foot.append(el('small', 'tree-note', `${best}${nextSaleLine(st) ?? 'Sell your empire on the city map for more points.'}`));
    };
    paint();
    const ok = el('button', 'buy', 'Done') as HTMLButtonElement;
    ok.onclick = close;
    box.append(header, tabs, list, foot, ok);
    back.append(box);
    this.root.append(back);
    ok.focus({ preventScroll: true });
  }

  /**
   * Node-bought animation (P1.3e): the row pops with a gold flash and a stamp, the points header pulses and a
   * "-3 🏛" floats up from the row. Plain CSS animations (a reduce-motion rule turns them into a static highlight).
   */
  private nodeBought(list: HTMLElement, header: HTMLElement, node: string, cost: number) {
    const row = list.querySelector<HTMLElement>(`.tree-node[data-node="${node}"]`);
    if (row) {
      row.classList.add('just-bought');
      const f = el('span', 'tree-spend', `−${cost} ${LEGACY_ICON}`);
      row.append(f);
      setTimeout(() => f.remove(), 1200);
    }
    header.classList.remove('pulse');
    void header.offsetWidth;
    header.classList.add('pulse');
  }

  /** Daily tasks finished at the last render (day and kinds), for the toast outside the scrapyard (P1.5d). */
  private dailyDoneKey: string | null = null;

  /** A daily task that finishes while the garage, lot or paint shop is on screen gets a toast pointing home. */
  private checkDailyDone(s: GameState) {
    const done = s.daily.tasks.filter((t) => taskDone(t));
    const key = `${s.daily.day}:${done.map((t) => t.kind).join(',')}`;
    const before = this.dailyDoneKey;
    this.dailyDoneKey = key;
    if (before === null || before === key || s.businesses.active === 'scrapyard') return;
    const [day, kinds] = before.split(':');
    if (Number(day) !== s.daily.day) return;
    const fresh = done.find((t) => !t.claimed && !(kinds ?? '').split(',').includes(t.kind));
    if (fresh) this.toast(taskDoneToast(fresh.kind, fresh.target), 4000);
  }

  /** A medal reached since the last look shows a toast (achievements, P1.5c). The first look only takes a snapshot. */
  private checkMedals(s: GameState) {
    const now = {} as Record<AwardId, number>;
    for (const id of AWARD_IDS) now[id] = tiersReached(s, id);
    const before = this.awardTiers;
    this.awardTiers = now;
    if (!before) return;
    const up = AWARD_IDS.filter((id) => now[id] > before[id] && now[id] > s.achievements.claimed[id]);
    if (up.length === 0) return;
    this.toast(up.length === 1 ? medalToast(s, up[0]!) : t('toast.medals', { n: up.length }), 4000);
    sfx.bonus();
  }

  /**
   * Collection book (P1.4b): three pages (car types, brands, barn classics), each a list of sets with their bonus and
   * a grid of model cards (silhouette until found, rarity badge, mastery stars and a bar to the next star). Opening
   * it marks every entry as seen; entries new since the last visit keep their NEW badge until the book is closed.
   */
  openBook() {
    if (this.modalOpen) return;
    this.modalOpen = true;
    sfx.tap();
    const back = el('div', 'modal-back book');
    const box = el('div', 'modal');
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', t('aria.book'));
    box.append(el('h2', 'display', '📒 Collection'));
    const header = el('p', 'book-head');
    const tabs = el('div', 'tree-tabs book-tabs');
    tabs.setAttribute('role', 'tablist');
    const list = el('div', 'book-sets');
    // Read the view before marking entries as seen, so this visit still shows what is new.
    const st = this.deps.state();
    const fresh = new Set(unseenEntries(st));
    const freshPages = new Set(bookView(st, 'cars').pages.filter((p) => p.isNew).map((p) => p.id));
    // A medal to claim and no new cars: open on the Awards page.
    if (freshPages.size === 0 && awardsToClaim(st).length > 0) this.bookPage = 'awards';
    if (markBookSeen(st) > 0) this.deps.onChange();
    const close = () => {
      if (!back.isConnected) return;
      back.remove();
      this.modalOpen = false;
      this.render();
    };
    const paint = () => {
      const s = this.deps.state();
      const page = this.bookPage;
      const v = bookView(s, page === 'awards' || page === 'story' || page === 'shop' ? 'cars' : page);
      const aw = awardsView(s);
      const log = storyLog(s);
      const w = s.wallet;
      header.innerHTML =
        page === 'awards'
          ? `<b>🏅 ${aw.header}</b><small>Medals count every empire you have built</small>`
          : page === 'shop'
            ? `<b>🛒 Shop</b><small>Gems and tokens come from medals, daily tasks and the calendar</small>`
            : page === 'story'
            ? `<b>📖 Story: ${log.have} of ${log.of} scenes</b><small>Tap a scene to read it again</small>`
            : `<b>${v.header}</b><small>Set bonuses last forever, even after you sell your empire</small>`;
      if (w.gems > 0 || w.tokens > 0 || page === 'shop') header.innerHTML += `<small class="wallet-line">💎 ${w.gems} gems · 🎟 ${w.tokens} auction tokens</small>`;
      const storyTab = el('button', `tree-tab${page === 'story' ? ' on' : ''}`, `<span>Story</span><small>${log.have}/${log.of}</small>`) as HTMLButtonElement;
      storyTab.setAttribute('role', 'tab');
      storyTab.setAttribute('aria-selected', String(page === 'story'));
      storyTab.dataset.page = 'story';
      storyTab.onclick = () => {
        this.bookPage = 'story';
        sfx.tap();
        paint();
        list.scrollTop = 0;
      };
      if (page === 'story') {
        const secs: HTMLElement[] = log.chapters.map((c) => {
          const sec = el('section', 'book-set story-chapter');
          sec.dataset.chapter = String(c.id);
          sec.append(el('div', 'book-set-head', `<b>Chapter ${c.id}: ${c.title}</b><span class="book-count">${c.have}/${c.of}</span><small class="book-bonus">${c.city}</small>`));
          for (const b of c.beats) {
            if (!b.seen) {
              sec.append(el('div', 'story-row locked', '🔒 <span>A scene still to come</span>'));
              continue;
            }
            const open = this.storyOpen === b.id;
            const row = el('button', `story-row${open ? ' open' : ''}`, `${open ? '▾' : '▸'} <span>${b.title}</span>`) as HTMLButtonElement;
            row.dataset.beat = b.id;
            row.setAttribute('aria-expanded', String(open));
            row.onclick = () => {
              this.storyOpen = open ? null : b.id;
              sfx.tap();
              paint();
            };
            sec.append(row);
            if (open) {
              const scene = storyScene(b.id);
              sec.append(el('div', 'story-lines story-replay', storyLinesHtml(b.id) + (scene.footer ? `<p class="story-footer">${scene.footer}</p>` : '')));
            }
          }
          return sec;
        });
        if (log.next) secs.push(el('p', 'story-next', `📖 ${log.next}`));
        list.replaceChildren(...secs);
      }
      const shopTab = el('button', `tree-tab${page === 'shop' ? ' on' : ''}`, `<span>Shop</span><small>💎 ${w.gems}</small>`) as HTMLButtonElement;
      shopTab.setAttribute('role', 'tab');
      shopTab.setAttribute('aria-selected', String(page === 'shop'));
      shopTab.dataset.page = 'shop';
      shopTab.onclick = () => {
        this.bookPage = 'shop';
        sfx.tap();
        paint();
        list.scrollTop = 0;
      };
      if (page === 'shop') {
        const rows = shopItems(s).map((it) => {
          const row = el('section', `award shop-item${it.available && it.affordable ? ' ready' : ''}`);
          row.dataset.item = it.id;
          const cur = it.currency === 'gems' ? '💎' : '🎟';
          row.innerHTML = `<span class="award-icon" aria-hidden="true">${it.icon}</span><div class="award-body"><b>${it.name}</b><small>${it.available ? it.line : it.why}</small></div>`;
          const btn = el('button', 'buy award-claim shop-buy', `${it.price} ${cur}`) as HTMLButtonElement;
          btn.disabled = !it.available || !it.affordable;
          btn.setAttribute('aria-label', t('aria.buy', { name: it.name, price: it.price, currency: it.currency }));
          btn.onclick = () => {
            const msg = buyShopItem(this.deps.state(), it.id);
            if (!msg) return;
            sfx.coin();
            this.toast(t('toast.shop', { icon: it.icon, name: it.name, msg }), 2500);
            this.deps.onChange();
            paint();
          };
          row.append(btn);
          return row;
        });
        rows.push(el('p', 'story-next', '💳 Gem packs: coming soon. Gems are never sold as random rewards.'));
        list.replaceChildren(...rows);
      }
      const awardTab = el('button', `tree-tab${page === 'awards' ? ' on' : ''}`, `<span>Awards</span><small>${aw.have}/${aw.of}</small>${aw.ready > 0 ? '<i class="dot on"></i>' : ''}`) as HTMLButtonElement;
      awardTab.setAttribute('role', 'tab');
      awardTab.setAttribute('aria-selected', String(page === 'awards'));
      awardTab.dataset.page = 'awards';
      awardTab.onclick = () => {
        this.bookPage = 'awards';
        sfx.tap();
        paint();
        list.scrollTop = 0;
      };
      if (page === 'awards') {
        list.replaceChildren(
          ...aw.cards.map((c) => {
            const row = el('section', `award${c.claimable ? ' ready' : ''}${c.complete ? ' complete' : ''}`);
            row.dataset.award = c.id;
            const medals = c.medals.map((m, i) => `<i class="medal ${m}" title="${ECON.achievements.medals[i]}">${ECON.achievements.medalIcons[i]}</i>`).join('');
            row.innerHTML =
              `<span class="award-icon" aria-hidden="true">${c.icon}</span><div class="award-body"><b>${c.name}</b>` +
              `<span class="award-medals" aria-label="${t('aria.medals', { n: c.medals.filter((m) => m === 'claimed').length, max: c.medals.length })}">${medals}</span>` +
              `<small>${c.line}</small><span class="book-bar"><i style="width:${Math.round(c.progress * 100)}%"></i></span></div>`;
            if (c.claimable) {
              const btn = el('button', 'buy award-claim', c.claimText) as HTMLButtonElement;
              btn.onclick = () => {
                const r = claimAward(this.deps.state(), c.id);
                if (!r) return;
                sfx.coin();
                this.toast(t('toast.medal', { icon: ECON.achievements.medalIcons[r.tier] ?? '', name: ECON.achievements.list[c.id].name, cash: formatCash(r.cash), gems: r.gems ? t('toast.medal.gems', { n: r.gems }) : '' }), 2500);
                this.deps.onChange();
                paint();
              };
              row.append(btn);
            }
            return row;
          }),
        );
      }
      tabs.replaceChildren(
        ...v.pages.map((p) => {
          const isNew = freshPages.has(p.id) && p.id !== this.bookPage;
          const t = el('button', `tree-tab${p.id === this.bookPage ? ' on' : ''}`, `<span>${p.name}</span><small>${p.have}/${p.of}</small>${isNew ? '<i class="dot on"></i>' : ''}`) as HTMLButtonElement;
          t.setAttribute('role', 'tab');
          t.setAttribute('aria-selected', String(p.id === this.bookPage));
          t.dataset.page = p.id;
          t.onclick = () => {
            this.bookPage = p.id;
            freshPages.delete(p.id);
            sfx.tap();
            paint();
            list.scrollTop = 0;
          };
          return t;
        }),
        awardTab,
        ...(log.have > 0 ? [storyTab] : []),
        shopTab,
      );
      if (page === 'awards' || page === 'story' || page === 'shop') return;
      list.replaceChildren(
        ...v.sets.map((set) => {
          const sec = el('section', `book-set${set.complete ? ' complete' : ''}`);
          sec.dataset.set = `${set.kind}:${set.id}`;
          const head = el(
            'div',
            'book-set-head',
            `<b>${set.name}</b><span class="book-count">${set.have}/${set.of}</span><small class="book-bonus">${set.complete ? '✓ ' : ''}${set.bonus}</small>` +
              (set.showcase ? `<small class="book-showcase">${set.showcase}</small>` : ''),
          );
          const grid = el('div', 'book-grid');
          for (const c of set.cards) {
            const card = el('div', `book-card${c.collected ? ` got ${c.rarity ?? 'common'}` : ' missing'}${c.kept ? ' kept' : ''}`);
            card.dataset.model = c.model;
            const img = el('img');
            img.src = carThumb(c);
            img.width = THUMB_W;
            img.height = THUMB_H;
            img.alt = '';
            const name = c.collected ? c.model : '???';
            const badge = c.collected && c.rarity !== 'common' ? `<i class="book-rarity ${c.rarity}">${c.rarityLabel}</i>` : '';
            const stars = c.collected ? `<span class="book-stars" aria-label="${t('aria.stars', { n: c.stars })}">${'★'.repeat(c.stars)}<s>${'★'.repeat(3 - c.stars)}</s></span>` : '';
            const bar = c.collected ? `<span class="book-bar"><i style="width:${Math.round(c.progress * 100)}%"></i></span>` : '';
            card.innerHTML = `${fresh.has(c.model) ? '<i class="book-new">NEW</i>' : ''}${badge}`;
            card.prepend(img);
            card.insertAdjacentHTML('beforeend', `<b>${name}</b>${stars}<small>${c.line}</small>${bar}`);
            card.setAttribute('aria-label', c.collected ? t('aria.card', { model: c.model, rarity: c.rarityLabel, line: c.kept ? t('aria.showcase') : c.line }) : t('aria.notFound'));
            grid.append(card);
          }
          sec.append(head, grid);
          return sec;
        }),
      );
    };
    paint();
    const ok = el('button', 'buy book-done', 'Done') as HTMLButtonElement;
    ok.onclick = close;
    box.append(header, tabs, list, ok);
    back.append(box);
    this.root.append(back);
    ok.focus({ preventScroll: true });
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
    box.setAttribute('aria-label', t('settings.title'));
    const h = el('h2', 'display', t('settings.title'));
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
        btn.textContent = get() ? t('settings.on') : t('settings.off');
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
    const slider = (label: string, key: 'musicVolume' | 'sfxVolume', apply: (v: number) => void, preview?: () => void) => {
      const row = el('div', 'set-row vol-row');
      row.append(el('div', 'set-label', label));
      const input = el('input', 'vol-slider') as HTMLInputElement;
      input.type = 'range';
      input.min = '0';
      input.max = '100';
      input.step = '5';
      input.value = String(Math.round(s.settings[key] * 100));
      input.dataset.vol = key;
      input.setAttribute('aria-label', label);
      input.oninput = () => {
        const v = Number(input.value) / 100;
        s.settings[key] = v;
        apply(v);
        this.deps.onChange();
      };
      input.onchange = () => preview?.();
      row.append(input);
      return row;
    };
    box.append(
      toggle(t('settings.sound'), '', () => s.settings.sound, (v) => {
        s.settings.sound = v;
        sfx.enabled = v;
      }),
      slider(t('settings.sfxVolume'), 'sfxVolume', (v) => sfx.setVolume(v), () => sfx.tap()),
      toggle(t('settings.music'), t('settings.music.note'), () => s.settings.music, (v) => {
        s.settings.music = v;
      }),
      slider(t('settings.musicVolume'), 'musicVolume', (v) => sfx.setMusicVolume(v)),
      toggle(t('settings.reduceMotion'), t('settings.reduceMotion.note'), () => s.settings.reduceMotion, (v) => (s.settings.reduceMotion = v)),
      toggle(t('settings.skipHaggle'), t('settings.skipHaggle.note'), () => s.settings.skipHaggle, (v) => (s.settings.skipHaggle = v)),
      toggle(t('settings.vibration'), haptics.supported ? t('settings.vibration.note') : t('settings.vibration.none'), () => s.settings.vibration, (v) => {
        s.settings.vibration = v;
        haptics.enabled = v;
        haptics.play('tap');
      }),
    );
    // Number format: two-way switch.
    const fmtRow = el('div', 'set-row');
    fmtRow.append(el('div', 'set-label', t('settings.numbers')));
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

    // City lights (P1.3d3c): only in a city with a night-time look.
    if (cityInfo(currentCity(s)).hasNight) {
      const litRow = el('div', 'set-row lights-row');
      const litText = el('div', 'set-label', t('settings.lights'));
      litText.append(el('small', '', t('settings.lights.note')));
      litRow.append(litText);
      const litSeg = el('div', 'seg');
      const litOpts: [CityLights, string][] = [
        ['auto', t('settings.lights.auto')],
        ['day', t('settings.lights.day')],
        ['night', t('settings.lights.night')],
      ];
      const litBtns = litOpts.map(([v, label]) => {
        const b = el('button', 'seg-btn', label) as HTMLButtonElement;
        b.dataset.lights = v;
        b.onclick = () => {
          s.settings.cityLights = v;
          for (const x of litBtns) x.classList.toggle('on', x === b);
          sfx.tap();
          this.deps.onChange();
        };
        b.classList.toggle('on', s.settings.cityLights === v);
        return b;
      });
      litSeg.append(...litBtns);
      litRow.append(litSeg);
      box.append(litRow);
    }

    const reset = el('button', 'danger', t('settings.reset')) as HTMLButtonElement;
    reset.onclick = () => {
      close();
      this.modal({
        title: t('settings.reset.title'),
        body: `<p>${t('settings.reset.body')}</p>`,
        button: t('settings.reset.keep'),
        secondary: t('settings.reset.delete'),
        onSecondary: () => this.deps.resetProgress(),
      });
    };
    const credits = el(
      'div',
      'credits',
      `<b>${t('settings.credits.title')}</b> v${version}<br>${t('settings.credits.line1')}<br>${t('settings.credits.line2')}<br>${t('settings.credits.line3')}`,
    );
    const done = el('button', 'buy', t('settings.done')) as HTMLButtonElement;
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
    done.focus({ preventScroll: true });
  }

  /** Stamp an auction card (P1.2c): `won` when you (or your Agent) bought the lot, `lost` when another bidder did. */
  auctionStamp(index: number, cls: 'won' | 'lost' | 'rival', auto = false) {
    const text = cls === 'won' ? (auto ? 'AGENT WON!' : 'YOURS!') : cls === 'rival' ? 'VINCE!' : 'SOLD!';
    this.stamps[index] = { text, cls, until: performance.now() + ECON.carlot.stampSeconds * 1000 };
    this.render();
  }

  /** True while the Auction tab is on screen (auction sounds only play then). */
  auctionShown(): boolean {
    return this.shownBiz === 'carlot' && this.tab === 'auction';
  }

  offlineModal(seconds: number, earned: number, parts: number, onCollect: () => void, garage = 0, carlot = 0, paint = 0) {
    const scrap = parts > 0 ? `<p class="offline-parts">♻ The Scrapper topped up the parts bin: +${parts} ⚙</p>` : '';
    const shop =
      (garage > 0 ? `<p class="offline-garage">🔧 The Foreman fixed cars in the garage: ${formatCash(garage)}</p>` : '') +
      (carlot > 0 ? `<p class="offline-carlot">🏷️ Your lot crew bought, polished and sold cars: ${formatCash(carlot)}</p>` : '') +
      (paint > 0 ? `<p class="offline-paint">🎨 The Painter finished paint and tuning orders: ${formatCash(paint)}</p>` : '');
    const away = awayText(this.deps.state(), seconds, offlineCap(this.deps.state()));
    const capLine = away.capped ? `<p class="offline-cap">${away.capped}</p>` : '';
    const perk = away.perk ? `<p class="offline-perk">${perkChipEl(away.perk).outerHTML} Night Shift: your crew works longer while you're away</p>` : '';
    // What waits to be claimed (P1.5d); main.ts rolls a new day before opening the popup.
    const waiting = waitingLines(this.deps.state())
      .map((l) => `<p class="offline-waiting">${l}</p>`)
      .join('');
    this.modal({
      title: t('ui.welcome.title'),
      body: `<p>${away.worked}</p>${capLine}${scrap}${shop}${perk}${waiting}`,
      big: formatCash(earned),
      button: t('ui.welcome.collect'),
      onClose: onCollect,
      cls: 'welcome',
    });
  }
}

/** A small gold chip for an owned Legacy perk (P1.3e). */
function perkChipEl(c: PerkChip): HTMLElement {
  const e = el('span', 'perk-chip', c.label);
  e.title = c.title;
  e.setAttribute('aria-label', c.title);
  e.dataset.perk = c.node;
  return e;
}

/** A scene's lines with portraits (story modal and story log). */
function storyLinesHtml(id: StoryBeatId): string {
  return storyScene(id)
    .lines.map((l) => {
      const who = speaker(l.who);
      const url = portraitUrl(l.who);
      const img = url ? `<img class="portrait" src="${url}" alt="" width="48" height="48">` : '<span class="portrait"></span>';
      return `<div class="story-line ${l.who}">${img}<div class="bubble"><b>${who.name}</b>${l.text}</div></div>`;
    })
    .join('');
}
