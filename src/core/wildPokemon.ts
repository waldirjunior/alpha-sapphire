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

export interface ZoneEncounterSource {
  name: string;
  encounters: readonly ZoneEncounterSlot[];
}

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

/**
 * Agrega slots iguais em uma entrada com peso = nº de slots. As taxas reais por slot do ORAS
 * ainda não foram extraídas (P-010), então cada slot vale 1.
 */
export function grassTableFromZone(zone: ZoneEncounterSource, resolve: EncounterSpeciesResolver): WildEncounterEntry[] {
  const entries = new Map<string, WildEncounterEntry>();
  for (const slot of grassSlots(zone.encounters)) {
    const speciesId = resolve(slot.species, slot.form);
    if (!speciesId) continue;
    const key = `${speciesId}:${slot.levelMin}:${slot.levelMax}`;
    const current = entries.get(key);
    entries.set(key, current
      ? { ...current, weight: current.weight + 1 }
      : { speciesId, minLevel: slot.levelMin, maxLevel: slot.levelMax, weight: 1 });
  }
  return [...entries.values()];
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
