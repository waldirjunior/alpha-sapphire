import natureTable from '../data/battle/natures.json';

export type NatureStat = 'atk' | 'def' | 'spe' | 'spa' | 'spd';

export interface Nature {
  id: number;
  name: string;
  increased: NatureStat | null;
  decreased: NatureStat | null;
}

interface RawNature {
  id: number;
  name: string;
  increased: string | null;
  decreased: string | null;
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

const RAW_NATURES: readonly RawNature[] = natureTable;
const NATURES: readonly Nature[] = RAW_NATURES.map((raw) => ({
  ...raw,
  increased: toNatureStat(raw.increased, raw.name),
  decreased: toNatureStat(raw.decreased, raw.name),
}));

export const NATURE_COUNT = NATURES.length;

export function getNature(id: number): Nature {
  const nature = NATURES[id];
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
