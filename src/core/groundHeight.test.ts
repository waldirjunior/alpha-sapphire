import { describe, expect, it } from 'vitest';
import type { MapDefinition } from './types';
import { groundHeight, groundedWorldPosition, selectGroundHeight } from './groundHeight';

const map: MapDefinition = {
  id: 'elevated', name: 'Elevated', width: 2, height: 2, collisions: [[0, 0], [0, 0]], warps: [],
  worldOrigin: { x: 80, z: 160 }, groundHeights: [[1, 27], [21, 20.5]],
};

describe('native primary ground heights', () => {
  it('uses the occupied local cell independently of horizontal ROM/world origins', () => {
    expect(groundedWorldPosition({ x: 1, z: 0 }, map)).toEqual({ x: 81, y: 27, z: 160 });
    expect(groundHeight(map, { x: 0, z: 1 })).toBe(21);
    expect(groundHeight(map, { x: 1, z: 1 })).toBe(20.5);
    expect(groundHeight({ ...map, romOrigin: { x: 900, z: 999 } }, { x: 1, z: 0 })).toBe(27);
  });

  it('keeps unknown, out-of-grid and legacy heights distinct from a measured zero', () => {
    const partial = { ...map, groundHeights: [[0, null], [21, 20.5]] };
    expect(groundHeight(partial, { x: 0, z: 0 })).toBe(0);
    expect(groundHeight(partial, { x: 1, z: 0 })).toBeNull();
    expect(groundHeight(partial, { x: -1, z: 0 })).toBeNull();
    expect(groundHeight(partial, { x: 2, z: 0 })).toBeNull();
    expect(groundHeight({ ...map, groundHeights: undefined }, { x: 0, z: 0 })).toBeNull();
    expect(groundedWorldPosition({ x: 1, z: 0 }, partial).y).toBe(0);
  });

  it('selects the physical layer nearest the actor reference height without promoting a floor by order', () => {
    const layered = { ...map, groundHeights: [[1, 0], [21, 20.5]],
      groundHeightCandidates: [{ x: 1, z: 0, heights: [0, 7.5] }] };
    expect(selectGroundHeight(layered, { x: 1, z: 0 }, 0)).toBe(0);
    expect(selectGroundHeight(layered, { x: 1, z: 0 }, 7.4)).toBe(7.5);
    expect(selectGroundHeight(layered, { x: 1, z: 0 }, undefined)).toBe(0);
    expect(groundedWorldPosition({ x: 1, z: 0 }, layered, 7.4).y).toBe(7.5);
  });

  it('keeps the current candidate on an exact tie and falls back to the primary floor when no layer is favored', () => {
    const layered = { ...map, groundHeights: [[1, 0], [21, 20.5]],
      groundHeightCandidates: [{ x: 1, z: 0, heights: [0, 7.5] }] };
    expect(selectGroundHeight(layered, { x: 1, z: 0 }, 7.5)).toBe(7.5);
    expect(selectGroundHeight(layered, { x: 1, z: 0 }, 3.75)).toBe(0);
    expect(selectGroundHeight(layered, { x: 2, z: 0 }, 3.75)).toBeNull();
    expect(selectGroundHeight({ ...layered, groundHeights: [[1, null], [21, 20.5]] }, { x: 1, z: 0 }, 3.75)).toBeNull();
  });
});
