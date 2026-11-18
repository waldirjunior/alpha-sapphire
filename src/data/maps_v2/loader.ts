import type { MapDefinition } from '../../core/types';
import { adaptZoneMap, type ZoneMapSource } from './adapter';
import { getZoneEncounters } from './encounters';
import { zonePlacement } from './neighbors';

export type ZoneMapLoader = (zoneId: number | string) => Promise<MapDefinition>;

export function zoneMapId(zoneId: number | string): string {
  const id = typeof zoneId === 'number' ? `zone_${String(zoneId).padStart(4, '0')}` : zoneId;
  if (!/^zone_\d{4}$/.test(id) || Number(id.slice(5)) > 535) throw new Error(`Identificador de zona inválido: ${zoneId}`);
  return id;
}

export function createZoneMapLoader(
  files: Record<string, () => Promise<ZoneMapSource>>,
  enrich: (source: ZoneMapSource, map: MapDefinition) => Promise<MapDefinition> = async (_source, map) => map
): ZoneMapLoader {
  const cache = new Map<string, Promise<MapDefinition>>();
  return async (zoneId) => {
    const id = zoneMapId(zoneId);
    const existing = cache.get(id);
    if (existing) return existing;
    const load = files[`./${id.slice(5)}.json`];
    if (!load) throw new Error(`JSON da zona ${id} não encontrado`);
    const pending = load().then((source) => {
      if (source.id !== id) throw new Error(`JSON da zona ${id} contém ${source.id}`);
      return enrich(source, adaptZoneMap(source));
    });
    cache.set(id, pending);
    pending.catch(() => cache.delete(id));
    return pending;
  };
}

export const getZoneMap = createZoneMapLoader(
  import.meta.glob<ZoneMapSource>('./[0-9][0-9][0-9][0-9].json', { import: 'default' }),
  async (source, map) => ({ ...map, ...zonePlacement(source.id), encounters: await getZoneEncounters(source.zone) })
);
