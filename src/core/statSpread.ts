import type { DexBaseStats } from './dex';
import { applyNature, NATURE_COUNT } from './natures';
import type { Rng } from './statusConditions';

export type StatSpread = Readonly<DexBaseStats>;
export type SpreadStat = keyof DexBaseStats;

export const MAX_IV = 31;
export const MAX_EV_PER_STAT = 252;
export const MAX_EV_TOTAL = 510;
const SPREAD_STATS: readonly SpreadStat[] = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];

export const ZERO_SPREAD: StatSpread = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };

export interface BattleStats {
  maxHp: number;
  attack: number;
  defense: number;
  spAtk: number;
  spDef: number;
  speed: number;
}

function core(base: number, iv: number, ev: number, level: number): number {
  return Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100);
}

/** Gen VI: HP = core + L + 10; demais = floor((core + 5) × natureza). */
export function calculateStats(base: DexBaseStats, level: number, ivs: StatSpread, evs: StatSpread, natureId: number): BattleStats {
  const other = (stat: Exclude<SpreadStat, 'hp'>) => applyNature(core(base[stat], ivs[stat], evs[stat], level) + 5, natureId, stat);
  return {
    maxHp: core(base.hp, ivs.hp, evs.hp, level) + level + 10,
    attack: other('atk'),
    defense: other('def'),
    spAtk: other('spa'),
    spDef: other('spd'),
    speed: other('spe'),
  };
}

export function validateSpread(spread: StatSpread, kind: 'IV' | 'EV'): void {
  const cap = kind === 'IV' ? MAX_IV : MAX_EV_PER_STAT;
  const offending = SPREAD_STATS.find((stat) => !Number.isInteger(spread[stat]) || spread[stat] < 0 || spread[stat] > cap);
  if (offending) throw new RangeError(`${kind} inválido em ${offending}: ${spread[offending]} (esperado 0..${cap}).`);
  const total = SPREAD_STATS.reduce((sum, stat) => sum + spread[stat], 0);
  if (kind === 'EV' && total > MAX_EV_TOTAL) throw new RangeError(`Total de EV ${total} excede ${MAX_EV_TOTAL}.`);
}

/** Soma EVs respeitando 252 por stat e 510 no total, na ordem HP→Spe. */
export function addEvs(current: StatSpread, gained: StatSpread): StatSpread {
  let total = SPREAD_STATS.reduce((sum, stat) => sum + current[stat], 0);
  const next = { ...current };
  for (const stat of SPREAD_STATS) {
    const room = Math.min(MAX_EV_PER_STAT - next[stat], MAX_EV_TOTAL - total);
    const added = Math.max(0, Math.min(gained[stat], room));
    next[stat] += added;
    total += added;
  }
  return next;
}

export function rollIvs(rng: Rng): StatSpread {
  const roll = () => Math.floor(Math.min(0.999999, Math.max(0, rng())) * (MAX_IV + 1));
  return { hp: roll(), atk: roll(), def: roll(), spa: roll(), spd: roll(), spe: roll() };
}

export function rollNature(rng: Rng): number {
  return Math.floor(Math.min(0.999999, Math.max(0, rng())) * NATURE_COUNT);
}
