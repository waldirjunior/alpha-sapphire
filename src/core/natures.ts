import { fromTables, type RawNature } from './battleTables';

export type NatureStat = 'atk' | 'def' | 'spe' | 'spa' | 'spd';

export interface Nature {
  id: number;
  name: string;
  increased: NatureStat | null;
  decreased: NatureStat | null;
}

const NATURE_STATS: readonly NatureStat[] = ['atk', 'def', 'spe', 'spa', 'spd'];
// Multiplicadores em décimos para evitar erro de ponto flutuante (0.9 × 50 ≠ 45 em IEEE 754).
const BOOST_TENTHS = 11;
const DROP_TENTHS = 9;

function toNatureStat(value: string | null, natureName: string): NatureStat | null {
  if (value === null) return null;
  const stat = NATURE_STATS.find((candidate) => candidate === value);
  if (!stat) throw new Error(`Stat de natureza inválido "${value}" em ${natureName} (esperado ${NATURE_STATS.join('/')}).`);
  return stat;
}

export const NATURE_COUNT = 25;

function toNature(raw: RawNature): Nature {
  return { ...raw, increased: toNatureStat(raw.increased, raw.name), decreased: toNatureStat(raw.decreased, raw.name) };
}

const natures = fromTables((tables) => {
  if (tables.natures.length !== NATURE_COUNT) {
    throw new Error(`natures.json com ${tables.natures.length} entradas (esperado ${NATURE_COUNT}).`);
  }
  return tables.natures.map(toNature);
});

export function getNature(id: number): Nature {
  const nature = natures()[id];
  if (!nature) throw new RangeError(`Natureza desconhecida: ${id} (esperado 0..${NATURE_COUNT - 1}).`);
  return nature;
}

function natureTenths(natureId: number, stat: NatureStat): number {
  const nature = getNature(natureId);
  if (nature.increased === stat) return BOOST_TENTHS;
  if (nature.decreased === stat) return DROP_TENTHS;
  return 10;
}

/** floor(valor × 1.1 / 0.9 / 1.0) conforme a natureza. */
export function applyNature(value: number, natureId: number, stat: NatureStat): number {
  return Math.floor((value * natureTenths(natureId, stat)) / 10);
}
