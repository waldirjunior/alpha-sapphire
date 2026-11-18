import { expect, it, vi } from 'vitest';
import type { BoundaryLink, MapDefinition } from '../../core/types';
import { createInitialState } from '../../core/gameState';
import { createMapRepository } from './runtime';

it('preloads one hop, then prepares the next neighborhood before crossing', async () => {
  const edge: BoundaryLink = { from: { x: 1, z: 0 }, direction: 'right', length: 2,
    offset: { x: -2, z: 0 }, targetMapId: 'b', inferred: false };
  const a: MapDefinition = { id: 'a', name: 'A', width: 2, height: 2, collisions: [[0, 0], [0, 0]],
    spawnPos: { x: 1, z: 0 }, warps: [], boundaries: [edge] };
  const b = { ...a, id: 'b', boundaries: [{ ...edge, targetMapId: 'c' }] };
  const c = { ...a, id: 'c', boundaries: [] };
  const get = vi.fn(async (id) => id === 'b' ? b : c);
  const repo = createMapRepository(get, { a });
  await repo.load('a');
  expect(get).toHaveBeenCalledTimes(1);
  expect(get).toHaveBeenCalledWith('b');
  const next = await repo.move(createInitialState('a', repo.maps), 'right');
  expect(next.player.mapId).toBe('b');
  expect(get).toHaveBeenCalledTimes(2);
  expect(repo.maps.c).toBe(c);
});
