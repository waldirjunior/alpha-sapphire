import type { PokemonInstance } from './battlePokemon';
import type { Rng } from './statusConditions';

const GEN_SIX_MAX_CATCH_VALUE = 255 * 4096;
const SHAKE_RANDOM_RANGE = 65536;
const SHAKE_EXPONENT = 3 / 16;
const CRITICAL_CAPTURE_ROLL_RANGE = 256;

const CRITICAL_CAPTURE_MULTIPLIERS = [
  { maxCaught: 30, multiplier: 0 }, { maxCaught: 150, multiplier: 0.5 },
  { maxCaught: 300, multiplier: 1 }, { maxCaught: 450, multiplier: 1.5 },
  { maxCaught: 600, multiplier: 2 }, { maxCaught: Infinity, multiplier: 2.5 },
] as const;

/** Threshold for one of the four Gen VI shake checks with an ordinary Poké Ball. */
export function genSixCatchShakeThreshold(target: PokemonInstance): number {
  const catchValue = modifiedCatchValue(target);
  const chance = SHAKE_RANDOM_RANGE * (catchValue / GEN_SIX_MAX_CATCH_VALUE) ** SHAKE_EXPONENT;
  return Math.min(SHAKE_RANDOM_RANGE, Math.max(0, chance));
}

export function genSixCriticalCaptureOdds(target: PokemonInstance, caughtSpeciesCount: number): number {
  const caught = Math.max(0, caughtSpeciesCount);
  const multiplier = CRITICAL_CAPTURE_MULTIPLIERS.find((entry) => caught <= entry.maxCaught)?.multiplier ?? 2.5;
  return Math.min(CRITICAL_CAPTURE_ROLL_RANGE, Math.floor((modifiedCatchValue(target) * multiplier) / (6 * 4096)));
}

export function rollGenSixCapture(target: PokemonInstance, rng: Rng, caughtSpeciesCount = 0): boolean {
  const threshold = genSixCatchShakeThreshold(target);
  if (isCriticalCapture(target, rng, caughtSpeciesCount)) return rollShake(threshold, rng);
  for (let check = 0; check < 4; check += 1) {
    if (!rollShake(threshold, rng)) return false;
  }
  return true;
}

function isCriticalCapture(target: PokemonInstance, rng: Rng, caughtSpeciesCount: number): boolean {
  const odds = genSixCriticalCaptureOdds(target, caughtSpeciesCount);
  return odds > 0 && Math.min(0.999999, Math.max(0, rng())) * CRITICAL_CAPTURE_ROLL_RANGE < odds;
}

function rollShake(threshold: number, rng: Rng): boolean {
  return Math.min(0.999999, Math.max(0, rng())) * SHAKE_RANDOM_RANGE < threshold;
}

function modifiedCatchValue(target: PokemonInstance): number {
  const hpFactor = (3 * target.maxHp - 2 * target.currentHp) / (3 * target.maxHp);
  const baseCatchValue = Math.floor(hpFactor * 4096 * target.species.catchRate);
  return baseCatchValue * statusCatchMultiplier(target);
}

function statusCatchMultiplier(target: PokemonInstance): number {
  const status = target.status?.kind;
  if (status === 'sleep' || status === 'freeze') return 2.5;
  if (status === 'paralysis' || status === 'poison' || status === 'toxic' || status === 'burn') return 1.5;
  return 1;
}
