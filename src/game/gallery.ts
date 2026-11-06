// Debug-only car gallery (?debug=1&gallery=1): every family in every rarity, for art review
// and the e2e screenshot. Not reachable in normal play.

import { ECON, PAINTS, type CarFamily, type Rarity } from '../core/config';
import { paintCar, paintRust } from './carArt';
import { BUYER_H, BUYER_W, paintBuyer } from './buyerArt';
import type { BuyerKind } from '../core/config';
import { BARN_BOX_H, BARN_BOX_W, paintBarn, paintTarp, type BarnLook } from './barnArt';
import { PRESS_H, PRESS_W, SCRAPPER_H, SCRAPPER_W, paintForeman, paintPress, paintScrapper } from './crewArt';

export function showCarGallery(): HTMLElement {
  const root = document.createElement('div');
  root.className = 'car-gallery';
  root.style.cssText =
    'position:fixed;inset:0;z-index:999;overflow:auto;background:#d9c7a7;display:grid;grid-template-columns:repeat(3,1fr);gap:4px;padding:6px;align-content:start;';
  const rarities = Object.keys(ECON.rarity) as Rarity[];
  (Object.keys(ECON.families) as CarFamily[]).forEach((family, i) => {
    rarities.forEach((_r, j) => {
      if (j > 1) return; // two looks per family, three columns: fits one phone screen
      const c = document.createElement('canvas');
      c.width = 360;
      c.height = 180;
      c.style.width = '100%';
      c.dataset.family = family;
      const ctx = c.getContext('2d')!;
      ctx.scale(0.5, 0.5);
      paintCar(ctx, { family, paint: PAINTS[(i * 3 + j) % PAINTS.length]!, rarity: j === 0 ? 'common' : rarities[(i % 3) + 1]! }, 720, 360);
      if (j === 1 && i % 2 === 0) paintRust(ctx, family, 720, 360, i + 1);
      root.append(c);
    });
  });
  // Customers, one per personality.
  for (const kind of Object.keys(ECON.buyers.kinds) as BuyerKind[]) {
    const c = document.createElement('canvas');
    c.width = BUYER_W * 2;
    c.height = BUYER_H * 2;
    c.style.height = '110px';
    c.style.justifySelf = 'center';
    c.dataset.buyer = kind;
    const ctx = c.getContext('2d')!;
    ctx.scale(2, 2);
    paintBuyer(ctx, kind);
    root.append(c);
  }
  // The Scrapper and its press, and the garage Foreman.
  for (const [name, w, h, paint] of [
    ['scrapper', SCRAPPER_W, SCRAPPER_H, paintScrapper],
    ['foreman', SCRAPPER_W, SCRAPPER_H, paintForeman],
    ['press', PRESS_W, PRESS_H, paintPress],
  ] as const) {
    const c = document.createElement('canvas');
    c.width = w * 2;
    c.height = h * 2;
    c.style.height = '110px';
    c.style.justifySelf = 'center';
    c.dataset.crew = name;
    const ctx = c.getContext('2d')!;
    ctx.scale(2, 2);
    paint(ctx);
    root.append(c);
  }
  // The barn through a restoration, and the reveal tarp over the tallest cars.
  const looks: BarnLook[] = [
    { status: 'covered', stage: 0, family: 'van', paint: PAINTS[1]! },
    { status: 'working', stage: 1, family: 'suv', paint: PAINTS[2]! },
    { status: 'working', stage: 2, family: 'muscle', paint: PAINTS[0]! },
    { status: 'working', stage: 3, family: 'sports', paint: PAINTS[3]! },
    { status: 'revealed', stage: 4, family: 'hyper', paint: PAINTS[4]! },
  ];
  for (const look of looks) {
    const c = document.createElement('canvas');
    c.width = BARN_BOX_W * 2;
    c.height = BARN_BOX_H * 2;
    c.style.width = '100%';
    c.dataset.barn = `${look.status}-${look.stage}`;
    const ctx = c.getContext('2d')!;
    ctx.scale(2, 2);
    paintBarn(ctx, look);
    root.append(c);
  }
  for (const family of ['van', 'suv', 'pickup'] as CarFamily[]) {
    const c = document.createElement('canvas');
    c.width = 360;
    c.height = 180;
    c.style.width = '100%';
    c.dataset.tarp = family;
    const ctx = c.getContext('2d')!;
    ctx.scale(0.5, 0.5);
    paintCar(ctx, { family, paint: PAINTS[0]!, rarity: 'legendary' }, 720, 360);
    paintTarp(ctx, 720 * 0.02, 720 * 0.98, 360 * 0.93, 360, true);
    root.append(c);
  }
  document.body.append(root);
  return root;
}
