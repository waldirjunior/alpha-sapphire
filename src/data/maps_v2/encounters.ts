import type { ZoneEncounterSlot, ZoneEncounterSource } from '../../core/wildPokemon';

export function createZoneEncounterLoader(files: Record<string, () => Promise<ZoneEncounterSource>>) {
  const cache = new Map<number, Promise<readonly ZoneEncounterSlot[]>>();
  return async (zoneId: number): Promise<readonly ZoneEncounterSlot[]> => {
    const existing = cache.get(zoneId);
    if (existing) return existing;
    const prefix = `${String(zoneId).padStart(3, '0')}_`;
    const entry = Object.entries(files).find(([path]) => path.split('/').pop()?.startsWith(prefix));
    if (!entry) throw new Error(`Encontros da zona ${zoneId}: esperado zones/${prefix}*.json`);
    const pending = entry[1]().then((zone) => zone.encounters.map((slot) => ({ ...slot })));
    cache.set(zoneId, pending);
    pending.catch(() => cache.delete(zoneId));
    return pending;
  };
}

export const getZoneEncounters = createZoneEncounterLoader(
  import.meta.glob<ZoneEncounterSource>('../zones/*.json', { import: 'default' })
);
