import type { DexSpecies } from './dex';

export type GrowthRate = 'medium_fast' | 'erratic' | 'fluctuating' | 'medium_slow' | 'fast' | 'slow';

export const MAX_LEVEL = 100;
const TRAINER_BONUS = 1.5;
// Gen VI volta à fórmula plana de XP (sem escala por nível, diferente da Gen V/VII).
const FLAT_FORMULA_DIVISOR = 7;

const GROWTH_RATES: readonly GrowthRate[] = ['medium_fast', 'erratic', 'fluctuating', 'medium_slow', 'fast', 'slow'];

export function toGrowthRate(value: string): GrowthRate {
  const rate = GROWTH_RATES.find((candidate) => candidate === value);
  if (!rate) {
    throw new Error(`Curva de XP desconhecida: "${value}" (esperado ${GROWTH_RATES.join('/')}).`);
  }
  return rate;
}

function erratic(n: number): number {
  const cube = n ** 3;
  if (n < 50) return (cube * (100 - n)) / 50;
  if (n < 68) return (cube * (150 - n)) / 100;
  if (n < 98) return (cube * Math.floor((1911 - 10 * n) / 3)) / 500;
  return (cube * (160 - n)) / 100;
}

function fluctuating(n: number): number {
  const cube = n ** 3;
  if (n < 15) return (cube * (Math.floor((n + 1) / 3) + 24)) / 50;
  if (n < 36) return (cube * (n + 14)) / 50;
  return (cube * (Math.floor(n / 2) + 32)) / 50;
}

const CURVES: Readonly<Record<GrowthRate, (n: number) => number>> = {
  fast: (n) => (4 * n ** 3) / 5,
  medium_fast: (n) => n ** 3,
  medium_slow: (n) => (6 / 5) * n ** 3 - 15 * n ** 2 + 100 * n - 140,
  slow: (n) => (5 * n ** 3) / 4,
  erratic,
  fluctuating,
};

/** XP total acumulado para estar exatamente no nível `level` (nível 1 = 0). */
export function totalExpForLevel(rate: GrowthRate, level: number): number {
  if (level < 1 || level > MAX_LEVEL) {
    throw new RangeError(`Nível fora da curva de XP: ${level} (esperado 1..${MAX_LEVEL}).`);
  }
  return level === 1 ? 0 : Math.floor(CURVES[rate](level));
}

export function levelForTotalExp(rate: GrowthRate, totalExp: number): number {
  let level = 1;
  while (level < MAX_LEVEL && totalExpForLevel(rate, level + 1) <= totalExp) level += 1;
  return level;
}

export interface ExpYieldContext {
  isTrainerBattle: boolean;
  /** Pokémon do time que participaram contra o derrotado e seguem de pé (s da fórmula). */
  participants: number;
}

/** Gen VI: floor(a·b·L / (7·s)); Lucky Egg, troca e Exp. Share ficam fora (P-010). */
export function expYield(defeated: DexSpecies, defeatedLevel: number, context: ExpYieldContext): number {
  const trainerBonus = context.isTrainerBattle ? TRAINER_BONUS : 1;
  const share = Math.max(1, context.participants);
  return Math.max(1, Math.floor((trainerBonus * defeated.baseExp * defeatedLevel) / (FLAT_FORMULA_DIVISOR * share)));
}
