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
  /** Slug estável usado por mapas, saves e engine (ex.: "treecko", "sceptile-1" para formas). */
  id: string;
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
  /** Categoria de efeito da ROM (MoveQuality do pk3DS; ver battle-tables.md). */
  quality: number;
  hitMin: number;
  hitMax: number;
  /** Condição infligida (0 nenhuma, 1 paralisia, 2 sono, 3 congelamento, 4 queimadura, 5 veneno, 6+ voláteis). */
  inflict: number;
  inflictPercent: number;
  turnMin: number;
  turnMax: number;
  flinchPercent: number;
  /** >0 = dreno (% do dano), <0 = recuo (% do dano). */
  recoilPercent: number;
  /** Byte com sinal: >0 = cura (% do HP máx.), <0 = dano ao usuário (% do HP máx., ex.: Struggle). */
  healPercent: number;
  target: number;
  statChanges: readonly DexStatChange[];
}

export interface DexStatChange {
  /** 1 atk, 2 def, 3 spa, 4 spd, 5 spe, 6 accuracy, 7 evasion, 8 todos (atk..spe). */
  stat: number;
  stages: number;
  /** 0 = garantido. */
  percent: number;
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
  quality: number;
  hitMin: number;
  hitMax: number;
  inflict: number;
  inflictPercent: number;
  turnMin: number;
  turnMax: number;
  flinchPercent: number;
  recoilPercent: number;
  healing: number;
  target: number;
  statChanges: readonly DexStatChange[];
}

const MOVE_CATEGORIES: readonly DexMoveCategory[] = ['status', 'physical', 'special'];

function toMoveCategory(value: string, moveName: string): DexMoveCategory {
  const category = MOVE_CATEGORIES.find((candidate) => candidate === value);
  if (!category) {
    throw new Error(`Categoria inválida "${value}" no golpe ${moveName} (esperado ${MOVE_CATEGORIES.join('/')}).`);
  }
  return category;
}

function speciesSlug(name: string, form: number): string {
  const base = normalizeName(name.replace('♀', 'f').replace('♂', 'm'));
  return form === 0 ? base : `${base}-${form}`;
}

function toDexSpecies(raw: RawSpecies): DexSpecies {
  const { species, types, ...rest } = raw;
  return {
    ...rest,
    id: speciesSlug(raw.name, raw.form),
    dexNumber: species,
    types: [...new Set(types.map(toElementalType))],
  };
}

function toSignedByte(value: number): number {
  return value > 127 ? value - 256 : value;
}

function toDexMove(raw: RawMove): DexMove {
  const { healing, ...rest } = raw;
  return {
    ...rest,
    healPercent: toSignedByte(healing),
    type: toElementalType(raw.type),
    category: toMoveCategory(raw.category, raw.name),
  };
}

const RAW_SPECIES: readonly RawSpecies[] = speciesTable;
const RAW_MOVES: readonly RawMove[] = moveTable;

const SPECIES_BY_PERSONAL = new Map(RAW_SPECIES.map((raw) => [raw.personalIndex, toDexSpecies(raw)]));
const SPECIES_BY_DEX_FORM = new Map([...SPECIES_BY_PERSONAL.values()].map((s) => [`${s.dexNumber}:${s.form}`, s]));
const SPECIES_BY_ID = indexBySlug([...SPECIES_BY_PERSONAL.values()]);

function indexBySlug(entries: readonly DexSpecies[]): ReadonlyMap<string, DexSpecies> {
  const index = new Map<string, DexSpecies>();
  for (const species of entries) {
    const clash = index.get(species.id);
    if (clash) {
      throw new Error(`Slug de espécie duplicado "${species.id}": personal ${clash.personalIndex} e ${species.personalIndex}.`);
    }
    index.set(species.id, species);
  }
  return index;
}
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

export function getSpeciesById(id: string): DexSpecies {
  const species = SPECIES_BY_ID.get(id);
  if (!species) {
    throw new Error(`Espécie desconhecida: id "${id}" (esperado slug como "treecko" ou "sceptile-1").`);
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
