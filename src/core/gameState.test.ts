import { describe, expect, it } from 'vitest';
import { createInitialState, movePlayer } from './gameState';
import type { MapDefinition } from './types';

const TEST_MAPS: Record<string, MapDefinition> = {
  littleroot_town: {
    id: 'littleroot_town',
    name: 'Littleroot Town',
    width: 10,
    height: 10,
    collisions: Array.from({ length: 10 }, (_, z) =>
      Array.from({ length: 10 }, (_, x) => (x === 0 || z === 0 ? 1 : 0))
    ),
    warps: [
      {
        from: { x: 5, z: 1 },
        targetMapId: 'route_101',
        targetPos: { x: 5, z: 8 },
      },
    ],
  },
  route_101: {
    id: 'route_101',
    name: 'Route 101',
    width: 10,
    height: 10,
    collisions: Array.from({ length: 10 }, () => Array(10).fill(0)),
    warps: [],
  },
};

describe('gameState', () => {
  it('moves player on walkable tiles and respects collisions', () => {
    let state = createInitialState();
    state = movePlayer(state, 'right', TEST_MAPS);
    expect(state.player.pos).toEqual({ x: 6, z: 5 });

    // Move to blocked border x=0
    state.player.pos = { x: 1, z: 5 };
    state = movePlayer(state, 'left', TEST_MAPS);
    expect(state.player.pos).toEqual({ x: 1, z: 5 });
    expect(state.player.facing).toBe('left');
  });

  it('triggers warp transition between maps', () => {
    const state = createInitialState();
    state.player.pos = { x: 5, z: 2 };
    const next = movePlayer(state, 'up', TEST_MAPS);
    expect(next.player.mapId).toBe('route_101');
    expect(next.player.pos).toEqual({ x: 5, z: 8 });
  });
});
