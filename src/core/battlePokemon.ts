import { getMoveById, type DexMove, type DexSpecies } from './dex';
import { getDefaultMoveset } from './learnsets';
import { NEUTRAL_STAGES, type StatStages } from './statStages';

export interface BattleMove extends DexMove {
  currentPp: number;
  maxPp: number;
}

export type MajorStatusKind = 'paralysis' | 'sleep' | 'freeze' | 'burn' | 'poison' | 'toxic';

export interface MajorStatus {
  kind: MajorStatusKind;
  /** Sono: tentativas restantes até acordar. Tóxico: multiplicador n/16 do próximo dano residual. */
  counter: number;
}

export interface PokemonInstance {
  species: DexSpecies;
  ability: string;
  level: number;
  xp: number;
  nextLevelXp: number;
  maxHp: number;
  currentHp: number;
  attack: number;
  defense: number;
  spAtk: number;
  spDef: number;
  speed: number;
  moves: BattleMove[];
  status: MajorStatus | null;
  stages: StatStages;
}

const MIN_LEVEL = 1;
const MAX_LEVEL = 100;

function calcStat(base: number, level: number, isHp: boolean): number {
  const scaled = Math.floor((2 * base * level) / 100);
  return isHp ? scaled + level + 10 : scaled + 5;
}

export function toBattleMove(move: DexMove): BattleMove {
  return { ...move, currentPp: move.pp, maxPp: move.pp };
}

function nextLevelXpFor(level: number): number {
  return level * level * 8;
}

export function createPokemonInstance(
  species: DexSpecies,
  level: number,
  moveIds: readonly number[] = getDefaultMoveset(species, level)
): PokemonInstance {
  if (level < MIN_LEVEL || level > MAX_LEVEL) {
    throw new RangeError(`Nível inválido para ${species.name}: ${level} (esperado ${MIN_LEVEL}..${MAX_LEVEL}).`);
  }
  const { hp, atk, def, spa, spd, spe } = species.baseStats;
  const maxHp = calcStat(hp, level, true);
  return {
    species,
    ability: species.abilities[0] ?? '',
    level,
    xp: 0,
    nextLevelXp: nextLevelXpFor(level),
    maxHp,
    currentHp: maxHp,
    attack: calcStat(atk, level, false),
    defense: calcStat(def, level, false),
    spAtk: calcStat(spa, level, false),
    spDef: calcStat(spd, level, false),
    speed: calcStat(spe, level, false),
    moves: moveIds.map((id) => toBattleMove(getMoveById(id))),
    status: null,
    stages: NEUTRAL_STAGES,
  };
}

/** Sai de campo: estágios zeram e o contador do tóxico volta a 1/16 (Gen VI). */
export function withdrawFromBattle(pokemon: PokemonInstance): PokemonInstance {
  const status = pokemon.status?.kind === 'toxic' ? { kind: 'toxic' as const, counter: 1 } : pokemon.status;
  return { ...pokemon, stages: NEUTRAL_STAGES, status };
}

export function restoreAtPokemonCenter(pokemon: PokemonInstance): PokemonInstance {
  return {
    ...pokemon,
    currentHp: pokemon.maxHp,
    status: null,
    stages: NEUTRAL_STAGES,
    moves: pokemon.moves.map((move) => ({ ...move, currentPp: move.maxPp })),
  };
}

export function awardXp(pokemon: PokemonInstance, gainedXp: number): { updated: PokemonInstance; leveledUp: boolean } {
  let xp = pokemon.xp + gainedXp;
  let level = pokemon.level;
  let nextLevelXp = pokemon.nextLevelXp;
  while (xp >= nextLevelXp && level < MAX_LEVEL) {
    xp -= nextLevelXp;
    level += 1;
    nextLevelXp = nextLevelXpFor(level);
  }
  if (level === pokemon.level) {
    return { updated: { ...pokemon, xp }, leveledUp: false };
  }
  return { updated: rebuildForLevel(pokemon, level, xp), leveledUp: true };
}

function rebuildForLevel(pokemon: PokemonInstance, level: number, xp: number): PokemonInstance {
  const rebuilt = createPokemonInstance(pokemon.species, level, pokemon.moves.map((move) => move.id));
  const hpGain = Math.max(0, rebuilt.maxHp - pokemon.maxHp);
  return {
    ...rebuilt,
    ability: pokemon.ability,
    moves: pokemon.moves,
    status: pokemon.status,
    stages: pokemon.stages,
    xp,
    currentHp: Math.min(rebuilt.maxHp, pokemon.currentHp + hpGain),
  };
}
