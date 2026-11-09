// Collection book thumbnails (P1.4b): a small side view of each entry, painted with the same Canvas 2D car art as the
// yard. Entries not found yet are a dark silhouette of their car type. Cached as data URLs (one per entry and look).

import type { CarFamily, Rarity } from '../core/config';
import { paintCar } from './carArt';

/** Thumbnail size in CSS px (the canvas is drawn at 2x for sharp phone screens). */
export const THUMB_W = 96;
export const THUMB_H = 48;
export const SILHOUETTE = '#2f3542';

const cache = new Map<string, string>();

export interface ThumbLook {
  family: CarFamily;
  paint: number;
  rarity: Rarity | null;
  collected: boolean;
}

export function thumbKey(look: ThumbLook): string {
  return look.collected ? `${look.family}|${look.paint}|${look.rarity ?? 'common'}` : `${look.family}|?`;
}

/** Data URL of the thumbnail (empty string where no canvas is available, e.g. unit tests). */
export function carThumb(look: ThumbLook): string {
  const key = thumbKey(look);
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  let url = '';
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas');
    c.width = THUMB_W * 2;
    c.height = THUMB_H * 2;
    const ctx = c.getContext('2d');
    if (ctx) {
      paintCar(ctx, { family: look.family, paint: look.paint, rarity: look.collected ? (look.rarity ?? 'common') : 'common' }, c.width, c.height, { shadow: look.collected });
      if (!look.collected) {
        ctx.globalCompositeOperation = 'source-atop';
        ctx.fillStyle = SILHOUETTE;
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.globalCompositeOperation = 'source-over';
      }
      url = c.toDataURL('image/png');
    }
  }
  cache.set(key, url);
  return url;
}
