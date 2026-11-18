import { describe, expect, it } from 'vitest';
import { createInitialState, movePlayer } from './gameState';
import type { MapDefinition } from './types';

const a: MapDefinition = { id: 'a', name: 'A', width: 4, height: 4,
  collisions: [[0, 1, 0, 0], [0, 1, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
  spawnPos: { x: 0, z: 1 }, warps: [{ from: { x: 1, z: 0 }, width: 2, height: 2,
    targetMapId: 'b', targetPos: { x: 1, z: 1 }, faceDirection: 'left', transitionEffect: 3 }] };
const b: MapDefinition = { ...a, id: 'b', name: 'B', warps: [] };

describe('rectangular warps', () => {
  it('enters a rectangle on its second row even if its GR permission is blocked', () => {
    const next = movePlayer(createInitialState('a', { a }), 'right', { a, b });
    expect(next.player).toMatchObject({ mapId: 'b', pos: { x: 1, z: 1 }, facing: 'left' });
  });
  it('does not step into an unloaded destination and does not mutate the state', () => {
    const start = createInitialState('a', { a });
    const copy = structuredClone(start);
    expect(movePlayer(start, 'right', { a }).player.mapId).toBe('a');
    expect(start).toEqual(copy);
  });
  it('does not bounce back when moving within the arrival rectangle', () => {
    const start = createInitialState('a', { a });
    start.player.pos = { x: 1, z: 1 };
    const next = movePlayer(start, 'right', { a, b });
    expect(next.player).toMatchObject({ mapId: 'a', pos: { x: 2, z: 1 } });
  });
});
