import type { BattleMove, PokemonInstance } from './battlePokemon';
import type { DexMove } from './dex';
import { statStageMultiplier } from './statStages';
import { rollInRange, type Rng } from './statusConditions';
import { getTypeEffectivenessAgainst, type ElementalType } from './typeChart';

export const STRUGGLE_MOVE_ID = 165;
const STAB = 1.5;
const BURN_PHYSICAL_MULTIPLIER = 0.5;

export function getTypeEffectiveness(moveType: ElementalType, defenderTypes: readonly ElementalType[]): number {
  return getTypeEffectivenessAgainst(moveType, defenderTypes);
}

/** Struggle é "sem tipo" na Gen VI: ignora efetividade e STAB. */
export function moveEffectiveness(move: DexMove, defender: PokemonInstance): number {
  return move.id === STRUGGLE_MOVE_ID ? 1 : getTypeEffectiveness(move.type, defender.species.types);
}

function attackingStat(attacker: PokemonInstance, move: DexMove): number {
  const physical = move.category === 'physical';
  const raw = physical ? attacker.attack : attacker.spAtk;
  const stage = physical ? attacker.stages.atk : attacker.stages.spa;
  return Math.max(1, Math.floor(raw * statStageMultiplier(stage)));
}

function defendingStat(defender: PokemonInstance, move: DexMove): number {
  const physical = move.category === 'physical';
  const raw = physical ? defender.defense : defender.spDef;
  const stage = physical ? defender.stages.def : defender.stages.spd;
  return Math.max(1, Math.floor(raw * statStageMultiplier(stage)));
}

function stabFor(attacker: PokemonInstance, move: DexMove): number {
  return move.id !== STRUGGLE_MOVE_ID && attacker.species.types.includes(move.type) ? STAB : 1;
}

function burnFor(attacker: PokemonInstance, move: DexMove): number {
  return attacker.status?.kind === 'burn' && move.category === 'physical' ? BURN_PHYSICAL_MULTIPLIER : 1;
}

export function calculateDamage(
  attacker: PokemonInstance,
  defender: PokemonInstance,
  move: DexMove,
  rng: Rng = Math.random
): number {
  const effectiveness = moveEffectiveness(move, defender);
  if (effectiveness === 0 || move.power === 0) return 0;
  const ratio = attackingStat(attacker, move) / defendingStat(defender, move);
  const base = Math.floor((((2 * attacker.level) / 5 + 2) * move.power * ratio) / 50) + 2;
  const randomFactor = 0.85 + 0.15 * Math.min(1, Math.max(0, rng()));
  const modifier = stabFor(attacker, move) * effectiveness * burnFor(attacker, move) * randomFactor;
  return Math.max(1, Math.floor(base * modifier));
}

/** Gen V+: golpes 2–5 acertam 2/3 com 35% cada e 4/5 com 15% cada. */
export function rollHitCount(move: BattleMove, rng: Rng): number {
  if (move.hitMax <= 1) return 1;
  if (move.hitMin === move.hitMax) return move.hitMax;
  if (move.hitMin === 2 && move.hitMax === 5) return weightedTwoToFive(rng());
  return rollInRange(move.hitMin, move.hitMax, rng);
}

function weightedTwoToFive(roll: number): number {
  if (roll < 0.35) return 2;
  if (roll < 0.7) return 3;
  if (roll < 0.85) return 4;
  return 5;
}
