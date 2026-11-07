// Rust Valley city map (P1.1b): an inline SVG drawn in code, plus the list rows under it.
// Pure string building (no DOM) so the art can be unit-tested and stays crisp at any size.

import type { BusinessId } from '../core/config';
import { perkChip } from './legacyView';
import { BUSINESS_IDS, MAX_TIER, unlockGoal, businessInfo, businessStatus, businessTier, nextTierGoal, openCost, unlockProgress, type BusinessStatus } from '../core/businesses';
import { formatCash } from '../core/format';
import type { GameState } from '../core/state';

export const MAP_W = 360;
export const MAP_H = 300;

/** Where each business sits on the map (plot top-left, size). */
export const PLOTS: Record<BusinessId, { x: number; y: number; w: number; h: number }> = {
  scrapyard: { x: 18, y: 176, w: 140, h: 104 },
  garage: { x: 196, y: 176, w: 146, h: 104 },
  carlot: { x: 18, y: 26, w: 140, h: 104 },
  paint: { x: 196, y: 26, w: 146, h: 104 },
};

const C = {
  grass: '#8fbf5a',
  grassDark: '#78a84a',
  road: '#4a505c',
  roadEdge: '#3a3f49',
  line: '#f5d76e',
  dirt: '#c9a46a',
  dirtDark: '#a8834f',
  rust: '#e8762b',
  rustDark: '#b9561a',
  steel: '#8a94a3',
  steelDark: '#5d6674',
  cream: '#fbf3e4',
  ink: '#2b2118',
  locked: '#9aa0a8',
  lockedDark: '#6e747c',
  water: '#5fb3d9',
};

function esc(t: string): string {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function tree(x: number, y: number, r = 9): string {
  return `<circle cx="${x}" cy="${y + 3}" r="${r}" fill="#000" opacity=".12"/><circle cx="${x}" cy="${y}" r="${r}" fill="#4f9a3c"/><circle cx="${x - r * 0.3}" cy="${y - r * 0.3}" r="${r * 0.45}" fill="#6fbf4f"/>`;
}

function ground(): string {
  const parts: string[] = [];
  parts.push(`<rect width="${MAP_W}" height="${MAP_H}" rx="18" fill="${C.grass}"/>`);
  // Soft grass patches.
  for (const [x, y, rx, ry] of [
    [60, 150, 40, 10],
    [300, 150, 46, 9],
    [180, 290, 60, 8],
  ] as const)
    parts.push(`<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${C.grassDark}" opacity=".5"/>`);
  // River in the top corner.
  parts.push(`<path d="M300 0 C 320 20, 345 18, 360 30 L360 0 Z" fill="${C.water}"/>`);
  // Roads: one avenue across, one street down the middle.
  parts.push(`<rect x="0" y="140" width="${MAP_W}" height="28" fill="${C.road}"/>`);
  parts.push(`<rect x="166" y="0" width="22" height="${MAP_H}" fill="${C.road}"/>`);
  parts.push(`<rect x="0" y="140" width="${MAP_W}" height="2" fill="${C.roadEdge}"/><rect x="0" y="166" width="${MAP_W}" height="2" fill="${C.roadEdge}"/>`);
  parts.push(`<line x1="0" y1="154" x2="${MAP_W}" y2="154" stroke="${C.line}" stroke-width="2" stroke-dasharray="10 8"/>`);
  parts.push(`<line x1="177" y1="0" x2="177" y2="140" stroke="${C.line}" stroke-width="2" stroke-dasharray="8 8"/>`);
  parts.push(`<line x1="177" y1="168" x2="177" y2="${MAP_H}" stroke="${C.line}" stroke-width="2" stroke-dasharray="8 8"/>`);
  for (const [x, y] of [
    [10, 12],
    [176, 292],
    [350, 290],
    [10, 290],
    [350, 120],
    [8, 135],
  ] as const)
    parts.push(tree(x, y, 7));
  return parts.join('');
}

function mapCar(x: number, y: number, body: string, roof: string): string {
  return `<rect x="${x}" y="${y}" width="24" height="9" rx="4" fill="${body}"/><rect x="${x + 5}" y="${y - 5}" width="12" height="6" rx="2.5" fill="${roof}"/><circle cx="${x + 5}" cy="${y + 9}" r="2.8" fill="${C.ink}"/><circle cx="${x + 19}" cy="${y + 9}" r="2.8" fill="${C.ink}"/>`;
}

/** Three little stars in the plot's top-left corner, filled up to the tier (P1.1d). */
function tierStars(p: { x: number; y: number }, tier: number): string {
  const o: string[] = [`<g class="tier" data-tier="${tier}"><rect x="${p.x + 4}" y="${p.y + 4}" width="40" height="14" rx="7" fill="${C.ink}" opacity=".6"/>`];
  for (let i = 0; i < MAX_TIER; i++) {
    const cx = p.x + 12 + i * 12;
    const cy = p.y + 11;
    const pts = Array.from({ length: 10 }, (_, k) => {
      const a = (k / 10) * Math.PI * 2 - Math.PI / 2;
      const r = k % 2 === 0 ? 5 : 2.2;
      return `${(cx + Math.cos(a) * r).toFixed(1)},${(cy + Math.sin(a) * r).toFixed(1)}`;
    }).join(' ');
    o.push(`<polygon class="${i < tier ? 'star on' : 'star'}" points="${pts}" fill="${i < tier ? C.line : '#ffffff40'}"/>`);
  }
  o.push('</g>');
  return o.join('');
}

function scrapyardArt(p: { x: number; y: number; w: number; h: number }, tier: number): string {
  const { x, y, w, h } = p;
  const o: string[] = [];
  o.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="${C.dirt}"/>`);
  o.push(`<rect x="${x + 6}" y="${y + h - 18}" width="${w - 12}" height="10" rx="5" fill="${C.dirtDark}" opacity=".5"/>`);
  // Junk piles.
  o.push(`<path d="M${x + 10} ${y + 70} q 18 -30 40 0 z" fill="${C.steelDark}"/><path d="M${x + 22} ${y + 70} q 10 -16 22 0 z" fill="${C.steel}"/>`);
  o.push(`<path d="M${x + 84} ${y + 74} q 22 -34 48 0 z" fill="${C.steelDark}"/><circle cx="${x + 104}" cy="${y + 62}" r="5" fill="#2b2f36"/>`);
  // Crane.
  o.push(`<rect x="${x + 62}" y="${y + 22}" width="5" height="52" fill="${C.rustDark}"/><rect x="${x + 50}" y="${y + 20}" width="44" height="5" fill="${C.rust}"/>`);
  o.push(`<line x1="${x + 88}" y1="${y + 25}" x2="${x + 88}" y2="${y + 40}" stroke="${C.ink}" stroke-width="1.5"/><rect x="${x + 82}" y="${y + 40}" width="12" height="6" fill="${C.steel}"/>`);
  // Little cars in the yard: one more per tier.
  o.push(mapCar(x + w - 30, y + 76, '#e5484d', '#c23a3f'));
  if (tier >= 2) {
    o.push(mapCar(x + 98, y + 42, '#3b82f6', '#2b5fb3'));
    // The crusher block by the junk pile.
    o.push(`<rect class="t2" x="${x + 70}" y="${y + 50}" width="20" height="18" rx="2" fill="${C.steelDark}"/><rect x="${x + 70}" y="${y + 50}" width="20" height="5" fill="#e5484d"/>`);
  }
  if (tier >= 3) {
    // Site office with a gold flag on the crane.
    o.push(`<rect class="t3" x="${x + 6}" y="${y + 74}" width="24" height="16" rx="2" fill="${C.cream}"/><rect x="${x + 4}" y="${y + 71}" width="28" height="5" rx="2" fill="${C.rust}"/><rect x="${x + 11}" y="${y + 79}" width="8" height="6" fill="#bfe3f2"/>`);
    o.push(`<rect x="${x + 50}" y="${y + 6}" width="2" height="15" fill="${C.ink}"/><path d="M${x + 52} ${y + 6} l 12 4 l -12 4 z" fill="${C.line}"/>`);
  }
  // Stacked tyres and a crushed cube by the gate.
  o.push(`<circle cx="${x + 16}" cy="${y + 28}" r="6" fill="#2b2f36"/><circle cx="${x + 16}" cy="${y + 28}" r="2.5" fill="${C.steel}"/><circle cx="${x + 28}" cy="${y + 28}" r="6" fill="#2b2f36"/><circle cx="${x + 28}" cy="${y + 28}" r="2.5" fill="${C.steel}"/>`);
  o.push(`<rect x="${x + 36}" y="${y + 30}" width="14" height="12" rx="2" fill="#3b82f6"/><rect x="${x + 36}" y="${y + 34}" width="14" height="2" fill="#2b5fb3"/>`);
  // Fence.
  o.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="none" stroke="${C.steelDark}" stroke-width="3" stroke-dasharray="4 3"/>`);
  return o.join('');
}

function garageArt(p: { x: number; y: number; w: number; h: number }, lit: boolean, tier: number): string {
  const { x, y, w, h } = p;
  const wall = lit ? '#d9dee6' : C.locked;
  const roof = lit ? '#3b82f6' : C.lockedDark;
  const door = lit ? '#f2f4f7' : '#b8bdc4';
  const o: string[] = [];
  o.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="${lit ? '#b9c0ca' : '#a5aab0'}"/>`);
  // Building with a flat roof and two roll-up doors.
  o.push(`<rect x="${x + 16}" y="${y + 22}" width="${w - 32}" height="58" rx="4" fill="${wall}"/>`);
  o.push(`<rect x="${x + 12}" y="${y + 14}" width="${w - 24}" height="12" rx="4" fill="${roof}"/>`);
  const dw = w / 2 - 32;
  [26, w / 2 + 6].forEach((dx, i) => {
    // Tier 2 rolls the first door up with a customer's car inside, tier 3 both (P1.1d).
    if (i < tier - 1) {
      o.push(`<rect class="t${i + 2}" x="${x + dx}" y="${y + 40}" width="${dw}" height="40" fill="#3a3f49"/>`);
      o.push(`<rect x="${x + dx}" y="${y + 40}" width="${dw}" height="8" fill="${door}"/>`);
      o.push(mapCar(x + dx + (dw - 24) / 2, y + 66, i === 0 ? '#f5b700' : '#1f9e9a', i === 0 ? '#c99600' : '#16706d'));
      return;
    }
    o.push(`<rect x="${x + dx}" y="${y + 40}" width="${dw}" height="40" fill="${door}"/>`);
    for (let k = 0; k < 5; k++) o.push(`<rect x="${x + dx}" y="${y + 44 + k * 8}" width="${dw}" height="1.5" fill="${lit ? '#c3cad4' : '#9ea3aa'}"/>`);
  });
  // Wrench sign on the roof.
  o.push(`<circle cx="${x + w / 2}" cy="${y + 10}" r="10" fill="${lit ? C.rust : C.lockedDark}" stroke="${C.cream}" stroke-width="2"/>`);
  o.push(`<path d="M${x + w / 2 - 4} ${y + 14} l 7 -7 m -1 -2 a 3 3 0 1 0 3 3" stroke="${C.cream}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`);
  // Driveway to the road.
  o.push(`<rect x="${x + 26}" y="${y + 80}" width="${w - 52}" height="${h - 80}" fill="${lit ? '#9aa3ae' : '#999ea4'}"/>`);
  // Tier 3: a lit strip along the roof.
  if (tier >= 3) o.push(`<rect class="t3" x="${x + 14}" y="${y + 24}" width="${w - 28}" height="3" rx="1.5" fill="${C.line}"/>`);
  return o.join('');
}

function carLotArt(p: { x: number; y: number; w: number; h: number }, lit: boolean, tier = 0): string {
  const { x, y, w, h } = p;
  const o: string[] = [];
  o.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="${lit ? '#6a717d' : '#a5aab0'}"/>`);
  // Bunting.
  const flags = lit ? ['#e5484d', '#f5b700', '#3b82f6', '#3bc45a'] : [C.lockedDark];
  o.push(`<path d="M${x + 8} ${y + 14} Q ${x + w / 2} ${y + 26} ${x + w - 8} ${y + 14}" stroke="${C.ink}" stroke-width="1" fill="none"/>`);
  for (let i = 0; i < 9; i++) {
    const fx = x + 16 + i * ((w - 32) / 8);
    const fy = y + 15 + Math.sin((i / 8) * Math.PI) * 9;
    o.push(`<path d="M${fx - 4} ${fy} l 8 0 l -4 8 z" fill="${flags[i % flags.length]}"/>`);
  }
  // Rows of parked cars: one row at tier 1, the second row from tier 2 (the locked plot shows both, greyed).
  const paints = lit ? ['#e5484d', '#f2f4f7', '#1f9e9a', '#f5b700', '#8b5cf6', '#2b2f36'] : [C.lockedDark];
  const rows = lit && tier < 2 ? 1 : 2;
  // Tier 3: a gold balloon over the lot and price tags on the front row.
  if (lit && tier >= 3)
    o.push(
      `<path class="t3" d="M${x + w - 18} ${y + 22} q 3 8 -2 16" stroke="${C.ink}" stroke-width="1" fill="none"/>` +
        `<circle cx="${x + w - 18}" cy="${y + 14}" r="8" fill="${C.line}" stroke="${C.cream}" stroke-width="1.5"/>`,
    );
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < 3; c++) {
      const cx = x + 16 + c * 42;
      const cy = y + 38 + r * 30;
      o.push(`<rect x="${cx}" y="${cy}" width="28" height="16" rx="5" fill="${paints[(r * 3 + c) % paints.length]}"/><rect x="${cx + 6}" y="${cy + 3}" width="16" height="6" rx="2" fill="#bfe3f2" opacity="${lit ? 1 : 0.4}"/>`);
      if (lit && tier >= 3 && r === 0) o.push(`<rect x="${cx + 20}" y="${cy - 5}" width="9" height="7" rx="1.5" fill="${C.line}" stroke="${C.ink}" stroke-width="0.8"/>`);
    }
  return o.join('');
}

function paintShopArt(p: { x: number; y: number; w: number; h: number }, lit: boolean, tier = 0): string {
  const { x, y, w, h } = p;
  const o: string[] = [];
  o.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="${lit ? '#c7b8e8' : '#a5aab0'}"/>`);
  o.push(`<rect x="${x + 18}" y="${y + 28}" width="${w - 36}" height="56" rx="4" fill="${lit ? '#f2f4f7' : C.locked}"/>`);
  o.push(`<path d="M${x + 14} ${y + 30} L ${x + w / 2} ${y + 10} L ${x + w - 14} ${y + 30} Z" fill="${lit ? '#8b5cf6' : C.lockedDark}"/>`);
  // Spray stripes on the wall.
  const stripes = lit ? ['#e5484d', '#f5b700', '#3b82f6'] : [C.lockedDark, '#858b93', C.lockedDark];
  stripes.forEach((col, i) => o.push(`<rect x="${x + 26}" y="${y + 40 + i * 9}" width="${w - 52}" height="5" rx="2.5" fill="${col}"/>`));
  o.push(`<rect x="${x + w / 2 - 14}" y="${y + 66}" width="28" height="18" fill="${lit ? '#d9dee6' : '#b8bdc4'}"/>`);
  // Tier 2: a second booth door with a freshly painted car rolling out of it (booth 2).
  if (lit && tier >= 2)
    o.push(
      `<rect class="t2" x="${x + 24}" y="${y + 66}" width="22" height="18" fill="#d9dee6"/>` +
        `<rect x="${x + 21}" y="${y + 73}" width="28" height="12" rx="5" fill="#e5484d" stroke="${C.ink}" stroke-width="0.8"/><rect x="${x + 27}" y="${y + 75}" width="16" height="4" rx="2" fill="#bfe3f2"/>`,
    );
  // Tier 3: a neon spray-can sign on the roof (booth 3).
  if (lit && tier >= 3)
    o.push(`<g class="t3"><rect x="${x + w / 2 - 6}" y="${y + 2}" width="12" height="18" rx="3" fill="${C.line}" stroke="${C.cream}" stroke-width="1.5"/><rect x="${x + w / 2 - 3}" y="${y - 2}" width="6" height="4" fill="${C.cream}"/></g>`);
  return o.join('');
}

function badge(p: { x: number; y: number; w: number; h: number }, status: BusinessStatus, progress: number): string {
  const cx = p.x + p.w / 2;
  const cy = p.y + p.h / 2 + 4;
  if (status === 'open') return '';
  if (status === 'locked') {
    // Padlock with a progress ring.
    const r = 17;
    const len = 2 * Math.PI * r;
    return (
      `<g class="lock"><circle cx="${cx}" cy="${cy}" r="${r + 4}" fill="${C.ink}" opacity=".55"/>` +
      `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#ffffff33" stroke-width="4"/>` +
      `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${C.line}" stroke-width="4" stroke-linecap="round" ` +
      `stroke-dasharray="${(len * progress).toFixed(1)} ${len.toFixed(1)}" transform="rotate(-90 ${cx} ${cy})"/>` +
      `<rect x="${cx - 7}" y="${cy - 2}" width="14" height="11" rx="2" fill="${C.cream}"/>` +
      `<path d="M${cx - 4.5} ${cy - 2} v -4 a 4.5 4.5 0 0 1 9 0 v 4" stroke="${C.cream}" stroke-width="2.5" fill="none"/></g>`
    );
  }
  // Unlocked: a "for sale" signpost (soon = same sign, cream).
  const sale = status === 'forSale';
  return (
    `<g class="sale"><rect x="${cx - 2}" y="${cy - 4}" width="4" height="24" fill="${C.rustDark}"/>` +
    `<rect x="${cx - 30}" y="${cy - 20}" width="60" height="20" rx="5" fill="${sale ? C.rust : C.cream}" stroke="${C.rustDark}" stroke-width="2"/>` +
    `<text x="${cx}" y="${cy - 6}" text-anchor="middle" font-family="Lilita One, sans-serif" font-size="11" fill="${sale ? C.cream : C.rustDark}">${sale ? 'FOR SALE' : 'SOON'}</text></g>`
  );
}

function label(p: { x: number; y: number; w: number; h: number }, text: string, lit: boolean): string {
  const cx = p.x + p.w / 2;
  const y = p.y + p.h - 4;
  const width = Math.max(60, text.length * 7.2 + 14);
  return (
    `<rect x="${cx - width / 2}" y="${y - 13}" width="${width}" height="17" rx="8.5" fill="${lit ? C.cream : '#e7e3dc'}" stroke="${lit ? C.rustDark : C.lockedDark}" stroke-width="1.5"/>` +
    `<text x="${cx}" y="${y}" text-anchor="middle" font-family="Lilita One, sans-serif" font-size="11.5" fill="${lit ? C.ink : C.lockedDark}">${esc(text)}</text>`
  );
}

function youAreHere(p: { x: number; y: number; w: number; h: number }): string {
  const cx = p.x + p.w - 22;
  const cy = p.y + 18;
  return (
    `<g class="pin"><path d="M${cx} ${cy + 16} C ${cx - 4} ${cy + 8}, ${cx - 11} ${cy + 3}, ${cx - 11} ${cy - 4} a 11 11 0 0 1 22 0 c 0 7 -7 12 -11 20 z" fill="${C.rust}" stroke="${C.cream}" stroke-width="2"/>` +
    `<circle cx="${cx}" cy="${cy - 4}" r="4" fill="${C.cream}"/></g>`
  );
}

/** The whole map as an SVG string. Plots carry `data-biz` so the UI can make them tappable. */
export function cityMapSvg(state: GameState): string {
  const parts: string[] = [ground()];
  for (const id of BUSINESS_IDS) {
    const p = PLOTS[id];
    const status = businessStatus(state, id);
    const lit = status === 'open';
    const tier = businessTier(state, id);
    let art = '';
    if (id === 'scrapyard') art = scrapyardArt(p, tier);
    else if (id === 'garage') art = garageArt(p, lit, tier);
    else if (id === 'carlot') art = carLotArt(p, lit, tier);
    else art = paintShopArt(p, lit, tier);
    const name = businessInfo(id).name;
    parts.push(
      `<g class="plot ${status}" data-biz="${id}" role="img" aria-label="${esc(name)}">${art}${badge(p, status, unlockProgress(state, id))}${label(p, name, lit || status !== 'locked')}${lit ? tierStars(p, tier) : ''}` +
        `${state.businesses.active === id ? youAreHere(p) : ''}</g>`,
    );
  }
  return `<svg class="city-svg" viewBox="0 0 ${MAP_W} ${MAP_H}" xmlns="http://www.w3.org/2000/svg" aria-label="Rust Valley city map">${parts.join('')}</svg>`;
}

export interface MapRow {
  id: BusinessId;
  icon: string;
  name: string;
  status: BusinessStatus;
  active: boolean;
  /** One short line under the name. */
  line: string;
  /** 0..1 towards the unlock goal. */
  progress: number;
  /** Button text, or null for no button. */
  action: string | null;
  /** Map tier 1..3 when open (0 otherwise) and what the next tier needs (P1.1d). */
  tier: number;
  nextTier: string | null;
}

export function mapRows(state: GameState): MapRow[] {
  return BUSINESS_IDS.map((id) => {
    const info = businessInfo(id);
    const status = businessStatus(state, id);
    const active = state.businesses.active === id;
    let line = '';
    let action: string | null = null;
    if (status === 'open') {
      line = active ? 'You are here' : 'Open';
      action = active ? null : 'Go';
    } else if (status === 'locked') {
      line = `Earn ${formatCash(unlockGoal(state, id))} in total to unlock`;
    } else if (status === 'soon') {
      line = 'Unlocked! Opening in the next update';
    } else {
      const fr = perkChip(state, 'franchise');
      line = fr ? `Ready to open · ${fr.label}` : 'Ready to open';
      action = `Open ${formatCash(openCost(state, id))}`;
    }
    return { id, icon: info.icon, name: info.name, status, active, line, progress: unlockProgress(state, id), action, tier: businessTier(state, id), nextTier: nextTierGoal(state, id) };
  });
}
