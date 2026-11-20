import { tryInflictStatus, type Rng } from './statusConditions';
import type { BattleMove, MajorStatusKind, PokemonInstance } from './battlePokemon';
import type { DexMove } from './dex';
import type { ElementalType } from './typeChart';
import { choiceItemMultiplier, defenseItemMultiplier } from './battleHeldItems';
import { applyStageDelta } from './statStages';

const POWER_UP_ABILITIES = new Set(['Huge Power', 'Pure Power']);
const CONTACT_DAMAGE_ABILITIES = new Set(['Rough Skin', 'Iron Barbs']);
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
  const sheerForce = sheerForceApplies(pokemon, move) ? 1.3 : 1;
  return technician * flashFire * sheerForce;
}

export function sheerForceApplies(pokemon: PokemonInstance, move: DexMove): boolean {
  if (pokemon.ability !== 'Sheer Force' || move.power === 0) return false;
  const userStatMove = move.quality === 7 || move.target === 7;
  const statSecondary = move.statChanges.some((change) => change.stages > 0 || !userStatMove && change.stages < 0);
  return (move.inflict !== 0 && move.inflictPercent > 0) || move.flinchPercent > 0 || statSecondary;
}

export function triggerMoxie(pokemon: PokemonInstance): { pokemon: PokemonInstance; message: string | null } {
  if (pokemon.ability !== 'Moxie') return { pokemon, message: null };
  const raised = applyStageDelta(pokemon.stages, 'atk', 1);
  if (raised.applied === 0) return { pokemon, message: null };
  return {
    pokemon: { ...pokemon, stages: raised.stages },
    message: `${pokemon.species.name} teve o Ataque aumentado por Moxie!`,
  };
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
): { attacker: PokemonInstance; messages: string[] } {
  if (!move.contact || attacker.currentHp === 0) {
    return { attacker, messages: [] };
  }
  const damaged = contactDamage(defender, attacker);
  const next = damaged.pokemon;
  const status = defender.currentHp > 0 ? CONTACT_STATUS[defender.ability] : undefined;
  const statusResult = status && next.currentHp > 0 && next.status === null && rng() < 0.3
    ? tryInflictStatus(next, status, move, rng)
    : { target: next, message: null };
  return { attacker: statusResult.target, messages: [damaged.message, statusResult.message].filter(isMessage) };
}

function contactDamage(defender: PokemonInstance, attacker: PokemonInstance): { pokemon: PokemonInstance; message: string | null } {
  if (!CONTACT_DAMAGE_ABILITIES.has(defender.ability) || attacker.ability === 'Magic Guard') {
    return { pokemon: attacker, message: null };
  }
  const damage = Math.max(1, Math.floor(attacker.maxHp / 8));
  const currentHp = Math.max(0, attacker.currentHp - damage);
  return {
    pokemon: { ...attacker, currentHp },
    message: `${attacker.species.name} sofreu ${attacker.currentHp - currentHp} de dano por ${defender.ability}!`,
  };
}

function isMessage(message: string | null): message is string {
  return message !== null;
}
