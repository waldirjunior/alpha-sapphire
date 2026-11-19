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

type LateralLedgeMap = MapDefinition & {
  lateralLedges: (GridPosition & { direction: 'left' | 'right' })[];
};

function lateralLedgeMap(direction: 'left' | 'right'): LateralLedgeMap {
  const collisions = Array.from({ length: 5 }, () => Array<number>(5).fill(0));
  collisions[2][2] = 1;
  return { id: 'field', name: 'Observed lateral ledge', width: 5, height: 5,
    spawnPos: { x: 2, z: 2 }, collisions, warps: [],
    lateralLedges: [{ x: 2, z: 2, direction }] };
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

describe('observed lateral ledge movement', () => {
  it.each([
    { direction: 'right' as const, start: { x: 1, z: 2 }, input: 'right' as const,
      landing: { x: 3, z: 2 }, blockedStart: { x: 3, z: 2 }, blockedInput: 'left' as const },
    { direction: 'left' as const, start: { x: 3, z: 2 }, input: 'left' as const,
      landing: { x: 1, z: 2 }, blockedStart: { x: 1, z: 2 }, blockedInput: 'right' as const },
  ])('jumps two cells only along the observed $direction normal', ({ direction, start, input, landing, blockedStart, blockedInput }) => {
    const map = lateralLedgeMap(direction), maps = { field: map };
    const state = { ...createInitialState('field', maps), player: { ...createInitialState('field', maps).player, pos: start } };
    const before = structuredClone({ state, map });

    expect(movePlayer(state, input, maps).player.pos).toEqual(landing);
    expect(movePlayer({ ...state, player: { ...state.player, pos: blockedStart } }, blockedInput, maps).player.pos)
      .toEqual(blockedStart);
    expect(map.collisions[2][2]).toBe(1);
    expect({ state, map }).toEqual(before);
  });

  it('rejects visible actors on the skipped ledge and the landing tile', () => {
    const map = lateralLedgeMap('right'), maps = { field: map };
    const start = { ...createInitialState('field', maps), player: {
      ...createInitialState('field', maps).player, pos: { x: 1, z: 2 },
    } };
    for (const pos of [{ x: 2, z: 2 }, { x: 3, z: 2 }]) {
      map.npcs = [blocker(pos)];
      expect(movePlayer(start, 'right', maps).player.pos).toEqual(start.player.pos);
      map.npcs[0].visible = false;
      expect(movePlayer(start, 'right', maps).player.pos).toEqual({ x: 3, z: 2 });
    }
  });
});
