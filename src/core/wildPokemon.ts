import type { WildEncounterEntry } from '../data/pokemon/route101';
import { createPokemonInstance, type PokemonInstance } from './battlePokemon';
import type { DexSpecies } from './dex';
import { rollIvs, rollNature } from './statSpread';
import type { Rng } from './statusConditions';

const UINT32 = 0x1_0000_0000;

/** RNG determinístico (mulberry32) para testes e sementes de sessão. */
export function createSeededRng(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / UINT32;
  };
}

/** Selvagens e times de treinador: IVs, natureza e personalidade sorteados pelo RNG injetado. */
export function generatePokemon(species: DexSpecies, level: number, rng: Rng): PokemonInstance {
  const ivs = rollIvs(rng);
  const nature = rollNature(rng);
  const personality = Math.floor(Math.min(0.999999, Math.max(0, rng())) * UINT32);
  return createPokemonInstance(species, level, undefined, { ivs, nature, personality });
}

export interface ZoneEncounterSlot {
  species: number;
  form: number;
  levelMin: number;
  levelMax: number;
}

export type EncounterMethod =
  | 'grass'
  | 'tall_grass'
  | 'swarm'
  | 'surf'
  | 'rock_smash'
  | 'old_rod'
  | 'good_rod'
  | 'super_rod'
  | 'horde_a'
  | 'horde_b'
  | 'horde_c';

export interface ZoneEncounterSource {
  name: string;
  encounterFormat?: 'oras-61-slot-v1';
  encounters: readonly ZoneEncounterSlot[];
}

export interface EncounterSubtableSlot extends ZoneEncounterSlot {
  slotIndex: number;
  methodSlot: number;
  slotRate: number | null;
}

export interface EncounterSubtable {
  method: EncounterMethod;
  tableRate: number | null;
  slots: EncounterSubtableSlot[];
}

interface EncounterSectionDefinition {
  method: EncounterMethod;
  count: number;
  slotRates: readonly number[] | null;
  tableRate: number | null;
}

// A-117: ZO preserves 61 raw slots; pk3DS RSWE.cs defines group order and RSWE.Designer.cs displays rates.
const ORAS_ENCOUNTER_SECTIONS: readonly EncounterSectionDefinition[] = [
  { method: 'grass', count: 12, slotRates: [10, 10, 10, 10, 10, 10, 10, 10, 10, 5, 4, 1], tableRate: null },
  { method: 'tall_grass', count: 12, slotRates: [10, 10, 10, 10, 10, 10, 10, 10, 10, 5, 4, 1], tableRate: null },
  { method: 'swarm', count: 3, slotRates: null, tableRate: null },
  { method: 'surf', count: 5, slotRates: [50, 30, 15, 4, 1], tableRate: null },
  { method: 'rock_smash', count: 5, slotRates: [50, 30, 15, 4, 1], tableRate: null },
  { method: 'old_rod', count: 3, slotRates: [60, 35, 5], tableRate: null },
  { method: 'good_rod', count: 3, slotRates: [60, 35, 5], tableRate: null },
  { method: 'super_rod', count: 3, slotRates: [60, 35, 5], tableRate: null },
  { method: 'horde_a', count: 5, slotRates: null, tableRate: 60 },
  { method: 'horde_b', count: 5, slotRates: null, tableRate: 35 },
  { method: 'horde_c', count: 5, slotRates: null, tableRate: 5 },
];

/** Resolve (dex, forma) para o id usado pelo jogo; `null` descarta (ex.: espécie sem modelo .glb). */
export type EncounterSpeciesResolver = (dexNumber: number, form: number) => string | null;

export function mapIdForZoneName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

/** Primeira sub-tabela do ZO (grama): slots até o primeiro `species = 0` (A-009). */
function grassSlots(encounters: readonly ZoneEncounterSlot[]): ZoneEncounterSlot[] {
  const end = encounters.findIndex((slot) => slot.species === 0);
  return [...encounters.slice(0, end < 0 ? encounters.length : end)];
}

export function encounterSubtableFromZone(zone: ZoneEncounterSource, method: EncounterMethod): EncounterSubtable {
  const section = ORAS_ENCOUNTER_SECTIONS.find((candidate) => candidate.method === method);
  if (!section) throw new Error(`Subtabela de encontro desconhecida: ${method}`);

  const start = ORAS_ENCOUNTER_SECTIONS.slice(0, ORAS_ENCOUNTER_SECTIONS.indexOf(section))
    .reduce((total, candidate) => total + candidate.count, 0);
  if (zone.encounterFormat !== 'oras-61-slot-v1') {
    const legacySlots = method === 'grass' ? grassSlots(zone.encounters) : [];
    return { method, tableRate: null, slots: legacySlots.map((slot, methodSlot) => ({
      ...slot, slotIndex: methodSlot, methodSlot, slotRate: null,
    })) };
  }
  if (zone.encounters.length !== 61) {
    throw new Error(`Encontros ${zone.name}: formato oras-61-slot-v1 exige 61 slots, recebeu ${zone.encounters.length}`);
  }

  const slots = Array.from({ length: section.count }, (_, methodSlot) => {
    const slot = zone.encounters[start + methodSlot];
    return slot ? {
      ...slot,
      slotIndex: start + methodSlot,
      methodSlot,
      slotRate: section.slotRates?.[methodSlot] ?? null,
    } : undefined;
  }).filter((slot): slot is EncounterSubtableSlot => slot !== undefined);
  return { method, tableRate: section.tableRate, slots };
}

/** Constrói uma tabela por método usando as probabilidades dos slots extraídas para ORAS. */
export function encounterTableFromZone(
  zone: ZoneEncounterSource,
  method: EncounterMethod,
  resolve: EncounterSpeciesResolver
): WildEncounterEntry[] {
  const subtable = encounterSubtableFromZone(zone, method);
  const entries = new Map<string, WildEncounterEntry>();
  for (const slot of subtable.slots) {
    const weight = slot.slotRate ?? (zone.encounterFormat === 'oras-61-slot-v1' ? 0 : 1);
    if (slot.species === 0 || weight <= 0) continue;
    const speciesId = resolve(slot.species, slot.form);
    if (!speciesId) continue;
    const key = `${speciesId}:${slot.levelMin}:${slot.levelMax}`;
    const current = entries.get(key);
    entries.set(key, current
      ? { ...current, weight: current.weight + weight }
      : { speciesId, minLevel: slot.levelMin, maxLevel: slot.levelMax, weight });
  }
  return [...entries.values()];
}

export function grassTableFromZone(zone: ZoneEncounterSource, resolve: EncounterSpeciesResolver): WildEncounterEntry[] {
  return encounterTableFromZone(zone, 'grass', resolve);
}

/** Uma tabela por mapa: vale a primeira zona do mesmo nome com grama não vazia. */
export function buildZoneEncounterTables(
  zones: readonly ZoneEncounterSource[],
  resolve: EncounterSpeciesResolver
): Record<string, WildEncounterEntry[]> {
  const tables: Record<string, WildEncounterEntry[]> = {};
  for (const zone of zones) {
    const mapId = mapIdForZoneName(zone.name);
    if (tables[mapId]) continue;
    const table = grassTableFromZone(zone, resolve);
    if (table.length > 0) tables[mapId] = table;
  }
  return tables;
}

export function resolveEncounterTable(
  mapId: string,
  zoneTables: Readonly<Record<string, WildEncounterEntry[]>>,
  fallback: Readonly<Record<string, WildEncounterEntry[]>>
): WildEncounterEntry[] | undefined {
  return zoneTables[mapId] ?? fallback[mapId];
}
