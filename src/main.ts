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
import { setNumberFormat } from './core/format';
import { collectOffline, queueOffline, touch, type GameEvent } from './core/sim';
import { newGame, type GameState } from './core/state';
import type { Bridge } from './game/bridge';
import { YardScene } from './game/YardScene';
import { createWebPlatform } from './platform/platform';
import { Ui } from './ui/ui';

const platform = createWebPlatform();
const saves = new SaveManager(platform.storage);

const loaded = saves.load(platform.now());
const state: GameState = loaded ?? newGame(platform.now());
sfx.enabled = state.settings.sound;
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
    if (e.type === 'sold') sales.push({ t: performance.now(), amount: e.amount });
    if (e.type === 'familyUnlocked') {
      ui.showBanner('NEW CARS!', `${ECON.families[e.family].name}s now roll into the yard`);
      sfx.fanfare();
    }
    if (e.type === 'legendary') ui.showBanner('LEGENDARY!', `A Legendary ${e.car.model} rolled in`);
    if (e.type === 'barnStageDone' && e.stage < ECON.barn.stages.length) {
      ui.toast(`Barn find: ${ECON.barn.stages[e.stage - 1]!.name} done!`, 2500);
      sfx.repaired();
    }
    if (e.type === 'barnFinished') {
      ui.showBanner('RESTORED!', 'Reveal your classic in the Yard tab');
      sfx.fanfare();
    }
    if (e.type === 'barnFound' && state.barn.restored > 0) ui.toast('Grandpa Joe found another covered classic!', 3000);
    if (e.type === 'contractDone') {
      ui.showBanner('ORDER DONE!', 'Claim it on the Jobs board');
      sfx.repaired();
    }
    if (e.type === 'buyerArrived') sfx.bell();
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
  barnReveal: (shown) => {
    const sc = scene();
    if (!sc) {
      shown();
      return () => {};
    }
    return sc.barnReveal(shown);
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
};

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#1E2430',
  width: app.clientWidth * dpr,
  height: app.clientHeight * dpr,
  scale: { mode: Phaser.Scale.NONE, zoom: 1 / dpr },
  render: { antialias: true, powerPreference: 'high-performance' },
  banner: false,
  disableContextMenu: true,
});
game.scene.add('yard', YardScene, true, { bridge });

function scene(): YardScene | undefined {
  return game.scene.getScene('yard') as YardScene | undefined;
}

function resize() {
  const w = Math.max(1, app.clientWidth);
  const h = Math.max(1, app.clientHeight);
  game.scale.resize(w * dpr, h * dpr);
  game.scale.setZoom(1 / dpr);
}
new ResizeObserver(resize).observe(app);

// ---- render + save loops -------------------------------------------------
setInterval(() => ui.render(), 100);
setInterval(() => {
  touch(state, platform.now());
  if (dirty) saveNow();
}, 5000);

// ---- offline earnings -----------------------------------------------------
function offerOffline(seconds: number, parts = 0) {
  if (state.pendingOffline <= 0) return;
  ui.offlineModal(seconds, state.pendingOffline, parts, () => {
    collectOffline(state);
    saveNow();
  });
}

let hiddenAt = 0;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    hiddenAt = platform.now();
    saveNow();
    sfx.suspend();
  } else {
    sfx.resume();
    const r = queueOffline(state, platform.now());
    if (r.seconds >= ECON.offline.minSecondsForPopup && hiddenAt) offerOffline(r.seconds, r.parts);
  }
});
window.addEventListener('pagehide', () => saveNow());

// ---- first launch / returning player --------------------------------------
if (loaded) {
  const r = queueOffline(state, platform.now());
  if (state.pendingOffline > 0) offerOffline(Math.max(r.seconds, 0), r.parts);
}
if (!state.tutorial.introSeen) {
  ui.modal({
    title: "Grandpa Joe's Yard",
    body:
      '<p class="note">"Kid, this old scrapyard is yours now. Wash the wrecks, fix them up and sell them. Make it the biggest name in cars."<br>— Grandpa Joe</p>',
    button: "Let's go!",
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
  (window as unknown as Record<string, unknown>).__jye = { state, saveNow, game };
  if (params.has('gallery')) void import('./game/gallery').then((m) => m.showCarGallery());
}
