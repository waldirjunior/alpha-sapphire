import { fromTables } from './battleTables';
import type { DexSpecies } from './dex';

export interface LevelUpEntry {
  level: number;
  move: number;
}

export type LearnMethod = 'level-up' | 'tm' | 'hm';

// Gen VI: Pokémon selvagens/recém-criados recebem os 4 últimos golpes de level-up até o nível atual.
const MAX_MOVES = 4;

const levelUpByPersonal = fromTables(
  (tables) => new Map<number, readonly LevelUpEntry[]>(tables.learnsets.map((entry) => [entry.personalIndex, entry.levelUp]))
);
const machines = fromTables((tables) => tables.machines);

export function getLevelUpLearnset(species: DexSpecies): readonly LevelUpEntry[] {
  const learnset = levelUpByPersonal().get(species.personalIndex);
  if (!learnset) {
    throw new Error(`Learnset ausente para ${species.name} (personal ${species.personalIndex}).`);
  }
  return learnset;
}

export function getMovesLearnedAtLevel(species: DexSpecies, level: number): number[] {
  return getLevelUpLearnset(species)
    .filter((entry) => entry.level === level)
    .map((entry) => entry.move);
}

export function getDefaultMoveset(species: DexSpecies, level: number): number[] {
  const learned = getLevelUpLearnset(species)
    .filter((entry) => entry.level <= level)
    .map((entry) => entry.move);
  const latestFirst = [...new Set([...learned].reverse())];
  return latestFirst.slice(0, MAX_MOVES).reverse();
}

export function getMachineMoves(species: DexSpecies): { tm: number[]; hm: number[] } {
  return {
    tm: species.tms.map((tm) => machineMove(machines().tmMoves, tm, 'TM')),
    hm: species.hms.map((hm) => machineMove(machines().hmMoves, hm, 'HM')),
  };
}

function machineMove(table: readonly number[], machineNumber: number, label: string): number {
  const move = table[machineNumber - 1];
  if (move === undefined) {
    throw new Error(`${label}${machineNumber} inexistente (esperado 1..${table.length}).`);
  }
  return move;
}

export function findLearnMethods(species: DexSpecies, moveId: number): LearnMethod[] {
  const machines = getMachineMoves(species);
  const methods: LearnMethod[] = [];
  if (getLevelUpLearnset(species).some((entry) => entry.move === moveId)) methods.push('level-up');
  if (machines.tm.includes(moveId)) methods.push('tm');
  if (machines.hm.includes(moveId)) methods.push('hm');
  return methods;
}

export function canLearnMove(species: DexSpecies, moveId: number): boolean {
  return findLearnMethods(species, moveId).length > 0;
}
