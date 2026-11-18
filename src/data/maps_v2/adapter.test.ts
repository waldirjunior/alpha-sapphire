import { describe, expect, it, vi } from 'vitest';
import { adaptZoneMap, type ZoneMapSource } from './adapter';
import { createZoneMapLoader } from './loader';

const fixture: ZoneMapSource = {
  schemaVersion: 2, id: 'zone_0006', zone: 6, name: 'Synthetic', width: 2, height: 2,
  collisions: [[0, 1], [0, 0]], terrain: [[0, 1], [2, 0]],
  spawnPos: { x: 0, z: 0 }, spawnDerived: true, spawnPolicy: 'first-walkable-tile',
  warps: [{ from: { x: 1, z: 0 }, targetMapId: 'zone_0223', targetPos: { x: 1, z: 1 },
    width: 1, height: 2, rom: { faceDirection: 1, transitionEffect: 3 } }],
  npcs: [{ id: 4, model: 289, script: 14, spawnFlag: 0, faceDirection: 2, pos: { x: 1, z: 1 } }],
  encounters: [{ species: 261, form: 0, levelMin: 2, levelMax: 3 }],
  source: { chunks: [{ grId: 6, localTile: { x: -10, z: 0 } }] },
};

describe('zone map adapter', () => {
  it('preserves coordinates, rectangular warps, encounters and derived spawn without mutating source', () => {
    const copy = structuredClone(fixture);
    const map = adaptZoneMap(fixture);
    expect(map.spawnDerived).toBe(true);
    expect(map.zoneId).toBe(6);
    expect(map.warps[0]).toMatchObject({ width: 1, height: 2, faceDirection: 'up', transitionEffect: 3 });
    expect(map.npcs?.[0]).toMatchObject({ modelUrl: '/assets/characters/mm_0289.glb', facing: 'left', script: 14 });
    expect(map.modelChunks).toEqual([{ modelUrl: '/assets/maps/gr_0006/gr_0006.glb', offset: { x: -10, z: 0 } }]);
    expect(map.encounters).toEqual(fixture.encounters);
    expect(fixture).toEqual(copy);
  });

  it('rejects mismatched grids and invalid warp dimensions', () => {
    expect(() => adaptZoneMap({ ...fixture, width: 3 })).toThrow(/zone_0006/);
    expect(() => adaptZoneMap({ ...fixture, warps: [{ ...fixture.warps[0], width: 0 }] })).toThrow(/warp/);
  });

  it('copies extracted south ledges without opening collisions and rejects invalid coordinates', () => {
    const source = { ...fixture, southLedges: [{ x: 1, z: 0 }] };
    const map = adaptZoneMap(source);
    expect(map.southLedges).toEqual(source.southLedges);
    expect(map.southLedges).not.toBe(source.southLedges);
    expect(map.collisions).toEqual(source.collisions);
    for (const pos of [{ x: 2, z: 0 }, { x: 0, z: 0 }, { x: 1.5, z: 0 }]) {
      expect(() => adaptZoneMap({ ...source, southLedges: [pos] })).toThrow(/ledge/);
    }
  });

  it('loads only the requested JSON, deduplicates requests and retries failures', async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(fixture);
    const unused = vi.fn();
    const get = createZoneMapLoader({ './0006.json': load, './0007.json': unused });
    await expect(get(6)).rejects.toThrow('offline');
    const [a, b] = await Promise.all([get(6), get('zone_0006')]);
    expect(a).toBe(b);
    expect(load).toHaveBeenCalledTimes(2);
    expect(unused).not.toHaveBeenCalled();
    await expect(get(7)).rejects.toThrow();
    await expect(get('littleroot_town')).rejects.toThrow(/zona/);
  });
});
