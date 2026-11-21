import { pokemonTypes, type BattleMove, type PokemonInstance } from './battlePokemon';
import type { DexMove } from './dex';
import { abilityImmunity, attackingAbilityMultiplier, defendingAbilityMultiplier, movePowerAbilityMultiplier } from './battleAbilities';
import { lifeOrbMultiplier } from './battleHeldItems';
import { statStageMultiplier } from './statStages';
import { rollInRange, type Rng } from './statusConditions';
import { getTypeEffectivenessAgainst, type ElementalType } from './typeChart';
import {
  rockSpecialDefenseMultiplier,
  screenDamageMultiplier,
  weatherPowerMultiplier,
  type BattleScreen,
  type BattleWeather,
} from './battleField';

export const STRUGGLE_MOVE_ID = 165;
// Gen VI: estágio 0 = 1/16, 1 = 1/8, 2 = 1/2, 3+ = sempre; dano crítico ×1.5.
const CRIT_CHANCE_BY_STAGE: readonly number[] = [1 / 16, 1 / 8, 1 / 2, 1];
const CRIT_MULTIPLIER = 1.5;
const CRIT_IMMUNE_ABILITIES: ReadonlySet<string> = new Set(['Battle Armor', 'Shell Armor']);

export interface DamageOptions {
  critical?: boolean;
  weather?: BattleWeather | null;
  weatherSuppressed?: boolean;
  screen?: BattleScreen | null;
}

export function rollCritical(defender: PokemonInstance, move: DexMove, rng: Rng, attacker?: PokemonInstance): boolean {
  if (CRIT_IMMUNE_ABILITIES.has(defender.ability)) return false;
  const modifier = (attacker?.ability === 'Super Luck' ? 1 : 0)
    + (attacker?.heldItem === 'Scope Lens' ? 1 : 0)
    + (attacker?.volatile.focusEnergy ? 2 : 0);
  const stage = Math.min(CRIT_CHANCE_BY_STAGE.length - 1, Math.max(0, move.critStage + modifier));
  const chance = CRIT_CHANCE_BY_STAGE[stage] ?? 1;
  return chance >= 1 || rng() < chance;
}
const BURN_PHYSICAL_MULTIPLIER = 0.5;

export function getTypeEffectiveness(moveType: ElementalType, defenderTypes: readonly ElementalType[]): number {
  return getTypeEffectivenessAgainst(moveType, defenderTypes);
}

/** Struggle é "sem tipo" na Gen VI: ignora efetividade e STAB. */
export function moveEffectiveness(move: DexMove, defender: PokemonInstance): number {
  if (abilityImmunity(defender, move.type)) return 0;
  if (move.type === 'ground' && defender.ability === 'Levitate') return 0;
  if (move.type === 'ground' && (defender.volatile.magnetRiseTurns ?? 0) > 0) return 0;
  return move.id === STRUGGLE_MOVE_ID ? 1 : getTypeEffectiveness(move.type, pokemonTypes(defender));
}

/** Crítico ignora estágios ofensivos negativos do atacante e defensivos positivos do alvo. */
function attackingStat(attacker: PokemonInstance, move: DexMove, critical: boolean): number {
  const physical = move.category === 'physical';
  const raw = physical ? attacker.attack : attacker.spAtk;
  const rawStage = physical ? attacker.stages.atk : attacker.stages.spa;
  const stage = critical ? Math.max(0, rawStage) : rawStage;
  return Math.max(1, Math.floor(raw * statStageMultiplier(stage) * attackingAbilityMultiplier(attacker, move)));
}

function defendingStat(
  defender: PokemonInstance,
  move: DexMove,
  critical: boolean,
  weather: BattleWeather | null,
  weatherSuppressed: boolean
): number {
  const physical = move.category === 'physical';
  const raw = physical ? defender.defense : defender.spDef;
  const rawStage = physical ? defender.stages.def : defender.stages.spd;
  const stage = critical ? Math.min(0, rawStage) : rawStage;
  const sandstormBoost = physical ? 1 : rockSpecialDefenseMultiplier(defender, weather, weatherSuppressed);
  return Math.max(1, Math.floor(raw * statStageMultiplier(stage) * sandstormBoost * defendingAbilityMultiplier(defender)));
}

function stabFor(attacker: PokemonInstance, move: DexMove): number {
  if (move.id === STRUGGLE_MOVE_ID || !pokemonTypes(attacker).includes(move.type)) return 1;
  return attacker.ability === 'Adaptability' ? 2 : 1.5;
}

function burnFor(attacker: PokemonInstance, move: DexMove): number {
  if (attacker.ability === 'Guts' && attacker.status) return 1;
  return attacker.status?.kind === 'burn' && move.category === 'physical' ? BURN_PHYSICAL_MULTIPLIER : 1;
}

function starterAbilityFor(attacker: PokemonInstance, move: DexMove): number {
  if (attacker.currentHp * 3 > attacker.maxHp) return 1;
  const boosts: Readonly<Record<string, ElementalType>> = { Blaze: 'fire', Torrent: 'water', Overgrow: 'grass' };
  return boosts[attacker.ability] === move.type ? 1.5 : 1;
}

export function calculateDamage(
  attacker: PokemonInstance,
  defender: PokemonInstance,
  move: DexMove,
  rng: Rng = Math.random,
  { critical = false, weather = null, weatherSuppressed = false, screen = null }: DamageOptions = {}
): number {
  const effectiveness = moveEffectiveness(move, defender);
  if (effectiveness === 0 || move.power === 0) return 0;
  const ratio = attackingStat(attacker, move, critical) / defendingStat(defender, move, critical, weather, weatherSuppressed);
  const power = move.power * movePowerAbilityMultiplier(attacker, move);
  const base = Math.floor((((2 * attacker.level) / 5 + 2) * power * ratio) / 50) + 2;
  const randomFactor = 0.85 + 0.15 * Math.min(1, Math.max(0, rng()));
  const critMultiplier = critical ? attackerCriticalMultiplier(attacker) : 1;
  const weatherMultiplier = weatherPowerMultiplier(move.type, weather, weatherSuppressed);
  const screenMultiplier = screenDamageMultiplier(screen, move.category, critical);
  const modifier = critMultiplier * stabFor(attacker, move) * effectiveness * burnFor(attacker, move)
    * starterAbilityFor(attacker, move) * lifeOrbMultiplier(attacker) * weatherMultiplier * screenMultiplier * randomFactor;
  return Math.max(1, Math.floor(base * modifier));
}

function attackerCriticalMultiplier(attacker: PokemonInstance): number {
  return attacker.ability === 'Sniper' ? 2.25 : CRIT_MULTIPLIER;
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
