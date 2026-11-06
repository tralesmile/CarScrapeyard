import { describe, expect, it } from 'vitest';
import { ECON } from '../src/core/config';
import { newGame } from '../src/core/state';
import { businessTier, nextTierGoal } from '../src/core/businesses';
import { cityMapSvg, mapRows, PLOTS, MAP_H, MAP_W } from '../src/ui/cityMap';

const T0 = 1_800_000_000_000;

/** Every opened tag is closed in order (catches broken string building). */
function balanced(svg: string): boolean {
  const stack: string[] = [];
  for (const m of svg.matchAll(/<(\/?)([a-zA-Z]+)[^>]*?(\/?)>/g)) {
    const [, close, name, self] = m;
    if (self) continue;
    if (close) {
      if (stack.pop() !== name) return false;
    } else stack.push(name!);
  }
  return stack.length === 0;
}

describe('city map', () => {
  it('draws every business plot inside the map, without overlaps', () => {
    const ids = Object.keys(PLOTS) as (keyof typeof PLOTS)[];
    for (const id of ids) {
      const p = PLOTS[id];
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.x + p.w).toBeLessThanOrEqual(MAP_W);
      expect(p.y + p.h).toBeLessThanOrEqual(MAP_H);
    }
    for (const a of ids)
      for (const b of ids) {
        if (a === b) continue;
        const A = PLOTS[a];
        const B = PLOTS[b];
        const overlap = A.x < B.x + B.w && B.x < A.x + A.w && A.y < B.y + B.h && B.y < A.y + A.h;
        expect(overlap, `${a} overlaps ${b}`).toBe(false);
      }
  });

  it('builds well-formed SVG with one tappable plot per business and the pin on the active one', () => {
    const s = newGame(T0, 1);
    const svg = cityMapSvg(s);
    expect(balanced(svg)).toBe(true);
    for (const id of Object.keys(ECON.businesses.list)) expect(svg).toContain(`data-biz="${id}"`);
    expect(svg.match(/class="pin"/g)?.length).toBe(1);
    const scrapyard = svg.slice(svg.indexOf('data-biz="scrapyard"'), svg.indexOf('data-biz="garage"'));
    expect(scrapyard).toContain('class="pin"');
    expect(svg).not.toMatch(/NaN|undefined/);
  });

  it('a locked plot shows a padlock whose ring fills with progress', () => {
    const s = newGame(T0, 1);
    s.lifetimeEarnings = ECON.businesses.list.garage.unlockLifetime / 2;
    const svg = cityMapSvg(s);
    const garage = svg.slice(svg.indexOf('data-biz="garage"'), svg.indexOf('data-biz="carlot"'));
    expect(garage).toContain('class="lock"');
    const dash = /stroke-dasharray="([\d.]+) ([\d.]+)"/.exec(garage)!;
    expect(Number(dash[1]) / Number(dash[2])).toBeCloseTo(0.5, 2);
  });

  it('rows: scrapyard is "You are here", the garage shows its goal, then its price; the car lot shows "soon"', () => {
    const s = newGame(T0, 1);
    let rows = mapRows(s);
    expect(rows.map((r) => r.id)).toEqual(['scrapyard', 'garage', 'carlot', 'paint']);
    expect(rows[0]).toMatchObject({ status: 'open', active: true, line: 'You are here', action: null });
    expect(rows[1]!.status).toBe('locked');
    expect(rows[1]!.line).toBe('Earn $200K in total to unlock');
    s.lifetimeEarnings = ECON.businesses.list.garage.unlockLifetime;
    rows = mapRows(s);
    expect(rows[1]).toMatchObject({ status: 'forSale', action: 'Open $100K', line: 'Ready to open' });
    let svg = cityMapSvg(s);
    expect(svg.slice(svg.indexOf('data-biz="garage"'), svg.indexOf('data-biz="carlot"'))).toContain('FOR SALE');
    // A business whose loop is not built yet (the Used Car Lot) shows "soon" once its goal is reached.
    s.lifetimeEarnings = ECON.businesses.list.carlot.unlockLifetime;
    rows = mapRows(s);
    expect(rows[2]).toMatchObject({ status: 'soon', action: null });
    svg = cityMapSvg(s);
    expect(svg.slice(svg.indexOf('data-biz="carlot"'), svg.indexOf('data-biz="paint"'))).toContain('SOON');
  });

  it('map tiers (P1.1d): businesses grow with lot slots and repair bays; closed ones have no tier', () => {
    const s = newGame(T0, 1);
    expect(businessTier(s, 'scrapyard')).toBe(1);
    expect(businessTier(s, 'garage')).toBe(0);
    expect(nextTierGoal(s, 'scrapyard')).toBe('3 lot slots');
    expect(nextTierGoal(s, 'garage')).toBeNull();
    s.slots = 2;
    expect(businessTier(s, 'scrapyard')).toBe(1);
    s.slots = 3;
    expect(businessTier(s, 'scrapyard')).toBe(2);
    expect(nextTierGoal(s, 'scrapyard')).toBe('4 lot slots');
    s.slots = 4;
    expect(businessTier(s, 'scrapyard')).toBe(3);
    expect(nextTierGoal(s, 'scrapyard')).toBeNull();
    s.businesses.opened.garage = true;
    expect(businessTier(s, 'garage')).toBe(1);
    expect(nextTierGoal(s, 'garage')).toBe('2 repair bays');
    s.garage.bays = 3;
    expect(businessTier(s, 'garage')).toBe(3);
    // The tier tops out at 3 and every reachable size maps into 1..3.
    for (let n = 1; n <= 4; n++) {
      s.slots = n;
      expect(businessTier(s, 'scrapyard')).toBeGreaterThanOrEqual(1);
      expect(businessTier(s, 'scrapyard')).toBeLessThanOrEqual(3);
    }
    // Lot slots can actually reach tier 3 (start + every slot bought).
    expect(ECON.slots.start + ECON.slots.costs.length).toBeGreaterThanOrEqual(ECON.businesses.tiers.scrapyard[1]);
  });

  it('the map draws each open business with stars for its tier and more on the plot per tier', () => {
    const s = newGame(T0, 1);
    s.businesses.opened.garage = true;
    s.lifetimeEarnings = ECON.businesses.list.garage.unlockLifetime;
    const plot = (svg: string, id: string, next: string) => svg.slice(svg.indexOf(`data-biz="${id}"`), svg.indexOf(`data-biz="${next}"`));
    let svg = cityMapSvg(s);
    expect(balanced(svg)).toBe(true);
    expect(plot(svg, 'scrapyard', 'garage')).toContain('data-tier="1"');
    expect(plot(svg, 'scrapyard', 'garage').match(/class="star on"/g)?.length).toBe(1);
    expect(plot(svg, 'garage', 'carlot')).not.toContain('class="t2"');
    // Locked businesses show no stars.
    expect(plot(svg, 'carlot', 'paint')).not.toContain('class="tier"');
    s.slots = 4;
    s.garage.bays = 2;
    svg = cityMapSvg(s);
    expect(balanced(svg)).toBe(true);
    expect(plot(svg, 'scrapyard', 'garage').match(/class="star on"/g)?.length).toBe(3);
    expect(plot(svg, 'scrapyard', 'garage')).toContain('class="t3"');
    expect(plot(svg, 'garage', 'carlot')).toContain('class="t2"');
    expect(plot(svg, 'garage', 'carlot')).not.toContain('class="t3"');
    const rows = mapRows(s);
    expect(rows[0]).toMatchObject({ tier: 3, nextTier: null });
    expect(rows[1]).toMatchObject({ tier: 2, nextTier: '3 repair bays' });
    expect(rows[2]).toMatchObject({ tier: 0, nextTier: null });
  });
});
