import { afterEach, describe, expect, it } from 'vitest';
import { getLocale, pickLocale, registerLocale, setLocale, t } from '../src/i18n';
import { en } from '../src/i18n/en';
import { taskLabel } from '../src/ui/dailyView';

describe('i18n', () => {
  afterEach(() => setLocale('en'));

  it('fills parameters and picks plural forms', () => {
    expect(t('daily.reset', { wait: '5h 12m' })).toBe('New tasks in 5h 12m');
    expect(t('daily.contract', { count: 1 })).toBe('Finish 1 job');
    expect(t('daily.contract', { count: 3 })).toBe('Finish 3 jobs');
    expect(taskLabel('sell', 5)).toBe('💰 Sell 5 cars');
  });

  it('falls back to English for missing keys and to the key itself when unknown', () => {
    registerLocale('xx', { 'daily.sell': 'Verkaufe {count} Autos' });
    setLocale('xx');
    expect(t('daily.sell', { count: 2 })).toBe('Verkaufe 2 Autos');
    expect(t('daily.crush', { count: 2 })).toBe('Crush 2 wrecks');
    expect(t('nope' as never)).toBe('nope');
  });

  it('keeps unknown placeholders visible and ignores unsupported locales', () => {
    expect(t('daily.reset')).toBe('New tasks in {wait}');
    setLocale('zz');
    expect(getLocale()).toBe('en');
    expect(pickLocale(['fr-CA', 'en-GB'])).toBe('en');
  });

  it('every plural key has both forms and every placeholder is a word', () => {
    const keys = Object.keys(en);
    for (const k of keys.filter((x) => x.endsWith('_one'))) expect(keys).toContain(k.replace(/_one$/, '_other'));
    for (const v of Object.values(en)) expect(v.replace(/\{\w+\}/g, '')).not.toMatch(/[{}]/);
  });

  it('settings and map texts come from the catalog (P1.9b)', () => {
    expect(t('settings.title')).toBe('Settings');
    expect(t('settings.reset.title')).toBe('Start over?');
    expect(t('map.row.buy', { cost: '$100K' })).toBe('Open $100K');
    expect(t('map.row.readyPerk', { perk: 'x' })).toBe('Ready to open · x');
    expect(t('map.rival.wins', { count: 1 })).toMatch(/1 time$/);
    expect(t('map.rival.wins', { count: 2 })).toMatch(/2 times$/);
  });

  it('contract and barn card texts come from the catalog (P1.9b)', () => {
    expect(t('ui.barn.locked', { count: 1 })).toMatch(/1 more sale$/);
    expect(t('ui.barn.locked', { count: 3 })).toMatch(/3 more sales$/);
    expect(t('ui.contract.reward', { reward: '$5', time: '2m' })).toBe('Reward $5 · 2m left');
    expect(t('ui.barn.next', { intro: '', name: 'Weld', value: '$9' })).toBe('Next: Weld. Sells for about $9');
    expect(t('ui.claim', { reward: '$1' })).toBe('Claim $1');
  });

  it('aria labels, banners and toasts come from the catalog (P1.9b)', () => {
    expect(t('aria.nodeBuy', { name: 'Grip', cost: 3 })).toBe('Grip: buy for 3 Legacy Points');
    expect(t('aria.nodeCost', { name: 'Grip', cost: 3 })).toBe('Grip: costs 3 Legacy Points');
    expect(t('aria.tier', { n: 2, max: 3 })).toBe('Tier 2 of 3');
    expect(t('aria.mapBtn', { city: 'Motor City' })).toBe('Motor City map');
    expect(t('toast.medal', { icon: '🥉', name: 'Crusher', cash: '$9', gems: t('toast.medal.gems', { n: 2 }) })).toBe('🥉 Crusher: +$9 · +2 💎');
    expect(t('toast.medal', { icon: '🥉', name: 'Crusher', cash: '$9', gems: '' })).toBe('🥉 Crusher: +$9');
    expect(t('banner.empire')).toBe('EMPIRE FOR SALE!');
  });
});

describe('daily card texts', () => {
  it('builds the calendar and task texts from the catalog', () => {
    expect(t('daily.cal.day', { n: 3, total: 7 })).toBe('Day 3/7');
    expect(t('daily.claim', { reward: '$5K' })).toBe('Claim $5K');
    expect(t('daily.task.bonus', { count: 3, cash: '$9K' })).toBe(' · all 3: +$9K');
    expect(t('daily.cal.tomorrow', { what: '$1K' })).toBe('Tomorrow: $1K');
  });
});
