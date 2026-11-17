import moveTable from '../data/battle/moves.json';
import speciesTable from '../data/battle/species.json';
import { toElementalType, type ElementalType } from './typeChart';

export interface DexBaseStats {
  hp: number;
  atk: number;
  def: number;
  spa: number;
  spd: number;
  spe: number;
}

export interface DexSpecies {
  personalIndex: number;
  dexNumber: number;
  form: number;
  name: string;
  types: readonly ElementalType[];
  baseStats: DexBaseStats;
  abilities: readonly string[];
  growthRate: string;
  eggGroups: readonly string[];
  catchRate: number;
  baseExp: number;
  tms: readonly number[];
  hms: readonly number[];
}

export type DexMoveCategory = 'status' | 'physical' | 'special';

export interface DexMove {
  id: number;
  name: string;
  type: ElementalType;
  category: DexMoveCategory;
  power: number;
  /** 101 = nunca erra (convenção da ROM, A-010). */
  accuracy: number;
  pp: number;
  priority: number;
}

interface RawSpecies {
  personalIndex: number;
  species: number;
  form: number;
  name: string;
  types: readonly string[];
  baseStats: DexBaseStats;
  abilities: readonly string[];
  growthRate: string;
  eggGroups: readonly string[];
  catchRate: number;
  baseExp: number;
  tms: readonly number[];
  hms: readonly number[];
}

interface RawMove {
  id: number;
  name: string;
  type: string;
  category: string;
  power: number;
  accuracy: number;
  pp: number;
  priority: number;
}

const MOVE_CATEGORIES: readonly DexMoveCategory[] = ['status', 'physical', 'special'];

function toMoveCategory(value: string, moveName: string): DexMoveCategory {
  const category = MOVE_CATEGORIES.find((candidate) => candidate === value);
  if (!category) {
    throw new Error(`Categoria inválida "${value}" no golpe ${moveName} (esperado ${MOVE_CATEGORIES.join('/')}).`);
  }
  return category;
}

function toDexSpecies(raw: RawSpecies): DexSpecies {
  const { species, types, ...rest } = raw;
  return { ...rest, dexNumber: species, types: [...new Set(types.map(toElementalType))] };
}

function toDexMove(raw: RawMove): DexMove {
  const { id, name, power, accuracy, pp, priority } = raw;
  return { id, name, power, accuracy, pp, priority, type: toElementalType(raw.type), category: toMoveCategory(raw.category, name) };
}

const RAW_SPECIES: readonly RawSpecies[] = speciesTable;
const RAW_MOVES: readonly RawMove[] = moveTable;

const SPECIES_BY_PERSONAL = new Map(RAW_SPECIES.map((raw) => [raw.personalIndex, toDexSpecies(raw)]));
const SPECIES_BY_DEX_FORM = new Map([...SPECIES_BY_PERSONAL.values()].map((s) => [`${s.dexNumber}:${s.form}`, s]));
const MOVES_BY_ID = new Map(RAW_MOVES.map((raw) => [raw.id, toDexMove(raw)]));
const MOVES_BY_NAME = new Map([...MOVES_BY_ID.values()].map((move) => [normalizeName(move.name), move]));

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function getSpeciesByPersonalIndex(personalIndex: number): DexSpecies {
  const species = SPECIES_BY_PERSONAL.get(personalIndex);
  if (!species) {
    throw new Error(`Índice personal desconhecido: ${personalIndex} (esperado 0..${SPECIES_BY_PERSONAL.size - 1}).`);
  }
  return species;
}

export function getSpeciesByDex(dexNumber: number, form = 0): DexSpecies {
  const species = SPECIES_BY_DEX_FORM.get(`${dexNumber}:${form}`);
  if (!species) {
    throw new Error(`Espécie desconhecida: dex ${dexNumber} forma ${form}.`);
  }
  return species;
}

export function getMoveById(moveId: number): DexMove {
  const move = MOVES_BY_ID.get(moveId);
  if (!move) {
    throw new Error(`Golpe desconhecido: id ${moveId} (esperado 1..${MOVES_BY_ID.size - 1}).`);
  }
  return move;
}

/** Aceita "Water Gun", "water_gun" ou "watergun". */
export function getMoveByName(name: string): DexMove {
  const move = MOVES_BY_NAME.get(normalizeName(name));
  if (!move) {
    throw new Error(`Golpe desconhecido: "${name}".`);
  }
  return move;
}
