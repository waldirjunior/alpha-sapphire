import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { zoneActorModelUrl, type ZoneMapSource } from './adapter';

// Contrato dos 536 JSONs que o runtime consome. Falha aqui = o pipeline gerou um mapa que o jogo não sabe usar.

const DIR = path.resolve('src/data/maps_v2');
const ZONES = new Map(readdirSync(DIR).filter((file) => /^\d{4}\.json$/.test(file))
  .map((file) => JSON.parse(readFileSync(path.join(DIR, file), 'utf8')) as ZoneMapSource)
  .map((zone) => [zone.id, zone]));

type Cell = { x: number; z: number };
const inside = (zone: ZoneMapSource, { x, z }: Cell): boolean => x >= 0 && z >= 0 && x < zone.width && z < zone.height;

function hasShape(grid: readonly (readonly unknown[])[] | undefined, zone: ZoneMapSource): boolean {
  return grid !== undefined && grid.length === zone.height && grid.every((row) => row.length === zone.width);
}

function zonesFailing(check: (zone: ZoneMapSource) => boolean): string[] {
  return [...ZONES.values()].filter((zone) => !check(zone)).map((zone) => zone.id);
}

function cellValues(grid: readonly (readonly number[])[]): Set<number> {
  return new Set(grid.flat());
}

describe('zone map contracts', () => {
  it('covers every zone of the ROM with a matching id', () => {
    expect(ZONES.size).toBe(536);
    expect(zonesFailing((zone) => zone.id === `zone_${String(zone.zone).padStart(4, '0')}`)).toEqual([]);
  });

  it('keeps every grid at the declared width × height', () => {
    expect(zonesFailing((zone) => hasShape(zone.collisions, zone))).toEqual([]);
    expect(zonesFailing((zone) => hasShape(zone.terrain, zone))).toEqual([]);
    expect(zonesFailing((zone) => hasShape(zone.groundHeights, zone))).toEqual([]);
  });

  it('uses only the cell codes the core understands', () => {
    expect(zonesFailing((zone) => [...cellValues(zone.collisions)].every((value) => value === 0 || value === 1))).toEqual([]);
    expect(zonesFailing((zone) => [...cellValues(zone.terrain)].every((value) => value >= 0 && value <= 2))).toEqual([]);
  });

  it('spawns the player on a walkable cell', () => {
    expect(zonesFailing(({ spawnPos, ...zone }) => spawnPos !== null && inside({ ...zone, spawnPos }, spawnPos) && zone.collisions[spawnPos.z][spawnPos.x] === 0)).toEqual([]);
  });

  it('points every warp at an existing zone', () => {
    const dangling = [...ZONES.values()].flatMap((zone) => zone.warps.filter((warp) => !ZONES.has(warp.targetMapId)).map((warp) => `${zone.id}→${warp.targetMapId}`));
    expect(dangling).toEqual([]);
  });

  it('keeps south ledges inside their zone', () => {
    expect(zonesFailing((zone) => (zone.southLedges ?? []).every((ledge) => inside(zone, ledge)))).toEqual([]);
  });

  it('keeps lateral ledges on blocked cells and observed Surf tiles on raw GR floor', () => {
    expect(zonesFailing((zone) => (zone.lateralLedges ?? []).every((ledge) =>
      inside(zone, ledge) && zone.collisions[ledge.z][ledge.x] === 1 &&
      (ledge.direction === 'left' || ledge.direction === 'right')))).toEqual([]);
    expect(zonesFailing((zone) => (zone.surfTiles ?? []).every((tile) =>
      inside(zone, tile) && zone.collisions[tile.z][tile.x] === 0))).toEqual([]);
  });

  it('resolves every actor model ID across all 536 zones to a valid MM index (0..509)', () => {
    const invalid = [...ZONES.values()].flatMap((zone) =>
      zone.npcs
        .map((npc) => ({ id: `${zone.id}#${npc.id}`, model: npc.model, url: zoneActorModelUrl(npc.model) }))
        .filter(({ url }) => {
          const match = /^\/assets\/characters\/mm_(\d{4})\.glb$/.exec(url);
          return !match || Number(match[1]) > 509;
        }),
    );
    expect(invalid).toEqual([]);
  });
});

// Anomalias herdadas da ROM/pipeline (P-017). Os números são catraca: mudar exige explicar no PRD de mapas.
describe('known zone anomalies (P-017)', () => {
  it('has warps outside the grid only in the zones already catalogued', () => {
    const origins = [...ZONES.values()].flatMap((zone) => zone.warps.filter((warp) => !inside(zone, warp.from)).map(() => zone.id));
    const arrivals = [...ZONES.values()].flatMap((zone) => zone.warps
      .filter((warp) => { const target = ZONES.get(warp.targetMapId); return target !== undefined && !inside(target, warp.targetPos); })
      .map(() => zone.id));
    expect({ origins: origins.length, arrivals: arrivals.length }).toEqual({ origins: 48, arrivals: 48 });
  });

  it('has actors outside the grid only in the zones already catalogued', () => {
    const offMap = [...ZONES.values()].flatMap((zone) => zone.npcs.filter((npc) => !inside(zone, npc.pos)).map((npc) => `${zone.id}#${npc.id}`));
    expect(offMap).toEqual(['zone_0023#11', 'zone_0044#13', 'zone_0177#0', 'zone_0221#3']);
  });
});
