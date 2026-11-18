import { describe, expect, it } from 'vitest';
import { createInitialState, movePlayer } from './gameState';
import type { MapDefinition } from './types';

const a: MapDefinition = { id: 'a', name: 'A', width: 2, height: 2,
  collisions: [[0, 0], [0, 0]], spawnPos: { x: 1, z: 1 }, warps: [],
  boundaries: [{ targetMapId: 'b', direction: 'right', from: { x: 1, z: 0 }, length: 2,
    offset: { x: -2, z: 0 }, inferred: false }] };
const b: MapDefinition = { ...a, id: 'b', worldOrigin: { x: 2, z: 0 }, boundaries: [] };

describe('continuous boundaries', () => {
  it('crosses one world tile without mutating the current state', () => {
    const state = createInitialState('a', { a });
    const before = structuredClone(state);
    const next = movePlayer(state, 'right', { a, b });
    expect(next.player).toMatchObject({ mapId: 'b', pos: { x: 0, z: 1 }, facing: 'right' });
    expect(state).toEqual(before);
  });
  it('does not cross into a blocked or unloaded destination', () => {
    const state = createInitialState('a', { a });
    expect(movePlayer(state, 'right', { a }).player.pos).toEqual(state.player.pos);
    expect(movePlayer(state, 'right', { a, b: { ...b, collisions: [[1, 1], [1, 1]] } }).player.mapId).toBe('a');
  });
  it('requires the correct direction and half-open span', () => {
    const state = createInitialState('a', { a });
    expect(movePlayer(state, 'up', { a, b }).player.mapId).toBe('a');
    const edge = { ...(a.boundaries ?? [])[0], length: 1 };
    expect(movePlayer(state, 'right', { a: { ...a, boundaries: [edge] }, b }).player.mapId).toBe('a');
  });
  it('crosses the inferred bridge over blocked padding without changing the GR collision grid', () => {
    const source = { ...a, width: 3, collisions: [[1, 0, 0], [1, 0, 0]],
      boundaries: [{ ...(a.boundaries ?? [])[0], direction: 'left' as const, from: { x: 1, z: 0 }, offset: { x: 1, z: 0 }, inferred: true }] };
    const state = createInitialState('a', { a: source });
    expect(movePlayer(state, 'left', { a: source, b }).player).toMatchObject({ mapId: 'b', pos: { x: 1, z: 1 } });
    expect(source.collisions[1][0]).toBe(1);
  });
});
