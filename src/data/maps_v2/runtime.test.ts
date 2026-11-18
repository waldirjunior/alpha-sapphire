import { describe, expect, it, vi } from 'vitest';
import { createInitialState } from '../../core/gameState';
import type { MapDefinition } from '../../core/types';
import { createMapRepository, startingMapId, saveStorageKey } from './runtime';

const source: MapDefinition = { id: 'zone_0006', name: 'A', width: 2, height: 2,
  collisions: [[0, 0], [0, 0]], spawnPos: { x: 0, z: 0 },
  warps: [{ from: { x: 1, z: 0 }, targetMapId: 'zone_0223', targetPos: { x: 0, z: 0 } }] };
const target: MapDefinition = { ...source, id: 'zone_0223', warps: [] };

describe('zone map repository', () => {
  it('loads a destination before committing a move and never fetches the whole graph', async () => {
    const get = vi.fn().mockResolvedValue(target);
    const repo = createMapRepository(get, { [source.id]: source });
    const start = createInitialState(source.id, repo.maps);
    const next = await repo.move(start, 'right');
    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith(target.id);
    expect(next.player.mapId).toBe(target.id);
    expect(start.player.mapId).toBe(source.id);
    expect(await repo.load(target.id)).toBe(target);
    expect(get).toHaveBeenCalledTimes(1);
  });
  it('keeps the original state on failure and supports legacy maps without fetching JSON', async () => {
    const get = vi.fn().mockRejectedValue(new Error('offline'));
    const repo = createMapRepository(get, { [source.id]: source });
    const start = createInitialState(source.id, repo.maps);
    await expect(repo.move(start, 'right')).rejects.toThrow('offline');
    expect(start.player.mapId).toBe(source.id);
    expect(await repo.load(source.id)).toBe(source);
    expect(startingMapId('')).toBe('zone_0006');
    expect(startingMapId('?maps=legacy')).toBe('littleroot_town');
    expect(saveStorageKey('')).toBe('alpha_sapphire_web_save_v2');
    expect(saveStorageKey('?maps=legacy')).toBe('alpha_sapphire_web_save_v1');
  });
});
