import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { MapDefinition } from '../core/types';
import { buildTallGrassGroup } from './tallGrass';

function mapWithTerrain(terrain: number[][], worldOrigin?: { x: number; z: number }): MapDefinition {
  const height = terrain.length;
  const width = terrain[0]?.length ?? 0;
  return {
    id: 'zone_0023',
    name: 'Route 101',
    width,
    height,
    collisions: terrain.map((row) => row.map(() => 0)),
    terrain,
    warps: [],
    worldOrigin,
  };
}

describe('buildTallGrassGroup', () => {
  it('returns null when the map has no tall grass cells (terrain === 2)', () => {
    expect(buildTallGrassGroup(mapWithTerrain([[0, 1], [0, 0]]))).toBeNull();
  });

  it('builds instanced grass tufts for every terrain === 2 cell respecting worldOrigin', () => {
    const group = buildTallGrassGroup(mapWithTerrain([[0, 2], [2, 0]], { x: 10, z: 20 }));
    expect(group).not.toBeNull();
    const mesh = group!.children.find((child): child is THREE.InstancedMesh => child instanceof THREE.InstancedMesh);
    expect(mesh).toBeDefined();
    expect(mesh!.count).toBe(8);

    const matrix = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    mesh!.getMatrixAt(0, matrix);
    pos.setFromMatrixPosition(matrix);
    expect(pos.x).toBeGreaterThan(10.5);
    expect(pos.x).toBeLessThan(11.5);
    expect(pos.z).toBeGreaterThan(19.5);
    expect(pos.z).toBeLessThan(20.5);
  });
});
