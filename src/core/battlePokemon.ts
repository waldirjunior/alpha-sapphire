import { getMoveById, type DexMove, type DexSpecies } from './dex';
import { MAX_LEVEL, toGrowthRate, totalExpForLevel } from './experience';
import { getDefaultMoveset } from './learnsets';
import { calculateStats, validateSpread, ZERO_SPREAD, type BattleStats, type StatSpread } from './statSpread';
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
  ivs: StatSpread;
  evs: StatSpread;
  nature: number;
  friendship: number;
  /** Valor de personalidade (Wurmple usa (PV >> 16) % 10 para decidir a evolução). */
  personality: number;
  heldItem: string | null;
}

export interface PokemonCreationOptions {
  ivs?: StatSpread;
  evs?: StatSpread;
  nature?: number;
  personality?: number;
  heldItem?: string | null;
}

const MIN_LEVEL = 1;

export function toBattleMove(move: DexMove): BattleMove {
  return { ...move, currentPp: move.pp, maxPp: move.pp };
}

export function expProgress(species: DexSpecies, level: number, totalExp: number): { xp: number; nextLevelXp: number } {
  const rate = toGrowthRate(species.growthRate);
  const floor = totalExpForLevel(rate, level);
  const nextLevelXp = level >= MAX_LEVEL ? 0 : totalExpForLevel(rate, level + 1) - floor;
  return { xp: totalExp - floor, nextLevelXp };
}

export function computeStats(pokemon: Pick<PokemonInstance, 'species' | 'level' | 'ivs' | 'evs' | 'nature'>): BattleStats {
  return calculateStats(pokemon.species.baseStats, pokemon.level, pokemon.ivs, pokemon.evs, pokemon.nature);
}

/** Recalcula stats (nível/EV/espécie) preservando o dano já sofrido. */
export function refreshStats(pokemon: PokemonInstance): PokemonInstance {
  const stats = computeStats(pokemon);
  const hpDelta = stats.maxHp - pokemon.maxHp;
  return { ...pokemon, ...stats, currentHp: Math.max(0, Math.min(stats.maxHp, pokemon.currentHp + Math.max(0, hpDelta))) };
}

export function createPokemonInstance(
  species: DexSpecies,
  level: number,
  moveIds: readonly number[] = getDefaultMoveset(species, level),
  options: PokemonCreationOptions = {}
): PokemonInstance {
  if (level < MIN_LEVEL || level > MAX_LEVEL) {
    throw new RangeError(`Nível inválido para ${species.name}: ${level} (esperado ${MIN_LEVEL}..${MAX_LEVEL}).`);
  }
  const ivs = options.ivs ?? ZERO_SPREAD;
  const evs = options.evs ?? ZERO_SPREAD;
  validateSpread(ivs, 'IV');
  validateSpread(evs, 'EV');
  const nature = options.nature ?? 0;
  const stats = computeStats({ species, level, ivs, evs, nature });
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
    ivs,
    evs,
    nature,
    friendship: species.baseFriendship,
    personality: options.personality ?? 0,
    heldItem: options.heldItem ?? null,
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
