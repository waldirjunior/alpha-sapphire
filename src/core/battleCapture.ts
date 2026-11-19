import type { PokemonInstance } from './battlePokemon';
import type { Rng } from './statusConditions';

const GEN_SIX_MAX_CATCH_VALUE = 255 * 4096;
const SHAKE_RANDOM_RANGE = 65536;
const SHAKE_EXPONENT = 3 / 16;

/** Threshold for one of the four Gen VI shake checks with an ordinary Poké Ball. */
export function genSixCatchShakeThreshold(target: PokemonInstance): number {
  const hpFactor = (3 * target.maxHp - 2 * target.currentHp) / (3 * target.maxHp);
  const baseCatchValue = Math.floor(hpFactor * 4096 * target.species.catchRate);
  const catchValue = baseCatchValue * statusCatchMultiplier(target);
  const chance = SHAKE_RANDOM_RANGE * (catchValue / GEN_SIX_MAX_CATCH_VALUE) ** SHAKE_EXPONENT;
  return Math.min(SHAKE_RANDOM_RANGE, Math.max(0, chance));
}

export function rollGenSixCapture(target: PokemonInstance, rng: Rng): boolean {
  const threshold = genSixCatchShakeThreshold(target);
  for (let check = 0; check < 4; check += 1) {
    const random = Math.min(0.999999, Math.max(0, rng()));
    if (random * SHAKE_RANDOM_RANGE >= threshold) return false;
  }
  return true;
}

function statusCatchMultiplier(target: PokemonInstance): number {
  const status = target.status?.kind;
  if (status === 'sleep' || status === 'freeze') return 2.5;
  if (status === 'paralysis' || status === 'poison' || status === 'toxic' || status === 'burn') return 1.5;
  return 1;
}
