import { getSpeciesByDex } from '../core/dex';
import { buildZoneEncounterSources, type ZoneEncounterSource } from '../core/wildPokemon';
import { findRosterSpecies } from '../data/pokemon/species';

const ZONE_FILES = import.meta.glob<ZoneEncounterSource>('../data/zones/*.json', { import: 'default' });

export function resolveRosterSpeciesId(dexNumber: number, form: number): string | null {
  const species = getSpeciesByDex(dexNumber, form);
  return findRosterSpecies(species.id) ? species.id : null;
}

export async function loadZoneEncounters(mapIds: readonly string[]): Promise<Record<string, ZoneEncounterSource>> {
  const wanted = Object.entries(ZONE_FILES).filter(([path]) => mapIds.some((mapId) => path.endsWith(`_${mapId}.json`)));
  const zones = await Promise.all(wanted.map(([, load]) => load()));
  const sources = buildZoneEncounterSources(zones);
  for (const mapId of mapIds) {
    const index = wanted.findIndex(([path]) => path.endsWith(`_${mapId}.json`));
    const source = zones[index];
    if (source) sources[mapId] = source;
  }
  return sources;
}
