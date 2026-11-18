import { describe, expect, it } from 'vitest';
import { createInitialState, isWalkable, movePlayer } from './gameState';
import type { GridPosition, MapDefinition, MapNpc } from './types';

function ledgeMap(): MapDefinition & { southLedges: GridPosition[] } {
  const collisions = Array.from({ length: 5 }, () => Array<number>(5).fill(0));
  collisions[2][2] = 1;
  return { id: 'field', name: 'Synthetic ledge', width: 5, height: 5,
    spawnPos: { x: 2, z: 1 }, collisions, warps: [], southLedges: [{ x: 2, z: 2 }] };
}

function blocker(pos: GridPosition): MapNpc {
  return { id: 'field:npc:1', pos, model: 123, script: 2, spawnFlag: 0, modelUrl: '/synthetic.glb' };
}

describe('south ledge movement', () => {
  it('jumps over the blocked ledge south, but cannot climb north or enter sideways', () => {
    const map = ledgeMap(), maps = { field: map }, start = createInitialState('field', maps);
    const before = structuredClone({ start, map });
    const landed = movePlayer(start, 'down', maps);
    expect(landed.player.pos).toEqual({ x: 2, z: 3 });
    expect(landed.player.facing).toBe('down');
    expect(isWalkable(map, { x: 2, z: 2 })).toBe(false);
    expect(movePlayer(landed, 'up', maps).player.pos).toEqual({ x: 2, z: 3 });
    const beside = { ...start, player: { ...start.player, pos: { x: 1, z: 2 } } };
    expect(movePlayer(beside, 'right', maps).player.pos).toEqual({ x: 1, z: 2 });
    expect({ start, map }).toEqual(before);
  });

  it('does not jump a generic wall or trust a ledge on ordinary floor', () => {
    const map = ledgeMap(), maps = { field: map }, state = createInitialState('field', maps);
    map.southLedges = [];
    expect(movePlayer(state, 'down', maps).player.pos).toEqual(state.player.pos);
    map.southLedges = [{ x: 2, z: 2 }];
    map.collisions[2][2] = 0;
    expect(movePlayer(state, 'down', maps).player.pos).toEqual({ x: 2, z: 2 });
  });

  it('rejects blocked and out-of-bounds landings', () => {
    const map = ledgeMap(), maps = { field: map }, state = createInitialState('field', maps);
    map.collisions[3][2] = 1;
    expect(movePlayer(state, 'down', maps).player.pos).toEqual(state.player.pos);
    map.collisions[3][2] = 0;
    map.height = 3;
    expect(movePlayer(state, 'down', maps).player.pos).toEqual(state.player.pos);
  });

  it('respects visible NPCs on the ledge and landing, without deleting actors', () => {
    const map = ledgeMap(), maps = { field: map }, state = createInitialState('field', maps);
    for (const pos of [{ x: 2, z: 2 }, { x: 2, z: 3 }]) {
      map.npcs = [blocker(pos)];
      expect(movePlayer(state, 'down', maps).player.pos).toEqual(state.player.pos);
      map.npcs[0].visible = false;
      expect(movePlayer(state, 'down', maps).player.pos).toEqual({ x: 2, z: 3 });
      expect(map.npcs).toHaveLength(1);
    }
  });

  it('preserves native warp priority and dialogue blocking', () => {
    const map = ledgeMap(), maps = { field: map }, state = createInitialState('field', maps);
    map.warps = [{ from: { x: 2, z: 2 }, targetMapId: 'field', targetPos: { x: 0, z: 0 } }];
    expect(movePlayer(state, 'down', maps).player.pos).toEqual({ x: 0, z: 0 });
    const dialogue = { ...state, activeDialogue: { sourceId: 'npc', text: 'Wait' } };
    expect(movePlayer(dialogue, 'down', maps)).toBe(dialogue);
  });
});
