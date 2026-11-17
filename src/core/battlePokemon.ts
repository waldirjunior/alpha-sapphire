import { getMoveById, type DexMove, type DexSpecies } from './dex';
import { MAX_LEVEL, toGrowthRate, totalExpForLevel } from './experience';
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
  /** XP total acumulado pela curva real da espécie (A-013). */
  totalExp: number;
  /** XP dentro do nível atual (barra de EXP). */
  xp: number;
  /** XP necessário entre o nível atual e o próximo (0 no nível 100). */
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

function calcStat(base: number, level: number, isHp: boolean): number {
  const scaled = Math.floor((2 * base * level) / 100);
  return isHp ? scaled + level + 10 : scaled + 5;
}

export function toBattleMove(move: DexMove): BattleMove {
  return { ...move, currentPp: move.pp, maxPp: move.pp };
}

export function expProgress(species: DexSpecies, level: number, totalExp: number): { xp: number; nextLevelXp: number } {
  const rate = toGrowthRate(species.growthRate);
  const floor = totalExpForLevel(rate, level);
  const nextLevelXp = level >= MAX_LEVEL ? 0 : totalExpForLevel(rate, level + 1) - floor;
  return { xp: totalExp - floor, nextLevelXp };
}

export function computeStats(species: DexSpecies, level: number): Pick<PokemonInstance, 'maxHp' | 'attack' | 'defense' | 'spAtk' | 'spDef' | 'speed'> {
  const { hp, atk, def, spa, spd, spe } = species.baseStats;
  return {
    maxHp: calcStat(hp, level, true),
    attack: calcStat(atk, level, false),
    defense: calcStat(def, level, false),
    spAtk: calcStat(spa, level, false),
    spDef: calcStat(spd, level, false),
    speed: calcStat(spe, level, false),
  };
}

export function createPokemonInstance(
  species: DexSpecies,
  level: number,
  moveIds: readonly number[] = getDefaultMoveset(species, level)
): PokemonInstance {
  if (level < MIN_LEVEL || level > MAX_LEVEL) {
    throw new RangeError(`Nível inválido para ${species.name}: ${level} (esperado ${MIN_LEVEL}..${MAX_LEVEL}).`);
  }
  const stats = computeStats(species, level);
  const totalExp = totalExpForLevel(toGrowthRate(species.growthRate), level);
  return {
    species,
    ability: species.abilities[0] ?? '',
    level,
    totalExp,
    ...expProgress(species, level, totalExp),
    ...stats,
    currentHp: stats.maxHp,
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
