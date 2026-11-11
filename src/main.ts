import { masteryToast, setCompleteBanner } from './ui/collectionView';
import '@fontsource/lilita-one/400.css';
import '@fontsource/nunito/600.css';
import '@fontsource/nunito/700.css';
import '@fontsource/nunito/800.css';
import './style.css';

import Phaser from 'phaser';
import { haptics } from './platform/haptics';
import { sfx } from './audio/sfx';
import { ECON } from './core/config';
import { SaveManager } from './core/save';
import { formatCash, setNumberFormat } from './core/format';
import { collectOffline, queueOffline, touch, type GameEvent } from './core/sim';
import { newGame, type GameState } from './core/state';
import { sellEmpire } from './core/legacy';
import { currentCity, isCityNight } from './core/cities';
import type { Bridge } from './game/bridge';
import { YardScene } from './game/YardScene';
import { GarageScene } from './game/GarageScene';
import { CarLotScene } from './game/CarLotScene';
import { PaintScene } from './game/PaintScene';
import { refreshDaily } from './core/daily';
import { music } from './audio/music';
import { analytics, MemorySink, Tracker } from './platform/analytics';
import { createWebPlatform } from './platform/platform';
import {
  bindGameplayToVisibility,
  createCrazyGamesSdk,
  createPokiSdk,
  detectPortal,
  withPortal,
  type CrazyGamesGlobal,
  type PokiGlobal,
} from './platform/portal';
import { t } from './i18n';
import { Ui } from './ui/ui';
import { announceHere } from './ui/announce';
import { rivalToast, rivalToastDue } from './ui/storyView';

// Portal builds (Poki, CrazyGames) add their SDK to the page; the web build has neither.
const portalGlobals = window as unknown as { PokiSDK?: PokiGlobal; CrazyGames?: CrazyGamesGlobal };
const portalName = detectPortal(window.location.search, portalGlobals);
const portalSdk =
  portalName === 'poki' && portalGlobals.PokiSDK
    ? createPokiSdk(portalGlobals.PokiSDK)
    : portalName === 'crazygames' && portalGlobals.CrazyGames
      ? createCrazyGamesSdk(portalGlobals.CrazyGames)
      : null;
const platform = portalSdk ? withPortal(createWebPlatform(), portalSdk) : createWebPlatform();
if (portalSdk) {
  bindGameplayToVisibility(portalSdk, document);
  portalSdk.loadingFinished();
}
const saves = new SaveManager(platform.storage);

const loaded = saves.load(platform.now());
const state: GameState = loaded ?? newGame(platform.now());
sfx.enabled = state.settings.sound;
sfx.setVolume(state.settings.sfxVolume);
sfx.setMusicVolume(state.settings.musicVolume);
haptics.enabled = state.settings.vibration;
setNumberFormat(state.settings.numberFormat);

// ---- income rate (rolling 30 s window of real sales) ------------------------
const sales: { t: number; amount: number }[] = [];
function incomePerSecond(): number {
  const now = performance.now();
  while (sales.length && now - sales[0]!.t > 30_000) sales.shift();
  if (sales.length < 2) return 0;
  const span = Math.max(10, (now - sales[0]!.t) / 1000);
  return sales.reduce((s, x) => s + x.amount, 0) / span;
}

// ---- saving --------------------------------------------------------------
let dirty = false;
let saveWarned = false;
/** Set while progress is being deleted, so nothing writes the old game back. */
let resetting = false;
function saveNow() {
  if (resetting) return;
  touch(state, platform.now());
  const ok = saves.save(state, platform.now());
  dirty = false;
  if (!ok && !saveWarned) {
    saveWarned = true;
    ui.toast('Your device storage is full: progress may not be saved.');
  }
}

function onEvents(events: GameEvent[]) {
  for (const e of events) {
    if (e.type === 'sold' || e.type === 'garageFixed') sales.push({ t: performance.now(), amount: e.amount });
    if (e.type === 'lotSold') sales.push({ t: performance.now(), amount: Math.max(0, e.profit) });
    if (e.type === 'familyUnlocked') {
      ui.showBanner(t('event.newCars.title'), t('event.newCars.body', { family: ECON.families[e.family].name }));
      sfx.fanfare();
    }
    // First car of a family sold (P0.14i). The starter families are counted quietly during the first sales,
    // so the tutorial hints and the haggle lesson are not crowded.
    if (e.type === 'firstOfFamily' && (ECON.families[e.family].unlockCarsSold > 0 || state.carsSold > ECON.collection.quietSales)) {
      const total = Object.keys(ECON.families).length;
      ui.toast(t('event.firstSold', { family: ECON.families[e.family].name, n: e.families, total }), 3500);
      sfx.repaired();
    }
    // Collection book (P1.4a): completed sets get a banner, mastery stars a toast.
    if (e.type === 'setComplete') {
      const b = setCompleteBanner(e.set, e.id);
      ui.showBanner(b.title, b.line);
      sfx.fanfare();
    }
    if (e.type === 'mastery') ui.toast(masteryToast(e.model, e.stars), 2500);
    if (e.type === 'legendary' && announceHere(e.type, state.businesses.active)) ui.showBanner(t('event.legendary.title'), t('event.legendary.body', { model: e.car.model }));
    if (e.type === 'barnStageDone' && e.stage < ECON.barn.stages.length) {
      ui.toast(t('event.barnStage', { stage: ECON.barn.stages[e.stage - 1]!.name }), 2500);
      sfx.repaired();
    }
    if (e.type === 'barnFinished') {
      ui.showBanner(t('event.restored.title'), t('event.restored.body'));
      sfx.fanfare();
    }
    if (e.type === 'barnFound' && state.barn.restored > 0) ui.toast(t('event.barnAgain'), 3000);
    if (e.type === 'contractDone') {
      ui.showBanner(t('event.order.title'), t('event.order.body'));
      sfx.repaired();
    }
    if (e.type === 'buyerArrived' && announceHere(e.type, state.businesses.active)) sfx.bell();
    if (e.type === 'buyerLeft' && e.rival && state.businesses.active === 'scrapyard' && rivalToastDue(state.story.rivalWins)) ui.toast(rivalToast('buyer', state.story.rivalWins), 2500);
    // Auction feel (P1.2c): stamps on the board; sounds only while the Auction tab is on screen.
    if (e.type === 'lotBought') {
      ui.auctionStamp(e.index, 'won', e.auto);
      if (!e.auto || ui.auctionShown()) sfx.gavel();
    }
    if (e.type === 'lotExpired') {
      ui.auctionStamp(e.index, e.rival ? 'rival' : 'lost');
      if (e.rival && state.businesses.active === 'carlot' && rivalToastDue(state.story.rivalWins)) ui.toast(rivalToast('lot', state.story.rivalWins), 2500);
      if (ui.auctionShown()) sfx.lotLost();
    }
    if (e.type === 'lotSold' && e.bonus > 0 && state.businesses.active === 'carlot') sfx.bonus();
    if (e.type === 'paintDone') {
      sales.push({ t: performance.now(), amount: e.amount });
      if (e.tip > 0 && state.paint.tips === 1) ui.toast(t('event.quickTip', { pct: Math.round(ECON.paint.tip * 100) }), 4000);
    }
    if (e.type === 'paintLotCarDone' && state.businesses.active !== 'paint') {
      const car = state.carlot.cars.find((c) => c.id === e.carId);
      if (car) ui.toast(t('event.lotBack', { model: car.model, cash: formatCash(e.value) }), 3000);
    }
    if (e.type === 'giftCar') {
      ui.showBanner(t('event.gift.title'), t('event.gift.body', { model: e.car.model, rarity: ECON.rarity[e.car.rarity].label }));
      dirty = true;
    }
    if (e.type.startsWith('garage') || e.type.startsWith('lot') || e.type.startsWith('paint')) dirty = true;
    if (e.type === 'sold' || e.type === 'buyerArrived' || e.type === 'arrived' || e.type === 'crushed' || e.type.startsWith('contract') || e.type.startsWith('barn')) dirty = true;
  }
  ui.render();
}

// ---- UI ------------------------------------------------------------------
const app = document.getElementById('app')!;
const ui = new Ui(document.getElementById('ui')!, {
  state: () => state,
  onEvents: (events) => scene()?.handleEvents(events),
  onChange: () => {
    dirty = true;
  },
  incomePerSecond,
  now: () => platform.now(),
  barnReveal: (shown) => {
    const sc = yardScene();
    if (!sc || state.businesses.active !== 'scrapyard') {
      shown();
      return () => {};
    }
    return sc.barnReveal(shown);
  },
  onSwitchBusiness: () => showBusiness(),
  sellEmpire: (city) => {
    // Freeze every scene first: their cars and textures belong to the empire being sold.
    for (const key of Object.values(SCENE_KEYS)) if (game.scene.isActive(key)) game.scene.pause(key);
    const sold = sellEmpire(state, platform.now(), city);
    if (!sold) {
      showBusiness();
      return null;
    }
    saveNow();
    return sold;
  },
  restart: () => {
    saveNow();
    resetting = true;
    location.reload();
  },
  resetProgress: () => {
    resetting = true;
    saves.wipe();
    location.reload();
  },
});

// ---- Phaser --------------------------------------------------------------
const dpr = Math.min(window.devicePixelRatio || 1, 2.5);

const bridge: Bridge = {
  state,
  dpr,
  insets: () => ui.insets(),
  cashTarget: () => ui.cashTarget(),
  onEvents,
  onInput: () => sfx.unlock(),
  onBarnTap: () => ui.showYard(),
  night: () => isCityNight(state.legacy.city, state.settings.cityLights, new Date(platform.now()).getHours()),
  // After the yard's create() has returned (a scene can't be put to sleep while it is still creating).
  onYardReady: () => window.setTimeout(showBusiness, 0),
};

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#1E2430',
  width: app.clientWidth * dpr,
  height: app.clientHeight * dpr,
  scale: { mode: Phaser.Scale.NONE, zoom: 1 / dpr },
  // pixelArt must be off explicitly: Phaser turns it on whenever zoom !== 1 (we zoom by 1/dpr), which silently
  // switched every texture to nearest-neighbour filtering (the stair-steps found in run 5). Trilinear mipmaps for
  // power-of-two textures (car art) keep the lot thumbnails smooth when they scale down (P0.14h).
  render: { antialias: true, pixelArt: false, powerPreference: 'high-performance', mipmapFilter: 'LINEAR_MIPMAP_LINEAR' },
  banner: false,
  disableContextMenu: true,
});
game.scene.add('yard', YardScene, true, { bridge });
game.scene.add('garage', GarageScene, false, { bridge });
game.scene.add('carlot', CarLotScene, false, { bridge });
game.scene.add('paint', PaintScene, false, { bridge });

function yardScene(): YardScene | undefined {
  return game.scene.getScene('yard') as YardScene | undefined;
}

/** Scene key per business. */
const SCENE_KEYS = { scrapyard: 'yard', garage: 'garage', carlot: 'carlot', paint: 'paint' } as const;
type SceneKey = (typeof SCENE_KEYS)[keyof typeof SCENE_KEYS];

function activeSceneKey(): SceneKey {
  return SCENE_KEYS[state.businesses.active];
}

/** The scene on screen (it runs the simulation tick and gets the player's events). */
function scene(): YardScene | GarageScene | CarLotScene | PaintScene | undefined {
  const key = activeSceneKey();
  if (key === 'yard') return yardScene();
  return game.scene.getScene(key) as GarageScene | CarLotScene | PaintScene | undefined;
}

/**
 * Put the active business's scene on screen (P1.1c). Only one scene runs at a time; the core tick inside it advances
 * every business, so the yard keeps earning while the garage or the lot is shown. The yard always boots first
 * (shared textures).
 */
function showBusiness() {
  const m = game.scene;
  const want = activeSceneKey();
  for (const key of Object.values(SCENE_KEYS)) {
    if (key === want || !m.isActive(key)) continue;
    m.sleep(key);
  }
  if (m.isSleeping(want)) m.wake(want);
  else if (!m.isActive(want)) m.run(want, { bridge });
  dirty = true;
  ui.render();
}

function resize() {
  const w = Math.max(1, app.clientWidth);
  const h = Math.max(1, app.clientHeight);
  game.scale.resize(w * dpr, h * dpr);
  game.scale.setZoom(1 / dpr);
}
new ResizeObserver(resize).observe(app);

// ---- render + save loops -------------------------------------------------
setInterval(() => {
  // A new game day (P1.5a): fresh tasks and the next calendar reward.
  if (refreshDaily(state, platform.now())) {
    dirty = true;
    if (state.tutorial.dailySeen) ui.toast('📅 New day: fresh daily tasks and a reward on the Jobs board', 3500);
    ui.rebuildCards();
  }
  ui.render();
}, 100);
setInterval(() => {
  touch(state, platform.now());
  if (dirty) saveNow();
}, 5000);

// ---- offline earnings -----------------------------------------------------
function offerOffline(seconds: number, parts = 0, garage = 0, carlot = 0, paint = 0) {
  if (state.pendingOffline <= 0) return;
  // A new day may have started while away: roll it first, so the popup can say what waits (P1.5d).
  if (refreshDaily(state, platform.now())) {
    dirty = true;
    ui.rebuildCards();
  }
  ui.offlineModal(
    seconds,
    state.pendingOffline,
    parts,
    () => {
      collectOffline(state);
      saveNow();
    },
    garage,
    carlot,
    paint,
  );
}

// Music follows the settings, the business on screen and the city (P1.8). Audio only starts after the first tap.
function syncMusic(): void {
  music.sync({ enabled: state.settings.music, opened: state.businesses.opened, active: state.businesses.active, city: currentCity(state) });
}
setInterval(syncMusic, 500);

// Analytics (P1.11): no network sink yet. With ?debug=1 events go to a memory log (consent granted) for the browser test.
const tracker = new Tracker(analytics, state);
setInterval(() => tracker.look(state), 1000);
analytics.track('session_start', { returning: !!loaded });

let hiddenAt = 0;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    hiddenAt = platform.now();
    saveNow();
    sfx.suspend();
  } else {
    sfx.resume();
    const r = queueOffline(state, platform.now());
    if (r.seconds >= ECON.offline.minSecondsForPopup && hiddenAt) offerOffline(r.seconds, r.parts, r.garage, r.carlot, r.paint);
  }
});
window.addEventListener('pagehide', () => saveNow());

// ---- first launch / returning player --------------------------------------
if (loaded) {
  const r = queueOffline(state, platform.now());
  if (state.pendingOffline > 0) offerOffline(Math.max(r.seconds, 0), r.parts, r.garage, r.carlot, r.paint);
}
if (!state.tutorial.introSeen) {
  ui.modal({
    title: t('intro.title'),
    body: `<p class="note">${t('intro.body')}<br>${t('intro.signoff')}</p>`,
    button: t('intro.button'),
    onClose: () => {
      state.tutorial.introSeen = true;
      dirty = true;
    },
  });
}
if (platform.storageVolatile) {
  ui.toast('Private browsing: your progress will not be saved after you close this tab.', 6000);
}
ui.render();

// Debug hook for automated tests: open the game with ?debug=1.
const params = new URLSearchParams(location.search);
if (params.has('debug')) {
  (window as unknown as Record<string, unknown>).__jye = { state, saveNow, game, ui, music, analytics, MemorySink };
  if (params.has('gallery')) void import('./game/gallery').then((m) => m.showCarGallery());
}

// Offline play (P1.10): production web builds only; not in ?debug runs, not in native shells.
if (
  import.meta.env.PROD &&
  'serviceWorker' in navigator &&
  !location.search.includes('debug') &&
  location.protocol.startsWith('http')
) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
