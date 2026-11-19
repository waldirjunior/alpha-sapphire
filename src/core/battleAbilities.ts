import { tryInflictStatus, type Rng } from './statusConditions';
import type { BattleMove, MajorStatusKind, PokemonInstance } from './battlePokemon';
import type { DexMove } from './dex';
import type { ElementalType } from './typeChart';
import { choiceItemMultiplier, defenseItemMultiplier } from './battleHeldItems';

const POWER_UP_ABILITIES = new Set(['Huge Power', 'Pure Power']);
const CONTACT_STATUS: Readonly<Record<string, MajorStatusKind>> = {
  Static: 'paralysis',
  'Flame Body': 'burn',
  'Poison Point': 'poison',
};

export function attackingAbilityMultiplier(pokemon: PokemonInstance, move: DexMove): number {
  if (move.category !== 'physical') return choiceItemMultiplier(pokemon, move.category);
  const powerMultiplier = POWER_UP_ABILITIES.has(pokemon.ability) ? 2 : 1;
  const gutsMultiplier = pokemon.ability === 'Guts' && pokemon.status ? 1.5 : 1;
  return powerMultiplier * gutsMultiplier * choiceItemMultiplier(pokemon, move.category);
}

export function defendingAbilityMultiplier(pokemon: PokemonInstance): number {
  return defenseItemMultiplier(pokemon);
}

export function movePowerAbilityMultiplier(pokemon: PokemonInstance, move: DexMove): number {
  const technician = pokemon.ability === 'Technician' && move.power > 0 && move.power <= 60 ? 1.5 : 1;
  const flashFire = pokemon.ability === 'Flash Fire' && pokemon.volatile.flashFireActive && move.type === 'fire' ? 1.5 : 1;
  return technician * flashFire;
}

export function stabMultiplier(pokemon: PokemonInstance, move: DexMove): number {
  if (move.id === 165 || !pokemon.species.types.includes(move.type)) return 1;
  return pokemon.ability === 'Adaptability' ? 2 : 1.5;
}

export function abilityImmunity(pokemon: PokemonInstance, type: ElementalType): 'flashFire' | 'waterAbsorb' | 'voltAbsorb' | null {
  if (type === 'fire' && pokemon.ability === 'Flash Fire') return 'flashFire';
  if (type === 'water' && pokemon.ability === 'Water Absorb') return 'waterAbsorb';
  if (type === 'electric' && pokemon.ability === 'Volt Absorb') return 'voltAbsorb';
  return null;
}

export function activateTypeImmunity(
  pokemon: PokemonInstance,
  kind: 'flashFire' | 'waterAbsorb' | 'voltAbsorb'
): { pokemon: PokemonInstance; message: string } {
  if (kind === 'flashFire') {
    return {
      pokemon: { ...pokemon, volatile: { ...pokemon.volatile, flashFireActive: true } },
      message: `Flash Fire de ${pokemon.species.name} absorveu o golpe!`,
    };
  }
  const restored = Math.min(Math.max(1, Math.floor(pokemon.maxHp / 4)), pokemon.maxHp - pokemon.currentHp);
  const healed = { ...pokemon, currentHp: pokemon.currentHp + restored };
  return { pokemon: healed, message: restored > 0 ? `${pokemon.species.name} recuperou ${restored} HP com ${pokemon.ability}!` : `${pokemon.ability} de ${pokemon.species.name} anulou o golpe!` };
}

export function triggerContactAbility(
  defender: PokemonInstance,
  attacker: PokemonInstance,
  move: BattleMove,
  rng: Rng
): { attacker: PokemonInstance; message: string | null } {
  const status = CONTACT_STATUS[defender.ability];
  if (!move.contact || !status || defender.currentHp === 0 || attacker.currentHp === 0 || rng() >= 0.3) {
    return { attacker, message: null };
  }
  const result = tryInflictStatus(attacker, status, move, rng);
  return { attacker: result.target, message: result.message };
}
